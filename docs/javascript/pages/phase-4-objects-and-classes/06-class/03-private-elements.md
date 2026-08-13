---
title: "06.3 · Private elements"
sidebar_label: "03 · Private elements"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Private elements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_elements), [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes). Documentation-validated.

**The one part of `class` with no desugaring.** Every other class feature can be
approximated with functions and prototypes; `#private` cannot, because its
enforcement is in the grammar.

MDN: *"Private elements get created by using a hash `#` prefix and cannot be legally
referenced outside of the class. The privacy encapsulation of these class elements is
enforced by JavaScript itself."*

The full set: private fields, private methods, private **static** fields and methods,
and private getters and setters.

## Access from outside is a `SyntaxError`

```js
class ClassWithPrivateField {
  #privateField;

  constructor() {
    this.#privateField = 42;
  }
}

const instance = new ClassWithPrivateField();
instance.#privateField; // SyntaxError
```

Note the error **kind**. Not `undefined`, not a `TypeError` at runtime — a
**`SyntaxError`**, thrown at parse time, so the file never runs. The privacy is not a
convention the runtime checks; it is a rule the parser enforces, and `#privateField`
outside a class body that declares it is not valid JavaScript.

That is why the `_underscore` convention it replaces was never equivalent:
`obj._private` was always accessible, always enumerable, and always visible in a
`JSON.stringify`.

Two more parse-time rules, both from MDN:

```js
class ClassWithPrivateField {
  #privateField;

  constructor() {
    delete this.#privateField; // Syntax error
    this.#undeclaredField = 42; // Syntax error
  }
}
```

**Private elements cannot be deleted, and cannot be created by assignment.** They
must be declared in the class body up front. So the shape of an instance's private
state is fixed by the class text — there is no dynamic addition, which is exactly
what makes the brand check trustworthy.

## Access on the wrong object is a `TypeError`

```js
class C {
  #x;

  static getX(obj) {
    return obj.#x;
  }
}

console.log(C.getX(new C())); // undefined
console.log(C.getX({}));      // TypeError: Cannot read private member #x from an object whose class did not declare it
```

Inside the class body the syntax is legal, so the check moves to runtime. Passing an
object that was not constructed by `C` throws.

**This is what the brand check exists to avoid:**

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
console.log(C.getX({}));           // "obj must be an instance of C"
```

`#x in obj` asks whether the object has that private element, without throwing.
Before this existed, probing meant a `try`/`catch`. It is only legal **inside** the
declaring class body — which is precisely what makes it safe: no outside code can
run the check, so no outside code learns anything about your private state.

And it is a stronger identity test than `instanceof`, because private elements cannot
be added afterwards, forged, or acquired without going through the constructor. See
[03 · brand checks](../03-existence-checks-and-delete/02-undefined-holes-and-brand-checks.md).

## Names must be unique, and the namespace is shared

MDN: *"All private identifiers declared within a class must be unique. The namespace
is shared between static and instance elements, with the exception of getter-setter
pairs"*:

```js
class ClassWithPrivate {
  #privateField;
  // #privateField; // Error: duplicate private field

  static #privateStaticField;

  // The private identifier cannot be #constructor
  // #constructor; // SyntaxError
}
```

Note this is the **one exception** to "duplicate names are fine" from
[01 · Methods, accessors and spread](../01-object-literals/02-methods-accessors-and-spread.md):
ordinary duplicate keys silently take the last value, even in strict mode, but
duplicate private names are an error. A `get #x()` / `set #x()` pair is the only
legal repetition.

`#constructor` is reserved and rejected.

## Private elements are not inherited

```js
class ClassWithPrivateField {
  #privateField = 42;
}

class Subclass extends ClassWithPrivateField {
  #subPrivateField = 23;
}
```

MDN: *"Private elements are not part of the prototypical inheritance model since they
can only be accessed within the current class's body and aren't inherited by
subclasses."*

So `Subclass` **cannot** read `#privateField`, even though every `Subclass` instance
has one. The parent's private state exists on the object and is reachable only by
code written inside the parent's body.

Two consequences:

- **`#private` is genuinely private, not "protected".** JavaScript has no
  `protected`. If a subclass must see it, the parent has to expose it — a
  `protected`-ish convention (`_name`), or a getter, or a method.
