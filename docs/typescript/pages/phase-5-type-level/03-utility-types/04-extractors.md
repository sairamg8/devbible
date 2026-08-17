---
title: "The extractors"
sidebar_label: "04 · The extractors"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types* —
> `Parameters`, `ConstructorParameters`, `ReturnType`, `InstanceType`, `Awaited`,
> `ThisParameterType`, `OmitThisParameter`), whose descriptions and `T0` examples
> are **quoted verbatim**, and the **2.8 release notes** (*Type inference in
> conditional types*), whose overload rule and `Foo`/`Bar` variance examples are
> quoted verbatim. **No console block** — no sandbox run covers this phase.

Seven utilities, one shape: **a conditional whose `extends` clause is a pattern
containing `infer`.** `ReturnType`'s original definition, from the 2.8 notes, is
the template for all of them:

```ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
```

## The function family

```ts
type T0 = Parameters<() => string>;                    // []
type T1 = Parameters<(s: string) => void>;             // [s: string]
type T2 = ReturnType<() => string>;                    // string
type T3 = ConstructorParameters<ErrorConstructor>;     // [message?: string]
type T4 = InstanceType<typeof C>;                      // C
```

The one that changes how you write code is `ReturnType<typeof fn>`:

```ts
function makeClient(config: Config) {
  return { get, post, close };   // an inferred, unnamed shape
}

type Client = ReturnType<typeof makeClient>;
```

You now have a name for a type you never wrote, and it cannot drift from the
factory that produces it. **Deriving the type from the implementation is the whole
point** — the alternative is an interface that someone has to remember to update.

`Parameters` gives the same leverage for wrappers:

```ts
function logged<F extends (...args: never[]) => unknown>(fn: F) {
  return (...args: Parameters<F>): ReturnType<F> => {
    console.log(fn.name, args);
    return fn(...(args as never[])) as ReturnType<F>;
  };
}
```

Note the two assertions. They are the deferral problem from
[topic 02 · chunk 02](../02-conditional-types/02-deferred.md): at the call site
everything is precise, inside the wrapper the compiler cannot prove that
`Parameters<F>` matches `F`'s own parameters. Wrapper functions are the standard
place where one asserted line is the honest answer. [10 · Deriving one function's type from another](../10-deriving-function-types/README.md)
is where this pattern is developed
properly.

## The overload rule — the sharpest edge in the family

Straight from the 2.8 notes, verbatim and emphasised there too:

> "When inferring from a type with multiple call signatures (such as the type of
> an overloaded function), inferences are made from the *last* signature (which,
> presumably, is the most permissive catch-all case). It is not possible to
> perform overload resolution based on a list of argument types."

```ts
declare function foo(x: string): number;
declare function foo(x: number): string;
declare function foo(x: string | number): string | number;
type T30 = ReturnType<typeof foo>; // string | number
```

**Every extractor sees only the last overload.** `Parameters<typeof foo>` is
`[x: string | number]`, not a union of the three. There is no flag and no
workaround inside the type system — if you need per-overload types, write the
signatures out or restructure the function to take a discriminated argument.

The practical rule that follows: **when you declare overloads, make the last one
the honest catch-all**, because it is the one every derived type will report.

## Multiple `infer` sites, and which way they combine

Also from the 2.8 notes, and worth knowing because it explains results that look
arbitrary:

```ts
type Foo<T> = T extends { a: infer U; b: infer U } ? U : never;
type T10 = Foo<{ a: string; b: string }>; // string
type T11 = Foo<{ a: string; b: number }>; // string | number
```

```ts
type Bar<T> = T extends { a: (x: infer U) => void; b: (x: infer U) => void }
    ? U
    : never;
type T20 = Bar<{ a: (x: string) => void; b: (x: string) => void }>; // string
type T21 = Bar<{ a: (x: string) => void; b: (x: number) => void }>; // string & number
```

> "multiple candidates for the same type variable in co-variant positions causes a
> union type to be inferred" … "multiple candidates for the same type variable in
> contra-variant positions causes an intersection type to be inferred"

**Co-variant (a value coming out) unions; contra-variant (a parameter going in)
intersects.** That is variance ([phase 3 · topic 14](../../phase-3-generics/14-variance.md))
showing up in inference, and it is why an extractor over parameter positions can
produce a `string & number` that no value can satisfy.

## `Awaited<Type>`

> "This type is meant to model operations like `await` in `async` functions, or
> the `.then()` method on `Promise`s"

```ts
type A = Awaited<Promise<string>>;            // string
type B = Awaited<Promise<Promise<number>>>;   // number
type C = Awaited<boolean | Promise<number>>;  // boolean | number
```

It is **recursive**, which is what distinguishes it from a hand-rolled
`T extends Promise<infer U> ? U : T`: a nested promise unwraps all the way down,
matching what `await` actually does at runtime. Combined with `ReturnType`, it
gives the shape you want from an async factory:

```ts
type Client = Awaited<ReturnType<typeof createClient>>;
```

That two-step is worth memorising — `ReturnType` alone on an `async` function
gives you `Promise<Client>`, which is almost never the type you wanted to name.

## The `this` pair

