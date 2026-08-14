---
title: "09.2 · `super.method()` and overriding safely"
sidebar_label: "2 · super.method() and overriding"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`super`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super), [`extends`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends), [Method definitions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions), [Classes guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_classes), [`Object.setPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf), [`Symbol.species`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/species), [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [Arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions). Documentation-validated; **no timings**.

`super()` constructs. **`super.method()` is a different operator with a different rule**, and
knowing which object it looks in explains every strange thing it does.

## `super` looks in the *home object's* prototype

```js
class Base  { greet() { return "base"; } }
class Child extends Base {
  greet() { return super.greet() + " + child"; }
}

new Child().greet();     // "base + child"
```

The naive explanation — "`super.greet` means the parent's `greet`" — gives the right answer here
and the wrong one everywhere interesting. The actual rule:

> **`super.x` looks up `x` starting at the prototype of the method's *home object* — the object the
> method was defined in — and then calls it with the current `this`.**

Two halves, both load-bearing:

- **The lookup is lexical.** `super` resolves against where the method was *written*, fixed at
  definition time. It has nothing to do with what `this` currently is.
- **The call is dynamic.** The found function runs with the current `this`, so a base method
  reached through `super` still sees the derived instance and its fields.

### Why the lexical half matters

```js
const child = new Child();
const fn = child.greet;
fn.call({});                // still resolves super against Child.prototype
```

**A method carries its home object with it.** Detaching it does not repoint `super`, which is why
`super` keeps working in an extracted method even when `this` has been replaced — while everything
else in the method breaks. (`this` detachment itself is
[07 · `this` inside methods, and losing it](../07-this-in-methods/README.md).)

The consequence people actually hit is the reverse:

```js
const obj = {
  greet() { return super.toString(); },      // ✅ shorthand method — has a home object
};

const bad = {
  greet: function () { return super.toString(); },   // 🔴 SyntaxError
};
```

🔴 **`super` is only available where there is a home object: a shorthand method or a class
method.** A function *expression* assigned to a property has no home object, so `super` there is a
`SyntaxError` — not a runtime failure, a parse failure. **Refactoring `greet() {}` into
`greet: function () {}` breaks the file**, which is a surprising thing for a supposedly equivalent
rewrite to do.

⚠️ **Arrow functions inherit `super`** from the enclosing method, the same way they inherit `this`.
That is what makes `super.render()` legal inside a callback written as an arrow inside a method —
and illegal inside a `function` callback in the same place.

### `super` in static methods

```js
class Base  { static describe() { return "base"; } }
class Child extends Base {
  static describe() { return super.describe() + " + child"; }
}
```

Same rule on the static chain: the home object is the *constructor*, so `super` looks in
`Base`. This is the second half of the two chains from
[09.1](./01-the-two-chains-and-construction.md).

### `Object.setPrototypeOf` moves the target

Because the lookup starts at the home object's prototype, repointing that prototype repoints
`super`:

```js
Object.setPrototypeOf(Child.prototype, OtherBase.prototype);
// super.greet() in Child's methods now finds OtherBase's greet
```

**Correct, and almost never something to do.** Worth knowing because it explains that `super` is
not a compile-time alias for a specific class — it is a live lookup through a link you can move.

## Overriding safely

Four rules, in the order they save you trouble.

**1 · Call `super.method()` when you are extending, not replacing.** An override that forgets it
silently drops the base behaviour, and the failure appears wherever that behaviour was needed —
never at the override.

```js
class Child extends Base {
  save() {
    super.save();                // ✅ the base's work still happens
    this.audit();
  }
}
```

⚠️ **Where you call it is a decision.** Before means the base runs first and the override refines
the result; after means the override prepares state the base depends on. Pick deliberately — a
`super.save()` moved from the top to the bottom of a method is a behavioural change that looks like
formatting.

**2 · Keep the signature compatible.** An override that requires more arguments, or returns a
different shape, breaks every caller that holds a base-typed reference. JavaScript will not warn
you; the call simply misbehaves. **An override may accept *more optional* parameters and must
accept everything the base accepted.**

**3 · Do not call overridable methods from a constructor.** The base runs before the subclass's
fields exist — the ordering trap proved in [09.1](./01-the-two-chains-and-construction.md).

**4 · Prefer composition when the hierarchy grows past two levels.** Deep chains make every method
a lookup through several prototypes and every override a question of "which level am I actually
extending". **18 · Mixins and composition over inheritance** *(not written yet)* is the standing
argument for this in JavaScript specifically.

## Extending built-ins

`class` made this work properly, and the detail that makes it work is `super()`:

```js
class ValidationError extends Error {
  constructor(message, field) {
    super(message);              // ✅ Error's constructor builds the object
    this.name = "ValidationError";
    this.field = field;
  }
}

const e = new ValidationError("bad email", "email");
e instanceof ValidationError;    // true
e instanceof Error;              // true
e.message;                       // "bad email"
```

🔴 **`this.name` must be set by hand.** `Error` does not derive it from the class, so without that
line the message prints as `Error: bad email` and every log and error report shows the wrong type.
Full treatment in
[08 · Errors and subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md).

**Subclassing `Array` has its own wrinkle:** methods that return a new array — `map`, `filter`,
`slice` — construct it using the subclass by default, which is usually what you want and
occasionally not. `Symbol.species` is the hook that changes it:

```js
class Rows extends Array {
  static get [Symbol.species]() { return Array; }   // map/filter return plain Arrays
}
```

⚠️ **Reach for this rarely.** Subclassing `Array` at all is a design decision worth questioning —
a class that *has* an array is usually clearer than a class that *is* one.

## Gotchas

**Symptom:** `SyntaxError: 'super' keyword unexpected here`
**Cause:** `super` used in a function expression assigned to a property, which has no home object.
**Fix:** Use shorthand method syntax, or a class method.

**Symptom:** Converting `greet() {}` to `greet: function () {}` broke the file
**Cause:** Same thing — the rewrite removed the home object that `super` needs.
**Fix:** Keep the shorthand form when the body uses `super`.

**Symptom:** `super` works inside an arrow callback but not a `function` callback in the same method
**Cause:** Arrows inherit `super` from the enclosing method; `function` expressions do not.
**Fix:** Use an arrow, or capture what you need before the callback.

**Symptom:** Base behaviour silently stopped happening after an override was added
**Cause:** The override replaced rather than extended — no `super.method()` call.
**Fix:** Call it, and decide deliberately whether before or after the override's own work.

**Symptom:** Moving `super.save()` from the top to the bottom of a method changed behaviour
**Cause:** It is an ordering decision, not formatting — the base may depend on state the override sets, or vice versa.
**Fix:** Treat its position as part of the contract.

**Symptom:** A custom error logs as `Error: …` rather than its own name
**Cause:** `Error` does not set `name` from the class.
**Fix:** `this.name = "ValidationError"` after `super(message)`.

**Symptom:** `map` on an `Array` subclass returned the subclass, breaking a consumer
**Cause:** Array methods construct results from the subclass by default.
**Fix:** `static get [Symbol.species]() { return Array; }` — or do not subclass `Array`.

**Symptom:** `super.method()` started resolving somewhere unexpected
**Cause:** Something called `Object.setPrototypeOf` on the class's prototype; `super` is a live lookup, not a fixed alias.
**Fix:** Stop repointing prototypes at runtime.

## Interview questions

**★ What does `super.method()` actually look up?**
It starts at the prototype of the method's **home object** — the object the method was defined in —
and calls what it finds with the current `this`. The lookup is lexical and fixed at definition
time; the invocation is dynamic.

**★ Why can't you use `super` in `greet: function () {}`?**
Because `super` needs a home object, and only shorthand methods and class methods have one. A
function expression assigned to a property does not, so `super` there is a `SyntaxError` — which
makes that rewrite a breaking change rather than a stylistic one.

**★ Does `super` work inside a callback?**
Inside an arrow function, yes — arrows inherit `super` from the enclosing method along with `this`.
Inside a `function` expression, no.

**★ What happens if an override forgets `super.method()`?**
The base implementation simply never runs. Nothing warns you, and the failure shows up wherever
that behaviour was relied on rather than at the override — which is why "extend or replace?" should
be an explicit decision.

**★ How do you subclass `Error` correctly?**
`extends Error`, call `super(message)` first so the base builds the object, then set
`this.name` by hand — `Error` does not derive it from the class, so logs otherwise show the wrong
type.

**★ What is `Symbol.species` for?**
It tells built-in methods that produce new instances — `Array.prototype.map`, `filter`, `slice` —
which constructor to use. By default a subclass produces more of itself; overriding the species
getter makes them produce the plain built-in instead.

**★ Is `super` a fixed reference to the parent class?**
No — it is a lookup through the home object's prototype link, which `Object.setPrototypeOf` can
move at runtime. That is rarely a good idea, but it is the proof that `super` is resolved by
lookup rather than baked in.

**When should you stop reaching for `extends` altogether?**
Once the hierarchy is more than two levels deep, or once a subclass overrides most of what it
inherits. At that point composition — holding the collaborator rather than inheriting from it —
gives the same reuse with far fewer ordering and override hazards.

---

← [09.1 · The two chains, and constructing a derived instance](./01-the-two-chains-and-construction.md) · [Topic index](./README.md) · [Phase index](../README.md)
