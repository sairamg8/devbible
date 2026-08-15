---
title: "Decorators (stage 3)"
sidebar_label: "13 · Decorators"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes** (*Decorators*) —
> both `loggedMethod` versions, the fully-typed signature, and the two
> compatibility statements are **quoted verbatim**. **No console block** — no
> sandbox run covers this phase.

A **Know** topic, and an unusual one: **there are two incompatible decorator
systems in circulation**, and the first thing to establish about any decorator
you meet is which one it is. Get that wrong and nothing else makes sense.

## The shape

A decorator is a function that receives the thing being decorated and returns a
replacement. The release notes' first example:

```ts
function loggedMethod(originalMethod: any, _context: any) {
    function replacementMethod(this: any, ...args: any[]) {
        console.log("LOG: Entering method.")
        const result = originalMethod.call(this, ...args);
        console.log("LOG: Exiting method.")
        return result;
    }
    return replacementMethod;
}
```

Two parameters: **the original method**, and **a context object**. Return a
replacement and it is installed in place of the original.

The context is where the metadata lives:

```ts
function loggedMethod(originalMethod: any, context: ClassMethodDecoratorContext) {
    const methodName = String(context.name);
    function replacementMethod(this: any, ...args: any[]) {
        console.log(`LOG: Entering method '${methodName}'.`)
        const result = originalMethod.call(this, ...args);
        console.log(`LOG: Exiting method '${methodName}'.`)
        return result;
    }
    return replacementMethod;
}
```

> The context parameter is a "context object" that has useful information about
> how the decorated method was declared - like whether it was a `#private`
> member, or `static`, or what the name of the method was.

## Typing one properly

The `any`s above are the release notes teaching the shape. The real signature is
a generic that threads the receiver, the arguments and the return type through:

```ts
function loggedMethod<This, Args extends any[], Return>(
    target: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
) {
    const methodName = String(context.name);
    function replacementMethod(this: This, ...args: Args): Return {
        console.log(`LOG: Entering method '${methodName}'.`)
        const result = target.call(this, ...args);
        console.log(`LOG: Exiting method '${methodName}'.`)
        return result;
    }
    return replacementMethod;
}
```

Worth reading as a phase-3 exercise rather than as decorator syntax — it is
[generics](../phase-3-generics/README.md) doing ordinary work:

- **`This`** is the receiver, threaded through the `this` parameter
  ([topic 10](./10-this-types.md)) so the replacement is as `this`-safe as the
  original.
- **`Args extends any[]`** captures the parameter list as a tuple, and
  `...args: Args` spreads it back — so a wrong-arity call is still an error.
- **`Return`** ties the replacement's return type to the original's.

**Every type parameter here appears at least twice**, which is exactly
[topic 13 of phase 3](../phase-3-generics/13-when-not-to-write-a-generic/README.md)'s
test for a generic that earns its place. `ClassMethodDecoratorContext` is
parameterised by both `This` and the method's own type, which is how
`context.name` and the rest stay accurate.

There is a context type per decoratable position — class, method, getter, setter,
field, accessor — and the parameters differ accordingly. **Look up the one you
need rather than memorising all six.**

## 🔴 The two systems, and telling them apart

This is the part that matters in practice.

| | **Legacy** (`--experimentalDecorators`) | **Stage 3** (TS 5.0, default) |
|---|---|---|
| Enabled by | the flag | nothing — valid syntax for all new code |
| Method decorator params | `target, propertyKey, descriptor` | `value, context` |
| Parameter decorators | **yes** | **no** |
| `emitDecoratorMetadata` | yes | **not compatible** |
| Used by | NestJS, TypeORM, Angular, older `class-validator` | newer libraries |

The release notes are explicit on both counts:

> `--experimentalDecorators` will continue to exist for the foreseeable future;
> however, without the flag, decorators will now be valid syntax for all new
> code. Outside of `--experimentalDecorators`, they will be type-checked and
> emitted differently. The type-checking rules and emit are sufficiently
> different that while decorators *can* be written to support both the old and
> new decorators behavior, any existing decorator functions are not likely to do
> so.

> This new decorators proposal is not compatible with `--emitDecoratorMetadata`,
> and it does not allow decorating parameters.

**The fastest tell is the parameter list.** Three parameters ending in a property
descriptor means legacy; `(value, context)` means stage 3.

⚠️ **The two omissions are why large frameworks have not moved.** NestJS's
`@Inject()` on a constructor parameter is a **parameter decorator**, and TypeORM
and `class-validator` lean on **`emitDecoratorMetadata`** to read design-time
types at runtime. Neither exists in the standard proposal. **If you work in one
of those frameworks, you stay on `experimentalDecorators`** — that is not
technical debt you can pay down by flipping a flag, and the release notes say as
much.

