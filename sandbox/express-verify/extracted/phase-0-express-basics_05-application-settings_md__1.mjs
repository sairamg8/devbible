// settings.mjs
import express from 'express';

const app = express();

for (const key of [
  'env',
  'x-powered-by',
  'etag',
  'query parser',
  'trust proxy',
  'strict routing',
  'case sensitive routing',
]) {
  console.log(key, '=', JSON.stringify(app.get(key)));
}
