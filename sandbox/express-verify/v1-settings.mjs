import express from 'express';
const app = express();
for (const k of ['env', 'x-powered-by', 'etag', 'query parser', 'trust proxy', 'subdomain offset', 'view engine', 'case sensitive routing', 'strict routing']) {
  console.log(`${k} = ${JSON.stringify(app.get(k))}`);
}