> `ThisParameterType<Type>`: "Extracts the type of the `this` parameter for a
> function type, or `unknown` if the function type has no `this` parameter."
>
> `OmitThisParameter<Type>`: "Removes the `this` parameter from `Type`. If `Type`
> has no explicitly declared `this` parameter, the result is simply `Type`."

```ts
function toHex(this: Number) {
  return this.toString(16);
}

type H = ThisParameterType<typeof toHex>;        // Number
const fiveToHex: OmitThisParameter<typeof toHex> = toHex.bind(5);
```

These exist for one job: typing `bind`, `call` and `apply` wrappers correctly.
They are rare in application code and unavoidable in library code that re-binds
functions — and they only see a `this` parameter that was *explicitly declared*
([phase 4 · topic 10](../../phase-4-classes-declarations/10-this-types.md)).

## Gotchas

**Symptom:** `ReturnType` on an overloaded function gives only one signature's
result
**Cause:** Documented behaviour — inference uses the **last** signature.
**Fix:** Order the overloads so the last is the permissive catch-all, or avoid
deriving from overloaded functions.

**Symptom:** `ReturnType<typeof asyncFn>` is `Promise<X>` and every consumer is
awkward
**Cause:** That is literally the return type.
**Fix:** `Awaited<ReturnType<typeof asyncFn>>`.

**Symptom:** An extractor on a generic function lost the generics
**Cause:** `typeof fn` for a generic function instantiates its parameters to their
constraints during inference; the type parameters do not survive extraction.
**Fix:** Extract from a concrete instantiation, or declare the type explicitly.

**Symptom:** `infer` produced `string & number`
**Cause:** Multiple candidates in **contra-variant** (parameter) positions
intersect, where co-variant ones union.
**Fix:** Infer from one position, or split the pattern into two conditionals.

**Symptom:** `Parameters<F>` inside a wrapper will not satisfy `F`'s own call
**Cause:** Deferral — the compiler cannot prove the relationship while `F` is a
parameter.
**Fix:** One asserted spread, commented, in a function short enough to verify.

**Symptom:** `ThisParameterType` returns `unknown`
**Cause:** The function has no explicitly declared `this` parameter; an implicit
`this` is invisible to it.
**Fix:** Declare `this: X` in the signature. There is nothing to extract
otherwise.

**Symptom:** `InstanceType<typeof C>` errors for an abstract class
**Cause:** `typeof C` for an abstract class is not a construct signature that can
be instantiated.
**Fix:** Use `InstanceType<abstract new (...args: any) => any>`-style patterns, or
extract from a concrete subclass ([phase 4 · topic 14 · chunk 04](../../phase-4-classes-declarations/14-mixins/04-abstract-and-fences.md)).

**Symptom:** `Awaited` of a thenable that is not a `Promise` behaves oddly
**Cause:** It models `await`, which follows any `then` method, so custom thenables
are unwrapped too.
**Fix:** Usually correct. If you need the wrapper type, do not unwrap it.

## Interview questions

**★ How is `ReturnType` implemented, and what does that tell you about the rest of
the family?**
`type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any` — a
conditional whose `extends` clause is a pattern with `infer`. Every other
extractor is the same line with a different pattern: `Parameters` infers the
parameter tuple, `InstanceType` infers from a construct signature,
`ThisParameterType` from a `this` parameter. Learn one, you have all seven.

**★ What happens when you apply `ReturnType` to an overloaded function, and why?**
You get the return type of the **last** overload only. The 2.8 notes state it:
inferences are made from the last signature, presumed to be the catch-all, and
overload resolution from a list of argument types is not possible. The practical
consequence is that the last overload should be the honest permissive one,
because it is what every derived type reports.

**★ Why does inferring the same variable twice sometimes union and sometimes
intersect?**
Position. Co-variant positions — values coming out, like properties or return
types — produce a **union** of the candidates. Contra-variant positions —
parameters going in — produce an **intersection**, because a function must accept
both. That is why an extractor over two parameter positions can yield
`string & number`, a type nothing satisfies.

**What is `Awaited` for, and how does it differ from a hand-rolled unwrapper?**
It models `await` and `.then()`, and it is **recursive**: nested promises unwrap
all the way, and non-promises pass through. A hand-rolled
`T extends Promise<infer U> ? U : T` unwraps exactly one level. The idiom worth
memorising is `Awaited<ReturnType<typeof asyncFactory>>`.

**When do `ThisParameterType` and `OmitThisParameter` matter?**
When typing `bind`, `call` or `apply` wrappers. `OmitThisParameter<typeof f>` is
the type of `f.bind(x)` — the same function without its receiver. Both only see
an *explicitly declared* `this` parameter; an implicit `this` yields `unknown`.

**You have `function createClient() { … }` returning an inferred object. How do
you name that type without writing it out?**
`type Client = ReturnType<typeof createClient>`, and
`Awaited<ReturnType<typeof createClient>>` if it is `async`. The type is derived
from the implementation, so it cannot drift — which is exactly the argument for
using it instead of a hand-maintained interface.

---

← Prev: [03 · The union filters](./03-union-filters.md) · Next → [05 · The oddities](./05-oddities.md)
