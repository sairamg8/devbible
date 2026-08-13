import express from 'express';
import http from 'node:http';
const mk = async (trust) => {
  const app = express();
  if (trust !== undefined) app.set('trust proxy', trust);
  app.get('/ip', (req, res) => res.json({ip: req.ip, ips: req.ips, proto: req.protocol, host: req.hostname}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return {server, port: server.address().port};
};
const get = (port, headers) => new Promise((resolve) => {
  http.get({host:'127.0.0.1', port, path:'/ip', headers}, (res) => {
    let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve(JSON.parse(b)));
  });
});
const hdrs = {'x-forwarded-for': '203.0.113.9, 70.41.3.18', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'api.example.com'};
for (const t of [undefined, 1, true, 'loopback']) {
  const {server, port} = await mk(t);
  console.log(`trust proxy = ${String(t).padEnd(9)}`, await get(port, hdrs));
  server.close();
}
