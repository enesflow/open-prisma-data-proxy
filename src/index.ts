// open-prisma-data-proxy
import {PrismaClient} from "@prisma/client";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import https from "https";
import {transformSelection, transformValues} from "./helpers/transformValues.js";
import {transformAction} from "./helpers/transformAction.js";

dotenv.config();
const TOKEN = process.env.TOKEN;
const PORT = 3000;

const prisma = new PrismaClient();
await prisma.$connect();

const key = fs.readFileSync("./certs/selfsigned.key");
const cert = fs.readFileSync("./certs/selfsigned.crt");
const options = {
	key,
	cert
}

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
		res.status(401).send("Unauthorized")
	} else {
		const auth = req.headers.authorization.trim();
		if (auth !== `Bearer ${TOKEN}`) {
			res.status(401).send("Unauthorized")
		}
		next();
	}
})

app.all("/:version/:id/graphql", async (req, res) => {
	try {

	let body = req.body as RequestBody;
	body = transformAction(body);
	if (body.action.startsWith("create")) {
		body = transformValues(body);
	}
	body.query.selection = transformSelection(body.query.selection);
	console.log(JSON.stringify(body, null, 2)); // <- for debugging
	const result = await (prisma as any)[body.modelName][body.action](
		convertToPrismaQuery(body)
	)


	const sessionName = body.action + "Session";
	const data = {
		data: {
			[sessionName]: result
		}
	}
	res.send(JSON.stringify(data));
	}
	catch (e) {
		res.status(500).send(e);
	}
})

https.createServer(options, app).listen(PORT, () => {
		console.log(`🔅 Server is listening on port ${PORT}`);
	}
);

// test
/*const test = await fetch("https://localhost:3000/v1/1/graphql", {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${TOKEN}`
	},
	body: JSON.stringify({}
	)
})
if (test.ok) {
	console.log(JSON.stringify(await test.json(), null, 2));
}
else {
	console.log(await test.text());
}*/

// on exit, close the prisma connection
process.on('SIGINT', async () => {
	await prisma.$disconnect();
	process.exit(0);
});