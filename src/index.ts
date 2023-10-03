import { PrismaClient } from "@prisma/client";
import {
	PrismaClientInitializationError,
	PrismaClientKnownRequestError,
	PrismaClientRustPanicError,
	PrismaClientUnknownRequestError,
	PrismaClientValidationError,
} from "@prisma/client/runtime/library.js";
import Elysia from "elysia";
import fs from "fs";
import { getCacheInformationFromHeaders } from "helpers/cache/cache";
import { useJavascriptMapCacheStore } from "helpers/cache/map";
import "helpers/loadenv";
import { joinAction, transformSingleAction } from "helpers/transformAction";
import {
	transformData,
	transformResponse,
	transformSelection,
	transformValues,
} from "helpers/transformValues";
import { IncomingHttpHeaders } from "http";
import https from "https";
import { Input, any, array, object, parse, string } from "valibot";

const cache = useJavascriptMapCacheStore();

const TOKEN = process.env.TOKEN;
const PORT = 3000;
const startMessage = `🔅 Server is listening on port ${PORT}`;

const prisma = new PrismaClient();
await prisma.$connect();

const bodySchema = object({
	action: string(),
	modelName: string(),
	query: object({
		arguments: object({
			where: any(),
			data: any(),
			take: any(),
			distinct: any(),
			orderBy: any(),
			skip: any(),
			create: any(),
			update: any(),
		}),
		selection: any(),
	}),
});
const batchBodySchema = object({
	batch: array(bodySchema),
});

export type RequestBodySingle = Input<typeof bodySchema>;
export type RequestBodyBatch = Input<typeof batchBodySchema>;
export type RequestBody = RequestBodySingle | RequestBodyBatch;

function convertToPrismaQuery(body: RequestBodySingle) {
	return {
		...body.query.arguments,
		select: body.query.selection,
	};
}

function isValidBody(body: any): asserts body is RequestBody {
	try {
		parse(bodySchema, body);
	} catch (e) {
		try {
			parse(batchBodySchema, body);
		} catch (e) {
			throw new Error(`Invalid request body. ${(e as any).message}`);
		}
	}
}

function transformBody(body: RequestBody) {
	if ("batch" in body) {
		const transformed = body.batch.map(transformBody);
		body.batch = transformed as Exclude<
			typeof body.batch,
			RequestBodyBatch
		>;
		return body;
	}
	// body = transformAction(body);
	body.query.arguments = transformValues(body.query.arguments);
	body.query.selection = transformSelection(body.query.selection);
	body.query.arguments.data = transformData(body.query.arguments.data);
	return body;
}

export async function executeQuery(body: RequestBody) {
	type PrismaError = {
		error: string;
		user_facing_error: {
			is_panic: boolean;
			message: string;
		};
	};
	function newError(message: string, isPanic = true): PrismaError {
		return {
			error: message,
			user_facing_error: {
				is_panic: isPanic,
				message,
			},
		};
	}

	async function singleQuery(body: RequestBodySingle) {
		try {
			const result = await (prisma as any)[body.modelName][
				transformSingleAction(body.action)
			](convertToPrismaQuery(body));
			return {
				status: "success" as const,
				data: result,
			};
		} catch (e) {
			if (e instanceof PrismaClientKnownRequestError) {
				return {
					status: "error" as const,
					data: newError(e.message, false),
				};
			} else if (e instanceof PrismaClientUnknownRequestError) {
				return {
					status: "error" as const,
					data: newError(e.message, false),
				};
			} else if (e instanceof PrismaClientRustPanicError) {
				return {
					status: "error" as const,
					data: newError(e.message, true),
				};
			} else if (e instanceof PrismaClientValidationError) {
				return {
					status: "error" as const,
					data: newError(e.message, false),
				};
			} else if (e instanceof PrismaClientInitializationError) {
				return {
					status: "error" as const,
					data: newError(e.message, false),
				};
			} else if (e instanceof Error) {
				return {
					status: "error" as const,
					data: newError(e.message, true),
				};
			} else {
				return {
					status: "error" as const,
					data: newError(
						"There was an error processing your request.",
						true
					),
				};
			}
		}
	}
	let errors: PrismaError[] = [];

	async function processSingleQuery(body: RequestBodySingle, index = 0) {
		const result = await singleQuery(body);
		if (result.status === "error") {
			errors.push(result.data);
			return null;
		}
		return {
			...result,
			index,
		};
	}

	if ("batch" in body) {
		// multiple queries at once
		const result = await Promise.all(
			body.batch.map((b, i) => processSingleQuery(b, i))
		);
		return {
			// if no data, make the data null for that query
			batchResult: [
				...result.map((r) =>
					r?.data
						? {
								data: {
									[joinAction(
										body.batch[r.index].action,
										body.batch[r.index].modelName
									)]: r.data,
								},
						  }
						: {
								data: null,
						  }
				),
				{
					errors: errors.length > 0 ? errors : undefined,
				},
			],
		};
	} else {
		const result = await processSingleQuery(body);
		return {
			data: {
				[joinAction(body.action, body.modelName)]: result?.data,
			},
			errors: errors.length > 0 ? errors : undefined,
		};
	}
}

