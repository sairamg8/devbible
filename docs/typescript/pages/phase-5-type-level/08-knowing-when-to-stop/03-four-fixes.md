---
title: "Four fixes that cost nothing"
sidebar_label: "03 · Four fixes that cost nothing"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. The two naming quotations are from the **TypeScript wiki,
> *Performance*** (*Naming Complex Types*, *Using Type Annotations*), quoted
> verbatim. `noErrorTruncation`, its `false` default and its description
> (*"Disable truncating types in error messages"*) are from the **compiler's own
> option record** (**TypeScript 5.9.3**, `sandbox/ts-p0`), read rather than
> recalled. `TS2344` and `TS2345` come from the same table and are confirmed in
> **7.0.2**. **No sandbox, no console block.** The naming habit and the review
> checklist are **judgement**, marked as such.

Before deciding whether a type should exist at all
([chunk 04](./04-the-stopping-tests.md)), apply these. They are cheap, they are
uncontroversial, and they turn a large share of "unreadable type" complaints into
non-problems — which matters, because a type you were about to delete for
illegibility may only have been anonymous.

## Fix 1 · Name every intermediate step

The most common complaint about type-level code is *"the error mentions a type
nobody wrote"*. That is literally what happened: the compiler had no name to print,
so it printed structure.

```ts
// no name to print — the caller's error shows the whole expansion
declare function save<T>(
  row: { [K in keyof T as `db_${string & K}`]: T[K] | null },
): void;

// a name to print
type DbRow<T> = { [K in keyof T as `db_${string & K}`]: T[K] | null };
declare function save2<T>(row: DbRow<T>): void;
```

**Judgement:** name every intermediate *step*, not just the final result. A chain of
three transformations inlined into one alias is one type the reader can hover; the
same chain as three aliases is three, each individually inspectable, and three the
compiler can print by name.

```ts
// one hoverable thing, and its hover is the whole computation
type ApiShape<T> = Required<Omit<{ [K in keyof T]: T[K] | null }, "id">>;

// three, each of which means something on its own
type Nullable<T>  = { [K in keyof T]: T[K] | null };
type WithoutId<T> = Omit<T, "id">;
type ApiShape2<T> = Required<WithoutId<Nullable<T>>>;
```

The performance guidance recommends the same habit for an unrelated reason, which is
what makes this unusually strong advice:

> If the return type in this example was extracted out to a type alias, more
> information can be cached by the compiler.

— *TypeScript wiki, Performance → Naming Complex Types*

And on writing types rather than deriving them:

> Adding type annotations, especially return types, can save the compiler a lot of
> work.

with the caveat the same page attaches, kept here so this does not turn into dogma:

> Type inference is very convenient, so there's no need to do this universally.

So naming buys **legibility and cache hits**: the rare recommendation with no
trade-off. It is the first thing to do and the last thing to skip. The compile-time
half of the argument belongs to **09 · Type-level performance** *(not written yet)*.

⚠️ **Naming is not the same as `Prettify`.** A name gives the compiler something to
print *instead of* structure; `Prettify` forces an already-structural display into a
single flat object. You often want both, and they fix different symptoms —
[topic 01 · chunk 01](../01-mapped-types/01-the-loop.md) has the mechanism.

## Fix 2 · Constrain the input instead of handling nonsense

[Chunk 02](./02-three-designs-one-mistake.md)'s version B in one sentence: **bad
input is excluded by a bound, never handled by a branch.**

- A bound fails at the call site, with `TS2344` *"Type `'{0}'` does not satisfy the
  constraint `'{1}'`."* or `TS2345`, naming what was expected.
- A fallback branch produces a valid-but-useless type that flows onward and fails
  somewhere unrelated — usually as a bare `never`, which is assignable to everything
  and therefore silent at the point it was created.

**The test:** add the bound, then try to delete the `never` branch. If it deletes
cleanly, the branch was compensating for a missing constraint.

⚠️ **A bound only helps if it is narrower than the valid set is wide.**
`K extends string` excludes nothing when every key you care about is a string; the
bound has to be the union of the values you accept.

