---
title: "Async iterators and generators"
sidebar_label: "18 · Async iterators"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`for await...of` — the loop for sequences that arrive over time. It is how you
read a stream, consume a paginated API or process events without holding the whole
result in memory.**

## The problem it solves

`Promise.all` needs every item up front, and it holds every result at once. Some
sequences are not like that: a 10GB file, an API that hands you one page at a time,
an event stream with no end. Async iteration processes them **one at a time, with
the memory of one item**.

## `for await...of` over an async generator

```js
// iter.mjs
import { setTimeout as sleep } from 'node:timers/promises';

async function* pages() {
  for (let p = 1; p <= 3; p++) {
    await sleep(10);                       // fetch the next page
    yield [`item${p}a`, `item${p}b`];
  }
}

for await (const page of pages()) console.log('page →', page);
```

```console
$ node iter.mjs
page → [ 'item1a', 'item1b' ]
page → [ 'item2a', 'item2b' ]
page → [ 'item3a', 'item3b' ]
```

`async function*` is the two features combined: `await` inside to wait, `yield` to
hand a value out. The consumer's `for await` loop pauses at each `yield` and pulls
the next value only when it is ready for it — the generator does no work in
advance. That is **pull-based backpressure**, and you get it for free.

This is the shape for any paginated API: loop while a cursor exists, `await` the
request, `yield` the batch. The caller writes an ordinary loop and never sees the
pagination.

## The protocol underneath

`for await` looks for `Symbol.asyncIterator` — a method returning an object with a
`next()` that returns a promise of `{ value, done }`:

```js
const ticker = {
  [Symbol.asyncIterator]() {
    let n = 0;
    return {
      async next() {
        await sleep(5);
        return n < 3 ? { value: ++n, done: false } : { value: undefined, done: true };
      }
    };
  }
};

for await (const t of ticker) process.stdout.write(`tick ${t} `);
```

```console
tick 1 tick 2 tick 3
```

You rarely write this by hand — async generators produce it for you. Recognising
it matters for reading library code and for the interview question.

## Cleanup on early exit

```js
async function* withCleanup() {
  try { yield 1; yield 2; yield 3; }
  finally { console.log('cleanup ran'); }
}

for await (const v of withCleanup()) { if (v === 2) break; }
```

```console
cleanup ran
```

`break`, `return` and a thrown error all call the iterator's `return()`, which
resumes the generator at its `finally`. **This is why `try`/`finally` in a
generator is the right place to close a file handle or release a connection** — it
runs even when the consumer walks away early.

## What is already async-iterable

You mostly consume these rather than writing your own:

| Source | Example |
|---|---|
| Streams | `for await (const chunk of readable)` |
| `fs/promises` file handles | `for await (const line of file.readLines())` |
| `readline/promises` | `for await (const line of rl)` |
| Events | `for await (const [e] of on(emitter, 'data'))` |
| Web streams / `fetch` bodies | `for await (const chunk of res.body)` |

```js
// iter2.mjs
import { EventEmitter, on, once } from 'node:events';
import { Readable } from 'node:stream';

const rs = Readable.from(['alpha\n', 'beta\n', 'gamma\n']);
for await (const chunk of rs) process.stdout.write('chunk: ' + chunk);

const ee = new EventEmitter();
let n = 0;
const timer = setInterval(() => {
  ee.emit('data', ++n);
  if (n === 3) { clearInterval(timer); ee.emit('done'); }
}, 5);

const ac = new AbortController();
once(ee, 'done').then(() => ac.abort());
try {
  for await (const [value] of on(ee, 'data', { signal: ac.signal })) console.log('event →', value);
} catch (e) { console.log('iteration ended via', e.name); }
```

```console
$ node iter2.mjs
chunk: alpha
chunk: beta
chunk: gamma
event → 1
event → 2
event → 3
iteration ended via AbortError
```

Two things worth noticing. `events.on` yields an **array** of the emitted
arguments, which is why the destructuring is `const [value]`. And it never
finishes on its own — an emitter has no end — so you stop it with an
[`AbortSignal`](19-abortcontroller.md), and the loop exits by throwing
`AbortError`.

## Sequential by definition

```js
for await (const item of source) {
  await process(item);      // strictly one at a time
}
```

That is the point when order matters or the work is rate-limited — but it means
async iteration is **never parallel**. If items are independent and you want
concurrency, you need a pool over them, not a loop —
[concurrency control](14-concurrency-control.md).

## Gotchas

**Symptom:** `for await` over an array of promises resolves them but feels serial
**Cause:** It is serial — it awaits each in turn.
**Fix:** That is correct behaviour. Use `Promise.all` if you want them
concurrently; `for await` is for sequences that arrive over time.

**Symptom:** `SyntaxError: await is only valid in async functions`
**Cause:** `for await` used outside an async function, in a CommonJS file with no
top-level await.
**Fix:** Wrap in an async function, or use ESM where top-level `await` works —
[ESM](../phase-1-modules/01-esm.md).

**Symptom:** A file handle stays open after breaking out of the loop
**Cause:** Cleanup was after the loop rather than in the generator's `finally`.
**Fix:** `try`/`finally` inside the generator; `return()` runs it on `break`.

**Symptom:** `for await (const e of on(emitter, 'x'))` never ends
**Cause:** Emitters have no completion. This is by design.
**Fix:** Pass `{ signal }` and abort it, or `break`.

**Symptom:** Destructured event value is `undefined`
**Cause:** `events.on` yields the full argument array.
**Fix:** `for await (const [value] of ...)`.

**Symptom:** Memory climbs while streaming a large file
**Cause:** Results are being accumulated into an array inside the loop.
**Fix:** Process and discard each item — accumulating defeats the purpose.

## Interview questions

**★ What does `for await...of` do that a normal `for...of` cannot?**
It awaits each value before the loop body runs, so it can iterate a sequence whose
items arrive over time — stream chunks, API pages, events. A normal `for...of`
over promises would give you the promise objects, not their values.

**★ What is an async generator and why is it useful?**
An `async function*` — it can `await` internally and `yield` values out. It is the
standard way to expose a paginated or streamed source, because the consumer pulls
one value at a time, so the producer does no work in advance and only one item is
in memory.

**★ How does backpressure work with async iteration?**
It is pull-based: the generator is suspended at `yield` until the consumer asks for
the next value. A slow consumer automatically slows the producer, with no explicit
signalling.

**★ What happens when you `break` out of a `for await` loop?**
The iterator's `return()` method is called, which resumes an async generator at its
`finally` block. That makes `try`/`finally` the correct place to release resources,
since it runs on early exit as well as normal completion.

**Is `for await...of` concurrent?**
No — it is strictly sequential, one item at a time. That is the right thing for
ordered or rate-limited work, but for independent items you want a bounded
concurrency pool instead.

---

← Prev: [Promise anti-patterns](17-promise-antipatterns.md) · Next → [AbortController](19-abortcontroller.md)
