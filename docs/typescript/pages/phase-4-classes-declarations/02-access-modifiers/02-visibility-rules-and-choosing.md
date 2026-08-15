---
title: "Visibility rules and choosing"
sidebar_label: "02 · Visibility rules and choosing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Classes → Member
> Visibility*, incl. *Cross-instance private access*) and **MDN** (*Private
> properties*). The `A.sameAs`, `Derived1`/`Derived2` and `#x in obj` examples are
> quoted verbatim from those pages. Error codes come from the **compiler's own
> diagnostic table** (⚠️ install inspected: TypeScript **6.0.3**). **No console
> block** — no sandbox run covers this phase.

## Cross-instance access is allowed

TypeScript sides with Java, C#, C++, Swift and PHP here rather than Ruby. The
handbook:

```ts
class A {
  private x = 10;
  public sameAs(other: A) {
    // No error
    return other.x === this.x;
  }
}
```

`private` means **private to the class**, not private to the instance. The same
holds for `#`: a method may read `other.#x` on any object that genuinely is an
instance of the declaring class. This is what makes `equals`, `compareTo` and
copy constructors writable at all — without it, every such method would need a
public accessor.

## Cross-hierarchy `protected` — TS2446

The rule that surprises people:

```ts
class Base {
  protected x: number = 1;
}

class Derived1 extends Base {
  protected x: number = 5;
}

class Derived2 extends Base {
  f1(other: Derived2) {
    other.x = 10;  // OK
  }

  f2(other: Derived1) {
    other.x = 10;  // Error: Property 'x' is protected and only accessible
                   // within class 'Derived1' and its subclasses
  }
}
```

`Derived2` may reach `protected` members through **itself or its own
subclasses** — not through a **sibling** branch. Both are `Base`s and it still
fails: access is granted by the class you are writing in, not by a shared
ancestor.

That is what TS2446's third placeholder is reporting — *"Property '{0}' is
protected and only accessible through an instance of class '{1}'. This is an
instance of class '{2}'."* The message names both classes precisely because the
two-class case is the confusing one.

**The practical read:** if two sibling classes need to cooperate over shared
state, the operation belongs on `Base`, not on either sibling.

## `#` brands a class, in both worlds

Two consequences that make `#` more than a stricter `private`.

**At the type level**, a class with private members compares by **declaration
site**, not structurally — the `TS2442` behaviour met in
[phase 3 · generic classes](../../phase-3-generics/09-generic-classes.md). Two
identically-shaped classes are not interchangeable if either has a private
member. That is nominal typing arriving through the back door, and it is the
mechanism behind branded types (**topic 07** *(not written yet)*).

**At runtime**, ES2022 supplies the matching check. MDN's example:

```js
class C {
  #x;
  constructor(x) {
    this.#x = x;
  }
  static getX(obj) {
    if (#x in obj) return obj.#x;
    return "obj must be an instance of C";
  }
}

console.log(C.getX(new C("foo"))); // "foo"
console.log(C.getX({})); // "obj must be an instance of C"
```

`#x in obj` evaluates to `true` when the object carries that private field and
`false` otherwise — a brand check that a look-alike object cannot forge.

🔴 **It is stronger than `instanceof`**, and for a specific reason: `instanceof`
walks the prototype chain, so it fails when two copies of the same package are
installed and produces a confusing "this `Foo` is not a `Foo`". `#x in obj` asks
whether *this class body* installed the field, which is exactly the question you
meant. It is the runtime twin of the declaration-site rule above, and the two
together are why `#` is the honest choice for a type you intend to be nominal.

## Which to use

**Default to `#` for anything that is genuinely internal state.** It is real, it
keeps fields out of serialisation, and it costs nothing.

**Reach for `private` when you need the escape hatches** — and be honest that
that is the trade you are making:

- A test that reaches in via `obj["field"]`. Worth asking whether it should, but
  it is a legitimate reason and the handbook names it.
