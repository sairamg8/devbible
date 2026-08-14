---
title: "17.1 · `null`, `undefined` and the API boundary"
sidebar_label: "1 · null, undefined and APIs"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse), [Nullish coalescing (`??`)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing), [Logical OR (`||`)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR), [Destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring), [`null`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/null), [`undefined`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined). Documentation-validated; **no timings**.

**The mechanism is already covered.** [02.1 · Defaults and the parameter scope](../02-parameters/01-defaults-and-scope.md)
proves — with measured output — that a default is an expression re-evaluated on every call where
the argument is `undefined`, that it lives in its own scope, and that `null` does not trigger it.

**This chunk is the consequence at a boundary you do not control.** One rule, stated once, and
everything below follows from it:

> **A default fires on `undefined` and on nothing else.**

That is a precise, deliberate design. It becomes a bug the moment your values come from somewhere
that cannot express `undefined` — which is to say, from anywhere outside your own program.

## JSON cannot carry `undefined`

```js
function renderUser({ name, avatar = "/img/default-avatar.png" }) {
  return `<img src="${avatar}"> ${name}`;
}

const user = JSON.parse('{"name":"Ada","avatar":null}');
renderUser(user);      // 🔴 src="null" — the default never ran
```

🔴 **JSON has no `undefined` literal.** The JSON grammar admits `null`, but there is no token for
`undefined`, so every "this field has no value" arriving over the wire is either a **missing key**
or an explicit **`null`** — and the two behave in opposite ways against a default:

| What the payload contains | The destructuring default |
|---|---|
| the key is absent | ✅ applies — reading a missing property yields `undefined` |
| `"avatar": null` | 🔴 **skipped** — `avatar` is `null` |
| `"avatar": ""` | 🔴 skipped — `avatar` is `""` |
| `"avatar": 0` | 🔴 skipped — `avatar` is `0` |

**A backend that serialises "no avatar" as `null` silently disables every default on the client.**
Nothing throws. The page renders `null` into an `src` attribute, the browser requests
`/current/path/null`, and the bug is reported as "broken images on some profiles".

⚠️ **The asymmetry runs the other way too.** `JSON.stringify` **drops** properties whose value is
`undefined` from objects, and turns them into `null` inside arrays:

```js
JSON.stringify({ a: 1, b: undefined });     // '{"a":1}'        ← key gone
JSON.stringify([1, undefined, 3]);          // '[1,null,3]'     ← became null
```

So a value can leave your program as `undefined` and come back as `null` **without any code having
decided that**. It is a round-trip artefact, and it lands squarely on your defaults.

## `??`, not `||`

```js
function renderUser({ name, avatar }) {
  const src = avatar ?? "/img/default-avatar.png";     // ✅ null OR undefined
  return `<img src="${src}"> ${name}`;
}
```

The default parameter is deleted and replaced with an explicit coalesce in the body — because the
parameter position can only test `undefined`, and the body can test what you actually mean.

🔴 **`??` is the right operator, and `||` is a different one.** `||` tests *falsiness*, so it
replaces `0`, `""`, `false` and `NaN` as well:

```js
const discount = opts.discount || 10;      // 🔴 a real 0% discount becomes 10%
const label    = opts.label    || "—";     // 🔴 a deliberate "" becomes "—"
const retries  = opts.retries  ?? 3;       // ✅ 0 retries stays 0
```

Reach for `||` only when **every** falsy value genuinely means "not supplied" — which is true for
a URL string and almost never true for a number or a boolean.

⚠️ `??` cannot be mixed with `&&` or `||` without parentheses — `a ?? b || c` is a `SyntaxError`.
That is deliberate: the precedence would be ambiguous to a reader, so the language makes you say
which you meant.

## The decision under the fix: is `null` "absent" or is it a value?

Collapsing `null` into the default is the right call **most** of the time, and writing it
reflexively is how the other half of this bug ships.

🔴 **Once you coalesce, you can no longer tell "the caller omitted this" from "the caller
explicitly cleared this."** For a rendering function that distinction does not exist. For anything
that *writes*, it is the whole contract:

```js
// PATCH semantics: null means "clear this field", absent means "leave it alone"
function buildPatch(fields) {
  const patch = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) patch[key] = value;    // ✅ an explicit null survives
  }
  return patch;
}

buildPatch({ bio: null, name: undefined });          // { bio: null } — clear bio, leave name
```

The test is `!== undefined`, never truthiness and never `!= null`. A `!= null` check here would
drop the `null` and make it impossible for a user to ever empty a field.

**So decide per boundary and write the decision down:**

| Boundary | What `null` means | What to use |
|---|---|---|
| Rendering / reading | absent | `value ?? fallback` |
| Write / PATCH | "clear this" — a real value | `value !== undefined` |
| Form input | usually `""`, not `null` | check `""` explicitly |
| Database row | absent *and* often meaningful | decide per column, once |

