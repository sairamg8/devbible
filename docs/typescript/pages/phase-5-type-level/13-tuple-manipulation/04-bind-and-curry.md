---
title: "Typing `bind`, `curry` and partial application"
sidebar_label: "04 · bind and curry"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 4.0 release notes**, *Variadic Tuple Types* —
> the `partialCall` implementation, its signature and all four of its error cases are the
> notes' own, quoted verbatim. `ThisParameterType` / `OmitThisParameter` and the
> `Parameters<F>` limitation are
> [topic 10 · chunk 01](../10-deriving-function-types/01-the-wrapper-signature.md)'s.
> **No sandbox, no console block, no timings.**

Partial application is the reason variadic tuple types exist in the shape they do. The 4.0
notes reach it as the payoff of the feature, and they are candid that `bind` itself was still
future work:

> We expect we may be able to leverage it to do a better job type-checking JavaScript's
> built-in `bind` method.

This chunk is that payoff, and the boundary where it stops.

## The notes' own `partialCall`

The runtime function is four lines of ordinary JavaScript:

```js
function partialCall(f, ...headArgs) {
  return (...tailArgs) => f(...headArgs, ...tailArgs);
}
```

and the signature that types it:

```ts
type Arr = readonly unknown[];

function partialCall<T extends Arr, U extends Arr, R>(
  f: (...args: [...T, ...U]) => R,
  ...headArgs: T
) {
  return (...tailArgs: U) => f(...headArgs, ...tailArgs);
}
```

🔴 **Read the parameter type of `f`: `(...args: [...T, ...U]) => R`.** That is the entire
trick. The function's parameter list is declared as **two spreads of two different type
parameters**, so passing `headArgs` fixes `T` and leaves `U` to be whatever is left over.
Neither `T` nor `U` is written by the caller; the split is inferred from how many arguments
were supplied.

> In this case, `partialCall` understands which parameters it can and can't initially take,
> and returns functions that appropriately accept and reject anything left over.

## The four things it gets right

Every one of these is from the notes, verbatim:

```ts
const foo = (x: string, y: number, z: boolean) => {};

const f1 = partialCall(foo, 100);
// Argument of type 'number' is not assignable to parameter of type 'string'.

const f2 = partialCall(foo, "hello", 100, true, "oops");
// Expected 4 arguments, but got 5.

// This works!
const f3 = partialCall(foo, "hello");
// const f3: (y: number, z: boolean) => void
```

and then, on the returned function:

```ts
// Works!
f3(123, true);

f3();
// Expected 2 arguments, but got 0.

f3(123, "hello");
// Argument of type 'string' is not assignable to parameter of type 'boolean'.
```

📌 **Four different failures, all at the right place.** A wrong *type* in the head args; too
*many* head args; too *few* tail args; a wrong *type* in the tail args. None of them is
reported inside `partialCall` — every one lands on the call the programmer wrote. That is the
bar tuple manipulation has to clear to be worth its cost
([topic 08 · chunk 01](../08-knowing-when-to-stop/01-the-error-is-the-interface.md)).

## Currying, and why it is a recursion

Partial application splits a parameter list **once**. Currying splits it at every position,
so it is the recursive version:

```ts
type Curried<A extends readonly unknown[], R> =
  A extends readonly [infer First, ...infer Rest]
    ? (arg: First) => Rest extends readonly [] ? R : Curried<Rest, R>
    : R;

declare function curry<A extends readonly unknown[], R>(
  fn: (...args: A) => R,
): Curried<A, R>;
```

Three things to notice, each of which is a decision:

1. **The recursion is nested, not tail** — the call sits inside a function type, so this is on
   the 100-level path ([topic 11 · chunk 01](../11-recursive-types/01-the-two-limits.md)). For
   parameter lists that is irrelevant; no real function has a hundred parameters.
2. **The base case is `R`, not `() => R`.** A curried function of zero arguments is the value,
   not a thunk. Getting this wrong is the commonest bug in a hand-written `Curried`.
3. ⚠️ **Labels are lost.** `infer First` takes the element type and leaves the label behind
   ([chunk 03](./03-labels-and-optionality.md)), so a curried function's hints degrade to
   `arg`. That is a real cost of currying at the type level and there is no way around it
   while the parameters are being taken one at a time.

## Where the pattern stops working

**Overloads.** A tuple can only describe one parameter list. `Parameters<F>` sees the **last**
overload and nothing else ([topic 10 · chunk 01](../10-deriving-function-types/01-the-wrapper-signature.md)),
so a partially-applied overloaded function silently binds against a signature the caller was
not using. This is the failure that type-checks and is untrue.

**Generic functions.** Extracting a parameter tuple from a generic function instantiates its
type parameters away — the partially-applied result is no longer generic. The fix is
structural rather than clever: make the *wrapper* generic and let inference resolve at the
call site, which is the same answer topic 10 gives for wrappers.

**`this`.** A tuple parameter list has no place for the receiver.
`ThisParameterType<F>` and `OmitThisParameter<F>` exist precisely because
`Parameters<F>` drops it, so a partially-applied method loses its `this` requirement unless
you carry it deliberately.

