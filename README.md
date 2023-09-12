# open-prisma-data-proxy

Open source alternative to Prisma Data Proxy and Prisma Accelerate

## What is this?

Prisma offers [Data Proxy](https://www.prisma.io/docs/concepts/components/prisma-data-platform#data-proxy) (and [Accelerate](https://www.prisma.io/data-platform/accelerate) which offers caching)
that allows you to connect to your database from a serverless environment like Cloudflare Workers or Netlify Functions.
This is a great solution for serverless environments that don't allow you to connect to your database directly.
But as from my experience, the Data Proxy and Accelerate have some downsides:

- It's not open source
- Long cold start times
- Slow response times

This project aims to be an open source alternative to the Prisma Data Proxy and Prisma Accelerate.

## Local development

```bash
# Clone the repository
git clone https://github.com/enesflow/open-prisma-data-proxy.git
# Put your schema.prisma file in prisma/schema.prisma
mkdir "prisma"
cp "path/to/schema.prisma" "prisma/schema.prisma"
# Set environment variables (see below)
touch ".env"
# Install dependencies
bun install
# The prisma client should be generated automatically
# Start the server
bun dev
```

> Docker support is coming soon

## Environment variables

| Name               | Description                                                              | Required | Default |
|--------------------|--------------------------------------------------------------------------|----------|---------|
| `DATABASE_URL`     | The URL to your database                                                 | Yes      |         |
| `TOKEN`            | The token to authenticate requests                                       | Yes      |         |
| `SELF_SIGNED_CERT` | Set to `true` if you use a self signed certificate for local development | No       | `false` |

## Self-signed certificate

```bash
# Set SELF_SIGNED_CERT to true in your .env file
mkdir "certs"
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "./certs/selfsigned.key" -out "./certs/selfsigned.crt"
```
> Note: To not get "self-signed certificate" errors in your application,
> set NODE_TLS_REJECT_UNAUTHORIZED=0 in your application.
> Example:
```bash
cd "path/to/your/application"
NODE_TLS_REJECT_UNAUTHORIZED=0 bun dev
```