---
title: "Function types"
sidebar_label: "08 · Function types"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Compiler output and the emitted
> signature come from `sandbox/ts-p1/ex5-functions.sh`.

**Describing a function is describing a contract with a caller.** Two rules
inside it are unintuitive and both exist for good reasons: a function with
*fewer* parameters is assignable where more are expected, and a function
returning something is assignable where `void` is expected.

## Writing one

```ts
type Formatter = (value: number, currency: string) => string;

interface Repo {
  find(id: string): Order | undefined;          // method shorthand
  save: (order: Order) => Promise<void>;        // property with a function type
}

function quote(weight: number, express = false): number { … }
const arrow = (a: number, b: number): number => a + b;
```

Parameters must be annotated ([01](./01-primitives-and-inference.md)); return
types are inferred but worth writing on exported functions.

## Contextual typing: the one place parameters infer

```ts
const f1: Formatter = (v, c) => `${c}${v}`;   // v: number, c: string — inferred
```

Because the target type is known, the compiler supplies the parameter types.
Remove the annotation and they revert to implicit `any`:

```console
src-ex5/fns.ts(5,24): error TS7006: Parameter 'v' implicitly has an 'any' type.
```

This is why callbacks passed to typed functions need no annotations, while a
standalone function always does.

## Fewer parameters is fine. More is not.

```ts
const f2: Formatter = (v) => `${v}`;             // fine
const f3: Formatter = (v, c, extra) => `${v}`;   // error
```

```console
src-ex5/fns.ts(5,7): error TS2322: Type '(v: any, c: any, extra: any) => string' is not assignable to type 'Formatter'.
  Target signature provides too few arguments. Expected 3 or more, but got 2.
```

**Ignoring an argument is safe; demanding one the caller will never send is not.**
It is the rule that makes every callback API usable:

```ts
['a', 'b'].map(x => x.toUpperCase());          // ignores index and array
['a', 'b'].map((x, i) => `${i}: ${x}`);        // takes them when wanted
```

Without it, every `map` callback would have to declare three parameters.

## Returning a value into a `void` slot is allowed

```ts
type Handler = () => void;
const h: Handler = () => 42;                   // no error

declare function each<T>(xs: T[], cb: (x: T) => void): void;
each([1, 2], (x) => x.toFixed(2));             // no error
```

`void` in a *parameter position* means "I will ignore whatever you return", not
"you must return nothing". This is what lets `arr.forEach(x => list.push(x))`
compile even though `push` returns a number.

The cost is that an `async` function slips in silently:

```ts
useEffect(() => fetchOrders(), []);            // returns a Promise into a void slot
```

React expects a cleanup function and receives a promise. The fix is a block body:
`useEffect(() => { void fetchOrders(); }, [])`
([Phase 8](../../syllabus/03-in-the-stack.md)).

## Optional, default and rest parameters

```ts
export function send(to: string, subject = 'none', ...cc: string[]) {
  return { to, subject, cc };
}
```

```console
export declare function send(to: string, subject?: string, ...cc: string[]): {
    to: string;
    subject: string;
    cc: string[];
};
```

Three things to read there:

1. A **default value makes the parameter optional** in the signature (`subject?`)
   while the *body* still sees a plain `string` — never `string | undefined`.
2. **Rest parameters** are typed as the array they collect.
3. Optional parameters must come after required ones; a rest parameter is last.

`subject?: string` and `subject: string = 'none'` differ inside the function: the
first is `string | undefined` in the body, the second is `string`.

## Overloads

When the return type depends on the arguments in a way one signature cannot
express:

```ts
function parse(input: string): string[];
function parse(input: string, limit: number): string[];
function parse(input: string, limit?: number): string[] {
  const parts = input.split(',');
  return limit === undefined ? parts : parts.slice(0, limit);
}

parse('a,b,c');
parse('a,b,c', 2);
parse('a,b,c', 2, true);
```

