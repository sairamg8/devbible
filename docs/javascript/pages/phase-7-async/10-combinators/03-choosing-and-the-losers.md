---
title: "10.3 · Choosing, and what happens to the losers"
sidebar_label: "03 · Choosing and the losers"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Promise.race()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race), [`Promise.any()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any). Documentation-validated.

**Two questions pick the combinator, and one fact applies to all four.**

## The decision

**Question 1: do you need every result, or just one?**
**Question 2: what should a failure mean?**

|  | Need **all** results | Need **one** result |
|---|---|---|
| **A failure should fail the operation** | **`all`** — fail-fast | **`race`** — first to settle, rejection included |
| **A failure is tolerable** | **`allSettled`** — never rejects | **`any`** — first to fulfil |

The left column waits for everything; the right takes a winner. The top row treats a
rejection as decisive; the bottom does not.

In one line each:

- **`all`** — "these belong together." A dashboard with no data for one panel is not a
  dashboard.
- **`allSettled`** — "report on each of these." Independent jobs where partial success is a
  real outcome.
- **`race`** — "whichever happens first, including failure." Deadlines.
- **`any`** — "whichever works first." Redundancy.

🔴 **The two commonly confused pairs are `race`/`any` and `all`/`allSettled`, and both
mistakes survive testing** — because in testing nothing fails. `race` used for redundancy
breaks the first time a mirror is down; `allSettled` used where `all` was meant renders an
empty page instead of an error.

## The losers keep running

**None of the four cancels anything.** MDN says it plainly for `Promise.all`:

> the promises "are **not explicitly cancelled** — they continue their internal execution."

The same is true of the rest: `race` does not stop the slow request, `any` does not stop the
mirrors that had not answered, `all` does not stop the siblings of the one that failed.

The consequences are practical:

- **The requests still reach the server.** A `race`-based timeout does not reduce load; it
  increases it, because you may retry while the first attempt is still running.
- **Sockets and memory stay held** until the losers finish.
- **Side effects still happen.** If a losing call writes to a database, it writes.

**For work that must actually stop, you need `AbortController`** — pass one signal to every
call and abort it when the winner arrives. That is
[14 · Cancellation](../README.md).

## Losing rejections do not become unhandled

A promise combinator attaches handlers to every input, which has a useful side effect. MDN,
on `Promise.all`:

> it "**immediately marks all promises as 'handled'**" when called, by calling their
> `.then()` methods, so "subsequent rejections after the first rejection will be ignored and
> will not trigger `unhandledrejection` events."

And on `race`:

> "Subsequent rejections after the first settlement will be ignored, and will not trigger any
> `unhandledrejection` events."

🔴 **This is a real safety property, and a reason to prefer a combinator over hand-managed
promises.** Hoisting promises into variables ([09 · 02](../09-sequential-vs-parallel/02-starting-before-awaiting.md))
leaves a window where a rejection has no handler; passing the same promises to a combinator
does not.

The flip side: **a losing failure is silent.** If two of three mirrors are down, `any`
succeeds and tells you nothing. Log it deliberately if you care:

```js
const attempts = sources.map((s) =>
  fetchFrom(s).catch((e) => {
    log.warn({ source: s, err: e }, "source failed");
    throw e;                     // re-throw so `any` still sees a rejection
  }),
);
const data = await Promise.any(attempts);
```

Note the re-throw — without it the `catch` fulfils with `undefined` and `any` treats the
failed source as a **winner** ([05 · 02](../05-promises/02-then-catch-finally.md)).

## Empty iterables — all four differ

This is the sharpest set of edge cases in the topic, and the differences are documented:

| Call | Result |
|---|---|
| `Promise.all([])` | **fulfils synchronously** with `[]` |
| `Promise.allSettled([])` | **fulfils synchronously** with `[]` |
| `Promise.any([])` | **already rejected** with an `AggregateError` |
| `Promise.race([])` | 🔴 **forever pending** — no error, ever |

The two "wait for everything" combinators do the sensible thing; `any` fails loudly; **`race`
hangs silently.**

```js
await Promise.race(candidates.map(tryOne));   // ⚠️ hangs if candidates is empty
```

**Guard any dynamically built array before racing it.** This is the only one of the four
where an empty input produces no signal at all.

MDN adds one subtlety for `allSettled`: *"if the iterable is non-empty but contains no
pending promises, the returned promise is still **asynchronously** fulfilled"*. So "no
inputs" and "inputs that already settled" are different cases.

## Scale: none of these is a scheduler

All four start **every** task immediately — they are joins, not pools.

```js
await Promise.all(tenThousandIds.map(getUser));   // ⚠️ 10 000 requests at once
```

This exhausts sockets, memory, or the target service. The combinators are for a **known,
small** set of operations. For a large or unknown-size list you need bounded concurrency —
a worker pool that keeps N in flight — which is
[16 · Concurrency limiting](../README.md).

**The rule:** combinators for a handful; a pool for a list.

## Gotchas

**Symptom:** A timeout fired but the server still processed the request
**Cause:** No combinator cancels. MDN: the losers *"continue their internal execution."*
**Fix:** `AbortController` / `AbortSignal.timeout()` if the work must stop.

**Symptom:** A redundancy setup silently hides that most sources are failing
**Cause:** `any` ignores rejections once one fulfils, and combinators suppress the losers'
unhandled-rejection reports.
**Fix:** Attach a logging `.catch` to each input that **re-throws**, so the combinator still
sees the rejection.

**Symptom:** A logging `.catch` on an input made a failed source count as a success
**Cause:** The `catch` returned nothing, so that promise **fulfilled** with `undefined`.
**Fix:** Re-throw from the `catch`.

**Symptom:** Code hangs with no error on an empty input array
**Cause:** `Promise.race([])` is **forever pending** — the only one of the four with no
signal.
**Fix:** Guard the empty case.

**Symptom:** `Promise.all` over a big list exhausts sockets or memory
**Cause:** It starts every task at once; it is a join, not a scheduler.
**Fix:** Bounded concurrency for lists.

**Symptom:** Switching from hoisted promises to a combinator removed an unhandled-rejection
warning
**Cause:** Expected — a combinator *"immediately marks all promises as handled"*.
**Fix:** Prefer the combinator for exactly this reason.

## Interview questions

**★ How do you choose between the four combinators?**
Two questions. **All results or one?** — `all`/`allSettled` versus `race`/`any`. **Should a
failure fail the operation?** — `all`/`race` versus `allSettled`/`any`. That gives a 2×2 with
one combinator in each cell.

**★ What happens to the promises that lose?**
They keep running. MDN: *"not explicitly cancelled — they continue their internal
execution."* Requests still reach the server, resources stay held, and side effects still
happen. Stopping the work needs `AbortController`.

**★ Do the losers' rejections become unhandled rejections?**
No — a combinator attaches handlers to every input when called, so *"subsequent rejections …
will not trigger `unhandledrejection` events"*. That is a genuine safety advantage over
hoisting promises into variables. The cost is that those failures are silent unless you log
them yourself.

**★ Which combinator hangs on an empty array?**
`Promise.race([])` — *"forever pending"*, with no error ever. `all` and `allSettled` fulfil
synchronously with `[]`; `any` rejects immediately with an `AggregateError`.

**★ Is `Promise.all(bigList.map(fn))` safe?**
Not for a large or unknown-size list. All four combinators are **joins, not schedulers** —
every task starts at once. Use a bounded worker pool for lists; combinators for a handful.

**Why must a logging `.catch` on a combinator input re-throw?**
Because a `catch` that returns normally **fulfils** the promise, so `any` would treat the
failed source as the winner and `all` would not fail at all.

---

← Prev [02 · `race` and `any`](./02-race-and-any.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