## Fix 3 · Treat truncation as a budget

Long types print with `...` in the middle. The option that turns that off is
`noErrorTruncation`, whose own record gives:

| Field | Value |
|---|---|
| `type` | `boolean` |
| `defaultValueDescription` | `false` |
| `category` | Output Formatting |
| description | *"Disable truncating types in error messages"* |

**Reading** a truncated error, and when to flip that flag temporarily, is
[phase 10 · Reading a TypeScript error](../../phase-10-strictness/04-reading-a-typescript-error.md)'s
subject. The author-side consequence belongs here:

> 🔴 **If your type's failure is only comprehensible with `noErrorTruncation` on,
> its failure is not comprehensible.** Nobody has that flag on. It defaults to
> `false`, it makes every *other* error worse, and the person hitting your type has
> no idea a flag stands between them and the answer.

So truncation is a **budget**, not an inconvenience: the useful part of your failure
has to fit inside what the compiler prints by default. A type whose message is
informative only in its elided middle has failed the test.

## Fix 4 · The hover test

Judgement, and the only review step that measures the thing this topic claims
matters. Before merging a computed type:

1. **Hover the result for one good input.** Is that the type you meant, or an
   expansion? If a reader would not recognise it, name the steps or apply
   `Prettify`.
2. **Write one deliberately wrong call and read the error out loud.** Not skim —
   read it as a stranger. Can they tell *what to change*?
3. **Check where the error landed.** At the call site with the mistake, or three
   files downstream? Downstream means a missing constraint.
4. **Count the lines.** If the message is longer than the function it guards, the
   guard is the more expensive thing.
5. **Read it from `tsc`, not the editor.** The editor renders related information as
   a collapsible tree; a CI log prints it flat, and flat is what the person debugging
   at 6pm sees.
6. **Do it with a widened argument too**, not only a literal. Most callers pass
   variables, and a widened input can resolve the computation differently before any
   comparison happens.

Step 2 is the one everybody skips, and it is the only one that tests the failure case
instead of the success case.

📌 **Make step 2 permanent where it matters.** A deliberately wrong call kept in the
codebase under `@ts-expect-error` is a regression test for the error's *existence* —
the directive fails the build if the line ever stops erroring
([phase 10 · suppression directives](../../phase-10-strictness/08-suppression-directives/README.md)).
It does not test the message's wording; the type-testing tools that do belong to
phase 12.

## Gotchas

**Symptom:** The error prints an anonymous mapped or intersection type instead of
your alias.
**Cause:** The type was inlined into the signature, so there was no alias to print.
**Fix:** Extract it and use the name in the signature.

**Symptom:** You named the type and the error *still* prints the expansion.
**Cause:** The alias resolved through a generic instantiation, or the type is an
intersection, which the compiler prints structurally rather than by name.
**Fix:** Apply the `Prettify` identity mapping at the boundary
([topic 01 · chunk 01](../01-mapped-types/01-the-loop.md)), or express the shape with
`interface … extends` instead of `&`
([chunk 05](./05-what-to-write-instead.md)).

**Symptom:** Naming the intermediates made the file longer and the hover worse.
**Cause:** Names were given to steps that are not concepts — `Step1`, `Tmp2`.
**Fix:** A name earns its place by *meaning* something. If a step has no name, that
is a hint the chain is doing too much in one place.

**Symptom:** The crucial type in the message is replaced by `...`.
**Cause:** Error truncation, on by default.
**Fix:** `noErrorTruncation: true` temporarily to debug; then shorten the type,
because the default limit is your real budget.

**Symptom:** `noErrorTruncation: true` got committed to the repo's `tsconfig.json`.
**Cause:** Someone fixed one error and left the switch on.
**Fix:** Take it out. It lengthens every unrelated message; it is a debugging tool,
not a setting.

