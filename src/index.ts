// open-prisma-data-proxy
import express from "express";
import https from "https";
import fs from "fs";

const key = fs.readFileSync("./certs/selfsigned.key");
const cert = fs.readFileSync("./certs/selfsigned.crt");
const options = {
	key,
	cert
}

const app = express();
app.use(express.json());
const PORT = 3000;

app.all("/:version/:id/graphql", (req, res) => {
	console.log(req.body) // {}
	console.log(req.params)
	console.log(req.headers)
	res.send("{data: {hello: 'world'}}")
})

https.createServer(options, app).listen(PORT, () => {
		console.log(`🔅 Server is listening on port ${PORT}`);
	}
);