// open-prisma-data-proxy
// Open source Prisma data proxy
// For the first step, we need to find out what the request is
import express from "express";
import bodyParser from "body-parser";
const app = express();
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.urlencoded({ extended: true }));
const PORT = 3000;

app.all("/:version/:id/graphql", (req, res) => {
	console.log(req.body) // {}
	console.log(req.params)
	console.log(req.headers)
	// I think the reason req.body is empty is the "connection" type is "keep-alive"
	// It might be because I'm using Cloudflare Tunnels to test this
	// Because otherwise I get SSL errors on http://localhost:3000
	res.send("DEBUG")
})

app.listen(PORT, () => {
	console.log(`🔅 Server is listening on port ${PORT}`);
});