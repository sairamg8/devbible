---
title: "Stream events, flowing and paused"
sidebar_label: "12 · Events and modes"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A Readable is either paused (you pull) or flowing (it pushes). Attaching a
`'data'` handler flips it to flowing permanently — and any chunk emitted before
you attached is gone.**

You will mostly use `for await` and `pipeline`, which manage this for you. You
need this page to debug the code that doesn't, and to answer "why is `close`
firing before `finish`".

## The events, in the order they fire

```js
// events.mjs
import { Readable, Writable } from 'node:stream';

const log = [];
const r = Readable.from(['a', 'b', 'c']);
const w = new Writable({ write(c, e, cb) { cb(); } });
for (const ev of ['data', 'end', 'close', 'error', 'pause', 'resume']) r.on(ev, () => log.push('R:' + ev));
for (const ev of ['drain', 'finish', 'close', 'error', 'pipe']) w.on(ev, () => log.push('W:' + ev));

r.pipe(w);
w.on('finish', () => setImmediate(() => console.log(log.join(' → '))));
```

```console
$ node events.mjs
W:pipe → R:resume → R:data → R:data → R:data → R:end → W:finish → R:pause → W:close → R:close
```

| Event | Side | Means |
|---|---|---|
| `'data'` | Readable | A chunk is available **and the stream is now flowing** |
| `'end'` | Readable | No more data. Only fires if the data was fully consumed |
| `'error'` | either | Something failed. No further events except `'close'` |
| `'close'` | either | Underlying resource released. The last event, always |
| `'finish'` | Writable | `end()` was called and all writes are flushed |
| `'drain'` | Writable | The queue fell below the high water mark; safe to write again |
| `'pipe'` / `'unpipe'` | Writable | A Readable attached or detached |

Three rules worth memorising:

- **`'end'` (readable) and `'finish'` (writable) are different events.** A Duplex
  emits both, at different times.
- **`'end'` only fires if you consume the data.** A stream nobody reads never
  ends — it just sits there holding a file descriptor.
- **`'close'` is the only event guaranteed after `'error'`.** Cleanup goes in
  `'close'`, or better, in `stream.finished()`.

```js
// error-order.mjs
import { Readable } from 'node:stream';
const r = new Readable({ read() { this.destroy(new Error('kaboom')); } });
const seen = [];
for (const e of ['data', 'end', 'error', 'close']) r.on(e, () => seen.push(e));
r.on('close', () => console.log('destroy(err) emits:', seen.join(' → ')));
r.resume();
```

```console
$ node error-order.mjs
destroy(err) emits: error → close
```

No `'end'`. Code that does its cleanup in `'end'` leaks on every failure — which
is the argument for `finished()` or `pipeline`.

## Flowing vs paused

```js
// modes.mjs
import { Readable } from 'node:stream';
const make = () => Readable.from(['one', 'two', 'three']);

const a = make();
console.log('fresh      : isPaused', a.isPaused(), '| readableFlowing', a.readableFlowing);
a.on('data', () => {});
console.log("on('data') : readableFlowing", a.readableFlowing);
a.pause();
console.log('pause()    : isPaused', a.isPaused(), '| readableFlowing', a.readableFlowing);
```

```console
$ node modes.mjs
fresh      : isPaused false | readableFlowing null
on('data') : readableFlowing true
pause()    : isPaused false → true | readableFlowing false
```

`readableFlowing` has three states, and the third is the one people miss:

| Value | Meaning |
|---|---|
| `null` | No consumer yet. Nothing is being read; nothing is lost |
| `true` | Flowing — chunks are pushed at you as fast as they arrive |
| `false` | Paused after having flowed — `pause()` or backpressure |

What switches a stream to flowing: `.on('data')`, `.pipe()`, `.resume()`.
What switches it back: `.pause()`, `.unpipe()`, or a `false` from a piped
destination.

## The data-loss window

```js
// lost.mjs
import { Readable } from 'node:stream';
const s = Readable.from(['one', 'two', 'three']);
s.resume();                       // something started the flow — a .pipe(), a .resume(), a library
let got = 0;
setImmediate(() => {
  s.on('data', () => got++);
  setTimeout(() => console.log(`late 'data' handler received ${got} of 3 chunks; already ended: ${s.readableEnded}`), 20);
});
```

```console
$ node lost.mjs
late 'data' handler received 0 of 3 chunks; already ended: true
```

