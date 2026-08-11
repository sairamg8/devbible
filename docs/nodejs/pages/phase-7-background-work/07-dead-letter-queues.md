---
title: "Dead-letter queues — where poison messages go"
sidebar_label: "07 · Dead-letter queues"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — `bullmq` 6.0.10 against **Redis 8.10.0**.

**A dead-letter queue is where a job goes when retrying it is no longer helping.** Its
value is not that it stores failures — it is that it *separates* the failures nobody
looked at from the ones that just happened, so the pile is small enough to read.

## The poison message

A job that fails every time, forever: a malformed payload, a deleted record, a bug
that throws on one particular row. Without somewhere to put it, one of two things
happens — it retries indefinitely, consuming a worker slot on every pass, or it fails
permanently into a pile of failures that nobody reads because it never stops growing.

```console
attemptsMade: 4 | final state: failed
failedReason: SMTP 421 service unavailable
counts: { completed: 0, failed: 1, delayed: 0, waiting: 0 }
```

**BullMQ has no built-in dead-letter queue.** Exhausted jobs stay in the `failed` set,
which is a holding area, not a DLQ — it mixes today's transient failures with last
month's poison. Moving them is a few lines you write:

```js
const dlq = new Queue('emails.dead', {connection});

worker.on('failed', async (job, err) => {
  if (!job || job.attemptsMade < job.opts.attempts) return;   // more attempts to come
  await dlq.add('dead', {
    originalId: job.id,
    name:       job.name,
    data:       job.data,
    reason:     err.message,
    stack:      err.stack,
    failedAt:   new Date().toISOString(),
    attempts:   job.attemptsMade,
  });
});
```

```console
moved to DLQ: { waiting: 1 }
```

On a database queue it is a column or a table:

```sql
update jobs set status = 'dead', died_at = now(), last_error = $2 where id = $1;
```

## What a DLQ entry must carry

An entry you cannot act on is just a log line with extra storage. Include:

- **The original payload**, complete — you will replay from it.
- **The error message and stack**, not a summary.
- **`attemptsMade` and the time of the last failure.**
- **A correlation id** tying it back to the request or event that produced it
  (Phase 10 covers propagating one).

## Reading it is the job

A DLQ nobody reads is worse than no DLQ, because it creates the impression the
failures are handled. Two mechanics make it real:

**Alert on the rate, not the depth.** "Ten new dead letters in an hour" is an
incident. "There are 4 000 dead letters" is a number people stop seeing. Alert on
*new arrivals*, and separately on **age of the oldest unreviewed entry**.

**Give it a disposal path.** Every entry ends one of three ways:

1. **Fix and replay** — the bug is fixed, deploy, replay the batch.
2. **Discard** — the record was deleted; the job is meaningless now. Delete it
   deliberately, with a note.
3. **Escalate** — this is data loss someone must know about.

Replay is a script you write once, and the only requirement it has is idempotency
([page 05](./05-job-idempotency.md)) — because some of those jobs partially succeeded
before failing:

```js
const replay = async (limit = 100) => {
  const dead = await dlq.getJobs(['waiting'], 0, limit);
  for (const j of dead) {
    await emails.add(j.data.name, j.data.data, {jobId: `replay:${j.data.originalId}`});
    await j.remove();
  }
  return dead.length;
};
```

Replay into the **original queue**, not straight into a worker, so the job gets the
normal retry and monitoring path.

## Choosing when a job dies

Too few attempts and transient failures become dead letters; too many and a poison
message wastes an hour of worker time.

| Job | Attempts | Reasoning |
|---|---|---|
| Send email | 5, exponential from 1 s | Provider blips resolve in minutes |
| Call a partner webhook | 8, exponential to hours | They may be down for a while |
| Image resize | 3 | Fails again for the same reason |
| Anything with a 4xx | 1 | Permanent — fail it immediately |

That last row matters most: classify the error rather than counting attempts
([page 14](./14-retry-safe-failures.md)). A `422` should reach the DLQ on the first
failure, not after five retries over fifteen seconds.

```js
if (res.status >= 400 && res.status < 500 && res.status !== 429) {
  throw new UnrecoverableError(`permanent ${res.status}`);
}
```

## Gotchas

**Symptom:** A job retries forever, consuming worker slots
**Cause:** No attempt cap.
**Fix:** Cap attempts; move exhausted jobs to a DLQ.

**Symptom:** Thousands of failed jobs nobody has read
**Cause:** Alerting on depth, which becomes background noise.
**Fix:** Alert on arrival rate and oldest-unreviewed age.

**Symptom:** A dead letter cannot be replayed
**Cause:** The entry stored the error but not the payload.
**Fix:** Store the full original payload, error, attempts and correlation id.

**Symptom:** Replaying dead letters duplicated the work
**Cause:** Jobs that partially succeeded before failing.
**Fix:** Idempotent handlers; replay with a derived `jobId`.

**Symptom:** A permanent 4xx sat in retry for fifteen seconds
**Cause:** All errors treated as transient.
**Fix:** `UnrecoverableError` for non-retryable status codes.

**Symptom:** Redis memory grows from failed jobs
**Cause:** `removeOnFail` unset, so the failed set retains everything.
**Fix:** Set an age/count, and move anything you care about to the DLQ first.

## Interview questions

**★ What is a dead-letter queue for?**
Somewhere to put jobs that retrying will not fix, so they stop consuming worker slots
and so the list of failures needing human attention stays small enough to actually
read. It is a triage queue, not an archive.

**★ Does BullMQ give you one?**
Not as such. Exhausted jobs stay in the `failed` set, which mixes recent transient
failures with old poison. Moving them to a dedicated queue on the `failed` event, once
`attemptsMade` reaches `attempts`, is a few lines.

**★ What must a dead-letter entry contain?**
The complete original payload, the error message and stack, the attempt count, the
time, and a correlation id. Anything less and you can see that something failed but
cannot replay or diagnose it.

**★ How do you handle a dead letter?**
Fix and replay, discard deliberately, or escalate as data loss. Replay goes back into
the original queue so it gets the normal retry and monitoring path — and it requires
idempotent handlers, because some of those jobs partially succeeded before failing.

**How many attempts before a job dies?**
Depends on the failure mode, not on a global default. A flaky email provider deserves
five with exponential backoff; a partner webhook maybe eight over hours; a
deterministic failure like a 4xx deserves exactly one. Classify the error rather than
counting.

**How should a DLQ be monitored?**
On the arrival rate and the age of the oldest unreviewed entry. Absolute depth becomes
noise that people stop seeing.

---

← Prev: [The transactional outbox](./06-transactional-outbox.md) · Next → [Scheduled and recurring jobs](./08-scheduled-jobs.md)
