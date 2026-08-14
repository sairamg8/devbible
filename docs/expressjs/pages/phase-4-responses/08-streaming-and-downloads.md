---
title: "Streaming and downloads"
sidebar_label: "08 · Streams · downloads"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

**`res.sendFile` and `res.download` stream files with safer path options.
For big dynamic bodies, pipe a stream and handle errors mid-flight.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [`res.sendFile`](https://expressjs.com/en/5x/api/response/): the path *"must be an
> absolute path unless the `root` option is set"*, and when `root` is given Express
> validates that the relative path resolves **within that root** — that is the documented
> traversal guard. `res.download` *"transfers the file as an 'attachment'"* and takes the
> same options, whose documented defaults are `dotfiles` **`"ignore"`**, `maxAge`
> **`0`**, `lastModified` `true`, `acceptRanges` `true`, `cacheControl` `true`,
> `immutable` `false`. `res.attachment(filename)` sets `Content-Disposition` and infers
> `Content-Type` from the extension.
> Stream cleanup below follows [`stream.pipeline`](https://nodejs.org/api/stream.html),
> which destroys every stream in the chain on failure — the reason to prefer it over a
> bare `.pipe()`.

```js
import path from 'node:path';

app.get('/report', (req, res) => {
  const file = path.join(reportsDir, 'latest.pdf');
  res.download(file, 'report.pdf', (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});
```

Always set `root` / resolve paths carefully — path traversal is a Node Phase 4/8
concern. Prefer object storage signed URLs when files are large or private.

## Which of the three

They overlap enough to be confusing, and they are not interchangeable.

| | Serves | Route needed | Use when |
|---|---|---|---|
| `express.static` | A whole directory | No — it is middleware | Public assets, an SPA build, anything with stable URLs |
| `res.sendFile` | One file, inline | Yes | The file is chosen by logic — auth, tenancy, a lookup |
| `res.download` | One file, as an attachment | Yes | The browser should offer *Save as*, with a filename you choose |

`res.download` is `res.sendFile` plus `Content-Disposition: attachment`. If you
find yourself writing a route that maps a URL segment straight onto a filename,
you have re-implemented `express.static` — badly, because yours probably lacks
the traversal guard.

## The `root` option is the security boundary

```js
// ✅ root set — Express verifies the resolved path stays inside it
res.sendFile(req.params.name, {root: path.join(import.meta.dirname, 'files')});

// ⛔ no root — you own every traversal check yourself, and `../` is a real input
res.sendFile(path.join(filesDir, req.params.name));
```

The second form is not merely less tidy. `req.params.name` is client-controlled;
`path.join` will cheerfully resolve `../../etc/passwd`. With `root` set, Express
performs that containment check for you. Treat "no `root`" as a code smell in
any handler whose path comes from the request.

## Streaming a dynamic body

For a response you generate rather than read from disk — a large export, a proxied
object, a report assembled on the fly — pipe it, and let `pipeline` own the cleanup.

```js
import {pipeline} from 'node:stream/promises';

app.get('/export.csv', async (req, res, next) => {
  res.type('csv').attachment('export.csv');
  try {
    await pipeline(rowsAsCsvStream(req.query), res);
  } catch (err) {
    next(err);          // headers are already sent — see page 04
  }
});
```

Two things are load-bearing here:

1. **Set headers before the first byte.** Once the stream writes, the status and
   headers are frozen — [page 04](04-headers-already-sent.md) is the whole story.
2. **`pipeline`, not `.pipe()`.** A bare `.pipe()` leaves the source open when the
   destination fails, which is how a client that disconnects mid-download becomes
   a leaked file handle and, eventually, a leaked process. `pipeline` destroys the
   whole chain.

The `catch` cannot rescue the response — the client has already received a 200 and
part of a body. It exists so the error is *logged* rather than swallowed. A
truncated download is the honest outcome; a silent one is not.

## Compression

`compression` middleware can help JSON APIs; many production stacks terminate
gzip at Nginx instead. Do not double-compress.

The decision is about where the CPU should be spent. Compressing in Node costs
event-loop time on the same thread that serves every other request — measurable
on large JSON payloads. Terminating at Nginx or the CDN keeps that work off the
runtime entirely, and is why most production stacks do it there. Compress in
Express when there is no reverse proxy to do it, or when only some responses are
worth compressing and you want per-route control.

Never do both: double compression wastes CPU on both hops and produces a response
that some intermediaries mishandle.

## Trade-off

Streaming keeps memory flat regardless of payload size — the difference between
serving a 2 GB export and falling over on it. What you give up is the ability to
change your mind: once the first byte is written you cannot switch to an error
status, so every check that might fail has to happen *before* the pipe starts.
Buffering the whole body keeps error handling simple and is the right default
until size makes it untenable.

## Gotchas

**Symptom:** A download that fails halfway leaves the process holding file handles
**Cause:** `.pipe()` does not destroy the source when the destination errors or the
client disconnects
**Fix:** `stream.pipeline` (or `pipeline` from `node:stream/promises`), which tears
down every stream in the chain

**Symptom:** `Error: ENOENT` from `res.sendFile` reaches the client as an unhandled 500
**Cause:** `sendFile`'s error arrives in its callback, not as a thrown exception
**Fix:** Pass a callback — `res.sendFile(p, opts, err => err && next(err))` — and
check `res.headersSent` before trying to send a status, as this page's first example does

**Symptom:** Setting a status after streaming starts silently does nothing
**Cause:** Headers were flushed with the first chunk
**Fix:** Decide the status before the first write; validate and authorise *before*
opening the stream

**Symptom:** `res.download` serves the file but the browser renders it instead of saving
**Cause:** Something later overwrote `Content-Disposition`, or a proxy stripped it
**Fix:** Check the response on the wire, not in the handler — and remember
`res.attachment()` must run before the body is sent

**Symptom:** Compressed responses are larger, or arrive corrupted
**Cause:** Double compression — `compression` in Express *and* gzip at the proxy
**Fix:** Pick one layer. If the proxy compresses, remove the middleware

## Interview questions

**★ sendFile vs download?**  
`download` suggests a filename for the Save dialog; both stream from disk.

**★ What does the `root` option actually protect against?**  
Path traversal. With `root` set, Express verifies the resolved path stays inside
that directory, so a `../../` in a client-supplied segment cannot escape. Without
it the path must be absolute and every containment check is yours.

**★ Why `stream.pipeline` instead of `.pipe()`?**  
`pipe` does not clean up on failure — an errored or disconnected destination
leaves the source open, leaking handles. `pipeline` destroys every stream in the
chain and reports the error.

**A stream fails after 10 MB of a 100 MB response. What can you send the client?**  
Nothing useful. The status and headers went out with the first chunk, so the
client sees a truncated 200. All you can do is destroy the stream and log it —
which is why authorisation and validation belong before the pipe.

**Should compression live in Express or in the reverse proxy?**  
The proxy, when you have one — it keeps the CPU cost off the event loop. Use the
middleware when Express is the edge, or when you need per-route control. Never
both.

**When would you not serve a file through Express at all?**  
When it is large or private: issue a signed URL to object storage instead. Node
then spends no bandwidth, no memory and no event-loop time on the transfer.

---

← Prev: [Cookies out](07-cookies-out.md) · Index: [Phase 4](README.md)
