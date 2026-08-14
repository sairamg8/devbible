---
title: "Operational vs programmer errors"
sidebar_label: "05 · Error kinds"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Operational errors are expected at the edge (bad input, not found). Programmer
errors are bugs. At the HTTP edge: expose the first, hide the second, log both.**

> Verified: 2026-08-14 — **no sandbox run**. The operational/programmer split is a
> **Node.js community distinction**, not an Express API: nothing in the Express docs
> names it, and no code path branches on it. What Express does supply is the mechanism
> the split relies on — a single four-arg handler that sees every request-scoped failure,
> and a default that reveals `err.stack` in development but not in production
> ([error handling](https://expressjs.com/en/guide/error-handling.html)).
> Process-level policy for programmer errors — `uncaughtException`, `unhandledRejection`,
> and why the answer is to exit — is Node's, and is covered in
> [Node Phase 5](../../../nodejs/pages/phase-5-http-processes/README.md) rather than
> repeated here.

| Kind | Example | Client sees |
|---|---|---|
| Operational | Invalid JSON, 404, 409 | Clear message + code |
| Programmer | `Cannot read properties of undefined` | Generic 500 |

Do not keep the process alive after unknown programmer errors in a bad state —
process-level policy is Node’s syllabus (`uncaughtException` → log and exit).
Express error middleware is for **request-scoped** failures.

## Telling them apart in practice

The distinction is not about severity — it is about **whether the failure was
anticipated**. A useful test: *could this happen with correct code and a hostile
user?*

| | Operational | Programmer |
|---|---|---|
| Cause | The world — bad input, missing row, dependency down | Your code — a wrong assumption |
| Anticipated? | Yes; you wrote the branch that raises it | No; if you had anticipated it you would have fixed it |
| Recoverable? | Yes, per request | Not meaningfully — the assumption is already broken |
| Client sees | Specific `code` + message | Generic 500 |
| Fix | Usually the caller's, sometimes a retry | A commit |

Two cases that look ambiguous and are not:

- **A database timeout is operational.** Databases time out; you knew that when you
  wrote the query. Map it to 503.
- **`TypeError: Cannot read properties of undefined` is a programmer error even when
  triggered by user input.** The input revealed a missing check — the bug is yours.

The practical marker is that you *raised* the one and *received* the other. Anything
your own code constructed with a `statusCode` is operational by construction.

## Why "log both" is not a hedge

They go to different places for different reasons.

- **Operational errors are a metric.** One 404 is nothing; a thousand from one client
  is an integration breaking. Log them at `warn`/`info` and count them.
- **Programmer errors are an alert.** Every single one is a bug with a stack trace,
  and it should reach whoever is on call. Log at `error` with the full stack.

Logging both at the same level destroys this: a real bug drowns in a sea of
routine 404s, and nobody notices the one line that mattered. What to log, and what
must never be logged, is [page 07](07-error-logging.md).

## Trade-off

Treating every unknown error as a programmer error — generic 500, full stack in
the log, alert someone — is the safe default, and it costs you specificity. Some
operational failures will be miscategorised and page an engineer at 3am for a
flaky upstream.

The opposite bias is worse. Guessing that an unrecognised error is "probably
operational" and echoing its message back is exactly how internal paths, driver
messages and schema names reach the public. **Fail towards generic.** Then move
specific failures into the operational bucket deliberately, one by one, as you
learn what they are.

## Gotchas

**Symptom:** A 500's message quotes a table or column name  
**Cause:** A driver error forwarded with its message intact  
**Fix:** Never pass a driver error through. Catch it where it happens, map it to your
own `code` and message, keep the original for the log only

**Symptom:** Genuine bugs are invisible because the error log is all 404s  
**Cause:** Both kinds logged at the same level  
**Fix:** Operational at `warn`, programmer at `error`. Alert only on the latter

**Symptom:** The process keeps serving requests after a corrupted-state bug  
**Cause:** A programmer error swallowed by request-scoped error middleware  
**Fix:** Error middleware handles the *response*; it does not decide the process is
healthy. Process-level policy belongs in Node — log and exit, let the supervisor restart

**Symptom:** Users see "Internal Server Error" for something they could have fixed  
**Cause:** A validation failure landing in the unknown-error branch because it carried no
`statusCode`  
**Fix:** Give every deliberately-raised error a `statusCode` and `code` at the point it
is thrown. Untagged means unknown, and unknown means generic — by design

## Interview questions

**★ Why hide programmer error messages?**  
They leak paths, schemas, and exploit detail.

**★ How do you tell an operational error from a programmer error?**  
Ask whether it was anticipated. If your own code raised it deliberately — with a
status and a code — it is operational. If you received it and it reveals a broken
assumption, it is a bug. Severity is not the test; a database outage is operational
and a `TypeError` is not.

**★ Should error middleware ever exit the process?**  
No. It is request-scoped: its job is to respond. Deciding the process is unrecoverable
is a Node-level concern — `uncaughtException` handling, log and exit, let the
supervisor restart.

**A user's malformed input triggers a `TypeError`. Which kind is it?**  
Programmer. The input exposed a missing validation; the fix is a commit, not a
message to the client. Return a generic 500 and alert on it.

**Why log operational errors at all if they are expected?**  
Because the aggregate is a signal even when each one is not. A spike of 409s means
two clients are racing; a spike of 401s from one key means a rotation went wrong.

---

← Prev: [Mapping to HTTP](04-mapping-to-http.md) · Next → [404 and process errors](06-not-found-and-process.md)
