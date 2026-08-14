// mountpath.mjs
import express from 'express';

const app = express();

const admin = express.Router();              // a Router
admin.get('/dashboard', (req, res) => {
  res.json({baseUrl: req.baseUrl, path: req.path, originalUrl: req.originalUrl});
});
app.use('/admin', admin);

const reports = express();                   // a sub-APP
reports.get('/daily', (req, res) => {
  res.json({mountpath: req.app.mountpath, baseUrl: req.baseUrl, path: req.path});
});
app.use('/reports', reports);

console.log('Router.mountpath  :', admin.mountpath);
console.log('sub-app.mountpath :', reports.mountpath);

const server = app.listen(0, '127.0.0.1', async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('router   ', await (await fetch(`${base}/admin/dashboard`)).json());
  console.log('sub-app  ', await (await fetch(`${base}/reports/daily`)).json());
  server.close();
});
