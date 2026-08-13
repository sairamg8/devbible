// set-cookie.mjs
import express from 'express';

const app = express();
app.get('/set', (req, res) => {
  res.cookie('sid', 'abc', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  res.end('ok');
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/set`);
  console.log(res.headers.getSetCookie?.() || res.headers.get('set-cookie'));
  server.close();
});
