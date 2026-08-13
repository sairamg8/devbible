import {Queue} from 'bullmq';
import {spawn} from 'node:child_process';
const connection = {host: '127.0.0.1', port: 56379};
const q = new Queue('shutdown', {connection});
await q.obliterate({force: true}).catch(() => {});

const run = async (label, signal) => {
  await q.obliterate({force: true}).catch(() => {});
  await q.add('slow', {label}, {attempts: 2, removeOnComplete: false, removeOnFail: false});
  const child = spawn('node', ['worker.mjs'], {stdio: 'inherit'});
  await new Promise((r) => setTimeout(r, 1200));      // let it pick the job up
  console.log(`--- sending ${signal} ---`);
  child.kill(signal);
  await new Promise((r) => child.on('exit', r));
  await new Promise((r) => setTimeout(r, 300));
  console.log(`${label}:`, await q.getJobCounts('completed', 'failed', 'active', 'waiting', 'delayed'));
  return child;
};

console.log('=== graceful: SIGTERM ===');
await run('SIGTERM', 'SIGTERM');

console.log('\n=== hard kill: SIGKILL ===');
await run('SIGKILL', 'SIGKILL');
console.log('waiting for the stall detector…');
const child2 = spawn('node', ['worker.mjs'], {stdio: 'inherit'});
await new Promise((r) => setTimeout(r, 9000));
console.log('after recovery:', await q.getJobCounts('completed', 'failed', 'active', 'waiting', 'delayed'));
child2.kill('SIGKILL');
await q.close();
process.exit(0);
