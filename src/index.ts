import "./helpers/loadenv.js";
import {PrismaClient} from "@prisma/client";
import express from "express";
import fs from "fs";
import https from "https";
import {transformData, transformSelection, transformValues} from "./helpers/transformValues.js";
import {transformAction} from "./helpers/transformAction.js";

const TOKEN = process.env.TOKEN;
const PORT = 3000;

const prisma = new PrismaClient();
await prisma.$connect();


export type RequestBody = {
	modelName: string;
	action: string;
	query: {
		arguments: {
			where?: any;
			data?: any;
			take?: number;
			distinct?: any;
			orderBy?: any;
			skip?: number;
			create?: any;
			update?: any;
		};
		selection?: any;
	}
}


function convertToPrismaQuery(body: RequestBody) {
	return {
		data: body.query.arguments.data,
		where: body.query.arguments.where,
		select: body.query.selection,
		take: body.query.arguments.take,
		distinct: body.query.arguments.distinct,
		orderBy: body.query.arguments.orderBy,
		skip: body.query.arguments.skip,
		create: body.query.arguments.create,
		update: body.query.arguments.update,
	}
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
	if (!req.headers.authorization) {
		console.log("No authorization header")
		res.status(401).send("Unauthorized")
		return;
	} else {
		const auth = req.headers.authorization.trim();
		if (auth !== `Bearer ${TOKEN}`) {
			console.log("Invalid authorization header", auth)
			res.status(401).send("Unauthorized")
			return;
		}
		next();
	}
})

app.all("/:version/:id/graphql", async (req, res) => {
		try {

			let body = req.body as RequestBody;
			console.log("Before:")
			console.dir(body, {depth: null, colors: true}); // <- For debugging}
			body = transformAction(body);
			body.query.arguments = transformValues(body.query.arguments);
			body.query.selection = transformSelection(body.query.selection);
			body.query.arguments.data = transformData(body.query.arguments.data)
			console.log("After:")
			console.dir(body, {depth: null, colors: true}); // <- For debugging
			const result = await (prisma as any)[body.modelName][body.action](
				convertToPrismaQuery(body)
			)


			const sessionName = body.action + "Session";
			const data = {
				data: {
					[sessionName]: result
				}
			}
			console.log("Result:")
			console.dir(data, {depth: null, colors: true}); // <- For debugging
			res.send(JSON.stringify(data));
		} catch
			(e) {
			console.error("Failed to process request");
			console.error(e);

			res.status(500).send(e);
		}
	}
)

const startMessage = `🔅 Server is listening on port ${PORT}`;
if (process.env.SELF_SIGNED_CERT) {
	const key = fs.readFileSync("./certs/selfsigned.key");
	const cert = fs.readFileSync("./certs/selfsigned.crt");
	const options = {
		key,
		cert
	}
	https.createServer(options, app).listen(PORT, () => {
			console.log(startMessage, "|with self-signed certificate|");
		}
	);
} else {
	// just start the server
	app.listen(PORT, () => {
			console.log(startMessage);
		}
	);
}

// test
/*const test = await fetch("https://localhost:3000/v1/1/graphql", {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${TOKEN}`
	},
	body: JSON.stringify()
if (test.ok) {
	console.log(JSON.stringify(await test.json(), null, 2));
} else {
	console.log(await test.text());
}*/

// on exit, close the prisma connection
process.on('SIGINT', async () => {
	await prisma.$disconnect();
	process.exit(0);
});