**Symptom:** The type is fine for literal arguments and mystifying for variables.
**Cause:** A widened argument resolved the computation differently before any
comparison happened.
**Fix:** Test the widened case — step 6. Use `as const` at the source, or a `const`
type parameter
([phase 3 · topic 12](../../phase-3-generics/12-const-type-parameters/README.md)), if
literal-ness is genuinely required.

**Symptom:** The message reads well in the editor and is unusable in CI.
**Cause:** Related information is a tree in the editor and flat text from `tsc`.
**Fix:** Judge every message from `tsc` output.

**Symptom:** Hovering the good input looked great, and the first bug report was about
the error message.
**Cause:** The success case was tested and the failure case was not.
**Fix:** Step 2. It takes a minute and it is the entire measurement.

**Symptom:** A helper's error message regressed silently after an unrelated refactor.
**Cause:** Nothing tested it. Error text is not covered by any normal test.
**Fix:** A kept `@ts-expect-error` line pins the *existence* of the error; wording
needs the type-testing tools of phase 12.

## Interview questions

**★ What is the single cheapest improvement to a type-level error?**
Name the intermediate types. The compiler prints a name when it has one and structure
when it does not, so extracting aliases converts a wall of expansion into something
hoverable. The performance guidance recommends the same habit for caching — *"If the
return type in this example was extracted out to a type alias, more information can
be cached by the compiler"* — so it improves both legibility and build time, with no
trade-off.

**★ Naming versus `Prettify` — what does each actually fix?**
A name gives the compiler something to print *instead of* structure, so the message
says `DbRow<User>` rather than an object literal. `Prettify` — the identity mapping
`{ [K in keyof T]: T[K] } & {}` — forces a display that is *already* structural,
typically an intersection, to collapse into one flat object. Different symptoms:
"the error names nothing I wrote" versus "the error shows `A & B & C` instead of the
merged shape". Deep type-level code usually wants both.

**★ How do you decide whether a `never` fallback should be a constraint?**
Add the constraint and try to delete the branch. If it deletes cleanly the branch was
absorbing input a bound should have rejected, and the bound reports by name at the
call site (`TS2344`/`TS2345`) where the branch reported nowhere. Keep a fallback only
for cases that are genuinely reachable and genuinely meaningless.

**★ Does `noErrorTruncation` fix bad error messages?**
No, and treating it as a fix is the mistake. Its own option record gives the default
as `false`, so the reader hitting your type does not have it on, does not know it
exists, and would make every other message longer by enabling it. It is a debugging
switch for whoever is reading an error, not a design escape hatch for whoever wrote
the type. The design implication runs the other way: the useful part of the message
must fit inside the default truncation.

**What is the hover test, and which step do people skip?**
Hover the result for a good input; write one deliberately wrong call and read the
error as a stranger; check where it landed; count its lines; read it from `tsc`
rather than the editor; and repeat with a widened argument. People skip the wrong
call, which is the only step that measures the failure mode.

**Can you regression-test an error message?**
Its *existence*, yes — a deliberately wrong call kept under `@ts-expect-error` fails
the build if that line ever stops erroring, which catches a helper silently going
permissive. Its *wording*, not with the compiler alone; that needs the type-level
testing tools, which phase 12 covers. Worth knowing the split, because "we have tests"
usually means the first and not the second.

**A colleague says naming intermediates is "just style". Answer them.**
It changes what the compiler prints — a name instead of an expansion — which *is* the
readability of the failure, and it changes what the compiler can cache, which is
measured in build time. Two independent benefits, no cost. It is one of the few places
in this phase where legibility and performance point the same way.

**Why insist on a bound that is the union of valid values rather than any bound?**
Because a bound only reports what it excludes. `K extends string` accepts every typo
that happens to be a string, so the mistake still reaches the fallback and still
surfaces far away. `K extends "date" | "number"` rejects it at the argument, naming
the alias — and it makes the fallback branch unreachable, which is the signal you got
it right.

---

← Prev: [02 · Three designs, one mistake](./02-three-designs-one-mistake.md) ·
[Topic index](./README.md) · Next → [04 · The stopping tests](./04-the-stopping-tests.md)