```console
src-ex5/overload.ts(9,19): error TS2554: Expected 1-2 arguments, but got 3.
```

**The implementation signature is not callable.** Only the two declared overloads
are visible to callers, which is why the third argument fails against
"1-2 arguments" rather than against the implementation's own parameter list.

Resolution picks the **first matching overload in order**, so put the more
specific ones first.

**Most overloads are better as a union or a generic.** Reach for them only when
the argument shape genuinely changes the return type:

```ts
// usually better:
function parse(input: string, limit?: number): string[] { … }
```

## Function type syntax cheatsheet

| Form | Meaning |
|---|---|
| `(a: string) => void` | Function type |
| `{ (a: string): void }` | Same, call-signature form — also allows extra properties |
| `new (a: string) => Widget` | Construct signature (a class, not an instance) |
| `(a: string): asserts a is Id` | Assertion function ([Phase 2](../../syllabus/01-type-system.md)) |
| `(a: unknown): a is Id` | Type predicate |

The call-signature form is what you need for a callable with properties:

```ts
interface Middleware {
  (req: Request, res: Response, next: NextFunction): void;
  name: string;
}
```

## Trade-off

**Annotating return types on exported functions** pins the contract — an
accidental change inside the body errors at the function rather than at a distant
caller. It costs a little duplication and can be wrong-headed on small internal
helpers, where inference is more accurate.

**Overloads** express a precise caller-facing API at the cost of a signature list
that must be maintained by hand and does not participate in inference the way a
generic does.

## Gotchas

**Symptom:** `Parameter 'x' implicitly has an 'any' type` in a callback
**Cause:** The function it is passed to is untyped, so there is no context to
infer from.
**Fix:** Type the receiving function, or annotate the callback parameter.

**Symptom:** An `async` callback was accepted where a sync one was expected
**Cause:** `void` in a parameter position accepts any return value.
**Fix:** Use a block body and `void` the promise, or type the parameter
`() => Promise<void>` if async is intended.

**Symptom:** `Expected 1-2 arguments, but got 3` when the implementation takes 3
**Cause:** The implementation signature is not callable — only the overloads are.
**Fix:** Add the overload you meant to expose.

**Symptom:** A parameter is `string | undefined` in the body despite a default
**Cause:** It was declared `x?: string` *and* given a default, or the default is
on a destructured property.
**Fix:** `function f(x = 'a')` alone — the default makes it optional for callers
and defined in the body.

**Symptom:** Assigning a handler fails with "Target signature provides too few
arguments"
**Cause:** Your function declares more parameters than the target type supplies.
**Fix:** Drop the extra parameters — you can never receive them.

## Interview questions

**★ Why can a function with fewer parameters be assigned where more are expected?**
Because ignoring an argument is safe, while requiring one the caller never sends
is not. It is what makes `arr.map(x => …)` legal without declaring `index` and
`array`. The reverse errors with `Target signature provides too few arguments`.

**★ Why does `() => 42` satisfy `() => void`?**
`void` in a parameter position means the caller ignores the return value, not
that there is none. It makes `forEach(x => arr.push(x))` compile — and it is why
an `async` callback slips into a `void` slot, which is the React `useEffect`
cleanup bug.

**★ What is the implementation signature of an overloaded function, and can
callers use it?**
It is the single real signature that implements all the overloads, and it is
**not** callable. Only the declared overloads are visible, which is why an
invalid call reports against the overload list (`Expected 1-2 arguments`).

**When should you use an overload rather than a union or a generic?**
Only when the return type genuinely depends on which arguments were passed in a
way one signature cannot express. Overloads do not participate in inference and
must be maintained by hand, so a union parameter or a generic is usually better.

**What is the difference between `x?: string` and `x: string = 'a'`?**
Both make the parameter optional for callers. Inside the body the first is
`string | undefined` and the second is `string`, because the default has already
been applied.

---

← Prev: [`type` vs `interface`](./07-type-vs-interface.md) · Next → [Structural typing](./09-structural-typing.md)
