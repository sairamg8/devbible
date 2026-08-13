// server.js
const app = createApp(deps);
const server = app.listen(config.port);
process.on('SIGTERM', () => {
  server.close(() => deps.pool.end().then(() => process.exit(0)));
});
