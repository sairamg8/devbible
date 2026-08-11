---
title: "Why streams exist"
sidebar_label: "07 · Why streams exist"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A stream processes data in chunks so memory stays constant no matter how much
data there is. Without one, your peak memory is the size of the largest thing a
user ever uploads — and that number is not under your control.**

## The measurement

Same job — count matching lines in a 216 MB log — two ways.

```js
// mem-readfile.mjs
import { readFile } from 'node:fs/promises';

const t = Date.now();
const data = await readFile('big.log');
let count = 0;
for (const line of data.toString().split('\n')) if (line.includes('order.created')) count++;
console.log(`readFile : ${count} lines, ${Date.now() - t}ms, peak RSS ${(process.memoryUsage.rss() / 1024 / 1024).toFixed(0)} MB`);
```

```js
// mem-stream.mjs
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const t = Date.now();
let count = 0, peak = 0;
const rl = createInterface({ input: createReadStream('big.log'), crlfDelay: Infinity });
for await (const line of rl) {
  if (line.includes('order.created')) count++;
  if ((count & 0xffff) === 0) peak = Math.max(peak, process.memoryUsage.rss());
}
console.log(`stream   : ${count} lines, ${Date.now() - t}ms, peak RSS ${(Math.max(peak, process.memoryUsage.rss()) / 1024 / 1024).toFixed(0)} MB`);
```

```console
$ node mem-readfile.mjs
readFile : 400000 lines, 1106ms, peak RSS 670 MB
$ node mem-stream.mjs
stream   : 400000 lines, 1133ms, peak RSS 88 MB
```

**670 MB versus 88 MB, for the same answer in the same time.** Note the file is
216 MB but `readFile` peaked at 670 — it holds the Buffer, then the decoded
string (UTF-16, so roughly double), then the array of split lines. Buffering does
not cost you the file size; it costs you the file size times however many
representations you create.

The streaming version's 88 MB is flat. Point it at a 20 GB file and it is still
88 MB.

## The hard ceilings

Buffering does not degrade gracefully. It works, works, works, then throws.

```js
// limits.mjs
import { readFileSync } from 'node:fs';
const buf = readFileSync('huge.log');          // 781 MB file
console.log('buffer ok', buf.length);
try { buf.toString(); } catch (err) { console.log('toString ->', err.code, '|', err.message); }
```

```console
$ node limits.mjs
buffer ok 819000000
toString -> ERR_STRING_TOO_LONG | Cannot create a string longer than 0x1fffffe8 characters
```

- **A V8 string caps at 0x1fffffe8 characters (~512 MB).** `buffer.constants.MAX_STRING_LENGTH`.
  Any `readFile(path, 'utf8')` or `.toString()` on a bigger file throws. No
  workaround exists except not doing it.
- **A Buffer caps at 2^53−1 bytes** on 64-bit Node 24 (`buffer.constants.MAX_LENGTH`),
  so buffers are not the limit — memory is.
- **The container's memory limit** is the real one. A 512 MB pod dies at file
  #2 when two requests upload 300 MB each.

## Where this decides your architecture

| Job | Buffered | Streamed |
|---|---|---|
| Serve a 2 GB video | impossible | `createReadStream().pipe(res)` |
| Accept a user upload | peak RSS = upload size × concurrency | constant |
| Export 5M rows to CSV | OOM | constant, and the client sees bytes immediately |
| Proxy an upstream response | double buffering, doubled latency | constant, first byte immediately |
| Read a 2 KB config at boot | **fine — do this** | pointless complexity |

The second benefit is **latency**. A streamed response sends its first byte as
soon as the first chunk exists. A buffered one sends nothing until the last byte
is computed. For an export endpoint that is the difference between a browser
showing a download immediately and a proxy timing out at 30 s with nothing sent.

