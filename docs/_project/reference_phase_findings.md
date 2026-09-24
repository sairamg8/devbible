---
name: devbible-phase-findings
description: Sandbox findings that contradicted common advice or corrected an already-written page, Node phases 0–5 — the reasons the pages say what they say
metadata:
  type: reference
---

Child of [[devbible-progress]]. Everything here was **executed on Node 24.19.0**,
not recalled.

**This is not a log of everything measured.** Per the test in
[[devbible-memory-file-cap]], a finding that simply *is* what a page says was left
out — the page is the record. What survives here is the subset that earns its
space: findings that **contradict widely-repeated advice** (so nobody "fixes" a
page back to the folklore), and findings that **corrected a page after it was
written** (so the correction is not silently undone).

## Findings that corrected an already-written page

These are the expensive ones — each was written wrong first and caught by running it.

- **`fetch(url, { dispatcher })` throws `UND_ERR_INVALID_ARG`** when the Agent comes
  from the **npm** `undici`. Node's built-in fetch and the bundled undici are
  different classes and the instance check fails. `setGlobalDispatcher` *does* cross
  the boundary; the per-call option does not. Fix: import `fetch` from `undici` too,
  or use the global dispatcher. **Invalidated two examples already drafted; Phase 5
  pages 07 and 08 were rewritten.**
- **Worker threads are NOT faster to start than forked processes** — median **59 ms
  vs 56 ms**; both boot a V8 isolate. The real advantage is memory: 4 threads added
  23 MB to the parent against ~49 MB *each* for 4 processes. **Corrected "starts far
  faster" claims already written on Phase 5 pages 19 and 21.**
- **`.js` specifiers are NOT rewritten to `.ts`.** Running `.ts` directly requires
  importing `./helper.ts`; the `./helper.js` convention only works if you compile.
  Written wrong in a first draft.
- **`Readable.from('abc')` emits ONE chunk, not one per character** — Node
  special-cases strings and Buffers. The common "one char per chunk" claim was
  written first and the run contradicted it.
- **A fixed-length "keep the last 32 chars" tail does not work** for a Transform that
  redacts across chunk boundaries — a match can still span the cut. Splitting on
  newlines and holding the partial line is the correct shape.
- **`ulimit -n` here is 524288 and inotify `max_user_watches` is 134494**, not the
  1024 and 8192 every article quotes. Both were written from the folklore and had to
  be corrected; the pages now say "check it — the variance is why leaks don't
  reproduce locally".

## Findings that contradict common advice

Keep these; a well-meaning later edit would otherwise "correct" the pages back.

**Async and the event loop**

- **`process.nextTick` does NOT always run before promises.** In `.cjs`: nextTick →
  promise → queueMicrotask. The *identical* file as ESM: promise → queueMicrotask →
  **nextTick last**, because ESM top-level code is itself a microtask. Inside any
  ordinary callback the classic order returns.
- **The `async` executor folklore is out of date.** `new Promise(async () => { throw
  … })` is said to swallow the error silently. On Node 24 it surfaces as an
  `unhandledRejection` and **kills the process**, while the constructed promise
  **never settles**. Both halves matter.
- **Event loop delay histograms cannot detect nextTick starvation or a blocking
  loop** — sampled by a timer that never runs. Reported max delay was 0 ms during a
  1139 ms block. Use `--cpu-prof`.
- `Promise.all` rejecting does **not** leave sibling rejections unhandled — it
  attaches handlers to every input. `Promise.race` does **not** cancel losers.
- **Abort reason ≠ error message.** `ac.abort(new Error('user cancelled'))` still
  rejects with a generic `AbortError` whose message is `The operation was aborted`;
  the custom reason is only on `signal.reason`. Bare `abort()` gives DOMException
  `code 20`, whereas `AbortSignal.timeout()` gives `code ABORT_ERR`.

**Buffers, streams, filesystem**

- **`Buffer.poolSize` is 65536 on Node 24**, not the 8192 older articles say; pooling
  applies below 32768. Default `highWaterMark` is **65536, raised from 16 KiB in Node
  22**; `Readable.from` is **1**.
- **The `allocUnsafe` leak is reproducible, not theoretical** — with enough churn,
  **2189 of 5000** `allocUnsafe(80)` buffers contained a previously-freed password.
  The naive "allocate 8 then read one" version recovers nothing.
- **brotli's default quality is 11 and is unusable per-request**: 19.1 MB took
  **75 729 ms** versus 667 ms at quality 4 and 784 ms for gzip level 6.
- `.pipe()` after a mid-chain error **leaves both ends open**; `pipeline` destroys
  both. Without an `'error'` listener the unhandled event kills the process.
- **`stat` can never identify a symlink** (`isFile true / isSymbolicLink false`), and
  on a *broken* symlink `stat` throws `ENOENT` while `lstat` works.
- **The missing-`path.sep` bug is real**: `resolve(ROOT,'../uploads-evil/x')
  .startsWith(ROOT)` is `true`. Must be `ROOT + path.sep`. Symlinks defeat every
  string check, so `realpath` + re-check is mandatory.