const app = new Elysia();

app.post(
	"*",
	async ({ body: untypedBody, headers, path }) => {
		const cacheInformation = getCacheInformationFromHeaders(headers);
		const body = transformBody(untypedBody as RequestBody);

		const bodyAsString = JSON.stringify(body);
		if (cacheInformation) {
			const cached = await cache.getFull(bodyAsString); // <- this ensures that the cache is not expired
			if (cached) {
				const pastTimeInSeconds =
					(Date.now() - cached.createdAt) / 1000;
				const leftTimeInSeconds =
					(cached.expiresAt - Date.now()) / 1000;
				if (cacheInformation["stale-while-revalidate"]) {
					if (
						pastTimeInSeconds >
						cacheInformation["stale-while-revalidate"]
					) {
						setTimeout(() => {
							cache.set(
								bodyAsString,
								executeQuery(body),
								leftTimeInSeconds * 1000
							);
						}, 0);
					}
				}
				return cached.value;
			}
		}
		const result = transformResponse(await executeQuery(body));
		if (cacheInformation) {
			if (cacheInformation["max-age"]) {
				setTimeout(() => {
					cache.set(
						bodyAsString,
						result,
						cacheInformation["max-age"]! * 1000
					);
				}, 0);
			}
		}
		// console.log("Result", result);
		return result;
	},
	{
		type: "json",
		beforeHandle: async ({ headers, body, set }) => {
			if (!headers.authorization) {
				set.status = 401;
				return "Unauthorized";
			}
			const auth = headers.authorization.trim();
			if (auth !== `Bearer ${TOKEN}`) {
				set.status = 401;
				return "Unauthorized";
			}
			try {
				isValidBody(body);
			} catch (e) {
				set.status = 400;
				return (e as any).message;
			}
		},
	}
);

function wrapElysiaServerWithHTTPS(
	elysia: Elysia
): https.RequestListener<any, any> {
	return async (req, res) => {
		function incomingHttpHeadersToHeaders(
			incomingHttpHeaders: IncomingHttpHeaders
		) {
			const headers = new Headers();
			for (const key in incomingHttpHeaders) {
				headers.set(key, incomingHttpHeaders[key] as string);
			}
			return headers;
		}

		function bodyToString() {
			return new Promise<string>((resolve, reject) => {
				let body = "";
				req.on("data", (chunk: string) => {
					body += chunk;
				});
				req.on("end", () => {
					resolve(body);
				});
				req.on("error", reject);
			});
		}

		async function requestToElysiaReadableRequest(
			req: https.IncomingMessage
		) {
			const body = await bodyToString();
			return {
				url: req.url ?? "",
				headers: incomingHttpHeadersToHeaders(req.headers),
				text: () => Promise.resolve(body),
				arrayBuffer() {
					return Promise.resolve(new ArrayBuffer(body.length));
				},
				blob() {
					return Promise.resolve(new Blob([body]));
				},
				json(): Promise<any> {
					return Promise.resolve(JSON.parse(body));
				},
				body: JSON.parse(body),
				cache:
					(req.headers["cache-control"] as RequestCache) ??
					("no-cache" as const),
				bodyUsed: false,
				clone() {
					return this;
				},
				credentials: req.headers["authorization"]
					? ("include" as const)
					: ("omit" as const),
				destination:
					(req.headers["destination"] as RequestDestination) ??
					"document",
				integrity: req.headers["integrity"]?.toString() ?? "",
				method: req.method ?? "GET",
				mode: req.headers["no-cors"] ? "no-cors" : "cors",
				redirect:
					(req.headers["redirect"] as RequestRedirect) ?? "follow",
				keepalive: !!req.headers["keep-alive"],
				referrer: req.headers["referrer"]?.toString() ?? "",
				formData() {
					return new Promise((resolve) => resolve(new FormData()));
				},
				referrerPolicy:
					(req.headers["referrer-policy"] as ReferrerPolicy) ?? "",
				signal: null as any,
			};
		}

		const request = await requestToElysiaReadableRequest(req);
		const result = await elysia.handle(request as any);
		res.statusCode = result.status;
		for (const [key, value] of result.headers.entries()) {
			res.setHeader(key, value);
		}
		res.end(await result.text());
	};
}

if (process.env.SELF_SIGNED_CERT) {
	const key = fs.readFileSync("./certs/selfsigned.key");
	const cert = fs.readFileSync("./certs/selfsigned.crt");
	const options = {
		key,
		cert,
	};
	console.warn("- Self signed certificates support is not guaranteed.");
	console.warn(
		"- Self signed certificates are being used. This is only for development purposes."
	);
	https
		.createServer(options, wrapElysiaServerWithHTTPS(app))
		.listen(PORT, () => {
			console.log(startMessage, "with self signed certificates (https)");
		});
} else {
	app.listen(PORT, () => {
		console.log(startMessage);
	});
}

// on exit, close the prisma connection
process.on("SIGINT", async () => {
	await prisma.$disconnect();
	process.exit(0);
});
