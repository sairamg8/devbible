---
title: "Link map · TypeScript · Part 1b (phases 2–3)"
sidebar_label: "01b · TypeScript · Narrowing, Generics (2–3)"
sidebar_position: 2
---

# Link map · TypeScript · Part 1b (phases 2–3)

Continues `01-type-system.md` (phases 0–1). Covers every topic row of phases 2 and 3 in `docs/typescript/syllabus/01-type-system.md`: T02-01 to T02-13 (Narrowing and control flow analysis) and T03-01 to T03-14 (Generics). That is 27 rows. **All 27 have a page of ours (✅).** The file was split because 57 blocks exceed the 300-line cap.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. Official typescriptlang.org pages show no date, so only the fetch date is given. No `#anchors` are given.

🔴 **Version note.** npm on 2026-10-12: `typescript` latest 7.0.2. The Handbook pages cited here are the live ones on typescriptlang.org, whose "What's New" list stops at 6.0 (no 7.0 page, see Part 1). Narrowing, generics and inference rules below were not described as changed in the 6.0 and 7.0 posts I read, but I did not diff the checkers: treat "unchanged" as **not confirmed**. Release-note pages (3.7, 4.4, 4.7, 4.9, 5.0, 5.4) are cited for the feature's introduction, not as current reference.

---

## Phase 2 — Narrowing and control flow analysis