⚠️ **A codebase that does not make this decision does one of two visible bad things:** it renders
`null` to users, or it refuses to let them empty a field they filled in by mistake.

## Nested destructuring defaults have the same hole, twice

```js
function draw({ box: { width = 100, height = 100 } = {} } = {}) { … }

draw({ box: null });     // 🔴 TypeError: Cannot destructure property 'width' of 'null'
```

The `= {}` on `box` fires only when `box` is `undefined`. An explicit `null` skips it and then
gets destructured, which **throws** rather than degrading — worse than the flat case, because a
`null` deeper in a payload turns a rendering glitch into a crash.

```js
function draw({ box } = {}) {
  const { width = 100, height = 100 } = box ?? {};    // ✅ null-safe
}
```

🔴 **The `= {}` is never optional at any level.** Without it on the outermost parameter,
`draw()` destructures `undefined` and throws
`TypeError: Cannot destructure property 'box' of 'undefined'` — the single most common signature
bug in options-object code.

## Gotchas

**Symptom:** A default did not apply to a value that came from an API
**Cause:** JSON has no `undefined`; "no value" arrives as `null` or as a missing key, and defaults fire only on `undefined`.
**Fix:** `value ?? fallback` in the body, and decide explicitly whether this boundary must distinguish omitted from explicitly-null.

**Symptom:** A value left the program as `undefined` and came back as `null`
**Cause:** `JSON.stringify` drops `undefined` object properties and converts `undefined` array elements to `null`.
**Fix:** Expected — treat the round trip as lossy and coalesce on the way back in.

**Symptom:** `||` replaced a legitimate `0`, `""` or `false`
**Cause:** `||` tests falsiness, not absence.
**Fix:** `??`, which triggers only on `null` and `undefined`.

**Symptom:** `SyntaxError` on a line mixing `??` with `||`
**Cause:** The language forbids the unparenthesised combination because the precedence would be ambiguous.
**Fix:** Add parentheses and say which you meant.

**Symptom:** Users cannot clear a field they previously filled in
**Cause:** A write path coalesced `null` into a default or filtered it out, so "clear this" never reaches the server.
**Fix:** Filter on `!== undefined` only; keep `null` as a real value in write paths.

**Symptom:** `TypeError: Cannot destructure property 'width' of 'null'`
**Cause:** A nested `= {}` default fires only on `undefined`; an explicit `null` skips it and is then destructured.
**Fix:** `box ?? {}` before destructuring.

**Symptom:** `TypeError: Cannot destructure property 'x' of 'undefined'`
**Cause:** A destructured options parameter with no `= {}`, called with no argument.
**Fix:** `function f({ a, b } = {})`.

## Interview questions

**★ Why does a default parameter not apply to a value from an API response?**
Because defaults fire only on `undefined`, and JSON cannot carry `undefined` — an absent value
arrives as `null` or as a missing key. The missing key reads as `undefined` and triggers the
default; the explicit `null` does not. Coalesce with `??` where `null` should mean absent.

**★ What exactly does `JSON.stringify` do with `undefined`?**
Drops the property entirely when it is an object value, and converts it to `null` when it is an
array element. So a round trip can turn `undefined` into `null` with no code having chosen that,
which is what breaks defaults on the way back in.

**★ Why `??` rather than `||`?**
`||` replaces every falsy value, so a real `0`, `""` or `false` gets overwritten by the fallback.
`??` triggers only on `null` and `undefined`, which is what "not supplied" means. `||` is
acceptable only when every falsy value genuinely counts as missing.

**★ When is collapsing `null` into a default the wrong thing to do?**
In any write path. `null` and "absent" are different instructions to a PATCH endpoint — clear the
field versus leave it alone — and coalescing destroys the difference, so users can never empty a
field. Filter on `!== undefined` there and let `null` through.

**★ Why is a nested destructuring default worse than a flat one?**
Because the failure escalates. A flat default that is skipped gives you `null` where you wanted a
fallback; a nested one is destructured and throws `TypeError: Cannot destructure property … of
'null'`. Guard with `?? {}` before destructuring.

**★ What does the `= {}` on an options parameter actually protect against?**
Calling the function with no argument at all. Without it the parameter is `undefined` and
destructuring `undefined` throws immediately.

**Can you distinguish "omitted" from "passed as `undefined`" inside a function?**
Not through a default — both trigger it, which is the point and is what makes defaults compose
through wrappers. If you genuinely need the difference, you need `arguments.length` or a rest
parameter, and you should first ask why a caller passing `undefined` deserves different treatment.

---

← [Topic index](./README.md) · [Next → 17.2 · Merging, forwarding and identity](./02-merging-forwarding-and-identity.md)
