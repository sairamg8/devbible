// mountpath.mjs
import express from 'express';

const admin = express.Router();
admin.get('/dashboard', (req, res) => {
  res.json({
    mountpath: admin.mountpath, // set after mount
    baseUrl: req.baseUrl,
  });
});

const app = express();
app.use('/admin', admin);

// After use(), router.mountpath reflects the mount
console.log('after mount, admin.mountpath =', admin.mountpath);

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/admin/dashboard`)).json());
  server.close();
});
