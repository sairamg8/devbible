---
title: "node:assert — strict mode and what deep equality really compares"
sidebar_label: "02 · node:assert"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**.

**Import `node:assert/strict`, never `node:assert`.** The legacy module uses `==`
semantics, and an assertion that passes on a type mismatch is worse than no assertion.

```js
import assert from 'node:assert/strict';       // do this
// import assert from 'node:assert';           // legacy: loose comparison
```

Measured difference:

```js
legacy.equal(1, '1');                 // passes
assert.equal(1, '1');                 // AssertionError [ERR_ASSERTION]
legacy.deepEqual({a: 1}, {a: '1'});   // passes
```

Everything below is strict mode.

## The assertions you actually use

```js
assert.ok(value);                        // truthy
assert.equal(actual, expected);          // Object.is / ===
assert.notEqual(a, b);
assert.deepStrictEqual(actual, expected);
assert.match('order-4821', /^order-\d+$/);
assert.throws(fn, matcher);
await assert.rejects(asyncFn, matcher);
assert.fail('should not reach here');
```

`assert.equal` in strict mode **is** `assert.strictEqual`. There is no reason to type
the longer name once you have imported the strict entrypoint.

## What `deepStrictEqual` compares

This is the assertion you use most and the one whose rules are least known. Every row
measured:

| Comparison | Result |
|---|---|
| `NaN` vs `NaN` | **passes** — `Object.is` semantics |
| `0` vs `-0` | **throws** — same reason, opposite direction |
| `{}` vs `Object.create(null)` | **throws** — prototypes are compared |
| `new Point(1)` vs `{x: 1}` | **throws** — class identity is compared |
| `[1, , 2]` vs `[1, undefined, 2]` | **throws** — a hole is not `undefined` |
| `new Date(0)` vs `new Date(0)` | passes — value, not reference |
| `new Map([['a',1],['b',2]])` vs `new Map([['b',2],['a',1]])` | **passes** — insertion order is irrelevant |
| `{a: 1}` vs `{a: 1, b: undefined}` | **throws** — an explicit `undefined` key is a difference |

Two of these cause most real confusion.

**Class identity.** A repository that returns a `User` instance will never
`deepStrictEqual` a plain object literal, however identical the fields look:

```js
assert.deepStrictEqual(await users.findById(1), {id: 1, name: 'Ada'});
// AssertionError: values have same structure but are not reference-equal
```

Compare the plain shape instead — `{...user}` — or assert on the fields you care about.

**The `undefined` key.** `JSON.parse` never produces one, but object spread and
optional properties do:

```js
const dto = {id: 1, name: 'Ada', deletedAt: undefined};
assert.deepStrictEqual(dto, {id: 1, name: 'Ada'});   // throws
```

That is usually a real bug in the code under test, not in the assertion.

## `partialDeepStrictEqual` for noisy objects

Available and **not flagged** on 24.19.0. It ignores extra keys on the actual value:

```js
assert.partialDeepStrictEqual(
  {id: 1, name: 'Ada', createdAt: new Date(), etag: 'W/"3-abc"'},
  {name: 'Ada'},                       // passes — the rest is ignored
);
```

The honest use is a response body with server-generated fields you do not want to pin.
The dishonest use is hiding a shape you have not thought about — if a field matters,
assert on it.

## Matching errors

The second argument is a **matcher**, and its type decides the meaning:

```js
assert.throws(() => parse(''), /empty input/);          // regexp on message
assert.throws(() => parse(''), {name: 'SyntaxError'});  // property subset
assert.throws(() => parse(''), SyntaxError);            // instanceof
```

A **string** second argument is not a matcher — it is the assertion's own failure
message, and Node refuses the ambiguity:

```js
assert.throws(() => { throw new Error('boom'); }, 'boom');
// TypeError [ERR_AMBIGUOUS_ARGUMENT]: The "error/message" argument is ambiguous.
// The error message "boom" is identical to the message.
```

