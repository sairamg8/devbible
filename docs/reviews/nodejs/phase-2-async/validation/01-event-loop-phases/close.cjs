const net = require('node:net');
const server = net.createServer(sock => {
  sock.on('close', () => console.log('close phase: socket close event'));
  setImmediate(() => console.log('check phase: setImmediate'));
  sock.destroy();
});
server.listen(0, () => {
  const c = net.connect(server.address().port, () => c.end());
  setTimeout(() => server.close(), 200);
});
