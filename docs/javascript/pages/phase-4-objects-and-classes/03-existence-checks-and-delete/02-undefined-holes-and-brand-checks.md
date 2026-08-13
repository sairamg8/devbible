---
title: "03.2 · `undefined`, holes and brand checks"
sidebar_label: "02 · undefined, holes, brand checks"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in), [`Object.hasOwn`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [Nullish coalescing](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing), [Private elements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_elements). Documentation-validated.

[Chunk 1](./01-in-and-hasown.md) covered the first axis — whether the prototype
chain counts. This is the second: **does a property that exists and holds
`undefined` count as present?**

`in` and `Object.hasOwn` say yes. `!== undefined` says no. That disagreement is the
source of a whole family of bugs that only appear for one input.

## `!== undefined` conflates two states

```js
const config = { retries: 0, timeout: undefined };

config.timeout !== undefined;          // false — but the key IS there
Object.hasOwn(config, "timeout");      // true
```

This is the check most code actually uses, and most of the time it is fine. It
becomes a bug the moment **an explicit `undefined` means something different from a
missing key** — precisely the situation in options objects, PATCH payloads, and
anything distinguishing "leave it alone" from "clear it".

```js
// A PATCH handler. These two requests mean different things:
//   { "nickname": null }   → clear the nickname
//   { }                    → don't touch the nickname
if (patch.nickname !== undefined) { /* … */ }     // cannot tell them apart
if (Object.hasOwn(patch, "nickname")) { /* … */ } // can
```

Note the JSON detail hiding in there: **`JSON.stringify` omits properties whose
value is `undefined`**, so `undefined` never survives a round trip. Over the wire
the distinction available to you is present-vs-absent or `null`-vs-absent, never
`undefined`-vs-absent. That is why `null` is the conventional "explicitly empty"
value in an API payload, and why a field you want to clear must be sent as `null`.

**Where `!== undefined` is genuinely right:** when you care only about the *value*,
inherited or not, and `undefined` and missing mean the same thing to you. That
covers a lot of application code — reaching for `Object.hasOwn` everywhere is
over-engineering. The rule: **if `undefined` is a meaningful value in your data,
stop using `!== undefined`.**

## `?.` and `??` are value checks, not existence checks

```js
user?.profile?.name ?? "anonymous";
```

`?.` short-circuits on `null` and `undefined`; `??` falls back on the same two.
Neither tells you whether a property **exists** — `{ name: undefined }` and `{}` are
indistinguishable to both. They are the right tool for *safely reading a value with
a default*, and the wrong tool for *deciding whether a key was supplied*.

The distinction from `||` matters more often:

```js
options.retries || 3;   // a deliberate 0 becomes 3
options.retries ?? 3;   // 0 stays 0
```

`||` falls back on every falsy value — `0`, `""`, `false`, `NaN` — while `??` falls
back only on `null`/`undefined`. `retries: 0`, `label: ""` and `enabled: false` are
all legitimate values that `||` silently discards. **`??` is the correct default
operator for defaults**; `||` is correct only when every falsy value really should
be replaced.

One syntax note: `a ?? b || c` is a `SyntaxError`. Mixing `??` with `||` or `&&`
requires explicit parentheses, deliberately, because the precedence would otherwise
be ambiguous to readers.

## Array holes make everything disagree

```js
const trees = ["redwood", "bay", "cedar", "oak", "maple"];
3 in trees;         // true
delete trees[3];
3 in trees;         // false — the slot is now a hole

const empties = new Array(3);
empties[2];         // undefined
2 in empties;       // false — never had a value

trees[3] = undefined;
3 in trees;         // true — the property exists and holds undefined
```

**Three states, not two:**

| State | `arr[i]` | `i in arr` | `Object.hasOwn(arr, i)` |
|---|---|---|---|
| present with a value | the value | true | true |
| present holding `undefined` | `undefined` | true | true |
| **a hole** (absent) | `undefined` | **false** | **false** |

Reading gives `undefined` for the last two, so only `in` and `Object.hasOwn`
distinguish them. MDN confirms the array case directly: `Object.hasOwn(fruits, 3)`
is `true` for a real element and `Object.hasOwn(fruits, 4)` is `false` past the end.

This matters because **array methods disagree about holes**: `map` and `forEach`
skip them while preserving them in the output, `Object.keys` omits them, but spread
and `for...of` visit them as `undefined`. A hole therefore behaves differently
depending on which method touches it, which is as confusing as it sounds.

**Never create holes deliberately.** Use `splice` to remove an element, `filter` to
build a new array, or `Array.from({length: n})` rather than `new Array(n)` when you
want `n` filled slots. Holes get full treatment in Phase 5.

## `#field in obj` — the brand check

An ES2022 form of `in` that has nothing to do with ordinary property existence:

```js
class Person {
  #age;
  constructor(age) {
    this.#age = age;
  }
  static isPerson(o) {
    return #age in o; // branded check
  }
}

const p1 = new Person(20);
Person.isPerson(p1); // true
Person.isPerson({}); // false
```

The question it answers is: **was this object constructed by this class?** Private
fields cannot be added afterwards, cannot be forged from outside the class body, and
are not acquired by anything that did not go through the constructor. So the answer
is trustworthy in a way `instanceof` is not — `instanceof` can be defeated by
`Symbol.hasInstance`, by a reassigned `prototype`, and by two copies of the same
class loaded in different realms (an iframe, a worker, a duplicated dependency).

MDN also notes the ergonomic gain: it *"avoids needing try-catch to detect private
elements and prevents `TypeError` when accessing undeclared private fields."*
Before this syntax, probing for a private field meant wrapping the access in
`try`/`catch`, because reading `#age` from an object that does not have it is a
`TypeError`.

The form is only legal **inside** the class body that declares the field, which is
what makes it safe — no outside code can perform the check, so no outside code can
learn about your private state.

## Which to use

- **`Object.hasOwn(obj, key)`** — the default for data.
- **`key in obj`** — capability and feature detection.
- **`obj.key !== undefined`** — fine when `undefined` and missing mean the same
  thing to you. Never in a patch or options path.
- **`obj.key ?? fallback`** — for reading with a default; not an existence check.
- **`#field in obj`** — brand checks, inside the declaring class.

## Gotchas

**Symptom:** A PATCH endpoint cannot distinguish "clear this field" from "leave it
alone"
**Cause:** `!== undefined` conflates a missing key with a key holding `undefined`.
**Fix:** `Object.hasOwn(patch, key)`. Note `JSON.stringify` drops `undefined` values
entirely, so on the wire the distinction must be present-vs-absent or
`null`-vs-absent.

**Symptom:** `options.retries || 3` turns a deliberate `0` into `3`
**Cause:** `||` falls back on every falsy value, not just absence. Same for
`label || "none"` with `""` and `enabled || true` with `false`.
**Fix:** `options.retries ?? 3`, which falls back only on `null`/`undefined`.

**Symptom:** `SyntaxError` when mixing `??` with `||` or `&&`
**Cause:** The combination requires explicit parentheses by design — the precedence
would be ambiguous.
**Fix:** Parenthesise: `(a ?? b) || c`.

**Symptom:** `arr[3]` is `undefined` but `3 in arr` is `false`
**Cause:** A hole — from `delete`, from `new Array(n)`, or from a sparse literal.
Reading a hole and reading a stored `undefined` both give `undefined`.
**Fix:** Do not create holes. `splice` to remove, `Array.from({length: n})` to
allocate. Use `in`/`Object.hasOwn` when you must tell the three states apart.

**Symptom:** `map` skipped elements but `for...of` visited them
**Cause:** Array methods disagree about holes — `map`/`forEach` skip them,
spread/`for...of` visit them as `undefined`.
**Fix:** Eliminate the holes rather than remembering which method does what.

**Symptom:** `TypeError` when reading a private field to check whether an object has
it
**Cause:** Accessing an undeclared private field throws rather than returning
`undefined`.
**Fix:** `#field in obj`, which MDN notes exists precisely to *"avoid needing
try-catch"*.

**Symptom:** `instanceof` returns `false` for an object that really is an instance
**Cause:** A cross-realm copy of the class, a reassigned `prototype`, or a custom
`Symbol.hasInstance`.
**Fix:** A brand check with `#field in obj` inside the class, which none of those
can fake.

## Interview questions

**★ How do you tell a missing property from one whose value is `undefined`?**
`Object.hasOwn(obj, key)` — or `key in obj` if inherited should count.
`obj.key !== undefined` cannot distinguish them, and neither can `?.` or `??`. It
matters in PATCH payloads and options objects, where absent and explicitly-empty
mean different things.

**★ Difference between `||` and `??` for defaults?**
`||` falls back on every falsy value — `0`, `""`, `false`, `NaN` — while `??` falls
back only on `null` and `undefined`. So `retries || 3` destroys a deliberate `0`
and `retries ?? 3` does not. `??` is the correct default operator; `||` is right
only when all falsy values genuinely should be replaced.

**★ What is `#field in obj`?**
An ES2022 **brand check**: it asks whether the object was constructed by the class
declaring `#field`. Private fields cannot be added or forged from outside, so it is
more trustworthy than `instanceof`, which is defeated by `Symbol.hasInstance`, a
reassigned prototype, or a cross-realm copy. It is only legal inside the declaring
class body.

**★ What are the three states an array index can be in?**
Present with a value, present holding `undefined`, and a **hole**. Reading gives
`undefined` for the last two, so only `in`/`Object.hasOwn` distinguish them — MDN
shows `2 in new Array(3)` is `false`, while `trees[3] = undefined` makes
`3 in trees` `true`.

**Why does `JSON.stringify` make `undefined` unusable as an API signal?**
Because it omits properties whose value is `undefined` entirely. A field set to
`undefined` and a field never set serialise identically, so the receiving end
cannot tell them apart. Use `null` for "explicitly empty" and absence for "not
provided".

**Is `?.` an existence check?**
No — it is a *value* check that short-circuits on `null` and `undefined`. `{}` and
`{ name: undefined }` behave identically under `obj?.name`. Use `Object.hasOwn`
when you need to know whether the key is there.

---

← [`in` and `Object.hasOwn`](./01-in-and-hasown.md) · [Topic index](./README.md) · Next → [`delete` and what it really costs](./03-delete-and-its-cost.md)