**Once a stream is flowing, chunks emitted before your handler attaches are gone
forever.** One tick of delay was enough to miss everything. This is why
`await someSetup()` before attaching a `'data'` handler to an incoming HTTP
request is a real bug — and why middleware that calls `req.resume()` to discard a
body destroys any later attempt to read it.

A never-consumed stream is the mirror-image problem: it never emits `'end'`, so
its file descriptor or socket stays open. Consuming a body you do not want is
`req.resume()`; abandoning it is `req.destroy()`.

## Pull mode with `'readable'`

```js
// pull.mjs
import { Readable } from 'node:stream';
const s = Readable.from(['one', 'two', 'three']);
s.on('readable', () => {
  let chunk;
  while ((chunk = s.read()) !== null) process.stdout.write(`[pull ${chunk}]`);
});
s.on('end', () => console.log('\ndone'));
```

```console
$ node pull.mjs
[pull one][pull two][pull three]
done
```

`'readable'` + `read()` is the explicit pull API: you decide when to take data,
so there is no loss window. `read(n)` can request an exact byte count, which is
the one thing `for await` cannot do — useful for fixed-size binary headers.

**Do not mix `'readable'` and `'data'` on the same stream.** They are different
modes; attaching both gives undefined-looking behaviour.

## Which API to use

| Situation | Use |
|---|---|
| Normal consumption | `for await...of` |
| Stream to stream | `pipeline` |
| Need an exact number of bytes | `'readable'` + `read(n)` |
| Need `'close'`/`'drain'`/`'unpipe'` specifically | events |
| Discard an unwanted body | `req.resume()` (drain) or `req.destroy()` (abandon) |

## Gotchas

**Symptom:** Request body is empty when read after an `await`
**Cause:** The stream started flowing and the chunks were emitted before the
handler attached.
**Fix:** Attach the consumer synchronously, or `req.pause()` first and resume
after setup.

**Symptom:** `'end'` never fires
**Cause:** Nobody consumed the data.
**Fix:** Consume it, `resume()` it, or `destroy()` it — otherwise the handle
leaks.

**Symptom:** Cleanup code in `'end'` never runs after a failure
**Cause:** An errored stream emits `'error'` then `'close'`, never `'end'`.
**Fix:** Clean up in `'close'`, or use `finished()`/`pipeline`.

**Symptom:** Both `'error'` and later events fire and cleanup runs twice
**Cause:** `'close'` follows `'error'` by design.
**Fix:** Guard with a flag, or let `finished()` collapse it into one callback.

**Symptom:** Chunks are missing when `'readable'` and `'data'` are both attached
**Cause:** Two competing modes on one stream.
**Fix:** Pick one.

**Symptom:** `'drain'` never fires
**Cause:** `write()` never returned `false`, so there is nothing to drain. Waiting
unconditionally deadlocks.
**Fix:** Only wait for `'drain'` after `write()` returns `false`.

**Symptom:** An HTTP server hangs on requests with bodies you ignore
**Cause:** The unread body keeps the socket alive.
**Fix:** `req.resume()` to discard it.

## Interview questions

**★ What is the difference between flowing and paused mode?**
In paused mode data is pulled with `read()`; in flowing mode it is pushed at you
via `'data'` events as fast as it arrives. Streams start with
`readableFlowing === null` — no consumer, nothing read — and switch to flowing on
`.on('data')`, `.pipe()` or `.resume()`.

**★ Why can attaching a `'data'` handler late lose data?**
Because the stream is already flowing, and chunks emitted before your listener
existed were dropped. Verified: attaching one tick after `resume()` received 0 of
3 chunks.

**★ What is the difference between `'end'`, `'finish'` and `'close'`?**
`'end'` — a Readable has no more data (and only fires if consumed). `'finish'` —
a Writable flushed everything after `end()`. `'close'` — the resource is
released; it is the last event and the only one guaranteed after `'error'`.

**★ Where do you put cleanup code?**
`'close'`, or `stream.finished(stream)`, which fires for success and failure
alike. `'end'` is wrong because it never fires on an errored stream.

**A stream nobody reads — what happens?**
Nothing is read, `'end'` never fires, and the descriptor or socket stays open. To
discard a body, `resume()` it; to abandon it, `destroy()` it.

**When would you use `'readable'` and `read(n)` over `for await`?**
When you need an exact number of bytes — a fixed-size protocol header — since
`read(n)` returns exactly `n` bytes or `null`, which the iterator cannot express.

---

← Prev: [Consuming with for await](11-for-await-of.md) · Next → [Transform streams](./transform-streams/)