- **The same name in parent and child does not collide.** `#privateField` in the
  parent and `#privateField` in the child would be two independent slots, since each
  is scoped to its own class body. That is a feature: adding a private field to a
  base class can never break a subclass.

## What private elements do not give you

Worth stating so the guarantee is not oversold:

- **Not a security boundary against the same process.** A debugger shows them, and
  anything running in the page can be modified. The guarantee is *encapsulation
  against other code* — nobody can accidentally depend on your internals — not
  secrecy.
- **Not serialisable.** `JSON.stringify` cannot see them, and — per
  [04 · `structuredClone`](../04-shallow-vs-deep-copy/02-structuredclone.md) — *"class
  private elements are not duplicated"* by structured cloning. Anything that clones
  or serialises your objects loses them, so a class carrying private state needs its
  own `toJSON` and `clone`.
- **Not available on plain objects.** They are a class feature only. The
  closure-and-`WeakMap` pattern remains the way to get private state without a class.

## Gotchas

**Symptom:** `SyntaxError` when reading `obj.#field`
**Cause:** The access is outside the class body that declares it. MDN: *"It's an
error to reference private fields from outside of the class."* It is a **parse-time**
error, so nothing in the file runs.
**Fix:** Expose a getter or method from inside the class.

**Symptom:** `SyntaxError` from `this.#newField = x` in a constructor
**Cause:** Private elements *"cannot be created through later assignment"* — they must
be declared in the class body.
**Fix:** Declare `#newField;` at the top of the class body.

**Symptom:** `TypeError: Cannot read private member #x from an object whose class did
not declare it`
**Cause:** A method received an object that is not an instance of the declaring class
— common with a detached or `call`-ed method.
**Fix:** Guard with the brand check `if (#x in obj)`, which returns a boolean instead
of throwing.

**Symptom:** A subclass cannot see the parent's `#field`
**Cause:** Private elements are not inherited — MDN: they *"can only be accessed
within the current class's body"*. There is no `protected` in JavaScript.
**Fix:** Expose it from the parent via a getter or a method, or use a conventional
`_name` if subclasses genuinely need it.

**Symptom:** Private state disappears after `JSON.stringify` or `structuredClone`
**Cause:** Neither can see private elements; MDN states structured cloning does not
duplicate them.
**Fix:** Give the class a `toJSON()` and a `clone()` that have access to the private
names.

**Symptom:** `SyntaxError` for a duplicate `#name`
**Cause:** Private identifiers must be unique, in a namespace shared between static
and instance elements. Only a getter/setter pair may repeat a name.
**Fix:** Rename one. Note this is the one place duplicate names are an error rather
than silently last-wins.

## Interview questions

**★ What makes `#private` different from the `_underscore` convention?**
Enforcement. `obj.#field` from outside the class is a **`SyntaxError` at parse time**
— MDN: *"enforced by JavaScript itself"*. `_private` was always readable, always
enumerable, and always appeared in `JSON.stringify`. Private elements also cannot be
deleted or added by assignment; they must be declared up front.

**★ What happens if you access a private field on an object that is not an
instance?**
`TypeError: Cannot read private member #x from an object whose class did not declare
it`. Inside the class body the syntax is legal, so the check happens at runtime. Guard
with `#x in obj`, the brand check, which returns a boolean instead of throwing.

**★ Are private elements inherited by subclasses?**
No. MDN: they *"are not part of the prototypical inheritance model … and aren't
inherited by subclasses."* A subclass cannot read the parent's `#field` even though
its instances have one — JavaScript has no `protected`. It also means parent and child
can use the same private name without colliding.

**★ Why is `#x in obj` a better identity check than `instanceof`?**
Because private elements cannot be added after construction, forged from outside, or
acquired without going through the constructor — the declaration set is fixed by the
class text. `instanceof` can be defeated by `Symbol.hasInstance`, a reassigned
`prototype`, or a cross-realm copy of the class.

**Do private fields survive cloning or serialisation?**
No. `JSON.stringify` cannot see them, and structured cloning does not duplicate them.
A class with private state needs its own `toJSON` and `clone` methods, written inside
the class where the names are in scope.

**Are private elements a security feature?**
No — a debugger shows them and same-process code can be modified. The guarantee is
**encapsulation**: no other code can accidentally depend on your internals, and you
can change them without breaking anyone. That is a maintenance property, not a
secrecy one.

---

← [Static members and accessors](./02-static-and-accessors.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
