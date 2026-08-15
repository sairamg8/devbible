---
title: "02 · Results versus exceptions"
sidebar_label: "02 · Results vs exceptions"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`try...catch`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError), [`console.error()`](https://developer.mozilla.org/en-US/docs/Web/API/console/error_static), [`unhandledrejection`](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event). Documentation-validated; **no timings, no console blocks**.

Two ways to report a failure, and the choice is not a matter of taste — it depends on whether the
failure is **expected** at that call site.

```js
// exception: the caller usually cannot continue
const user = await getUser(id);            // throws NotFoundError

// result object: the caller is expected to handle both outcomes
const result = parseEmail(input);          // { ok: true, value } | { ok: false, error }
```

## The rule: expected failures are values, unexpected failures are exceptions

| The failure is… | Report it as | Because |
|---|---|---|
| Part of normal operation — invalid input, "not found" on a lookup that often misses | a **result** | the caller has a branch for it anyway; an exception is control flow with extra steps |
| Exceptional — the database is down, a required file is missing, an invariant broke | an **exception** | most callers cannot do anything, and it must not be forgettable |
| A programmer error — a `TypeError`, an assertion | 🔴 **an exception, never caught locally** | it needs to reach your reporting, not be handled |

🔴 **The deciding question: will *most* callers immediately `try`/`catch` this?** If yes, it was
never exceptional and a result object says so honestly. If almost no caller can handle it, an
exception is right — it propagates by default, which is exactly what you want.

### What each style costs

**Exceptions** are invisible in the signature — nothing tells a caller what can be thrown, and
nothing forces them to handle it. That is their weakness and, for genuinely exceptional failures,
their strength: forgetting is the correct default, because the error keeps travelling.

**Result objects** are explicit and checkable, and the caller cannot ignore the failure without
it being visible in the code. The cost is ceremony at every call site, and the risk that people
propagate `{ ok: false }` upward by hand — badly — turning your codebase into exception handling
implemented in `if` statements.

```js
const r = parseEmail(input);
if (!r.ok) return r;                 // ⚠️ fine once; a smell at every layer
```

**A pragmatic split that works: results at the boundary, exceptions inside.** A parse or a
validation returns a result because both outcomes are ordinary; everything behind it throws,
because by then the data is known good and a failure means something broke.

⚠️ **`Promise.allSettled` is a result-object API** — `{ status: 'fulfilled', value }` or
`{ status: 'rejected', reason }`. When you find yourself designing a result shape, matching that
one means callers already know how to read it
([Phase 7 · 16 · The bounded pool](../../phase-7-async/16-concurrency-limiting/02-the-bounded-pool.md)).

## The empty `catch` is the most expensive line in this topic

```js
try { await sync(); } catch {}        // 🔴 the failure happened; nothing recorded it
```

The program continues in a state it did not verify, the user is told nothing, and the incident
leaves no trace. **Every `catch` must do at least one of four things:**

| | What it means |
|---|---|
| **Handle** | recover meaningfully — fall back, use a default, retry |
| **Translate** | rethrow with context and `cause` ([08](../08-custom-error-classes/02-cause-chains-and-boundaries.md)) |
| **Report** | log or send to error tracking, then continue deliberately |
| **Rethrow** | it is not yours — let it go up |

**If the answer really is "ignore it", write that down:**

```js
try {
  await navigator.clipboard.writeText(text);
} catch {
  // Clipboard permission denied or unavailable — the copy button is a convenience,
  // and the text is already selectable. Nothing to report.
}
```

🔴 **A comment is the difference between a decision and an oversight.** The next reader cannot
tell them apart from the code alone, and neither can you in six months.

## Do not report the same failure five times

```js
// ❌ every layer logs
catch (err) { console.error(err); throw err; }
```

Layered logging multiplies one incident into a wall of duplicates, and the duplicates are what
make people stop reading the log. **Log where you handle**, not where you pass through — a layer
that rethrows should add context via `cause`, not a log line.

**One place decides what the user sees**, too. A toast per layer is the same bug with a worse
symptom: the user gets three notifications for one failure.

## Do not turn a failure into a value that lies

```js
// ❌ every one of these hides a failure behind plausible data
catch { return []; }         // "no results" — but we never asked
catch { return 0; }          // a total that is not the total
catch { return null; }       // now the caller has an unexplained null
```

An empty array means "there are none". If you do not know, that is a different state, and
conflating them produces a UI that confidently shows "No orders" during an outage.

**Make the unknown state explicit** — three states rather than two:

```js
const [state, setState] = useState({ status: 'loading' });
// → { status: 'ready', orders } | { status: 'error', error } | { status: 'loading' }
```

🔴 **"Empty" and "failed" must look different to the user.** The fallback is the mechanism; the
message is what makes it honest.

## What the user sees, and what you keep

| | Show the user | Keep in logs |
|---|---|---|
| What happened | in their vocabulary — "We could not save your order" | the full `cause` chain and stack |
| What to do | "Try again" — and a control that does | the request id, so support can find it |
| Internals | 🔴 never — no stacks, no SQL, no hostnames | everything |

**Give them the next action.** An error message with no recovery path is a dead end; a retry
button, a link back, or a "we have been notified" is the difference between an error screen and a
usable one.

⚠️ **Include a correlation id when you have one.** "Reference: 8f3a1c" costs one line and turns an
unreproducible report into a log search.

## Gotchas

**Symptom: a failure leaves no trace anywhere.**
Cause — an empty `catch`.
Fix — handle, translate, report or rethrow; if genuinely ignoring, write the reason as a comment.

**Symptom: one incident produces a dozen identical log entries.**
Cause — every layer logs and rethrows.
Fix — log where you handle; pass context up with `cause`.

**Symptom: the UI shows "No results" during an outage.**
Cause — a `catch` returned `[]`.
Fix — model loading, empty and error as distinct states.

**Symptom: a `null` propagates far from its origin and fails elsewhere.**
Cause — a `catch` that returned `null` instead of failing or explaining.
Fix — return a result with the error, or throw.

**Symptom: callers wrap every call in `try`/`catch`.**
Cause — an expected failure is being reported as an exception.
Fix — return a result object for that case.

**Symptom: result objects are threaded by hand through five layers.**
Cause — results used where an exception was appropriate.
Fix — results at the boundary, exceptions inside.

**Symptom: a user sees a stack trace or a database hostname.**
Cause — the internal message was rendered.
Fix — show the boundary message; log the chain; include a correlation id.

## Interview questions

**★ Result object or exception?**
Expected failures — invalid input, a lookup that often misses — are results, because the caller
has a branch for them anyway. Unexpected failures are exceptions, because most callers cannot act
and forgetting should propagate. Programmer errors are always exceptions and are not caught
locally.

**★ What is wrong with an empty `catch`?**
The failure happened, the program continued in an unverified state, and nothing recorded it. Every
`catch` should handle, translate, report or rethrow — and a deliberate ignore needs a comment
saying why.

**★ Why not log in every layer?**
One incident becomes many entries, which is how logs stop being read. Add context with `cause` on
the way up and log once, where the error is handled.

**★ Why is `catch { return [] }` dangerous?**
It reports "there are none" for a failure to find out, so the UI shows "No orders" during an
outage. Loading, empty and error are three different states.

**★ What should an error message contain?**
What happened in the user's terms, what they can do next, and a correlation id. Never internals —
stacks, queries and hostnames belong in logs.

**★ Where does the result-versus-exception split usually fall in practice?**
Results at the boundary — parsing and validation, where both outcomes are ordinary — and
exceptions inside, where the data is already known good.

**Does `Promise.allSettled` return results or throw?**
Results: `{ status, value }` or `{ status, reason }` per input. It is the standard library's own
result-object shape and worth copying.

---

← [01 · Validate at the boundary](./01-validate-at-the-boundary.md) · [Topic index](./README.md)