**HTTP and processes**

- **`requestTimeout` alone does nothing** — it is enforced by a sweep whose interval,
  `connectionsCheckingInterval`, defaults to **30 000 ms**. Set both or a 2 s timeout
  is noticed 30 s later.
- **A thrown handler never becomes a 500.** The client hangs until *its* timeout. An
  `async` handler routes even a *synchronous* throw to `unhandledRejection`.
- **Order matters on a 413**: `req.destroy()` before responding gives the client a
  socket error, which looks retryable, so clients hammer you. Respond *then* destroy.
- **CORS is advisory.** A Node `fetch` with a spoofed `Origin` got 200 and read every
  header from a server sending no CORS headers. A *rejected* preflight still returned
  200 with a body — the browser is what refuses.
- **`URLSearchParams` is the wrong cookie parser**: `note=a+b` parses as `"a b"`, last
  duplicate wins where cookies take the first, and valueless tokens become keys.
- **An unread `fetch` response body pins its pooled connection** — with
  `connections: 1` the second request never started at all.
- **`AbortSignal.timeout` covers the response body too** — headers at 25 ms, still
  aborted at 802 ms under an 800 ms deadline.
- **`http.globalAgent.keepAlive` is `true`** (since Node 19), so the old advice to
  construct an Agent to enable it is stale. But **undici's default dispatcher does
  not bound per-origin concurrency**: 20 parallel `fetch` → 19 connections.
- **`server.close()` alone never completes** while one idle keep-alive socket is
  parked, and **one** call to `closeIdleConnections()` is also not enough — a
  connection becomes idle *after* its request finishes. `closeAllConnections()`
  completes instantly but **kills the in-flight request**. Working recipe:
  `close()` + a repeating idle sweep + an unref'd forced backstop.
- **`process.exit()` truncates a pipe write**: 10 MB written, **65 536 bytes
  delivered**, callback never fired — but **200 000 small writes all arrived**. So
  "it worked when I tested it" proves nothing here.
- **`dns.lookup` 1066 ms vs `dns.resolve4` 15 ms** for the same name with the libuv
  pool saturated. `localhost` resolves `::1` first under the `verbatim` default.
- **cluster round-robins connections, not requests**: 40 requests over one keep-alive
  connection went to **1 of 4 workers**; keep-alive off gave exactly 10 each.
- **The shared-memory data race is non-deterministic**: 4 threads × 2 M non-atomic
  increments lost 1 845 540, then **0**, then 687 242 across three runs. A start
  barrier was needed to make it appear at all.
- **Shell injection defeats *quoted* interpolation two ways**:
  `report.txt"; cat secrets; echo "` closes the quote, and `$(cat …)` substitutes
  **inside double quotes** with no escape needed.
- **`node:` prefix — the "unshadowable" claim is wrong.** Core already beats
  `node_modules` for `path`/`fs`. The real hole is the four **prefix-only** builtins
  (`node:sea`, `node:sqlite`, `node:test`, `node:test/reporters`), where the bare
  name falls through to npm and `require('test')` silently loads a package.

## Version facts that are easy to get wrong

- **Type stripping is Stability 2 – Stable as of v24.12.0** (default since v23.6.0,
  warning-free since v24.3.0) — so it is stable *on the LTS target*, not a Node 26
  feature.
- **Node 26 shipped 5 May 2026**, not April. **v27: alpha opens Oct 2026, 27.0.0
  ships April 2027**, LTS Oct 2027, EOL April 2030. Oct 2026 is not a ship date.
- `require(esm)` is no longer experimental as of **v24.15.0**; it returns the
  *namespace*, so default is at `.default`. Fails only on top-level await.
- `mock.module()` is still **1.0 Early development** — the rendered docs page hides
  this because it inherits "Stability: 2" from the Mocking section header.
- `exports` map is exhaustive the moment it exists — even the real file path throws
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## The debt fixes — 2026-08-10

Five known-wrong statements carried since Phase 0, now fixed:

1. **`08-running-node.md`** — the `execArgv` demo used `--watch-path`, which runs the
   script in a child inheriting no watch flags, printing `[]` directly above a
   sentence saying `execArgv` is how you verify a flag landed. Now `--trace-warnings`.
2. **`10-how-v8-optimizes.md`** — the unreproducible **"About 8%"** claim and its
   console block are **deleted**; the snippet is `// pseudo-code` and the qualitative
   lesson replaces them. **Deliberately did not** take Gemini's advice to expand the
   six branches and re-measure: that gives +41%…+111%, almost all of it the extra
   property assignment rather than shape polymorphism (controlled: −6%, +14%, +2%).
3. **`05-node-vs-browser.md`** — dropped the cross-origin `fetch` from `shared.mjs`,
   which the same page's gotcha section refuted two screens later.
4. **`syllabus/01-foundations.md`** — type stripping was "stable in Node 26"; now
   v24.12.0, agreeing with the Phase 1 page that was already right.
5. **`docs/nodejs/README.md`** — Node 26 ship date and the v27 dates, per above.
