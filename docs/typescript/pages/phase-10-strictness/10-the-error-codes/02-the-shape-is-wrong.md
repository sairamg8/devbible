---
title: "The shape is wrong — TS2322 and TS2345"
sidebar_label: "02 · The shape is wrong"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **numbered diagnostic table** in the **TypeScript
> 5.9.3** build. Every code and template quoted here was read from that table:
> `TS2322`, `TS2345`, and the elaboration codes `TS2200`, `TS2201`, `TS2326`,
> `TS2328`, `TS2330`, `TS2411`, `TS2413`, `TS2416`, `TS2419`, `TS2634`, `TS2636`,
> `TS2684`, `TS2685`, `TS2603`, `TS2606`. The **TypeScript handbook**'s *Type
> Compatibility* section is the reference for the assignability relation itself.
> **No sandbox, no console block** — the nested shapes below are assembled from
> the quoted templates and labelled as such.

Two codes, one check, and between them they are the majority of every TypeScript
error you will ever see.

> **`TS2322` and `TS2345` are the same failure in two positions.** The compiler
> asks "is this type assignable to that one?", gets no, and picks a message based
> on **where the value was going** — into a binding, or into a parameter.
> Everything else about them is identical, **including the reasons printed
> underneath**, which is why learning the reason codes once pays off on both.

[Topic 04](../04-reading-a-typescript-error.md) owns **how to read** these: last
line first, then the property path. This chunk owns **what the lines are**, which
turns out to be a more precise instrument than the path alone.

| Code | Template | Position |
|---|---|---|
| `TS2322` | `Type '{0}' is not assignable to type '{1}'.` | assignment — a variable, a property, a `return`, a JSX attribute |
| `TS2345` | `Argument of type '{0}' is not assignable to parameter of type '{1}'.` | a call |

📌 **Why the distinction earns a second of attention: the fix lives somewhere
different.** For `TS2322` both sides are usually in the file you are looking at.
For `TS2345` the second type belongs to a **function signature that is often in
another package**, and no amount of staring at your own code will show it to you.
The move for `TS2345` is to hover the function, not to reread the error.

## 🔴 The reason lines are codes too, and each one locates the fault

The nested lines under a `TS2322` are not free text. Each is its own numbered
diagnostic, and **the code says what *kind* of thing disagreed**:

| Code | Template | The disagreement is in |
|---|---|---|
| `TS2326` | `Types of property '{0}' are incompatible.` | a **property** |
| `TS2200` | `The types of '{0}' are incompatible between these types.` | a nested member, named by path |
| `TS2201` | `The types returned by '{0}' are incompatible between these types.` | a **return type** |
| 🔴 `TS2328` | `Types of parameters '{0}' and '{1}' are incompatible.` | a **parameter** — see below |
| `TS2330` | `'{0}' and '{1}' index signatures are incompatible.` | two index signatures |
| `TS2634` | `'{0}' index signatures are incompatible.` | one index signature |
| `TS2411` | `Property '{0}' of type '{1}' is not assignable to '{2}' index type '{3}'.` | a property vs the index signature declared above it |
| `TS2413` | `'{0}' index type '{1}' is not assignable to '{2}' index type '{3}'.` | a numeric index vs a string index |
| `TS2419` | `Types of construct signatures are incompatible.` | a `new` signature |
| `TS2685` | `The 'this' types of each signature are incompatible.` | `this` |
| `TS2684` | `The 'this' context of type '{0}' is not assignable to method's 'this' of type '{1}'.` | a **detached method** — `const f = obj.method` |
| `TS2416` | `Property '{0}' in type '{1}' is not assignable to the same property in base type '{2}'.` | an **override** |
| `TS2603` | `Property '{0}' in type '{1}' is not assignable to type '{2}'.` | a JSX component's prop |
| `TS2606` | `Property '{0}' of JSX spread attribute is not assignable to target property.` | a JSX `{...spread}` |
| `TS2636` | `Type '{0}' is not assignable to type '{1}' as implied by variance annotation.` | an explicit `in`/`out` annotation |

