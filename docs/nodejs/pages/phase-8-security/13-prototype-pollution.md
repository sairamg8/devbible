---
title: "Prototype pollution"
sidebar_label: "13 · Prototype pollution"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — merge behaviour, `JSON.parse` output,
> `structuredClone`, `Object.freeze` and `--disable-proto=throw` executed on this machine.

**A JavaScript-specific bug class: one request writes a property onto
`Object.prototype`, and every object in the process inherits it.** Not the request's
objects — *every* object, including ones created before the attack and ones in libraries
you never call directly.

```console
after merge, ({}).isAdmin = true
an unrelated object {name:'ada'}.isAdmin = true
```

## The mechanism, stated precisely

`JSON.parse` is **not** the vulnerability. It creates `__proto__` as an ordinary own
property and does not invoke the setter:

```js
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
Object.getPrototypeOf(payload) === Object.prototype;   // true — verified
JSON.stringify(payload);                               // {"__proto__":{"isAdmin":true}}
```

The parse is inert. The damage happens in whatever walks that object next — a recursive
merge, a config loader, a query-string parser, a "set a nested path" helper:

```js
function merge(target, source) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = target[key] || {};
      merge(target[key], source[key]);        // ← target['__proto__'] is Object.prototype
    } else {
      target[key] = source[key];              // ← writes onto it
    }
  }
  return target;
}

merge({}, JSON.parse('{"__proto__": {"isAdmin": true}}'));
```

`target['__proto__']` goes through the **getter** on `Object.prototype` and returns
`Object.prototype` itself. The recursive call then assigns `isAdmin` directly onto it.
One property write, process-wide blast radius, and it persists until restart.

The same shape reaches you through `constructor.prototype` — blocking only `__proto__`
leaves that door open.

## Why it turns into a real exploit

Rarely by flipping `isAdmin` directly. The realistic paths:

**Filling in a check that was reading an absent property.** `if (!user.isAdmin)` is false
for every user once the prototype carries it.

**Poisoning a library's options.** Templating engines, HTTP clients and child-process
wrappers read options with `opts.x ?? default`. A polluted prototype supplies the value
the caller never set — which is how prototype pollution becomes RCE: an inherited
`shell`, `env` or template-compilation option.

**Denial of service.** Polluting `toString` or a method name breaks unrelated code
throughout the process.

## Where the inputs come from

Anything that builds an object from user-controlled key names:

- `JSON.parse` output fed into a merge or a deep-clone helper
- **query strings** — `?__proto__[isAdmin]=true`, if your parser supports nested brackets
- `PATCH`/`PUT` bodies applied over a record
- YAML and TOML config, and CLI argument parsers
- `lodash.merge`-style helpers, `set(obj, 'a.b.c', v)` path setters

## Defences, measured

### `Object.create(null)` for anything keyed by user input

```js
const bag = Object.create(null);
Object.getPrototypeOf(bag);      // null — no prototype to pollute, and none to inherit from
```

There is no chain, so `bag.isAdmin` cannot be inherited and `bag['__proto__'] = x` sets
an ordinary own property. The cost: no `hasOwnProperty`, no `toString`, and
`console.log` renders it as `[Object: null prototype]`. Use `Object.hasOwn(bag, k)`.

**`Map` is the better answer** where the keys are genuinely dynamic. Keys are values, not
properties; `__proto__` is just a string.

### Reject the dangerous keys explicitly

```js
const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);

function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (BLOCKED.has(key)) continue;                 // or throw — a request sending these is hostile
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!Object.hasOwn(target, key) || typeof target[key] !== 'object') target[key] = {};
      safeMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}
```

All three keys, at every level of the recursion. `Object.hasOwn` rather than
`target[key] ||` keeps the check off the prototype chain.

The `JSON.parse` reviver is a free place to do this — it sees every key, nested first:

```console
reviver keys -> x, __proto__, y, constructor, ok,
```

```js
const data = JSON.parse(body, (key, value) => (BLOCKED.has(key) ? undefined : value));
```

### Schema validation at the boundary

A `zod` or `valibot` schema with unknown keys stripped removes the whole class before it
reaches your code — the object you work with contains only the fields you declared. This
is the same argument as [page 17](./17-input-validation.md), and it is the defence that
scales, because it does not depend on remembering to guard each merge.

### Runtime flags

`--disable-proto=throw` turns the getter itself into an error:

