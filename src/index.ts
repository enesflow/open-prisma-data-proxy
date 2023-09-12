import "./helpers/loadenv.js";
import {PrismaClient} from "@prisma/client";
import {PrismaClientKnownRequestError} from "@prisma/client/runtime/library.js";
import Elysia from "elysia";
import fs from "fs";
import {IncomingHttpHeaders} from "http";
import https from "https";
import {transformData, transformSelection, transformValues} from "./helpers/transformValues.js";
import {transformAction} from "./helpers/transformAction.js";

const TOKEN = process.env.TOKEN;
const PORT = 3000;
const startMessage = `🔅 Server is listening on port ${PORT}`;

const prisma = new PrismaClient();
await prisma.$connect();

/*const logging = {
  beforeQuery: false,
  afterQuery: false,
  result: false,
  error: true,
}*/


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

function isValidBody(body: any): asserts body is RequestBody {
  const empty = [];
  if (!body.action) {
    empty.push("action");
  }
  if (!body.modelName) {
    empty.push("modelName");
  }
  if (!body.query) {
    empty.push("query");
  }
  if (empty.length > 0) {
    throw new Error(`Invalid request body. Missing ${empty.map(e => `"${e}"`).join(", ")}.`);
  }
}

function transformBody(body: RequestBody) {
  body = transformAction(body);
  body.query.arguments = transformValues(body.query.arguments);
  body.query.selection = transformSelection(body.query.selection);
  body.query.arguments.data = transformData(body.query.arguments.data)
  return body;
}

const app = new Elysia();

app.post("*", async ({body: untypedBody, set}) => {
    function newError(message: string
      , isPanic = true
    ) {
      return {
        errors: [
          {
            error: message,
            user_facing_error: {
              is_panic: isPanic,
              message,
            }
          }
        ]
      }
    }

    const body = transformBody(untypedBody as RequestBody);
    try {

      const result = await (prisma as any)[body.modelName][body.action](
        convertToPrismaQuery(body)
      )
      return {
        data: {
          [body.action + "Session"]: result
        }
      }
    } catch (e) {
      const isPrismaError = e instanceof PrismaClientKnownRequestError;

      // res.status(500).json(newError("There was an error processing your request.", !isPrismaError));
      set.status = 500;
      return newError("There was an error processing your request.", !isPrismaError);

    }
  },
  {
    type: "json",
    beforeHandle: async ({headers, body, set}) => {
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
    }
  }
)

function wrapElysiaServerWithHTTPS(elysia: Elysia): https.RequestListener<any, any> {
  return async (req, res) => {
    function incomingHttpHeadersToHeaders(incomingHttpHeaders: IncomingHttpHeaders) {
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
        })
        req.on("end", () => {
          resolve(body);
        })
        req.on("error", reject);
      })
    }

    async function requestToElysiaReadableRequest(req: https.IncomingMessage) {
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
        cache: req.headers["cache-control"] as RequestCache ?? "no-cache" as const,
        bodyUsed: false,
        clone() {
          return this;
        },
        credentials: req.headers["authorization"] ? "include" as const : "omit" as const,
        destination: req.headers["destination"] as RequestDestination ?? "document",
        integrity: req.headers["integrity"]?.toString() ?? "",
        method: req.method ?? "GET",
        mode: req.headers["no-cors"] ? "no-cors" : "cors",
        redirect: req.headers["redirect"] as RequestRedirect ?? "follow",
        keepalive: !!req.headers["keep-alive"],
        referrer: req.headers["referrer"]?.toString() ?? "",
        formData() {
          return new Promise((resolve) => resolve(new FormData()));
        },
        referrerPolicy: req.headers["referrer-policy"] as ReferrerPolicy ?? "",
        signal: null as any
      }
    }

    const request = await requestToElysiaReadableRequest(req);

    const result = await elysia.handle(request as any);
    res.statusCode = result.status;
    for (const [key, value] of result.headers.entries()) {
      res.setHeader(key, value);
    }
    res.end(await result.text());
  }

}

if (process.env.SELF_SIGNED_CERT) {
  const key = fs.readFileSync("./certs/selfsigned.key");
  const cert = fs.readFileSync("./certs/selfsigned.crt");
  const options = {
    key,
    cert
  }
  console.warn("- Self signed certificates support is not guaranteed.");
  console.warn("- Self signed certificates are being used. This is only for development purposes.");
  https.createServer(options, wrapElysiaServerWithHTTPS(app)
  ).listen(PORT, () => {
    console.log(startMessage, "with self signed certificates (https)");
  })
} else {
  app.listen(PORT, () => {
      console.log(startMessage);
    }
  );
}

// on exit, close the prisma connection
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});