For application errors, match on the fields you rely on rather than the prose:

```js
await assert.rejects(
  () => repo.create({sku: 'A'}),
  (err) => {
    assert.equal(err.code, '23505');
    assert.equal(err.constraint, 'orders_sku_key');
    return true;                    // a matcher function MUST return true
  },
);
```

The `return true` is required. A matcher function that returns `undefined` fails the
assertion even when every inner check passed — a silent, confusing failure.

## `rejects` is async and must be awaited

```js
await assert.rejects(chargeCard, {message: 'gateway declined'});   // ✅
assert.rejects(chargeCard, {message: 'gateway declined'});         // ✗ see page 06
```

Full treatment of what happens when you forget:
[page 06](./06-async-testing.md).

## Assertions on the test context

Every assertion is also on `t.assert`, which is what `t.assert.snapshot()` uses:

```js
it('works', (t) => {
  t.assert.equal(1, 1);
  t.assert.snapshot(render());
});
```

Functionally identical for the normal assertions; use whichever reads better in your
codebase, but be consistent.

## Gotchas

**Symptom:** An assertion passes when the types differ
**Cause:** `import assert from 'node:assert'` — the legacy loose module.
**Fix:** `node:assert/strict`. Measured: `legacy.equal(1, '1')` passes.

**Symptom:** `values have same structure but are not reference-equal`
**Cause:** Comparing a class instance to an object literal. `deepStrictEqual` checks the
prototype.
**Fix:** Spread the instance (`{...user}`), or assert on individual fields.

**Symptom:** Two objects look identical in the diff but the assertion fails
**Cause:** One has a key set to `undefined`; the printer renders it the same way.
**Fix:** Look for the extra key. It is usually a real defect in the code under test.

**Symptom:** `ERR_AMBIGUOUS_ARGUMENT`
**Cause:** A string was passed as the second argument to `throws`/`rejects`.
**Fix:** Use a regexp, an object of expected properties, or the error class.

**Symptom:** A matcher function's checks all pass but the assertion still fails
**Cause:** The function did not `return true`.
**Fix:** Return `true` explicitly at the end.

**Symptom:** `deepStrictEqual` fails on two arrays that print identically
**Cause:** One is sparse — `[1, , 2]` — and holes are not `undefined`.
**Fix:** `Array.from(sparse)` before comparing, or fix the code producing holes.

## Interview questions

**★ Why `node:assert/strict` rather than `node:assert`?**
The legacy module compares with `==`, so `equal(1, '1')` and
`deepEqual({a: 1}, {a: '1'})` both pass. An assertion that ignores type is worse than
none, because it creates confidence without evidence.

**★ Does `deepStrictEqual(NaN, NaN)` pass?**
Yes. It uses `Object.is` semantics, so `NaN` equals `NaN` — and, for the same reason,
`0` does **not** equal `-0`. Both were measured.

**★ Why does comparing a model instance to an object literal fail?**
`deepStrictEqual` compares prototypes as well as own properties, so a `User` instance
is never deep-equal to a plain object with the same fields. Spread it, or assert
field by field.

**★ What does a string as the second argument to `assert.throws` mean?**
It is the assertion's failure message, not a matcher — and if it equals the thrown
error's message Node raises `ERR_AMBIGUOUS_ARGUMENT` rather than guessing. Use a
regexp, an object, or the error constructor.

**When would you use `partialDeepStrictEqual`?**
Asserting on a response body that contains server-generated fields — ids, timestamps,
etags — where pinning them would make the test brittle. Not as a way to avoid deciding
what the response shape should be.

**How do you assert on a database error rather than its message?**
Match on the structured fields: `err.code` (the SQLSTATE, e.g. `23505`) and
`err.constraint`. Error prose changes between versions; SQLSTATEs do not.

---

← Prev: [01 · node:test](./01-node-test-runner.md) ·
Next → [03 · Unit, integration, e2e](./03-unit-integration-e2e.md)