**So a 40-line error is a stack of codes, not a stack of prose.** Three of these
are worth spotting on sight, because they mean the ordinary
property-by-property reading will *not* find the answer:

- **`TS2201` or `TS2328`** → the problem is inside a **function type**. Stop
  looking at data shapes.
- **`TS2684`** → you detached a method from its object. The fix is `.bind(obj)`,
  an arrow wrapper, or not detaching it.
- **`TS2411`** → your interface has an index signature and one named property
  contradicts it. Very easy to miss, because the named property looks fine on its
  own line.

📌 **This is the one place where skimming beats reading.** Searching a wall of
output for `TS2328` takes two seconds and reclassifies the whole error.

## 🔴 `TS2328` is the contravariance line, and it reads backwards

*"Types of parameters '{0}' and '{1}' are incompatible."*

This is the line that makes people conclude the checker is broken. The two names
are **your** parameter and **their** parameter, and the required direction is the
opposite of the intuitive one:

```ts
type Handler = (e: MouseEvent | KeyboardEvent) => void;

// TS2322, with TS2328 underneath, naming 'e' and 'e'
const h: Handler = (e: MouseEvent) => { console.log(e.clientX); };
```

The rejection is correct, and the reason is worth internalising once: `Handler`
promises its callers *"you may pass me a keyboard event"*. A function that only
accepts `MouseEvent` cannot keep that promise — it would read `.clientX` off a
key press.

**Return types run the other way**, which is why the same error never appears
there:

```ts
type Make = () => MouseEvent | KeyboardEvent;
const m: Make = (): MouseEvent => new MouseEvent("click");   // fine
```

Returning something *narrower* than promised is always safe; accepting something
narrower than promised never is. **Parameters are contravariant, returns are
covariant**, and `TS2328` is the only place the compiler says so out loud.

⚠️ **`strictFunctionTypes` decides whether this is checked at all, and it exempts
methods on purpose.** That exemption *is* the method-bivariance hole — argued in
[topic 07](../07-unsound-by-design/04-mutation-and-variance.md), with the flag
itself in [topic 01](../01-strict-flag-by-flag/README.md). It exists because
making methods strict would break `Array<T>`: `Array<Dog>` being usable as
`Array<Animal>` requires `push(item: Dog)` to be assignable to
`push(item: Animal)`, which contravariance forbids.

📌 **The practical consequence of that exemption is a real inconsistency you will
hit.** Declare the same callback as a property and it is checked; declare it as a
method and it is not:

```ts
interface Strict  { onEvent: (e: MouseEvent | KeyboardEvent) => void }   // checked
interface Lenient { onEvent(e: MouseEvent | KeyboardEvent): void }       // NOT checked
```

**Prefer the property form for callbacks.** It costs nothing and it is the free
half of the mitigation for method bivariance.

### The three fixes, in order

1. **Delete the annotation.** Contextual typing gives the parameter exactly the
   right type, and an annotation on a contextually typed parameter can only be
   equal to it or wrong:

   ```ts
   const h: Handler = (e) => {
     if (e instanceof MouseEvent) console.log(e.clientX);
   };
   ```

2. **Widen and narrow inside.** Same as above but explicit, when you want the
   parameter type visible at the declaration.
3. **Change the contract.** If `Handler` genuinely never receives keyboard
   events, the union is the bug and the type should say so.

⛔ **Not on the list: `as`.** An assertion here claims a keyboard event will
never arrive, which is exactly the thing the type says can happen.

## Gotchas

**Symptom:** a `TS2345` naming two types you have never declared.
**Cause:** the parameter type is a library's, and one or both names are inferred
or internal.
**Fix:** hover the function. The signature is the authority; the error is a
report about it.

