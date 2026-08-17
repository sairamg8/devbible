---
title: "What derivation quietly loses"
sidebar_label: "02 · What it quietly loses"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types* — the documented
> behaviour of `Parameters` and `ReturnType` on overloaded functions, developed in
> [topic 03 · chunk 04](../03-utility-types/04-extractors.md)) and the **5.4 release notes** for
> `NoInfer`. `TS2769` and `TS2345` are from the **compiler's own message table** (**5.9.3**) and
> confirmed in **7.0.2**. **No sandbox, no console block** — the multi-line error shape is
> assembled from the quoted templates and labelled as such.

A derived wrapper signature is right about the common case and **silently wrong about four
specific things**. Every one of them fails at a caller rather than at the wrapper, which is
[topic 08](../08-knowing-when-to-stop/01-the-error-is-the-interface.md)'s whole point in a
concrete setting.

## 1 · Overloads collapse to the last signature

The single sharpest edge in the family, and it is documented rather than incidental:
`Parameters<T>` and `ReturnType<T>` see **only the last overload**
([topic 03 · chunk 04](../03-utility-types/04-extractors.md) has the rule).

```ts
declare function parse(input: string): Config;
declare function parse(input: string, strict: true): StrictConfig;

type P = Parameters<typeof parse>;   // [input: string, strict: true]
type R = ReturnType<typeof parse>;   // StrictConfig
```

So a wrapper over `parse` **requires** the second argument and always claims to return
`StrictConfig`. Every one-argument caller of the original now fails against the wrapper:

```
❌ TS2345: Argument of type '[string]' is not assignable to parameter of type '[input: string, strict: true]'.
```

⚠️ **Assembled from the quoted message templates, not from a run.**

**What to do about it, in order of honesty:**

1. **Make the wrapper generic and let inference pick the overload per call site** —
   `function wrap<A extends unknown[], R>(fn: (...a: A) => R)` infers from the *argument list
   actually used*, so each call resolves its own overload.
2. **Write the overloads on the wrapper by hand.** Verbose, correct, and the failure mode is
   `TS2769` with a candidate list rather than a wrong single signature.
3. **Do not wrap overloaded functions generically.** Sometimes the right answer.

📌 **This is the case where deriving is worse than writing**, and it is worth knowing before
you reach for `Parameters` on anything with more than one signature.

## 2 · Generic functions are not generic afterwards

```ts
declare function identity<T>(x: T): T;

type P = Parameters<typeof identity>;   // [x: unknown]
type R = ReturnType<typeof identity>;   // unknown
```

Extracting a signature **instantiates** the type parameter — there is nowhere for `T` to live in
a tuple — so genericity is lost, and with it the relationship the function existed to express.

> 🔴 **A wrapper derived from a generic function is not a generic wrapper.** It is a wrapper
> over one instantiation, and the instantiation is usually the constraint or `unknown`.

**The fix is structural, not a better extraction:** make the *wrapper* generic and forward the
parameter.

```ts
// ❌ loses T
type BadWrapped = (...a: Parameters<typeof identity>) => ReturnType<typeof identity>;

// ✅ keeps the relationship
function instrument<T>(fn: (x: T) => T): (x: T) => T { /* … */ }
```

⚠️ **This is the most common wrong turn in the topic**, because the derived version compiles and
the loss only shows up as `unknown` at a call site far away.

## 3 · Modifiers survive only if you spread, not rebuild

`Parameters<F>` is a tuple that carries optionality and labels
([chunk 01](./01-the-wrapper-signature.md)). Both are lost the moment you take it apart and put
it back together:

```ts
declare function send(to: string, body?: string): void;

type Ok  = (...a: Parameters<typeof send>) => void;            // (to: string, body?: string)
type Bad = (a: Parameters<typeof send>[0],
            b: Parameters<typeof send>[1]) => void;            // both required, names gone
```

**Judgement:** index into `Parameters<F>` to *read* a type, never to rebuild a parameter list.
Spread it, or manipulate it with a variadic pattern that preserves the rest
(**13 · Tuple manipulation**, *not written yet*).

## 4 · Inference sites you did not intend to create

A generic wrapper introduces a new inference site, and TypeScript will happily infer from the
*wrong* argument — typically widening a type parameter because a later argument mentions it.

```ts
declare function pick<T, K extends keyof T>(obj: T, key: K): T[K];

function logged<T, K extends keyof T>(obj: T, key: K): T[K] { /* … */ }
```

When a caller's mistake makes two inference sites disagree, the error lands on whichever the
compiler chose — often not the one at fault. **`NoInfer<T>` (5.4)** is the fence that says
"infer this parameter from somewhere else, not here", and it is
**14 · `NoInfer<T>`** *(not written yet)*'s subject in full.

📌 **The relevance here:** every wrapper you make generic to solve problems 1 and 2 adds
inference sites, so the two fixes have a cost of their own. That is not a reason to avoid them —
it is a reason to check the hover at a call site with a *wrong* argument, per
[topic 08 · chunk 03](../08-knowing-when-to-stop/03-four-fixes.md).