**`new`.** Construct signatures are a separate world; none of this applies to a constructor
without a parallel construct-signature version.

🔴 **All four have the same root cause: a tuple describes one call shape, and a function type
can carry several.** When the function is simple, tuple manipulation types it exactly. When
it is overloaded, generic, method-bound or constructible, the tuple is a lossy projection —
and [topic 08](../08-knowing-when-to-stop/README.md)'s answer applies: two hand-written
signatures beat one clever one.

## Gotchas

**Symptom:** A partially-applied overloaded function accepts the wrong arguments.
**Cause:** The parameter tuple came from the last overload only.
**Fix:** Hand-write the signatures for the overloads you actually use. There is no tuple that
represents an overload set.

**Symptom:** The curried result's parameter hints all say `arg`.
**Cause:** `infer First` drops the position's label.
**Fix:** Unavoidable while currying one parameter at a time. If the hints matter more than
the currying, they are an argument against currying at the type level.

**Symptom:** `Curried<[], R>` produced `() => R` and callers had to call it twice.
**Cause:** The base case returns a thunk instead of the value.
**Fix:** Return `R` directly from the empty case, and check `Rest extends []` before
recursing rather than after.

**Symptom:** Partial application of a generic function lost its genericity.
**Cause:** Extracting a parameter tuple instantiates the type parameters.
**Fix:** Declare the type parameter on the wrapper so it resolves per call site — topic 10's
"infer the tuple, do not extract it".

**Symptom:** A partially-applied method throws on `this` at runtime.
**Cause:** `Parameters<F>` drops the `this` parameter, so the type never required a receiver.
**Fix:** `ThisParameterType<F>` explicitly, or bind the receiver rather than partially
applying.

**Symptom:** Too many head arguments produced a confusing error deep in the helper.
**Cause:** Not in the release-notes signature — it reports *"Expected 4 arguments, but got
5"* at the call. If you are seeing it elsewhere, the signature has drifted from that shape.
**Fix:** Compare against `f: (...args: [...T, ...U]) => R` with `...headArgs: T`. Both spreads
have to be in the *parameter list of `f`*, not on the wrapper.

**Symptom:** The curried type hits `TS2589`.
**Cause:** Nesting, at 100 levels — or, far more likely, a genuinely unbounded parameter list
from an array rather than a tuple.
**Fix:** Check the input is a tuple. `Curried<string[], R>` has no fixed shape to recurse
over, and no depth cap makes that meaningful.

## Interview questions

**★ How does the release notes' `partialCall` work?**
By declaring the wrapped function's parameter list as **two spreads of two type parameters**:
`f: (...args: [...T, ...U]) => R`, with `...headArgs: T`. Supplying the head arguments fixes
`T`, and `U` is inferred as whatever is left, so the returned function takes exactly the
remaining parameters. Neither type parameter is written by the caller — the split falls out
of how many arguments were passed.

**★ What does it catch, and where do the errors land?**
Four distinct failures, all at the call the programmer wrote: a wrong type in the head args, a
wrong *number* of head args, too few tail args, and a wrong type in the tail args. Nothing is
reported inside the helper. That placement is the whole justification for the technique — a
tuple-manipulating type that reported at its own definition would be worse than the overloads
it replaced.

**★ Why is currying recursive when partial application is not?**
Because partial application splits the parameter list once, at a position the caller chose,
which one pair of spreads describes. Currying splits at *every* position, so the type has to
walk the tuple: take the first element, return a function of it whose return type is the
curried remainder. It is nested recursion — the call sits inside a function type — which is
fine here because no real parameter list approaches a hundred elements.

**★ What is the commonest bug in a hand-written `Curried`?**
The base case. When no parameters remain the result is `R`, not `() => R` — a curried function
of zero arguments is the value itself. Writing the thunk means every caller has to make one
extra call, and the mistake is invisible until someone uses it.

**★ Where does tuple-based function manipulation stop working?**
Overloads, generics, methods and constructors — and they share a root cause: a tuple describes
**one** call shape, while a function type can carry several. `Parameters<F>` sees only the
last overload, extraction instantiates a generic's type parameters away, the `this` parameter
is not part of the tuple, and construct signatures are a separate world. In all four the
honest answer is hand-written signatures.

**Why do labels disappear when currying?**
Because `infer First` extracts the element *type*, and the label belonged to the position,
which no longer exists. It is the same spread-versus-rebuild rule as everywhere else in this
topic: taking parameters one at a time is a rebuild by definition, so the structure cannot
survive it.

**Did 4.0 fix `bind`?**
No, and the notes are explicit about that — they say only that they expect they *may* be able
to leverage variadic tuples to do a better job of type-checking it. `partialCall` is the
worked example the feature actually shipped with; `bind` has the extra problem of the `this`
parameter, which a parameter tuple does not carry.

---

← [03 · Labels and optionality](./03-labels-and-optionality.md) · [Topic index](./README.md) ·
Next → [05 · The limits](./05-the-limits.md)