## What decorators are actually good at

- **Cross-cutting behaviour** — logging, timing, retry, caching around a method,
  written once and applied by name.
- **Registration** — a class decorator that adds an entry to a registry at
  definition time.
- **Declarative metadata** — routes, validation rules, ORM columns. This is where
  the framework ecosystem lives, and it is exactly the part that needs the legacy
  system.

## And what they cost

⚠️ **A decorator moves behaviour off the page.** Reading a decorated method, you
cannot see that it retries, or logs, or is wrapped in a transaction — the name at
the top is the only clue, and "go to definition" leads to a generic wrapper
rather than to what will happen.

Two more, both real:

- **Debugging goes through the replacement.** Stack traces and breakpoints land in
  the decorator, not in the method you were reading.
- **Order is bottom-up and easy to get wrong** when decorators are stacked, and
  the resulting behaviour is often silently wrong rather than broken.

**The honest comparison is a higher-order function.** `withRetry(fn)` does the
same job, is visible at the call site, and needs no compiler feature. A decorator
wins when the behaviour must be **declarative and discoverable by a framework** —
which is precisely why the pattern is concentrated in frameworks rather than in
application code.

## Trade-off

**Decorators** remove repetition, keep cross-cutting concerns out of method
bodies, and give frameworks a declarative surface that is genuinely pleasant to
use. They cost visibility — behaviour that does not appear where it happens —
plus debugging indirection and a stacking order people get wrong.

**Higher-order functions and explicit wiring** keep everything visible and need
no compiler support, at the cost of noise at every call site.

The line worth holding: **use the decorators your framework defines; think twice
before writing your own.** If you do write one, prefer stage 3 for new code, and
check first that you need neither parameter decorators nor
`emitDecoratorMetadata` — because if you do, that decision is already made for
you.

## Gotchas

**Symptom:** An existing decorator stopped working after upgrading to TypeScript 5
**Cause:** Without `--experimentalDecorators`, decorators are type-checked and
emitted differently, and legacy decorator functions are unlikely to support both.
**Fix:** Keep the flag on, or rewrite the decorator for the new signature.

**Symptom:** `@Inject()` on a constructor parameter is rejected
**Cause:** Stage-3 decorators do not allow decorating parameters.
**Fix:** `experimentalDecorators`. There is no stage-3 equivalent.

**Symptom:** An ORM or validator stopped seeing property types at runtime
**Cause:** The new proposal is not compatible with `emitDecoratorMetadata`.
**Fix:** Stay on the legacy system for that project.

**Symptom:** A decorator's `this` is wrong inside the replacement
**Cause:** The replacement was written without a `this` parameter, or the original
was called without `.call(this, …)`.
**Fix:** Follow the typed signature — `function replacementMethod(this: This, …)`
and `target.call(this, ...args)`.

**Symptom:** Stacked decorators apply in an unexpected order
**Cause:** They are applied bottom-up.
**Fix:** Reorder deliberately, and keep stacks short.

**Symptom:** A breakpoint in a decorated method is never hit
**Cause:** The replacement is running; the original is only reached through
`target.call`.
**Fix:** Expected. Break in the decorator, or step through it.

## Interview questions

**★ What are the two decorator systems and how do you tell them apart?**
Legacy decorators behind `--experimentalDecorators`, and the stage-3 standard
form that TypeScript 5.0 made valid syntax with no flag. The fastest tell is the
parameter list: legacy method decorators take `target, propertyKey, descriptor`;
stage-3 ones take `(value, context)`. The release notes say the type-checking and
emit differ enough that an existing decorator is unlikely to support both.

**★ Why are NestJS and TypeORM still on the legacy system?**
Two things the standard proposal does not have: **parameter decorators**, which
NestJS needs for constructor injection, and **`emitDecoratorMetadata`**, which
ORMs and validators use to read design-time types at runtime. Both are stated in
the 5.0 release notes as not supported, so this is not debt you clear by flipping
a flag.

**What is the `context` parameter for?**
Metadata about how the decorated member was declared — its name, whether it is
`static`, whether it is a `#private` member — and it is typed per position
(`ClassMethodDecoratorContext` and siblings), parameterised by the receiver and
the member's own type so `context.name` and friends stay accurate.

**When would you not use a decorator?**
When a higher-order function would do. A decorator moves behaviour off the page:
the method body no longer shows that it retries or logs, breakpoints land in the
replacement, and stacked decorators apply bottom-up. `withRetry(fn)` is visible
and needs no compiler feature. Decorators win where a framework needs a
declarative, discoverable surface.

---

← Prev: [12 · Static members](./12-static-members-and-the-static-side.md) · Next → **14 · Mixins** *(not written yet)*