**Symptom:** the error is on a callback you are passing, and the parameter you
wrote looks obviously right.
**Cause:** `TS2328` contravariance — your parameter is *narrower* than the
signature promises to pass.
**Fix:** widen it, or delete the annotation and take the contextual type.

**Symptom:** two interfaces look identical, but only one of them catches a bad
callback.
**Cause:** one declares the callback as a **property** and the other as a
**method**. `strictFunctionTypes` exempts methods.
**Fix:** use the property form for anything you want checked.

**Symptom:** `TS2322` on a `return` statement in a function with no return type
annotation.
**Cause:** it is not the `return` — it is the **contextual** return type from
wherever the function was passed.
**Fix:** annotate the return type. The error then lands on the offending
expression instead of the whole function.

**Symptom:** an error about `this` on a function you never wrote `this` in.
**Cause:** `TS2684` — you assigned a method to a variable and lost its receiver.
**Fix:** `obj.method.bind(obj)`, or `(...args) => obj.method(...args)`. This is
the same class of bug as passing `array.map(this.render)` in a class component.

**Symptom:** a property that clearly matches its declared type is rejected.
**Cause:** `TS2411` — an index signature on the same interface requires every
property to be assignable to *it*, too.
**Fix:** widen the index signature, or drop it and enumerate the keys.

**Symptom:** a union target, and the nested detail only explains one member.
**Cause:** the value failed against **every** member; the compiler elaborates the
closest one.
**Fix:** add a discriminant so the compiler can pick a branch, or assign to each
member in turn to see all the reasons.

**Symptom:** the same error appears twice with different codes in an editor and in
CI.
**Cause:** JSX positions have their own elaboration codes — `TS2603` and
`TS2606` — layered over the same `TS2322`.
**Fix:** none needed; read the inner line as usual. But be aware that searching
for `TS2322` will not find the JSX-specific discussion.

## Interview questions

**What is the difference between `TS2322` and `TS2345`?**
They are the same assignability failure reported in two positions. `TS2322` is an
assignment — a variable, property, return or JSX attribute. `TS2345` is an
argument at a call site. The practical difference is where the fix lives: for
`TS2322` both sides are usually visible in your file; for `TS2345` the parameter
type belongs to a signature that is often in another package, so the move is to
read the signature rather than the error.

**A 40-line assignability error has a line saying `Types of parameters 'e' and 'e'
are incompatible`. What is going on?**
That is `TS2328`, the contravariance line. The callback being assigned accepts a
*narrower* parameter than the target signature promises to pass. The target
guarantees its callers may pass the wider type, so a function that only handles
part of it cannot be substituted. The fix is to widen the parameter, or to leave
it unannotated and take the contextual type — never an assertion, which would be
claiming the wider case cannot occur.

**Why are parameters contravariant when returns are covariant?**
Because substitutability runs in opposite directions for inputs and outputs. A
replacement function may *return* something more specific than promised — every
caller can still use it. But it must *accept* everything the original accepted,
or some existing caller breaks. So return types may narrow and parameter types
must widen.

**Why does the same bad callback error in one interface and not another?**
`strictFunctionTypes` checks parameter types contravariantly for function-typed
**properties** and deliberately exempts **methods**. The exemption exists because
`Array<T>` depends on it — array covariance requires `push` to be bivariant. The
practical rule is to declare callbacks as properties rather than methods when you
want them checked; it is a one-word change and it is free.

**How do you speed up reading a very long assignability error?**
Skim for the reason codes before reading any prose. `TS2201` or `TS2328` means the
problem is inside a function type, so property-by-property reading will never
find it. `TS2684` means a method lost its receiver. `TS2411` means an index
signature on the same interface is the real constraint. Each of those
reclassifies the error in a couple of seconds.

---

← [01 · What a code is](./01-what-a-code-is.md) · [Topic index](./README.md) · Next → [03 · Two types with one name](./03-two-types-with-one-name.md)
