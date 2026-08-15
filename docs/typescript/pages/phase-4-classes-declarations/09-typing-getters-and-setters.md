---
title: "Typing getters and setters"
sidebar_label: "09 · Getters and setters"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 4.3 release notes** (*Separate Write
> Types on Properties*) — the `Thing` class, its usage block, the interface
> syntax and the assignability rule are **quoted verbatim** — and the
> **handbook** (*Classes → Getters / Setters*). **No console block** — no
> sandbox run covers this phase.

A **Know** topic: recognise the shape when you meet it, and know the one rule
that governs it. Most classes should not have accessors at all.

## The default: read and write share a type

An ordinary accessor pair is typed once. TypeScript infers the property type from
the getter, and a setter must accept it.

That is the right model when the accessor exists to add a check, compute a value,
or keep a field private — which is most of the time.

## Divergent types (TypeScript 4.3)

Since 4.3 the two halves may differ, which lets you model an API that **converts
on write**:

```ts
class Thing {
  #size = 0;

  get size(): number {
    return this.#size;
  }

  set size(value: string | number | boolean) {
    let num = Number(value);
    // Don't allow NaN and stuff.
    if (!Number.isFinite(num)) {
      this.#size = 0;
      return;
    }
    this.#size = num;
  }
}
```

```ts
let thing = new Thing();
// Assigning other types to `thing.size` works!
thing.size = "hello";
thing.size = true;
thing.size = 42;

// Reading `thing.size` always produces a number!
let mySize: number = thing.size;
```

**Write wide, read narrow.** Callers may assign several things; readers always
get one. The setter is where the coercion and the validation live, so nobody
downstream has to handle the union.

Note the `#size` backing field — hard private, so the raw value cannot be reached
around the accessor ([topic 02](./02-access-modifiers/README.md)). Divergent
accessors are only as good as the field they guard.

It works in interfaces and object types too:

```ts
interface Thing {
  get size(): number
  set size(value: number | string | boolean);
}
```

## 🔴 The one rule

> One limitation of using different types for reading and writing properties is
> that the type for reading a property has to be assignable to the type that
> you're writing. In other words, the getter type has to be assignable to the
> setter. This ensures some level of consistency, so that a property is always
> assignable to itself.

So `get(): number` with `set(v: string | number | boolean)` is fine — `number` is
one of the accepted writes. The reverse is not: you cannot read a wide type and
accept only a narrow one, because then `thing.size = thing.size` would fail.

**That self-assignability test is the whole rule, and it is worth remembering as
the test rather than the statement:** if `x.p = x.p` would not compile, the pair
is illegal.

## Where it earns its place

- **Coercing setters** — accept a `Date | string | number`, store a timestamp.
- **Normalising input** — trim and lower-case an email on write, always read back
  the canonical form.
- **Migration** — widen a setter to accept a legacy shape while readers keep the
  new one. The union lives in one place instead of at every call site.

## Where it does not

⚠️ **An accessor pair that only reads and writes a field is a field.** It costs a
declaration, a line of indirection and a reader's attention to achieve nothing:

```ts
// no
private _name = '';
get name() { return this._name; }
set name(v: string) { this._name = v; }

// yes
name = '';
```

Two more cautions worth carrying:

- **A getter that does real work is a lie about cost.** Reading a property looks
  free; if `get total()` runs a loop or a query, every caller pays a price the
  syntax hides. Make it a method — `getTotal()` — so the cost is visible.
- **Divergent types make a property behave asymmetrically**, which is genuinely
  surprising in a codebase that does not use the pattern elsewhere. Use it where
  the conversion is the *point* of the API, not to save a caller one
  `Number(...)`.

## Trade-off

**Accessors** let you validate, normalise or compute at the boundary while
callers keep property syntax, and divergent types let one property serve a
forgiving write and a precise read. They cost indirection, hide the cost of work,
and make a property's behaviour depend on which side you are on.

**A plain field** is honest and free, and a **method** makes work visible. Between
them they cover almost everything.

The line worth holding: **an accessor should do something.** If it does not,
delete it; if it does something expensive, make it a method.

## Gotchas

**Symptom:** A getter/setter pair is rejected as an illegal combination
**Cause:** The getter's type is not assignable to the setter's.
**Fix:** Widen the setter to include the getter's type. Test it with
`x.p = x.p` — if that would not compile, the pair is illegal.

**Symptom:** A property reads back a different type than was assigned
**Cause:** Divergent accessor types — intended, but surprising if undocumented.
**Fix:** Nothing, if the conversion is the point. Say so in a doc comment.

**Symptom:** Setter validation is bypassed
**Cause:** The backing field is reachable — `private` is soft, so `obj["_size"]`
works.
**Fix:** `#` for the backing field, as in the handbook's `Thing`.

**Symptom:** A hot loop is unexpectedly slow
**Cause:** A getter doing real work behind property syntax.
**Fix:** Make it a method so the cost is visible, or cache it.

**Symptom:** A pass-through accessor pair adds nothing
**Cause:** Reflex encapsulation.
**Fix:** Use a public field. You can convert it to an accessor later without
changing a single call site — that is the point of property syntax.

## Interview questions

**★ Can a getter and setter have different types?**
Yes, since TypeScript 4.3 — the classic use is a setter accepting
`string | number | boolean` and coercing, while the getter always returns
`number`. It works in interfaces and object types too.

**★ What is the rule that constrains them?**
The getter's type must be **assignable to** the setter's — the release notes'
reason is *"so that a property is always assignable to itself"*. The practical
test is `x.p = x.p`: if that would not compile, the pair is illegal.

**When should a class not use accessors?**
When they only read and write a field — that is a field, and you can convert it
to an accessor later without touching any call site. And a getter that does real
work should be a method instead, because property syntax makes expensive work
look free.

---

← Prev: [08 · `readonly` and definite assignment](./08-readonly-and-definite-assignment.md) · Next → [10 · `this` types and polymorphic `this`](./10-this-types.md)
