---
title: "Operations happen where the data is"
sidebar_label: "02 · Operations where the data is"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against the **Redis documentation** —
> [Redis strings](https://redis.io/docs/latest/develop/data-types/strings/)
> (the `INCR` atomicity explanation and the 512 MB limit),
> [`INCR`](https://redis.io/docs/latest/commands/incr/),
> [`SET`](https://redis.io/docs/latest/commands/set/) and
> [Redis sets](https://redis.io/docs/latest/develop/data-types/sets/).
> Documentation-validated — **no console blocks**.

Chunk 01 said the types are the product. **This chunk is why that matters, and
it is not mainly about speed — it is about correctness.**

The defining property of a data-structure server is that **the operation runs
next to the data**, not in your process. That single fact buys atomicity, and
atomicity is the thing you cannot rebuild in application code.

## The race you write without noticing

Here is a page-view counter, written the way you write it when Redis is "a cache
that holds strings":

```js
// ⛔ Broken under any concurrency at all
const current = Number(await redis.get('views:home')) || 0
await redis.set('views:home', current + 1)
```

Two requests arrive at the same moment. Both `GET` and read `10`. Both compute
`11`. Both `SET` `11`. **One page view has vanished**, and nothing errored.

This is not a Redis problem. It is the classic read-modify-write race, and it is
present in this code because the *modify* step happens in Node — thousands of
kilometres, or at least a network hop and an event-loop turn, away from the data.

The fix is not a lock. It is to stop moving the data:

```js
// ✅ One command. The increment happens inside Redis.
await redis.incr('views:home')
```

The Redis documentation explains the guarantee in its own words, and it is worth
quoting exactly because people assume it is weaker than it is:

> What does it mean that INCR is atomic? That even multiple clients issuing INCR
> against the same key will never enter into a race condition. For instance, it
> will never happen that client 1 reads "10", client 2 reads "10" at the same
> time, both increment to 11, and set the new value to 11. The final value will
> always be 12 and the read-increment-set operation is performed while all the
> other clients are not executing a command at the same time.

Two things to take from that sentence. First, **the guarantee is unconditional** —
no transaction, no `MULTI`, no lock, no retry loop. Second, note *why* it holds:
"while all the other clients are not executing a command at the same time." That
is the single-threaded execution model, and it is topic 02.

`INCR` also **initialises to 0 when the key does not exist**, so there is no
create-then-increment race either. The same is true of `DECR`, `INCRBY`,
`DECRBY` and `INCRBYFLOAT`.

## The general shape

Every collection type has the same property, and once you see the pattern you
stop writing the broken version:

| What you want | The read-modify-write version | The atomic version |
|---|---|---|
| Add to a set | `GET`, parse, push, `SET` | `SADD key member` |
| Append to a queue | `GET`, parse, push, `SET` | `RPUSH key value` |
| Take the next job | `GET`, parse, shift, `SET` | `LPOP key` |
| Bump a score | `GET`, parse, add, `SET` | `ZINCRBY key 1 member` |
| Set only if absent | `EXISTS`, then `SET` | `SET key val NX` |
| Read then expire | `GET`, then `EXPIRE` | `GETEX key EX 60` |
| Read then delete | `GET`, then `DEL` | `GETDEL key` |

**Every row in the left column is a race.** The `EXISTS`-then-`SET` one is the
most consequential of them: it is the naive distributed lock, it looks obviously
correct, and it is the subject of an entire topic in Phase 8 because two clients
can both pass the `EXISTS` check before either reaches the `SET`.

`SET key val NX` closes that window because the condition and the write are the
same command — one operation, evaluated server-side, with no gap for another
client to slip into.

## Computation, not just storage

The second half of "operations where the data is" is that Redis will *compute*
for you, so the data never crosses the network at all.

```
SINTER online:users premium:users
```

That intersects two sets inside the server and returns only the answer. The
application-side equivalent fetches both sets in full — potentially megabytes —
and intersects them in JavaScript, to produce a result that might be four
elements long.

The same argument applies to `ZRANGEBYSCORE` (give me the members scoring between
X and Y), `ZRANGE key 0 9 REV` (the top ten), `SCARD` (how many, without
transferring any of them), `STRLEN`, `HLEN`, and the whole bitmap and
probabilistic families.

**The rule of thumb: if you find yourself fetching a collection in order to ask a
question about it, there is probably a command that answers the question.**

## The round-trip arithmetic

The third effect is the plainest. Suppose you need twenty cached values:

- Twenty `GET`s issued sequentially = **twenty round trips**, each one a full
  network latency you wait for before sending the next.
- One `MGET` with twenty keys = **one round trip**.

Both do the same work inside Redis. The difference is entirely the network, which
is why the docs describe `MSET`/`MGET` as being "for reduced latency" rather than
for reduced server load.

⚠️ **`MGET` and `MSET` are O(N) in the number of keys** — the saving is round
trips, not server work. And the trick has a hard limit in cluster mode, where
multi-key commands require all keys to live in the same hash slot. Phase 3
covers the caveat; Phase 10 covers why the constraint exists.

This is also the distinction between **pipelining** and **`MULTI`**, which people
routinely conflate: pipelining removes round trips, `MULTI` provides atomicity.
They are different problems and Phase 6 separates them properly.

## What this buys you that a local structure cannot

Take the counter again, and put three Node instances behind a load balancer.

An in-process counter now counts *per instance*. Three instances means three
counters, and the number you wanted — total page views — exists nowhere. Worse,
it looks like it works in development, where there is one instance.

`INCR` against one Redis instance is **one counter, correct across every process,
machine and deploy**. That is the entire argument, and it reappears almost
verbatim in Phase 8: a rate limiter with per-process counters lets through *n
times* the intended limit, where *n* is your instance count, and it is the most
common Redis-shaped bug in a Node codebase.

## Trade-off

**Atomicity is free per command and expensive across commands.** One command is
atomic; a *sequence* of commands is not, and the moment your logic needs two
commands to happen together you are into `MULTI`, Lua, or an optimistic-retry
loop — none of which are free, and each of which has its own failure modes
(Phase 6 and Phase 8).

The trap is that the free atomicity is so good that it trains you to expect it.
Code that reads "check the limit, then increment it" is two commands, and the
guarantee that made `INCR` safe does not extend across them.

**Pushing computation server-side has a ceiling too.** Redis runs one command at
a time, so a big `SINTER` or a large `ZRANGE` is not merely slow for you — it
blocks every other client for its duration. Moving work to the server is the
right instinct right up until the work is large, at which point it becomes topic
03's problem. "Do it in Redis" and "do a lot of it in Redis" are different
recommendations.

## Gotchas

**`GET` then `SET` to update a value.**
*Symptom:* lost updates under concurrency, invisible in development.
*Cause:* the modify step runs in your process, so two clients interleave.
*Fix:* use the type's own mutating command — `INCR`, `SADD`, `RPUSH`, `ZINCRBY`,
`HINCRBY`.

**`EXISTS` then `SET` as a lock.**
*Symptom:* two workers both believe they hold the lock.
*Cause:* a gap between the check and the write that another client fits into.
*Fix:* `SET key val NX PX <ms>` — one command. The full lock discussion, including
why even this is not sufficient on its own, is Phase 8.

**Assuming a multi-command sequence inherits single-command atomicity.**
*Symptom:* a correct-looking check-then-act that fails under load.
*Cause:* atomicity is per command, not per logical operation.
*Fix:* `MULTI`, a Lua script, or a command that already fuses the steps
(`SET … NX`, `GETEX`, `GETDEL`, `INCR`).

**Fetching a collection to count it.**
*Symptom:* megabytes on the wire to produce an integer.
*Cause:* the application-side habit of "load then compute".
*Fix:* `SCARD`, `ZCARD`, `LLEN`, `HLEN`, `STRLEN`, `ZCOUNT` — the answer without
the data.

**Issuing N commands in a loop and calling it a batch.**
*Symptom:* latency scales linearly with the number of keys.
*Cause:* `await` inside a `for` loop serialises the round trips.
*Fix:* `MGET`/`MSET` where the shape allows, otherwise pipelining (Phase 6).
⚠️ Not `Promise.all` over N separate awaits as a mental substitute for
understanding the round trips — that helps, but the client's pipelining behaviour
is the thing to actually know.

**Pushing a genuinely large computation server-side.**
*Symptom:* unrelated requests time out during one "clever" command.
*Cause:* one command at a time; a large O(N) operation blocks the server.
*Fix:* topic 03. Bound the work — `ZRANGE` with a small range, `SCAN` instead of
`KEYS`, and never `SMEMBERS` on a set you have not bounded.

**Relying on `INCR` for a counter that must never be lost.**
*Symptom:* the count is short after a restart.
*Cause:* atomic is not the same as durable — topic 05.
*Fix:* Redis counts; the system of record records. If the number is billable,
it lands in PostgreSQL too.

**Using `INCR` on a key holding a non-integer string.**
*Symptom:* an error rather than a value.
*Cause:* `INCR` parses the string as an integer; a non-integer value is an error
condition, and values outside the 64-bit signed range are too.
*Fix:* keep counter keys single-purpose, and never reuse a key name for two
shapes.

## Interview questions

**★ Why is `INCR` atomic, and what does that save you?**
Because the read, the increment and the write all happen inside the server as one
command, while no other client is executing. The docs state that two clients both
reading "10" and both writing "11" cannot happen — the result is always 12. It
saves you a lock, a transaction and a retry loop, none of which you would have
got right under load.

**★ Show the difference between `EXISTS`+`SET` and `SET … NX`.**
`EXISTS` returns, then your code decides, then `SET` is sent — and another client
can complete the same sequence in the gap, so both believe they won. `SET key val
NX` evaluates the condition and performs the write as one server-side operation,
so exactly one client can succeed. This is the foundation of the distributed-lock
topic in Phase 8.

**★ Your rate limiter allows three times the configured requests. Why?**
The counter is per process and you are running three instances. Each has its own
in-memory count, so the effective limit multiplies by the instance count. The fix
is shared state: `INCR` on a Redis key, which is one counter for every process.

**★ When does Redis's atomicity guarantee stop applying?**
At the command boundary. Any logic needing two or more commands to be
indivisible — check-then-act, read-then-conditionally-write — has a window
between them. You then need `MULTI`, a Lua script, or a single fused command.

**Why is `MGET` faster than twenty `GET`s?**
It is one round trip instead of twenty. The server-side work is the same and
`MGET` is documented O(N) in the number of keys — the saving is entirely network
latency, which is why the docs frame `MSET`/`MGET` as a latency optimisation.

**What is the difference between pipelining and `MULTI`?**
Pipelining sends many commands without waiting for each reply, removing round
trips; it makes no atomicity promise. `MULTI` queues commands to be executed
together without other clients interleaving. One is about latency, the other
about isolation, and conflating them produces code that is fast and wrong.

**Give an example of moving computation to Redis rather than data to the client.**
`SINTER online:users premium:users` intersects two sets on the server and returns
only the result. The alternative transfers both sets in full to compute the same
answer in application code — possibly megabytes on the wire to produce a handful
of elements. `SCARD`, `ZCOUNT` and `ZRANGEBYSCORE` are the same idea.

**Is there a downside to doing more work server-side?**
Yes. Redis executes one command at a time, so a large server-side operation
blocks every other client for its duration. Server-side computation is right when
the work is bounded and wrong when it is not — which is exactly what topic 03 is
about.

**Does atomic mean durable?**
No, and conflating them is a common and expensive mistake. `INCR` is atomic with
respect to other clients; whether the resulting value survives a process restart
is a separate question answered by the persistence configuration, and by default
the honest answer is "not necessarily". Topic 05, and Phase 9.

---

← Prev: [01 · The data-structure server](./01-the-data-structure-server.md) ·
Next: [03 · Choosing the type](./03-choosing-the-type.md) →