```js
// export.mjs — the shape of a streaming export endpoint
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

async function exportOrders(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="orders.csv"',
  });

  async function* rows() {
    yield 'id,amount,region\n';
    for await (const row of db.queryStream('SELECT id, amount, region FROM orders')) {
      yield `${row.id},${row.amount},${row.region}\n`;
    }
  }

  await pipeline(Readable.from(rows()), res);   // constant memory, first byte immediately
}
```

The same endpoint written with `rows.map(toCsv).join('\n')` holds every row in
memory twice and sends nothing for a minute.

## When NOT to stream

Streaming is not free. It costs you:

- **Complexity** — error handling, backpressure, cleanup on every path.
- **Random access** — you see each chunk once, in order.
- **Whole-value operations** — you cannot `JSON.parse` a stream (without a
  streaming parser), cannot sort, cannot compute anything needing all the data.

So: **if the data is bounded and small, buffer it.** A config file, a 10 KB JSON
body, a 50-row query — `readFile` and `await json(req)` are correct, and turning
them into streams is a self-inflicted wound.

The line is *"is there any input size the user controls?"* If yes, stream or
enforce a hard limit. Usually both.

## Where the chunks come from

Node's default read size is 64 KB (`stream.getDefaultHighWaterMark(false)` —
raised from 16 KB in Node 22, so older articles disagree). One `data` event is
one chunk, and **chunk boundaries have no relationship to your data's structure**:
lines, JSON records and multi-byte characters split across them freely. Every
stream consumer either uses a boundary-aware helper (`readline`, a splitter
Transform) or handles reassembly itself — see [page 05](05-string-decoder.md).

## Gotchas

**Symptom:** Memory climbs with traffic and the pod is OOM-killed under load
**Cause:** Buffering request bodies or responses; peak = size × concurrency.
**Fix:** Stream, and cap body size regardless.

**Symptom:** `ERR_STRING_TOO_LONG` on a large file
**Cause:** A string above ~512 MB was requested.
**Fix:** Stream it. There is no larger string.

**Symptom:** Export endpoint times out at the proxy though the query is fast
**Cause:** Nothing is written until every row is formatted.
**Fix:** Stream rows out as they arrive; the first byte resets the proxy's idle
timer.

**Symptom:** Works with test data, dies on a real file
**Cause:** Fixtures are small enough to fit in one chunk and in memory.
**Fix:** Test with a file bigger than the container's memory limit.

**Symptom:** Streaming code is buggy and the data was 4 KB
**Cause:** Streaming applied where buffering was correct.
**Fix:** Buffer bounded, small data. Streams are for unbounded or large inputs.

## Interview questions

**★ Why do streams matter if the machine has enough RAM?**
Because peak memory is size × concurrency, and both are user-controlled. Ten
simultaneous 300 MB uploads is 3 GB with buffering and roughly constant with
streaming. Measured on a 216 MB file: 670 MB RSS buffered versus 88 MB streamed.

**★ Why did buffering a 216 MB file cost 670 MB?**
Three representations live at once: the Buffer, the decoded UTF-16 string
(roughly double the bytes), and the array produced by splitting it. Buffering
costs the file size times the number of copies you make.

**★ What hard limit does buffering hit that has no workaround?**
V8's maximum string length, 0x1fffffe8 characters (~512 MB). `readFile(path,
'utf8')` on anything larger throws `ERR_STRING_TOO_LONG`. Buffers themselves go
to 2^53−1 bytes, so the string is the wall.

**★ When is streaming the wrong choice?**
When the data is bounded and small, or when the operation needs the whole value —
`JSON.parse`, sorting, aggregation. Streaming adds error-handling and
backpressure complexity that a 10 KB config file does not justify.

**Besides memory, what does streaming improve?**
Time to first byte. A streamed response starts sending immediately instead of
after the last byte is computed, which keeps proxies and browsers from timing
out on long exports.

**Is a chunk a line?**
No. Chunks are byte-count-driven (64 KB by default) and split lines, JSON
records and multi-byte characters arbitrarily. Consumers must reassemble.

---

← Prev: [Binary data and endianness](06-binary-data-and-endianness.md) · Next → [The four stream types](08-stream-types.md)