### T02-01 · `typeof` narrowing — Master · ✅ written `docs/typescript/pages/phase-2-narrowing/01-typeof-narrowing.md`
- **Read this:** [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · section "typeof type guards": the returned strings, and the `null` example where `typeof strs === "object"` still leaves `null` possible (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** none found that adds to the Handbook page.
- **Our delta:** none.

### T02-02 · Truthiness and equality narrowing — Master · ✅ written `docs/typescript/pages/phase-2-narrowing/02-truthiness-and-equality.md`
- **Read this:** [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · sections "Truthiness narrowing" and "Equality narrowing" (*headings only*) · covers our angle: **partial** — the empty-string and zero trap is not confirmed on the headings · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** the empty-string/zero trap that removes the wrong branch.

### T02-03 · Discriminated unions — Master · ✅ written `docs/typescript/pages/phase-2-narrowing/05-discriminated-unions.md`
- **Read this:** [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · its "Discriminated unions" section (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [TypeScript Discriminated Unions for Frontend Developers](https://www.totaltypescript.com/discriminated-unions-are-a-devs-best-friend) · Matt Pocock, 2023-03-29 (updated 2023-08-01) · "bag of optionals" versus a discriminated union, destructuring (*headings only*) · fetched 2026-10-12
- **Our delta:** none.

### T02-04 · Exhaustiveness with `never` — Master · ✅ written `docs/typescript/pages/phase-2-narrowing/06-exhaustiveness.md`
- **Read this:** [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · sections "The never type" and "Exhaustiveness checking" (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** the named `assertNever` helper and the build-breaking workflow.

### T02-05 · User-defined type guards — Master · ✅ written `docs/typescript/pages/phase-2-narrowing/07-type-guards.md`
- **Read this:** [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · section "Using type predicates" (*headings only*) · covers our angle: **partial** — "the compiler trusts you" is not confirmed on the heading · fetched 2026-10-12
- **Also good:** [Type Predicate Inference: The TS 5.5 Feature No One Expected](https://www.totaltypescript.com/type-predicate-inference) · Matt Pocock, 2024-03-17 · inferred predicates, and whether `filter(Boolean)` works (*headings only*) · fetched 2026-10-12
- **Our delta:** the trust gap, and TS 5.5 inferred predicates as a version note.

### T02-06 · `satisfies` — Master · ✅ written `docs/typescript/pages/phase-2-narrowing/10-satisfies/README.md`
- **Read this:** [TypeScript 4.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) · typescriptlang.org · "The satisfies Operator": validate against a type "without changing the resulting type" (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Clarifying the `satisfies` Operator](https://www.totaltypescript.com/clarifying-the-satisfies-operator) · Matt Pocock, 2023-03-13 (updated 2023-05-29) · colon annotation versus `satisfies`: the type wins versus the value wins (*read*) · fetched 2026-10-12
- **Our delta:** limits and patterns (the page's second chunk).

### T02-07 · Narrowing you lose without noticing — Master · ✅ written `docs/typescript/pages/phase-2-narrowing/11-narrowing-lost/README.md`
- **Read this:** [TypeScript 5.4 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html) · typescriptlang.org · "Preserved Narrowing in Closures Following Last Assignments" (*read* the opening) · covers our angle: **partial** — one case (closures); `await`, mutable properties and callbacks are not covered · fetched 2026-10-12
- **Also good:** [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · "Control flow analysis" and "Assignments" (*headings only*) · fetched 2026-10-12
- **Our delta:** most of the row; no single page found that lists the ways a check dies. The TS 5.4 change means the closure case depends on the compiler version.

### T02-08 · `as` assertions — Understand · ✅ written `docs/typescript/pages/phase-2-narrowing/08-as-assertions/README.md`
- **Read this:** [Type Assertions](https://www.totaltypescript.com/concepts/type-assertions) · Total TypeScript · the `as` keyword, its limits, and the double `as unknown as X` reset (*read*) · covers our angle: **partial** — "a claim you now own" is our argument, not the page's · fetched 2026-10-12
- **Also good:** [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · typescriptlang.org · section "Type Assertions" (*headings only*) · fetched 2026-10-12
- **Our delta:** the ownership framing.

### T02-09 · `in` operator narrowing — Understand · ✅ written `docs/typescript/pages/phase-2-narrowing/03-in-operator-narrowing.md`
- **Read this:** [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · section "The in operator narrowing" (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** none.

### T02-10 · `instanceof` narrowing — Understand · ✅ written `docs/typescript/pages/phase-2-narrowing/04-instanceof-narrowing.md`
- **Read this:** [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · section "instanceof narrowing" (*headings only*) · covers our angle: **partial** — cross-realm and bundle failures and `Symbol.hasInstance` are not confirmed · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** realms, bundles and `Symbol.hasInstance`.

### T02-11 · Assertion functions — Understand · ✅ written `docs/typescript/pages/phase-2-narrowing/09-assertion-functions/README.md`
- **Read this:** [TypeScript 3.7 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html) · typescriptlang.org · "assertion signatures": the `assert` form, `asserts val is T`, and the comparison to type predicates (*read*) · covers our angle: **partial** — the explicit-annotation requirement is not confirmed in my read · fetched 2026-10-12
- **Also good:** [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · section "Assertion functions" (*headings only*) · fetched 2026-10-12
- **Our delta:** the explicit-annotation requirement at the call site.

### T02-12 · `unknown` in `catch` — Understand · ✅ written `docs/typescript/pages/phase-2-narrowing/12-unknown-in-catch.md`
- **Read this:** [TypeScript 4.4 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html) · typescriptlang.org · `useUnknownInCatchVariables` changes catch variables from `any` to `unknown`; JavaScript can throw any value (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [TSConfig: useUnknownInCatchVariables](https://www.typescriptlang.org/tsconfig/useUnknownInCatchVariables.html) · typescriptlang.org · the flag reference (*headings only*) · fetched 2026-10-12
- **Our delta:** the "every handler starts by proving" pattern; Phase 7 owns the server version.

### T02-13 · The non-null assertion `!` — Know · ✅ written `docs/typescript/pages/phase-2-narrowing/13-non-null-assertion.md`
- **Read this:** [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · typescriptlang.org · section "Non-null Assertion Operator (Postfix !)" (*headings only*) · covers our angle: **partial** — "usually a missing guard" is our judgement · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** when it is legitimate.

---

## Phase 3 — Generics

### T03-01 · Generic functions and inference — Master · ✅ written `docs/typescript/pages/phase-3-generics/01-generic-functions-and-inference/README.md`
- **Read this:** [More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html) · typescriptlang.org · "Generic Functions": Inference, Constraints, Specifying Type Arguments (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) · typescriptlang.org · "Hello World of Generics" and "Working with Generic Type Variables" (*headings only*) · fetched 2026-10-12
- **Our delta:** none.

### T03-02 · Constraints — `T extends …` — Master · ✅ written `docs/typescript/pages/phase-3-generics/02-constraints/README.md`
- **Read this:** [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) · typescriptlang.org · section "Generic Constraints" (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html) · typescriptlang.org · "Constraints" and "Working with Constrained Values" (*headings only*) · fetched 2026-10-12
- **Our delta:** none.

### T03-03 · Generic interfaces and type aliases — Master · ✅ written `docs/typescript/pages/phase-3-generics/03-generic-interfaces-and-aliases/README.md`
- **Read this:** [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) · typescriptlang.org · section "Generic Types" (*headings only*) · covers our angle: **partial** — no `ApiResult` or `Repository` examples · fetched 2026-10-12
- **Also good:** [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) · typescriptlang.org · "Generic Object Types" (*headings only*) · fetched 2026-10-12
- **Our delta:** the worked data-structure examples.

### T03-04 · `keyof` — Master · ✅ written `docs/typescript/pages/phase-3-generics/04-keyof/README.md`
- **Read this:** [Keyof Type Operator](https://www.typescriptlang.org/docs/handbook/2/keyof-types.html) · typescriptlang.org · the `keyof` operator, ≈700 words (*headings only*) · covers our angle: **partial** — "entry point to every advanced type" is our framing · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** the framing.

### T03-05 · The `getProp` pattern — Master · ✅ written `docs/typescript/pages/phase-3-generics/05-getprop-pattern/README.md`
- **Read this:** [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) · typescriptlang.org · `getProperty<Type, Key extends keyof Type>(obj, key)` and the error for `"m"` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** none.

### T03-06 · Indexed access types — `T[K]` — Understand · ✅ written `docs/typescript/pages/phase-3-generics/06-indexed-access-types.md`
- **Read this:** [Indexed Access Types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html) · typescriptlang.org · ≈900 words (*headings only*) · covers our angle: **partial** — `T[number]` on arrays not confirmed · fetched 2026-10-12
- **Also good:** [This Crazy Syntax Lets You Get An Array Element's Type](https://www.totaltypescript.com/get-the-type-of-an-array-element) · Matt Pocock, 2024-09-02 · "Extracting Types From Arrays" and indexed access (*headings only*) · fetched 2026-10-12
- **Our delta:** `T[number]`.

### T03-07 · The `typeof` type operator — Understand · ✅ written `docs/typescript/pages/phase-3-generics/07-typeof-type-operator.md`
- **Read this:** [Typeof Type Operator](https://www.typescriptlang.org/docs/handbook/2/typeof-types.html) · typescriptlang.org · the operator and its "Limitations" (*headings only*) · covers our angle: **partial** — `typeof x[number]` from a `const` array not confirmed · fetched 2026-10-12
- **Also good:** [This Crazy Syntax Lets You Get An Array Element's Type](https://www.totaltypescript.com/get-the-type-of-an-array-element) · Matt Pocock, 2024-09-02 (*headings only*) · fetched 2026-10-12
- **Our delta:** deriving a union from a `const` array.

### T03-08 · Default type parameters — Understand · ✅ written `docs/typescript/pages/phase-3-generics/08-default-type-parameters.md`
- **Read this:** [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) · typescriptlang.org · section "Generic Parameter Defaults" (*headings only*) · covers our angle: **partial** — interaction with inference not confirmed · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** defaults and inference.

### T03-09 · Generic classes — Understand · ✅ written `docs/typescript/pages/phase-3-generics/09-generic-classes.md`
- **Read this:** [Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html) · typescriptlang.org · section "Generic Classes" with "Type Parameters in Static Members" (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) · typescriptlang.org · "Generic Classes" (*headings only*) · fetched 2026-10-12
- **Our delta:** when a generic class beats a generic function.

### T03-10 · Inference sites and contextual typing — Understand · ✅ written `docs/typescript/pages/phase-3-generics/10-inference-sites-and-contextual-typing.md`
- **Read this:** [Type Inference](https://www.typescriptlang.org/docs/handbook/type-inference.html) · typescriptlang.org · "Best common type" and "Contextual Typing" (the `window.onmousedown` example) (*read*) · covers our angle: **partial** — nothing on return-position inference or the three failure places · fetched 2026-10-12
- **Also good:** [How To Pass Types To Functions](https://www.totaltypescript.com/passing-types-to-functions) · Matt Pocock, 2024-02-22 · type arguments versus inference (*headings only*) · fetched 2026-10-12
- **Our delta:** the failure places.

### T03-11 · `infer` in conditional types — Understand · ✅ written `docs/typescript/pages/phase-3-generics/11-infer-in-conditional-types.md`
- **Read this:** [Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html) · typescriptlang.org · section "Inferring within conditional types" (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** none.

### T03-12 · `const` type parameters — Understand · ✅ written `docs/typescript/pages/phase-3-generics/12-const-type-parameters/README.md`
- **Read this:** [Const type parameters bring 'as const' to functions](https://www.totaltypescript.com/const-type-parameters) · Matt Pocock, 2023-04-11 (updated 2023-05-29) · `<const T>` makes `{ foo: 'bar' }` infer the literal `bar` with no `as const` at the call (*read*) · covers our angle: **partial** — where it silently does nothing is not on it · fetched 2026-10-12
- **Also good:** [TypeScript 5.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html) · typescriptlang.org · "const Type Parameters", `readonly string[]` constraint example (*read*) · fetched 2026-10-12
- **Our delta:** the silent no-op cases.

### T03-13 · When *not* to write a generic — Understand · ✅ written `docs/typescript/pages/phase-3-generics/13-when-not-to-write-a-generic/README.md`
- **Read this:** [More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html) · typescriptlang.org · "Guidelines for Writing Good Generic Functions": "Push Type Parameters Down", "Use Fewer Type Parameters" (*read*) · covers our angle: **partial** — "a type parameter used once is a disguised `any`" is not confirmed as worded · fetched 2026-10-12
- **Also good:** [There Is No Such Thing As A Generic](https://www.totaltypescript.com/no-such-thing-as-a-generic) · Matt Pocock, 2023-07-20 (updated 2023-10-05) · type arguments, type parameters and generic types (*headings only*) · fetched 2026-10-12
- **Our delta:** the disguised-`any` argument and the dismantling worked example.

### T03-14 · Variance — Know · ✅ written `docs/typescript/pages/phase-3-generics/14-variance.md`
- **Read this:** [TypeScript 4.7 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html) · typescriptlang.org · "Optional Variance Annotations for Type Parameters": `Getter` and `Setter` examples of `in`/`out` (*read* the opening) · covers our angle: **partial** — no method bivariance or `strictFunctionTypes` · fetched 2026-10-12
- **Also good:** [Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html) · typescriptlang.org · "Function Parameter Bivariance" (*headings only*); [TSConfig: strictFunctionTypes](https://www.typescriptlang.org/tsconfig/strictFunctionTypes.html) (*headings only*) · fetched 2026-10-12
- **Our delta:** method-parameter bivariance.
