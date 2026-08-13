import {Queue, Worker, QueueEvents} from 'bullmq';
const connection = {host: '127.0.0.1', port: 56379};
const q = new Queue('emails', {connection});
await q.obliterate({force: true}).catch(() => {});

// ---- retries with backoff ----
const started = Date.now();
const stamps = [];
await q.add('send', {to: 'ada@example.com'}, {
  attempts: 4,
  backoff: {type: 'exponential', delay: 200},
  removeOnComplete: false, removeOnFail: false,
});

let doneResolve; const done = new Promise((r) => { doneResolve = r; });
const w = new Worker('emails', async (job) => {
  stamps.push(Date.now() - started);
  throw new Error('SMTP 421 service unavailable');
}, {connection, concurrency: 1});

w.on('failed', (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) doneResolve(job);
});
const failed = await done;
console.log('attempt timings (ms from start):', stamps.map((s) => Math.round(s / 10) * 10).join(', '));
console.log('attemptsMade:', failed.attemptsMade, '| final state: failed');
console.log('failedReason:', failed.failedReason);
console.log('counts:', await q.getJobCounts('completed', 'failed', 'delayed', 'waiting'));

// ---- dead letter: move exhausted failures to their own queue ----
const dlq = new Queue('emails.dead', {connection});
await dlq.obliterate({force: true}).catch(() => {});
const deadJobs = await q.getFailed();
for (const j of deadJobs) {
  await dlq.add('dead', {originalId: j.id, name: j.name, data: j.data, reason: j.failedReason});
}
console.log('moved to DLQ:', await dlq.getJobCounts('waiting'));
await w.close(); await q.close(); await dlq.close();
