---
title: "02 · Cause chains and boundaries"
sidebar_label: "02 · Chains and boundaries"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof) — and Node.js [Errors](https://nodejs.org/api/errors.html). Documentation-validated; **no timings, no console blocks**.

A `cause` chain is how an error keeps its history while gaining context. It costs one option
object and it is the difference between "Could not load dashboard" and knowing which query, on
which connection, failed with what.

## Build the chain at each layer that adds meaning

```js
// data layer
try {
  return await db.query(sql, params);
} catch (err) {
  throw new DependencyError('Order query failed', { code: 'DB_QUERY', cause: err });
}

// service layer
try {
  return await orders.findById(id);
} catch (err) {
  throw new AppError(`Could not load order ${id}`, { code: 'ORDER_LOAD', cause: err });
}
```

Each layer says what *it* was trying to do, in its own vocabulary, and keeps the layer below
intact. The chain reads outward-in: the outermost error is the most human, the innermost the most
precise.

🔴 **Wrap where you add information, and nowhere else.** A wrapper that only restates the inner
message — `Failed: ${err.message}` — adds a stack frame, a level of nesting and no meaning. The
test is whether the new message says something the inner one could not.

## Reading a chain

`cause` is an ordinary property, so walking it is a loop:

```js
function chain(err) {
  const out = [];
  for (let e = err, guard = 0; e instanceof Error && guard < 10; e = e.cause, guard++) out.push(e);
  return out;
}

const root = (err) => chain(err).at(-1);
const has = (err, code) => chain(err).some((e) => e.code === code);
```

⚠️ **Guard the loop.** A cycle in a `cause` chain — usually from re-wrapping an error that is
already in the chain — makes a naive walk spin forever. A depth cap costs nothing.

**Node prints the chain for you** in an uncaught error, and browser consoles expand `cause` in
the expanded error view. Your own logger has to walk it: if it prints only `err.message` and
`err.stack`, everything below the top layer is invisible, which is the most common reason a
carefully built chain turns out to be useless in production.

## Translate at a boundary; do not leak the layer below

A **boundary** is a point where the vocabulary changes — data layer to domain, library to
consumer, server to client.

```js
// ❌ the caller now depends on your database driver's error codes
throw err;

// ✅ the caller depends on your contract; the driver's error is still attached
throw new ConflictError('That order was updated by someone else', {
  code: 'ORDER_STALE',
  cause: err,                        // kept for logs, not for the caller to branch on
});
```

🔴 **What crosses the boundary is your contract; what is attached as `cause` is diagnostics.**
Callers branch on the outer class and code. If they start branching on `err.cause.code`, you have
leaked your implementation and cannot change the driver without breaking them.

**And do not let the inner message reach a user.** `ECONNREFUSED 10.0.3.7:5432` in a toast is an
information disclosure as well as being useless to them — the outer message is the one to show,
the chain is the one to log.

## Errors do not survive most boundaries intact

| Boundary | What happens to an `Error` |
|---|---|
| `JSON.stringify(err)` | 🔴 **`{}`** — `message` and `stack` are not enumerable |
| `postMessage` / worker / `structuredClone` | the error survives as an `Error` with `message`, `name`, `stack` and `cause`, but **your subclass becomes a plain `Error`** |
| Network response | whatever you chose to serialise |
| Across realms (iframe, `vm`) | `instanceof` fails; `name` and `code` still work |
| A duplicated package copy in a bundle | `instanceof` fails — two distinct classes |

🔴 **`JSON.stringify(err)` producing `{}` is the trap people hit first.** Custom fields you added
(`code`, `field`) *are* enumerable and do survive; `message` and `stack` do not. Serialise
deliberately:

```js
const toWire = (err) => ({
  name: err.name,
  code: err.code,
  message: err.message,                 // ✅ only if it is safe to show
  cause: err.cause instanceof Error ? toWire(err.cause) : undefined,
});
```

⚠️ **Decide what the wire form is allowed to contain.** Internal messages and stacks belong in
logs, not in a response body that reaches a browser — but a stable `code` is exactly what a client
needs in order to branch.

**On the receiving side, reconstruct rather than trust:** rebuild an `Error` (or your own class)
from the fields, so downstream code gets something with the right shape and `instanceof` works
locally again.

## `instanceof` is not identity across boundaries

```js
err instanceof ValidationError    // false: worker, iframe, or two copies of the package
err.name === 'ValidationError'    // ✅ survives everything
err.code === 'INVALID_EMAIL'      // ✅ the one to branch on
```

Class identity is per realm and per module instance. **Use `instanceof` inside one program, and
`name`/`code` anywhere a boundary might be involved** — which is exactly why the taxonomy in
[01](./01-designing-the-taxonomy.md) puts a `code` on every error rather than relying on the class
alone.

## Several failures at once

When a step fails for more than one reason — validating every field, or a bulk operation — one
error with one cause is the wrong shape:

```js
throw new AggregateError(failures, `${failures.length} fields are invalid`);
```

`AggregateError` carries an `errors` array, so nothing is discarded and the handler can render
every message. `Promise.any` throws one natively. It is **16 · `AggregateError`** *(not written
yet)*; the bulk-operation version is
[Phase 7 · 16 · The bounded pool](../../phase-7-async/16-concurrency-limiting/02-the-bounded-pool.md).

## Gotchas

**Symptom: `JSON.stringify(err)` gives `{}`.**
Cause — `message` and `stack` are non-enumerable.
Fix — serialise fields explicitly, and decide what may cross the wire.

**Symptom: `err instanceof MyError` is false for an error from a worker.**
Cause — the structured clone rebuilds it as a plain `Error`; class identity does not cross realms.
Fix — branch on `err.name` / `err.code`, and reconstruct on receipt if you need a class.

**Symptom: the log shows only the outermost message.**
Cause — the logger prints `err.message` and never walks `cause`.
Fix — walk the chain when logging; the chain is worthless if nothing reads it.

**Symptom: a `cause` walk hangs.**
Cause — a cycle from re-wrapping an error already in the chain.
Fix — cap the depth, and do not wrap an error you did not just catch.

**Symptom: a database error message is shown to the user.**
Cause — the inner error's message was rendered instead of the boundary's.
Fix — show the outer message; log the chain.

**Symptom: callers broke when you swapped the database driver.**
Cause — they were branching on `err.cause.code`.
Fix — expose a stable code on your own error; `cause` is diagnostics, not contract.

**Symptom: three layers of wrapping all say roughly the same thing.**
Cause — wrapping where no information was added.
Fix — wrap only when the new message says something the inner one could not.

## Interview questions

**★ What does `cause` give you that a message string does not?**
The original error object — its type, its own `cause`, and its stack. `new Error(err.message)`
keeps the words and destroys everything else.

**★ Where should you wrap an error?**
At each layer that adds meaning, and at boundaries where the vocabulary changes. Not where the
wrapper only restates the inner message.

**★ What crosses a module boundary — the class or the cause?**
The class and code are your contract; `cause` is diagnostics. A caller branching on
`err.cause.code` has coupled itself to your implementation.

**★ Why does `JSON.stringify(err)` give `{}`?**
`message` and `stack` are non-enumerable. Custom fields you added do serialise. Build the wire
form explicitly, and choose what is safe to send.

**★ Why does `instanceof` fail for an error from a worker or an iframe?**
Class identity is per realm and per module instance — the structured clone rebuilds a plain
`Error`, and a duplicated package copy is a different class. Use `name` or `code`.

**★ How do you report several failures from one operation?**
`AggregateError` with an `errors` array, so every reason survives instead of only the first.

**How do you walk a cause chain safely?**
A loop on `err.cause` while it is an `Error`, with a depth cap — re-wrapping can create a cycle.

---

← [01 · Designing the taxonomy](./01-designing-the-taxonomy.md) · [Topic index](./README.md)
