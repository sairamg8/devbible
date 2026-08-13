import express from 'express';
const app = express();
const admin = express.Router();
console.log('before mount, admin.mountpath =', admin.mountpath);
admin.get('/', (req, res) => res.json({mountpath: req.app?.mountpath, baseUrl: req.baseUrl}));
app.use('/admin', admin);
console.log('after mount,  admin.mountpath =', admin.mountpath);

const sub = express();                       // a sub-APP, not a Router
app.use('/sub', sub);
console.log('sub-app .mountpath           =', sub.mountpath);

const server = app.listen(0, '127.0.0.1', async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/admin`)).json());
  server.close();
});
