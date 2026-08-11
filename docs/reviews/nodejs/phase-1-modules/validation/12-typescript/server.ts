interface Config { port: number; host: string; }
function start(config: Config): string {
  return `listening on ${config.host}:${config.port}`;
}
const conf: Config = { port: 8080, host: '127.0.0.1' };
console.log(start(conf));