- A field that must stay enumerable or serialisable.
- **`readonly` combined with visibility.** `private readonly` is a common and
  useful pair; `#` fields cannot take an accessibility modifier at all.
- **Parameter properties** (**topic 03** *(not written yet)*) —
  `constructor(private readonly repo: Repo)` has no `#` equivalent, and for
  dependency-injected services that idiom is worth more than hard privacy.

⚠️ **Do not use both for the same conceptual field.** A class carrying `private
a` alongside `#b` for similar data invites exactly the serialisation confusion
from [chunk 01](./01-soft-private-and-hard-private.md) — half the state
round-trips through JSON and half vanishes.

## Trade-off

**`#private`** gives a real guarantee: unreachable from JavaScript, absent from
JSON, `Object.keys` and spread, and usable as a runtime brand. It costs the
escape hatches — tests must go through the public API — and downlevel output
becomes WeakMap machinery you cannot read.

**`private`** is a comment the compiler checks. It documents intent, catches
honest mistakes, keeps the field ordinary and inspectable, and composes with
`readonly` and parameter properties. It keeps no secrets whatsoever.

The line worth holding: **if the answer to "what happens if someone ignores
this?" is anything worse than untidy code, use `#`.** Otherwise `private` is
fine, and it is what most codebases already use.

## Gotchas

**Symptom:** `other.x` fails inside a subclass, on a `protected` member both
classes inherit
**Cause:** `protected` does not reach across sibling branches — TS2446.
**Fix:** Access through `this` or your own subclass, or move the operation onto
the base class.

**Symptom:** Two identically-shaped classes are not assignable to each other
**Cause:** A private or protected member makes the comparison nominal, by
declaration site.
**Fix:** Intended behaviour. Share a base class or an interface if they really
should be interchangeable.

**Symptom:** `instanceof` returns `false` for an object that is obviously the
right class
**Cause:** Two copies of the package in the build, so two distinct prototypes.
**Fix:** `#brand in obj` if the class has a private field — it asks the question
you actually meant. Otherwise deduplicate the dependency.

**Symptom:** A comparison method cannot read `other.x`
**Cause:** Assuming `private` is per-instance.
**Fix:** It is per-class; cross-instance access is allowed. The error is
something else — usually `other` being typed as a supertype.

**Symptom:** `#x in obj` reports `false` for a deserialised object
**Cause:** `JSON.parse` produces a plain object; no class body ever installed the
field.
**Fix:** Reconstruct through the constructor. This is the check working, not
failing.

## Interview questions

**★ Why can't a subclass touch a sibling's `protected` member?**
Access is granted by the class you are writing in, not by a shared ancestor.
`Derived2` can reach `protected` members through `Derived2` or its own
subclasses; a `Derived1` instance is a different branch, so it is TS2446 — whose
message names both classes, which is why it has three placeholders.

**★ How do you check at runtime whether an object is really an instance of a
class?**
`#x in obj`, the ES2022 brand check — `true` only if that object carries a
private field installed by that class body. Stronger than `instanceof`, because a
look-alike object cannot satisfy it and it is unaffected by a duplicated copy of
the package.

**Can one instance read another instance's `private` field?**
Yes. TypeScript allows cross-instance access — `private` is private to the class,
not to the instance — which is what makes `equals` and comparison methods
possible without exposing public accessors.

**Why do two identically-shaped classes sometimes fail to be assignable?**
Because a private or protected member makes the comparison nominal rather than
structural: members are matched by declaration site. Branded types exploit the
same mechanism deliberately.

**When would you deliberately choose `private` over `#`?**
When you need what `#` removes: bracket-notation access from tests, a field that
must serialise, `private readonly`, or a parameter property in a constructor —
none of which `#` supports. It is a real trade, not a legacy choice.

---

← [01 · Soft private and hard private](./01-soft-private-and-hard-private.md) · Up → [Overview](./README.md) · Next → **03 · Parameter properties** *(not written yet)*
