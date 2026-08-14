---
title: "17.2 · Merging, forwarding and identity"
sidebar_label: "2 · Merging, forwarding, identity"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [`Object.assign()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign), [Destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring), [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters), [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [Equality comparisons](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). Documentation-validated; **no timings**.

Three more places a default quietly does not do what the code appears to say — and all three are
about **when** and **how many times** the default's expression is evaluated, rather than about
`undefined`.

## Merging options: three mechanisms, three answers

The most common way a default is defeated is that the merge happens *before* the function ever
sees its parameters.

```js
const DEFAULTS = { timeout: 5000, retries: 3 };

function request(url, opts) {
  const config = { ...DEFAULTS, ...opts };          // 🔴
  return fetch(url, { signal: AbortSignal.timeout(config.timeout) });
}

request("/api", { timeout: undefined });            // timeout is undefined, not 5000
```

The three ways people combine an options object **do not agree** about an explicit `undefined`:

| Mechanism | An explicit `undefined` property |
|---|---|
| `{ ...DEFAULTS, ...opts }` | 🔴 **overwrites** — spread copies own enumerable keys, `undefined` included |
| `Object.assign({}, DEFAULTS, opts)` | 🔴 **overwrites** — same rule, it copies the key |
| `const { timeout = 5000 } = opts` | ✅ **default applies** — destructuring defaults fire on `undefined` |

🔴 **Spread and `Object.assign` copy the key, not the meaning.**
`{ ...{a: 1}, ...{a: undefined} }` is `{ a: undefined }` — the property exists and its value is
`undefined`. `"a" in result` is `true`. The default that was spread in first has been overwritten
by a value that means "nothing".

⚠️ **`undefined` reaches an options object far more often than people expect**, because it is what
every missing lookup produces: `{ timeout: config.get("timeout") }`, `{ signal: opts?.signal }`,
or a React prop that was not passed. Nobody types `undefined`; they forward it.

**Two mechanisms are actually safe. Pick one and stay with it:**

```js
// ✅ destructure with defaults — one place, and it reads as documentation
function request(url, { timeout = 5000, retries = 3, signal } = {}) { … }

// ✅ or merge, then coalesce each field you depend on
const config = { ...DEFAULTS, ...opts };
const timeout = config.timeout ?? DEFAULTS.timeout;
```

The first is better for a function you own — the signature states the contract. The second is
better when the merged object is passed onward whole and you cannot destructure everything out of
it.

🔴 **What you must not do is rely on the spread alone.** `{ ...DEFAULTS, ...opts }` reads exactly
like "defaults, then overrides" and is right for every case except the one that actually happens.

## Forwarding through a wrapper

Defaults **compose correctly**, which surprises people who expect a wrapper to break them:

```js
const fetchUser = (id, timeout = 5000) => request(`/users/${id}`, timeout);
const withRetry = (id, timeout)        => fetchUser(id, timeout);   // forwards undefined

withRetry(7);        // ✅ timeout is 5000 — the inner default fires
```

`withRetry(7)` leaves its second parameter `undefined` and passes that along, which is precisely
what `fetchUser`'s default triggers on. **This is the strongest argument for a default over an
`arguments.length` check** — a length check would see "two arguments were passed" and skip the
default, so the wrapper *would* break it. Same point from the other side in
[16 · There is no function overloading](../16-no-function-overloading.md).

⚠️ **It stops composing the moment the wrapper substitutes anything:**

```js
const withRetry = (id, timeout = null) => fetchUser(id, timeout);   // 🔴
withRetry(7);        // timeout is null the whole way down
```

🔴 **A pass-through parameter gets no default at all.** Let it stay `undefined` and let the
function that actually *uses* the value own the default. **One default per value, at the point of
use** — a default repeated in a wrapper and its target is two sources of truth that will drift.

## A fresh value every call — and the identity it costs

[02.1 · The shared-default myth](../02-parameters/01-defaults-and-scope.md) shows the good news:
`function f(list = [])` gives every call its own array, so JavaScript has no Python-style shared
mutable default. **The price is a new identity on every defaulted call**, and a surprising amount
of code compares by identity:

```js
function useRows(rows = []) {
  // 🔴 a brand-new array whenever rows is omitted, so this key is never reused
  cache.set(rows, expensiveDerive(rows));
}
```

Three places it bites:

- **A `Map`- or `WeakMap`-keyed cache never hits** for defaulted calls, and grows on every one of
  them. The key-derivation problem in full: [13 · Memoization](../13-memoization.md).
- **A dependency or change comparison** — a framework's dependency array, a `shouldUpdate` guard,
  a `prev !== next` check — sees a difference every time and re-runs unconditionally.
- **A test assertion** passes under `toEqual` and fails under `toBe`, for reasons that have
  nothing to do with the code being tested.

### When identity matters: hoist, and then freeze

```js
const EMPTY = Object.freeze([]);              // ✅ one identity, and safe to share
function useRows(rows = EMPTY) { … }
```

🔴 **Hoisting alone reintroduces exactly the trap JavaScript avoided.** A module-level
`const EMPTY = []` that any caller can `push` into is the Python shared-mutable-default, now
written on purpose. `Object.freeze` is what makes sharing safe: a write to a frozen object is a
silent no-op in sloppy mode and a `TypeError` in strict mode — and **modules are always strict**,
so in any modern codebase you get the loud version.

⚠️ **`Object.freeze` is shallow.** `Object.freeze({ user: {} })` still permits
`obj.user.name = "x"`. For a nested default, freeze what you actually hand out, or do not share
it at all.

**Do not reach for this by default.** A fresh `[]` per call is the safer behaviour and should stay
the norm; hoist only when something downstream genuinely compares identity, and say why in a
comment.

## A default is code, so it runs like code

Two consequences that get missed because a default *looks* like a value sitting in the signature.

**It runs on every defaulted call, and it is never cached.**

```js
function report(rows, generatedAt = expensiveTimestamp()) { … }
```

`expensiveTimestamp()` executes once per call that omits the argument, and never at definition
time. Usually that is the point — a *fresh* timestamp is what you wanted. It is not what you want
when the default is a large `structuredClone`, a regex compile, or a parse in a hot path; move
those to a module constant.

**A side effect in a default fires per call, invisibly.**

```js
function save(record, id = nextId()) { … }    // ⚠️ nextId() increments a counter
save(a, 5);        // does NOT consume an id
save(b);           // consumes one
```

The id sequence now depends on how each call site chose to invoke the function — a dependency that
appears nowhere in the function body. 🔴 **Keep defaults pure.** If the value must come from a side
effect, produce it in the body where the condition is visible: `const realId = id ?? nextId();`.

**And a default reads its outer variables at call time:**

```js
let locale = "en";
const format = (n, loc = locale) => n.toLocaleString(loc);

format(1234);          // "1,234"
locale = "de";
format(1234);          // "1.234"  ← same function, different behaviour
```

That is a closure, and it is the bridge to the rest of this topic: **the default captured the
variable `locale`, not the string `"en"`.** Whether that is a feature (live configuration) or a
bug (a function that changes under its callers) depends entirely on whether you meant it — and
[17.3 · Which binding did you get?](./03-which-binding-did-you-get.md) is about answering that
question in general.

## Gotchas

**Symptom:** An option is `undefined` even though a defaults object was spread in first
**Cause:** Spread and `Object.assign` copy an explicit `undefined` property over the default — the key wins, not the value.
**Fix:** Destructure with defaults after the merge, or `?? DEFAULTS.x` per field. Never rely on the spread alone.

**Symptom:** `"timeout" in config` is true but `config.timeout` is `undefined`
**Cause:** Same thing — the property exists with the value `undefined`.
**Fix:** Test the value, not the key.

**Symptom:** A default stopped working after a wrapper was added
**Cause:** The wrapper gave its pass-through parameter a default of its own (often `null`), so `undefined` never reaches the inner function.
**Fix:** Pass-through parameters get no default. Default once, at the point of use.

**Symptom:** A memoisation cache never hits and grows without bound
**Cause:** A `= []` or `= {}` default constructs a new object per call, so the key is never reused.
**Fix:** A frozen module-level constant when identity must be stable, or derive a primitive key.

**Symptom:** A change-detection guard re-runs on every call
**Cause:** Same identity problem — the defaulted value differs by reference each time.
**Fix:** Hoist the default, or compare the contents rather than the reference.

**Symptom:** Mutating a shared default silently did nothing
**Cause:** The hoisted default is frozen and the code is running in sloppy mode.
**Fix:** Expected — copy before mutating (`[...EMPTY, x]`). In a module you would have got a `TypeError` instead.

**Symptom:** A frozen default was mutated anyway, one level down
**Cause:** `Object.freeze` is shallow.
**Fix:** Freeze the nested objects too, or stop sharing.

**Symptom:** Generated ids or timestamps come out in an order nobody expected
**Cause:** A side-effecting default runs only on calls that omitted the argument, so the sequence depends on call sites.
**Fix:** Keep defaults pure; do the side effect in the body behind `??`.

**Symptom:** A function's behaviour changed without its source changing
**Cause:** Its default names an outer `let` and reads it at call time.
**Fix:** Intentional for live config; otherwise capture the value once at definition or pass it in.

## Interview questions

**★ What breaks when you merge options with spread instead of destructuring?**
Spread and `Object.assign` copy own enumerable **keys**, so a property explicitly set to
`undefined` overwrites the default that was spread in first. Destructuring defaults fire on
`undefined`, so they survive. Mixing the two is why an option "with a default" arrives undefined.

**★ Where does an explicit `undefined` property come from, if nobody types it?**
From forwarding — `{ signal: opts?.signal }`, a missing map lookup, an unpassed prop. Any
expression that evaluates to `undefined` still creates the key when written into an object
literal.

**★ Does a default survive being forwarded through a wrapper?**
Yes. A wrapper that passes its own missing argument along passes `undefined`, which is exactly
what the inner default triggers on. It breaks only if the wrapper substitutes a value or declares
its own default. That composability is also why a default beats an `arguments.length` check.

**★ JavaScript has no shared-mutable-default bug. What does it have instead?**
A new object on every defaulted call, so identity is never stable. Anything comparing by reference
— a `Map` cache, a dependency array, a `toBe` assertion — sees a change every time.

**★ When is hoisting a default to a module constant dangerous, and what makes it safe?**
Dangerous the moment it is mutable: one caller's `push` becomes visible to every other, which is
the Python trap written by hand. `Object.freeze` makes it safe — a `TypeError` in strict mode,
where modules always run. Remember freeze is shallow.

**★ When does a default parameter's expression actually run?**
On every call where that argument is `undefined`, in the parameter scope, left to right — never at
definition time and never cached. So an expensive default is paid per call, and a side-effecting
one fires only for the callers that omitted the argument.

**★ Why should a default not have side effects?**
Because whether it runs depends on the call site, so the side effect's sequence becomes a property
of how the function is called rather than of what it does. Move it into the body behind `??`,
where the condition is visible.

**Why can a function's behaviour change without its source changing?**
Because a default that names an outer variable closes over the variable, not its value, and reads
it at call time. Reassign the outer `let` and every subsequent call behaves differently.

---

← [17.1 · `null`, `undefined` and the API boundary](./01-null-undefined-and-the-api-boundary.md) · [Topic index](./README.md) · [Next → 17.3 · Which binding did you get?](./03-which-binding-did-you-get.md)
