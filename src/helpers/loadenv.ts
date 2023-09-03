import {boolean, coerce, type Input, object, optional, parse, string, url} from "valibot";
import dotenv from "dotenv";
dotenv.config();

const envSchema = object({
	DATABASE_URL: string([url()]),
	TOKEN: string(),
	SELF_SIGNED_CERT: optional(coerce(
		boolean(), (v) => v === "true",
	))
})
declare global {
	namespace NodeJS {
		interface ProcessEnv extends Input<typeof envSchema> {}
	}
}
// validate process.env against envSchema
try {
	const env = parse(envSchema, process.env);
	// for every key in env, if the typeof env[key] is a boolean, if false, set process.env[key] to ""
	// so that if (process.env[key]) will be false
	for (const key in env) {
		if (typeof (env as any)[key] === "boolean" && !(env as any)[key]) {
			process.env[key] = "";
		}
	}
} catch (e) {
	const err = e as any;
	console.error(err);
	console.error("Environment variables are not valid:");
	console.error(
		">", err.issues.map((i: any) => i.path.map((p: any) => p.key).join(".")).join(", "),
	)
	process.exit(1);
}

