---
title: "Soft private and hard private"
sidebar_label: "01 · Soft private and hard private"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Classes → Member
> Visibility*, incl. its *Caveats* subsection) and **MDN** (*Private
> properties*). The `MySafe` and `Dog` examples and the soft/hard private wording
> are quoted verbatim from the handbook; the serialisation behaviour and the
> runtime `TypeError` text are quoted from MDN. Error codes and their exact
> `{0}`-templated text are read out of the **compiler's own diagnostic table**
> (⚠️ install inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus
> targets). **No console block** — no sandbox run covers this phase.

## The three modifiers, quickly

`public` (the default), `protected`, `private`. Standard meanings, enforced with
these:

| Code | Message text (verbatim from the diagnostic table) |
|---|---|
| **TS2341** | *"Property '{0}' is private and only accessible within class '{1}'."* |
| **TS2445** | *"Property '{0}' is protected and only accessible within class '{1}' and its subclasses."* |
| **TS2446** | *"Property '{0}' is protected and only accessible through an instance of class '{1}'. This is an instance of class '{2}'."* |

TS2446 has three placeholders for a reason —
[chunk 02](./02-visibility-rules-and-choosing.md) covers it.

## 🔴 `private` is enforced during type checking only

The handbook is unambiguous: `private` and `protected` *"are only enforced during
type checking"*. Its own demonstration:

```ts
class MySafe {
  private secretKey = 12345;
}

// In a JavaScript file...
const s = new MySafe();
// Will print 12345
console.log(s.secretKey);
```

Nothing survives compilation. `private secretKey = 12345` emits
`this.secretKey = 12345` — an ordinary, enumerable own property. Any JavaScript
caller sees it, as does anything that walks the object.

There is an escape hatch inside TypeScript too:

```ts
const s = new MySafe();
// Not allowed during type checking
console.log(s.secretKey);  // Error
// OK
console.log(s["secretKey"]);  // Works!
```

The handbook's framing: bracket notation *"makes `private`-declared fields
potentially easier to access for things like unit tests, with the drawback that
these fields are **soft private** and don't strictly enforce privacy."*

**"Soft private" is the term to carry**, because it names the guarantee exactly:
`private` documents intent and catches accidents. It does not keep a secret.

## `#private` is hard private

```ts
class Dog {
  #barkAmount = 0;
  personality = "happy";
}
```

The handbook again, verbatim: *"Unlike TypeScript's `private`, JavaScript's
private fields (`#`) remain private after compilation and do not provide the
previously mentioned escape hatches like bracket notation access, making them
**hard private**."*

This is real JavaScript, not an annotation, and the engine enforces it:

- **Dot access from outside the class body is a *syntax* error** — rejected at
  parse time, before anything runs. MDN: `instance.#privateField; // Syntax
  error`.
- **Dynamic access throws.** MDN's example ends with
  `TypeError: Cannot read private member #x from an object whose class did not
  declare it`.
- **There is no bracket-notation equivalent.** `obj["#x"]` reads a normal
  property named `"#x"` — a different thing entirely, and almost always a bug.

⚠️ **Downlevel note:** *"When compiling to ES2021 or less, TypeScript uses
WeakMaps in place of `#` for hard privacy."* The privacy holds, but the emitted
shape is no longer one-to-one — worth knowing before hunting for `#x` in a
bundle.

⚠️ **The two systems do not combine.** `private #x` is rejected: *"An
accessibility modifier cannot be used with a private identifier."* A `#` field is
already private, and it cannot take `public`/`protected`/`private`.

## The difference that reaches production

All of the above sounds academic until something serialises:

| | `private x` | `#x` |
|---|---|---|
| `JSON.stringify(obj)` | **included** | not included |
| `Object.keys(obj)` | **included** | not included |
| `{ ...obj }` | **copied** | not copied |
| `structuredClone(obj)` | copied | not cloned |
| `Object.freeze` / `seal` affects it | yes | **no effect** |
| Readable from JavaScript | yes | no |
| Readable via `obj["x"]` in TypeScript | yes | no |

MDN states the right-hand column directly: private elements *"are not part of the
prototypical inheritance model"*, `structuredClone()` does not clone them, and
`Object.freeze()` and `Object.seal()` have no effect on them.

🔴 **This is how a `private` field ends up in an API response.** A `User` class
with `private passwordHash`, handed to `res.json(user)`, serialises the hash. The
compiler was satisfied the whole way, because nobody ever *read* the property in
TypeScript — and reading is the only thing `private` checks.

**If a field must not leave the process, `#` is the only modifier that says so.**
The alternative — and often the better design regardless — is never to hand a
domain object to a serialiser at all, but to map it explicitly to a response
shape.

## Gotchas

**Symptom:** A `private` field appears in an API response or a log
**Cause:** `private` is erased; the field is an ordinary enumerable own property
and `JSON.stringify` sees it.
**Fix:** `#` for anything that must not leave the process, and an explicit
serialiser rather than passing the instance straight to `res.json`.

**Symptom:** `TS2341: Property 'x' is private…`, but `obj["x"]` compiles fine
**Cause:** `private` is soft — bracket notation is a documented escape hatch, not
a loophole.
**Fix:** Nothing is broken. If you needed it closed, the field should have been
`#`.

**Symptom:** `TypeError: Cannot read private member #x from an object whose class
did not declare it`
**Cause:** A `#` field read on something that is not an instance of the declaring
class — commonly a plain object from `JSON.parse`, or a detached method that lost
`this`.
**Fix:** Guard with `#x in obj` (chunk 02), or reconstruct a real instance.

**Symptom:** `#x` is missing after a spread or `structuredClone`
**Cause:** Private elements are not own properties and are outside the
prototypical inheritance model.
**Fix:** Copy through a constructor or an explicit `clone()`.

**Symptom:** `An accessibility modifier cannot be used with a private
identifier.`
**Cause:** `private #x` — the two systems do not stack.
**Fix:** Pick one; `#x` is already private.

**Symptom:** `Object.freeze(obj)` did not protect a `#` field
**Cause:** Freezing acts on own properties; private elements are not among them.
**Fix:** Expected. Immutability of `#` state is the class's own job.

## Interview questions

**★ What is the difference between `private` and `#private`?**
`private` is a type annotation enforced only during type checking — it is erased,
so a JavaScript caller can read the field, `obj["x"]` works even in TypeScript,
and it shows up in `JSON.stringify` and `Object.keys`. The handbook calls that
*soft private*. `#` is real JavaScript: dot access outside the class body is a
syntax error, dynamic access throws a `TypeError`, and the field is invisible to
serialisation. That is *hard private*.

**★ Can `private` keep a secret?**
No, and it is not trying to. It documents intent and catches accidents at compile
time. Anything that must genuinely stay inside the object — a password hash, a
token — needs `#`, because `private` fields serialise like any other property.

**What happens to `#` fields when you target an older runtime?**
TypeScript emits WeakMaps in place of `#` when compiling to ES2021 or below. The
hard privacy is preserved; the output simply stops resembling the source, which
matters when you are reading a bundle.

**Why does `Object.freeze` not lock down a `#` field?**
Because private elements are not own properties. Freeze and seal operate on the
own-property table, and `#` state lives outside it — along with being skipped by
spread, `structuredClone` and `Object.keys`.

---

← [Overview](./README.md) · Next → [02 · Visibility rules and choosing](./02-visibility-rules-and-choosing.md)