```console
$ node --disable-proto=throw
o.__proto__ = {x:1}
  -> Error: Accessing Object.prototype.__proto__ has been disallowed with --disable-proto=throw
merge({}, JSON.parse('{"__proto__":{"isAdmin":true}}'))
  -> Error: Accessing Object.prototype.__proto__ has been disallowed
```

Verified: the merge throws instead of polluting, and `JSON.parse` still produces the own
property (`{"__proto__":{"isAdmin":true}}`), which is the correct division of labour.
`--disable-proto=delete` removes the accessor instead of throwing. Test before shipping —
some dependencies use `__proto__` legitimately, and it does nothing about
`constructor.prototype`.

`Object.freeze(Object.prototype)` at startup is the other blunt instrument, and its
behaviour **depends on the calling code's mode**:

```console
ESM / strict  -> TypeError: Cannot add property isAdmin, object is not extensible
CJS / sloppy  -> silent no-op; ({}).isAdmin = undefined
```

Either way the pollution is prevented, but in sloppy mode you get no signal at all —
the attack fails silently and you never learn it happened. It also breaks any dependency
that legitimately extends `Object.prototype`.

### What does *not* defend

**`structuredClone` does not sanitise.** The clone keeps the own property — verified,
`JSON.stringify` of the clone still returns `{"__proto__":{"x":1}}`. It is a deep copy,
not a filter.

**A round-trip through `JSON.parse(JSON.stringify(x))`** likewise preserves it.

**Checking `Object.keys()` at the top level only.** The payload nests.

## Gotchas

**Symptom:** An unrelated object suddenly has a property nobody set
**Cause:** `Object.prototype` was polluted earlier in the process; inheritance does the rest.
**Fix:** Find the merge or path-setter that accepted `__proto__`; restart clears the state.

**Symptom:** Blocking `__proto__` in the request body did not stop it
**Cause:** `constructor.prototype` reaches the same object.
**Fix:** Block all three of `__proto__`, `constructor`, `prototype`, at every nesting level.

**Symptom:** `structuredClone` was added to sanitise input and nothing changed
**Cause:** It clones the own property faithfully — verified.
**Fix:** Strip keys explicitly, or validate with a schema that drops unknown keys.

**Symptom:** A library behaves as if an option was passed that never was
**Cause:** It reads `opts.x ?? default` and the prototype now supplies `x`.
**Fix:** The pollution is upstream; also prefer `Object.hasOwn` over truthiness for options.

**Symptom:** `Object.freeze(Object.prototype)` silently fails to report anything
**Cause:** Sloppy-mode assignment is a no-op rather than a throw — verified.
**Fix:** Rely on it as hardening only; keep the input-side guard, which can log.

**Symptom:** `bag.hasOwnProperty is not a function`
**Cause:** The object came from `Object.create(null)`.
**Fix:** `Object.hasOwn(bag, key)` — and that is the safer form regardless.

## Interview questions

**★ Is `JSON.parse` vulnerable to prototype pollution?**
No. It creates `__proto__` as an own property and does not go through the setter —
verified, the parsed object's prototype is still `Object.prototype`. The vulnerability is
in code that later walks that object and assigns with `target[key] = value`.

**★ Why does a recursive merge pollute when a shallow assignment doesn't?**
`target['__proto__'] = value` invokes the setter and changes that one object's prototype.
A recursive merge instead *reads* `target['__proto__']`, receiving `Object.prototype`
itself, and then writes properties onto it — affecting every object in the process.

**★ Blocking `__proto__` is not sufficient. What else?**
`constructor` and `prototype`, checked at every level of the recursion, not only at the
top. And prefer a schema that strips unknown keys, so the guard is not something each
merge has to remember.

**★ What is the strongest structural defence?**
Don't build plain objects out of user-controlled keys. `Map` treats keys as values;
`Object.create(null)` has no prototype to pollute or inherit from. Both remove the
mechanism rather than filtering the input.

**How does prototype pollution become remote code execution?**
By supplying an option a library never received. Child-process wrappers and template
engines read options with defaults; an inherited `shell` or template-compilation option
turns an inherited property into executed code.

**What do `--disable-proto=throw` and `Object.freeze(Object.prototype)` actually buy you?**
Runtime hardening, not a fix. `--disable-proto=throw` makes the access an error — verified
to abort the merge. Freezing prevents the write, but silently in sloppy mode. Neither
covers `constructor.prototype`, and both can break dependencies.

---

← Prev: [SSRF](./12-ssrf.md) · Next → [ReDoS](./14-redos.md)
