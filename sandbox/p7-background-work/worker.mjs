import {Worker} from 'bullmq';
const connection = {host: '127.0.0.1', port: 56379};
const worker = new Worker('shutdown', async (job) => {
  console.log(`[worker ${process.pid}] started job ${job.id}`);
  await new Promise((r) => setTimeout(r, 3000));   // long job
  console.log(`[worker ${process.pid}] finished job ${job.id}`);
  return 'ok';
}, {connection, concurrency: 1, lockDuration: 5000, stalledInterval: 2000});

process.on('SIGTERM', async () => {
  console.log(`[worker ${process.pid}] SIGTERM — closing, will finish the in-flight job`);
  const t = Date.now();
  await worker.close();                            // waits for the active job
  console.log(`[worker ${process.pid}] closed after ${Date.now() - t} ms`);
  process.exit(0);
});
console.log(`[worker ${process.pid}] up`);
