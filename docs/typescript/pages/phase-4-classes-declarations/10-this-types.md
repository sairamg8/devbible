---
title: "`this` types and polymorphic `this`"
sidebar_label: "10 · `this` types"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Classes → `this` Types*,
> *`this` Parameters*, *`this`-based type guards*, *Arrow Functions*). The `Box`
> / `ClearableBox`, `MyClass.getName`, `FileSystemObject` and arrow-function
> examples, and the trade-offs listed after them, are **quoted verbatim**. **No
> console block** — no sandbox run covers this phase.

A **Know** topic. `this` appears in three distinct positions in TypeScript and
they solve three different problems — recognising which one you are looking at is
most of the value.

## 1. `this` as a return type — polymorphic `this`

```ts
class Box {
  contents: string = "";
  set(value: string) {
    this.contents = value;
    return this;
  }
}
```

TypeScript infers the return type as **`this`**, not `Box`. That distinction is
invisible until you subclass:

```ts
class ClearableBox extends Box {
  clear() {
    this.contents = "";
  }
}

const a = new ClearableBox();
const b = a.set("hello");
     // const b: ClearableBox
```

`b` is a `ClearableBox`, so `a.set("hello").clear()` chains. Had `set` been
declared `: Box`, the chain would break at `clear()` — the subclass's own methods
would be gone after one call.

**This is why fluent APIs work in a hierarchy**, and it is the single practical
reason to care about `this` types. Query builders, assertion libraries and
configuration builders all depend on it.

⚠️ **You get it by inference; you lose it by annotating.** Writing `set(value:
string): Box` is the mistake — it is not wrong, exactly, it just discards the
subclass. Either leave the return type off, or write `: this` deliberately.

## 2. `this` parameters — a fake first parameter

```ts
// TypeScript input with 'this' parameter
function fn(this: SomeType, x: number) {
  /* ... */
}
```

A parameter literally named `this`, which must come first, declares what `this`
must be when the function is called. **It is erased during compilation** — it is
not a real parameter, and callers pass nothing for it.

On a method it constrains detached use:

```ts
class MyClass {
  name = "MyClass";
  getName(this: MyClass) {
    return this.name;
  }
}

const c = new MyClass();
c.getName(); // OK

const g = c.getName;
console.log(g()); // Error: 'this' context not assignable
```

The detached call is caught at compile time instead of producing `undefined` at
runtime — the classic "passed a method as a callback" bug.

## 3. `this`-based type guards

```ts
class FileSystemObject {
  isFile(): this is FileRep {
    return this instanceof FileRep;
  }
  isDirectory(): this is Directory {
    return this instanceof Directory;
  }
}

const fso: FileSystemObject = new FileRep("foo/bar.txt", "foo");
if (fso.isFile()) {
  fso.content; // const fso: FileRep
}
```

A [type predicate](../phase-2-narrowing/07-type-guards.md) about `this` rather
than about an argument. It narrows the receiver, so a base-class method can tell
callers which subclass they are actually holding — useful when the alternative is
exporting a discriminant field.

## Arrow property or method? The `this` question

The same problem — `this` lost when a method is detached — has two solutions, and
the handbook lists the costs of each rather than picking one.

```ts
class MyClass {
  name = "MyClass";
  getName = () => {
    return this.name;
  };
}

const c = new MyClass();
const g = c.getName;
console.log(g()); // Prints "MyClass" instead of crashing
```

| | Arrow property | Method with a `this` parameter |
|---|---|---|
| Runtime `this` | **guaranteed correct** | can still be misused by JavaScript callers |
| Memory | **a copy per instance** | one function per class definition |
| `super.getName` in a subclass | **not available** | works |
| Failure mode | none | a compile error at the detach site |

**The handbook's framing is the honest one:** an arrow property fixes the problem
at runtime and costs memory and `super`; a `this` parameter costs nothing at
runtime and only protects TypeScript callers.

Practical reading: **arrow properties for callbacks you hand to a framework**
(event handlers, React class methods, subscriptions), **methods for everything
else**. If a class has dozens of instances, the per-instance copy is a real cost
and worth noticing.

## `noImplicitThis`

Part of `strict`. It reports a `this` whose type cannot be determined — typically
a standalone `function` used as a callback, where `this` is whatever the caller
supplies. The fix is usually one of the three tools above: a `this` parameter to
say what is expected, or an arrow function so there is no dynamic `this` at all.

## Trade-off

**`this` types** keep a hierarchy's fluent API working and let a base class
narrow to its subclasses — capabilities nothing else provides. They cost
understanding: `this` in a type position means something different from `this` in
an expression, and a stray explicit return annotation silently disables the
polymorphism.

**Avoiding them** — concrete return types, standalone functions, no chaining —
is simpler and adequate for most classes.

The line worth holding: **let the return type be inferred on chainable methods**,
reach for a `this` parameter when a method is genuinely `this`-sensitive, and use
`this is T` only where a base class really must narrow. Everything else is fine
without.

## Gotchas

**Symptom:** A fluent chain stops working after subclassing
**Cause:** A method annotated `: Box` rather than returning `this`.
**Fix:** Remove the annotation, or write `: this`.

**Symptom:** `'this' context not assignable` when passing a method as a callback
**Cause:** A `this` parameter declaring what the method needs.
**Fix:** Bind it, wrap it in an arrow, or make the member an arrow property.

**Symptom:** `this` is `undefined` at runtime in a detached method
**Cause:** Ordinary JavaScript. TypeScript only warns if a `this` parameter was
declared.
**Fix:** An arrow property, or `.bind(this)`.

**Symptom:** `super.method()` is unavailable in a subclass
**Cause:** The base declared the member as an arrow property — it is an instance
field, not on the prototype.
**Fix:** Use a method with a `this` parameter if `super` matters.

**Symptom:** Memory grows with instance count in a class full of arrow properties
**Cause:** Each instance gets its own copy of every arrow property.
**Fix:** Methods, with binding at the call site instead.

**Symptom:** `this` implicitly has type `any` in a standalone function
**Cause:** `noImplicitThis` — the caller decides `this` and nothing declares it.
**Fix:** A `this` parameter, or an arrow function.

## Interview questions

**★ What is a polymorphic `this` type?**
A method that returns `this` is typed as the *current* class, not the declaring
one — so `a.set("hello")` on a `ClearableBox` returns `ClearableBox` and the
chain keeps the subclass's methods. It is inferred when you `return this` and
omit the annotation, and writing `: Box` instead silently discards it. This is
what makes fluent builders work across a hierarchy.

**★ What is a `this` parameter?**
A parameter literally named `this`, declared first, saying what `this` must be
when the function is called. It is erased at compile time — callers pass nothing
for it — and it turns "method detached from its object" from a runtime
`undefined` into a compile error.

**Arrow property or method?**
The handbook gives the trade directly: an arrow property guarantees the right
`this` at runtime but allocates one copy per instance and makes `super` calls
impossible; a method with a `this` parameter costs nothing at runtime, allows
`super`, and only protects TypeScript callers. Arrows for callbacks handed to
frameworks, methods for everything else.

**What is `this is T` for?**
A type predicate about the receiver rather than an argument, so a base class can
narrow to a subclass — `if (fso.isFile()) { fso.content }`. Useful when the
alternative would be exposing a discriminant field just for narrowing.

---

← Prev: [09 · Typing getters and setters](./09-typing-getters-and-setters.md) · Next → [11 · Abstract classes and abstract construct signatures](./11-abstract-classes.md)
