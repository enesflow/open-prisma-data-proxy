import {type Input, object, parse, string, url} from "valibot";
import dotenv from "dotenv";
dotenv.config();

const envSchema = object({
	DATABASE_URL: string([url()]),
	TOKEN: string(),
})
declare global {
	namespace NodeJS {
		interface ProcessEnv extends Input<typeof envSchema> {}
	}
}
// validate process.env against envSchema
try {
	parse(envSchema, process.env);
} catch (e) {
	const err = e as any;
	console.error(err);
	console.error("Environment variables are not valid:");
	console.error(
		">", err.issues.map((i: any) => i.path.map((p: any) => p.key).join(".")).join(", "),
	)
	process.exit(1);
}