## The four losses, and the response

| Lost | Symptom at the caller | Response |
|---|---|---|
| All but the last overload | a required argument appears, or the return type is too narrow | generic wrapper, or hand-written overloads |
| Genericity | `unknown` where a real type belonged | make the **wrapper** generic and forward the parameter |
| Optionality and labels | a required parameter, hints showing `args_0` | spread the tuple; never rebuild it by index |
| Inference control | the error lands on the wrong argument | `NoInfer<T>`, and check a deliberately wrong call |

## Gotchas

**Symptom:** A wrapper demands an argument the original made optional or absent.
**Cause:** Overload collapse — the last signature won.
**Fix:** Generic wrapper, or write the overloads out on the wrapper.

**Symptom:** The wrapper's return type is the *most specific* overload's, everywhere.
**Cause:** Same cause, other half.
**Fix:** Same fixes. Note that this one is more dangerous: it type-checks and is simply untrue.

**Symptom:** `Parameters<typeof f>` came back as `[x: unknown]`.
**Cause:** `f` is generic; extraction instantiated the parameter.
**Fix:** Do not derive. Make the wrapper generic with the same shape.

**Symptom:** A generic wrapper compiles but callers get `unknown` downstream.
**Cause:** The type parameter was declared on the wrapper but the derived types still come from
`typeof f`, so nothing connects them.
**Fix:** Type the parameter in terms of the wrapper's own type variables.

**Symptom:** An optional parameter became required after a refactor of the wrapper.
**Cause:** Somebody replaced a spread with indexed access.
**Fix:** Spread `Parameters<F>`; check the hover shows `?` and the real names.

**Symptom:** Editor hints show `args_0`, `args_1`.
**Cause:** Labels were lost — a rebuilt tuple, or a tuple constructed from a union.
**Fix:** Preserve the original tuple; labels are a property of the declaration, not recoverable
later.

**Symptom:** The error for a bad call points at the second argument when the first is wrong.
**Cause:** Two inference sites for one type parameter; the compiler picked the other one.
**Fix:** `NoInfer<T>` on the site that should not drive inference
(**14 · `NoInfer<T>`**, *not written yet*).

**Symptom:** Everything is correct and the wrapper is still unusable in a `.d.ts`.
**Cause:** The derived type is too large to serialise — `TS7056`.
**Fix:** Annotate the wrapper's return type explicitly
([topic 09 · chunk 04](../09-type-level-performance/04-the-fixes-in-order.md)).

## Interview questions

**★ What happens when you extract the signature of an overloaded function?**
You get **only the last overload** — `Parameters` and `ReturnType` are documented to behave that
way. A wrapper derived from a two-overload `parse` therefore requires the second argument and
claims the more specific return type, so every caller of the simpler form now fails with a
`TS2345` about tuple assignability. The fixes are a generic wrapper that infers per call site, or
overloads written out on the wrapper; the third option, not wrapping it generically, is sometimes
right.

**★ Why is a wrapper derived from a generic function not generic?**
Because extraction instantiates the type parameter — a tuple has nowhere to keep `T` — so
`Parameters<typeof identity>` is `[x: unknown]` and the relationship the function existed to
express is gone. The remedy is not a better extraction but a structural change: declare the type
parameter on the *wrapper* and forward it. The derived version is dangerous precisely because it
compiles.

**★ Which of the four losses is the most dangerous, and why?**
Overload collapse in the *return* position. A missing or extra parameter fails loudly at the call
site, but a return type taken from the most specific overload type-checks everywhere and is
simply untrue — callers get a type the function may not produce, and nothing errors until
runtime.

**★ How do you keep optionality and parameter names in a derived signature?**
Spread the tuple — `(...a: Parameters<F>) => R` — and never rebuild the parameter list by indexing
into it. `Parameters<F>[0]`, `Parameters<F>[1]` produces required parameters with generated names;
the optional marker and the 4.0 labels live on the tuple as declared and cannot be recovered once
discarded.

**What does making a wrapper generic cost you?**
New inference sites. A type parameter mentioned in two places can be inferred from either, so a
caller's mistake may be reported against the argument the compiler happened to choose rather than
the one at fault. `NoInfer<T>` exists to fence that off, and the practical habit is to hover a
deliberately wrong call before merging the wrapper.

**When is writing the wrapper's type by hand the better engineering decision?**
When the wrapped function is overloaded, and when the wrapper is exported. Overloads cannot be
derived faithfully at all, and an exported derived signature is the population that hits `TS7056`
and prints expansions in every downstream error. Deriving wins where the input is genuinely
open — the caller's own function, inferred at the call site.

---

← Prev: [01 · The wrapper signature](./01-the-wrapper-signature.md) · [Topic index](./README.md) ·
Next → **03 · The shapes in practice** *(not written yet)*
