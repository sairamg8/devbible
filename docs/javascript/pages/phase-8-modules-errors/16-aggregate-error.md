---
title: "16 · `AggregateError`"
sidebar_label: "16 · AggregateError"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError), [`Promise.any()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause). Documentation-validated; **no runs, no timings, no console blocks** — samples are illustrative.

## One error, several failures

Most error handling assumes one thing went wrong. Sometimes several did, independently, and
picking one to report throws away the rest — the other four validation problems, the seven records
that failed in a batch of a hundred.

**`AggregateError` is the standard shape for that case.** MDN: it *"represents an error when
several errors need to be wrapped in a single error"*, and it **is a subclass of `Error`** — so it
travels through every `catch`, reporter and boundary you already have
([03 · The `Error` object](./03-error-and-subclasses/01-the-error-object.md)).

```js
const err = new AggregateError([new Error('too short'), new Error('bad domain')], 'Invalid input');
err.name;            // 'AggregateError'
err.message;         // 'Invalid input'
err.errors.length;   // 2
err instanceof Error // true
```

**The one property that matters is `errors`** — MDN describes it as *"an array representing the
errors that were aggregated"*. Everything below is about putting the right things in it and not
losing them on the way out.

## Where you meet it without asking: `Promise.any`

`Promise.any` fulfils with the first promise that **fulfils** and rejects only when they all reject
— and what it rejects with is an `AggregateError`
([Phase 7 · 10 · `race` and `any`](../phase-7-async/10-combinators/02-race-and-any.md)).

```js
try {
  const config = await Promise.any([fromCache(), fromDisk(), fromNetwork()]);
} catch (err) {
  if (err instanceof AggregateError) {
    for (const e of err.errors) report(e);   // all three reasons, not one
  }
}
```

Three documented details, and each one has caught someone out:

- 🔴 **`errors` is in the order the promises were passed**, not the order they failed. MDN states it
  explicitly — *"The errors are in the order of the promises passed, regardless of completion
  order"* — which is what makes it safe to line up with your input list by index.
- ⚠️ **An empty iterable rejects immediately.** `Promise.any([])` is *"already rejected"*, so a
  filtered-to-nothing list is a failure, not a hang. Guard the empty case rather than debugging it
  later.
- ⚠️ **Do not match on the message.** MDN's own examples show different wording for the same
  situation, so treat the message as human copy and branch on the type or inspect `errors`.

**`Promise.any` versus `Promise.race`** in one line: `race` settles on the first *settled* promise,
including a rejection; `any` ignores rejections until something fulfils. Only one of them needs a
way to report several failures at once.

## Throwing one yourself: batch work

The natural producer of an aggregate is a batch that keeps going after a failure. `allSettled` is
the collector; `AggregateError` is how you report the result upward
([Phase 7 · 10 · `all` and `allSettled`](../phase-7-async/10-combinators/01-all-and-allsettled.md)):

```js
const results = await Promise.allSettled(ids.map(id => importRecord(id)));

const failures = results.flatMap((r, i) =>
  r.status === 'rejected'
    ? [new Error(`record ${ids[i]} failed`, { cause: r.reason })]
    : []);

if (failures.length) {
  throw new AggregateError(failures, `${failures.length} of ${ids.length} records failed`);
}
```

Two decisions in that snippet are the whole design:

- 🔴 **Each entry carries its own context** — which record, wrapped around the original reason via
  `cause` ([08 · Cause chains](./08-custom-error-classes/02-cause-chains-and-boundaries.md)). An
  `errors` array of bare `TypeError`s tells the reader nothing about *which* item produced them.
- **The message counts, the array details.** A caller who logs only the message still learns the
  scale of the failure; one that inspects `errors` gets everything.

**When not to aggregate:** a sequence that must stop at the first failure has exactly one error,
and wrapping it in an array only makes handlers work harder. Aggregate when the failures are
**independent** — the parallel case, or validation where you deliberately collect everything before
answering ([09 · Validate at the boundary](./09-failing-well/01-validate-at-the-boundary.md)).

## Handling one without losing it

```js
catch (err) {
  if (err instanceof AggregateError) {
    for (const e of err.errors) log(e);      // ✅ every reason survives
  } else {
    log(err);
  }
}
```

⚠️ **The default failure is silent truncation.** A logger that records `err.message` and `err.stack`
captures nothing at all about the aggregated errors — they live only on `errors`, and neither the
message nor the stack mentions them.

**So at any boundary that serialises errors** — a reporter, a queue, a JSON API
([10 · Shipping errors to a reporter](./10-global-error-handling/02-shipping-to-a-reporter.md)) —
flatten deliberately:

```js
const serialise = (e) => ({
  name: e.name,
  message: e.message,
  ...(e.errors && { errors: e.errors.map(serialise) }),
  ...(e.cause && { cause: serialise(e.cause) }),
});
```

🔴 **`errors` and `cause` answer different questions, and a good report keeps both.** `cause` is
*why this one failed* — a chain, one deep at each step. `errors` is *these all failed* — a set,
side by side. Nesting them is normal: an aggregate of wrapped errors, each with a cause.

**`instanceof AggregateError` is safe within one realm**, and like every `instanceof` check it is
not safe across two — a duplicated module or a worker boundary breaks it
([15 · Interop, both ways](./15-commonjs-today/02-interop-both-ways.md)). Testing
`err.name === 'AggregateError'` or `Array.isArray(err.errors)` survives both.

## Gotchas

**Symptom: a `Promise.any` failure reports only one reason.**
Cause — the handler logged `err.message` and never touched `err.errors`.
Fix — iterate `errors`; the message alone carries none of them.

**Symptom: `Promise.any([])` rejected without running anything.**
Cause — an empty iterable is documented as already rejected.
Fix — check for an empty list before calling it.

**Symptom: the errors do not line up with the inputs.**
Cause — an assumption that `errors` is in completion order.
Fix — it is in the order the promises were passed; index against your input list, and never sort it.

**Symptom: a string match on the rejection message broke.**
Cause — the message wording is not something to depend on.
Fix — branch on the type or on `errors`, never the message.

**Symptom: aggregated errors vanish in the error reporter.**
Cause — the serialiser copies `name`, `message` and `stack` only.
Fix — flatten `errors` (and `cause`) explicitly on the way out.

**Symptom: `instanceof AggregateError` is false for an obvious aggregate.**
Cause — two realms or two copies of a module.
Fix — test `err.name` or the shape of `err.errors`.

**Symptom: every batch failure reads "TypeError: Cannot read properties of undefined".**
Cause — the raw reasons were aggregated with no per-item context.
Fix — wrap each with an identifying message and the original as `cause`.

## Interview questions

**★ What is `AggregateError` for?**
Reporting several independent failures as one error. It subclasses `Error`, so it travels through
normal handling, and carries the individual reasons on an `errors` array.

**★ Which built-in produces one?**
`Promise.any`, when every input promise rejects — including the empty-iterable case, which rejects
immediately.

**★ What order is `errors` in?**
The order the promises were passed, regardless of when each failed — so it lines up with the input
list by index.

**★ How is `errors` different from `cause`?**
`cause` is a chain — why this error happened, one link at a time. `errors` is a set — these all
failed, side by side. Real reports usually contain both.

**★ Why do aggregated errors disappear in logs?**
Because the reasons live only on `errors`; a serialiser that copies name, message and stack drops
them silently. Flatten explicitly.

**★ When should you not use one?**
When the operation stops at the first failure. One error is one error; an array of one just makes
callers unwrap it.

**Is `instanceof AggregateError` reliable?**
Within one realm, yes. Across realms or two copies of a module, check `err.name` or the shape of
`err.errors` instead.

---

← [Phase 8 index](./README.md) · Prev → [15 · CommonJS in a modern world](./15-commonjs-today/README.md)
