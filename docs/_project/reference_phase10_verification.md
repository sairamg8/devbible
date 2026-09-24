---
name: devbible-phase10-verification
description: Verification pass over Grok's Phase 10 draft — what was measured on Node 24.19.0, what is still unverified, and the findings the draft could not have known
metadata:
  type: reference
---

Child of [[devbible-progress]]. Phase 10 was **drafted externally by Grok** and landed
**directly in `docs/`** rather than `drafts/`. Scripts: `sandbox/p10-observability/`
(`ex1-builtins` `ex2-lag` `ex3-diag` `ex4-reports` `ex5-trace` `ex6-logging` `ex7-pipe`).

## How the draft behaved

**It followed the two hard rules.** Zero `> Verified:` lines — no false promises — and
**25 honest `<!-- VERIFY -->` markers** across 16 files. Structure, tiers, gotcha shape
and interview-question shape all matched the spec. The prose is usable.

**12 of 25 markers resolved** in this pass, all built-in APIs. **9 remain**, all
third-party packages (`pino`, OTel, `prom-client`, `autocannon`/`mitata`, `0x`/`clinic`)
whose versions are not pinned. The phase README says so explicitly.

## Measured on Node 24.19.0

**Event loop lag (page 09) — the two findings that change how the metric is read:**
```
idle (resolution 10)      p50 10.23ms  p99 11.45ms  max  11.48ms
after one 100ms block     p50 10.20ms  p99 11.48ms  max 114.88ms
after 5x 100ms blocks     p50 10.20ms  p99 110.23ms max 114.88ms
idle (resolution 1)       p50  1.08ms  p99  1.24ms  max   1.70ms
after one 200ms block                               max 201.33ms
```
**The idle p50 is the sampling resolution, not lag** — alerting on "p50 > 5ms" at the
default alerts on arithmetic. And **a single stall is invisible in percentiles**: one
block moved only `max`. `max` is the smoke alarm, p99 is the trend.

*Method note:* calling `h.reset()` immediately before a sync block loses the sample —
the first attempt reported max 11.31ms and looked like the block never happened.

**`--max-old-space-size=256` reports `heap_size_limit` of 448 MB**, not 256 — the limit
covers more than old space. Default 4288 MB on a 15763 MB machine.

**`process.report.getReport()` returns an object, not a string** —
`JSON.parse(getReport())` throws `SyntaxError: "[object Object]" is not valid JSON`.
`writeReport()` returns the filename. All three auto-triggers default **false**. Report
includes `environmentVariables`, so it is a secrets-bearing artifact.

**`createTracing` does not validate categories** — `bogus.category` enabled without
error and `getEnabledCategories()` reported it. A typo is an empty trace file.

**diagnostics_channel names that actually fire:** `http.server.request.start`,
`http.server.response.finish`, `net.client.socket`, `undici:request:create|headers|trailers`.
**Core uses dots, undici uses colons**; a wrong separator fails silently.
`tracingChannel` order is **start → end → asyncStart → asyncEnd** — `end` brackets the
sync call, not completion. `Object.keys(tc)` is `[]` (accessors).

**Other:** `memoryUsage()` all bytes, ~50 MB RSS on a do-nothing process, heapUsed 4.6 MB.
GC entry `detail: {"kind":1,"flags":0}`, duration ~1 ms for a minor.
`writeHeapSnapshot()` returns the filename. `--cpu-prof`/`--heap-prof` write
`CPU.*.cpuprofile` / `Heap.*.heapprofile` **on exit only**.
`enableCompileCache()` → `{"status":1,"directory":"/tmp/node-compile-cache"}`, dir keyed
by version+arch+hash, and **under `/tmp`** so containers lose it every restart.

## A claim that did NOT reproduce

Page 01 asserted that sync stdout writes block the loop. 20 000 × 500-byte lines to a
redirected stdout: **62 ms, max lag 2.2 ms** — no stall. Node writes pipes/sockets
asynchronously, files/TTYs synchronously. The page now says this honestly and keeps the
async-logger recommendation as a tail risk that depends on a slow consumer.
**Do not let a later pass "fix" this back into a confident claim.**

## Build traps confirmed here

**`grep -icE 'warning|broken'` is not enough** — a failing build prints `[ERROR]` and
neither word. Check the **exit code** too. A build that ran while `build/` and
`node_modules/.cache` were deleted in the same command failed with
`ENOENT … build/__server/server.bundle.js`; a plain retry succeeded.

**A newly created `README.md` needs the cache cleared** — see [[devbible-progress]].
