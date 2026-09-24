---
name: devbible-typescript-concepts-phase10
description: The load-bearing claims behind TypeScript phase 10 (Strictness and correctness), banked per topic, with the compiler-table technique that produced them
metadata:
  type: reference
---

# TypeScript Phase 10 — Strictness and correctness

Part B's phase. Claims banked so a later session can review or reuse them
without re-reading the pages. **No sandbox anywhere in this phase** — everything
is read from the `tsconfig` reference, the handbook, or the compiler's own
tables on disk.

⚠️ **Topics 01–04 predate this file** (written 2026-08-15 by session `27931e79`)
and their claims are **not yet banked here** — only topic 05 is. Banking them is
outstanding work for whoever next opens the phase; the pages themselves carry
their `> Verified:` lines.

## The technique this phase runs on

Two readable sources, both already on disk, and **reading them is not a sandbox
run**:

```bash
# 1. the OPTION record — settles defaults and strict-membership from the compiler
grep -n -A14 'name: "exactOptionalPropertyTypes"' \
  sandbox/ts-p0/node_modules/typescript5/lib/typescript.js

# 2. the DIAGNOSTIC table — exact {0} text, 5.9.3 has the numbers
grep -o "_2412\", \"[^\"]*\"" \
  sandbox/ts-p0/node_modules/typescript5/lib/typescript.js

# 3. cross-check against the 7.0.2 Go binary — NOTE the bounded -oE form
timeout 110 strings -n 20 \
  sandbox/ts-p0/node_modules/@typescript/typescript-linux-x64/lib/tsc \
  | grep -oE ".{0,60}exactOptionalPropertyTypes.{0,190}" | sort -u
```

🔴 **The option record is the underused half.** A record's fields answer
questions people normally answer from memory or a blog: `defaultValueDescription`
gives the documented default, and the **presence or absence of `strictFlag`**
settles whether `strict: true` enables it. No prose source needed.

⚠️ **Do not use `grep -F` or a `[^"]\{0,N\}` pattern on the 7.0.2 binary.** Its
string table contains no newlines, so `-F` returns one ~125 KB line, and the
bracketed-repetition pattern exceeds ugrep's complexity limit outright. The
bounded `-oE ".{0,60}<needle>.{0,190}"` form is what works.

⚠️ **The limit of the technique, restated:** 7.0.2 is the Go port, so its string
table is readable and **its checker is not**. You can quote a message and prove a
code exists; you cannot prove which code a given program fires. Say so on the
page when it matters — topic 05 does.

## Topic 05 · `exactOptionalPropertyTypes`

### The option, from the compiler's own record

`type: "boolean"` · `category: Type_Checking` · `affectsSemanticDiagnostics` ·
`defaultValueDescription: false` · description *"Interpret optional property
types as written, rather than adding `'undefined'`."*

🔴 **No `strictFlag` field.** So `strict: true` does **not** enable it — settled
from the record, not from documentation prose. Same status as
`noUncheckedIndexedAccess`.

### 🔴 THREE diagnostics, not one

| Code | Message | Shape |
|---|---|---|
| `TS2375` | *"Type `'{0}'` is not assignable to type `'{1}'` with `'exactOptionalPropertyTypes: true'`. Consider adding `'undefined'` to the types of the target's **properties**."* | object → variable |
| `TS2379` | *"**Argument** of type `'{0}'` is not assignable to parameter of type `'{1}'` … the target's **properties**."* | object → parameter |
| `TS2412` | *"Type `'{0}'` … Consider adding `'undefined'` to the type of the **target**."* | `o.k = undefined` |

**The singular/plural ending is a reading technique**, not trivia: plural means a
whole object failed and the property path at the end is the only part that
matters; singular means the error is already on the line you need. Verbatim
identical in 5.9.3 and 7.0.2 under the same numbers. ⚠️ The shape column is
**inferred from the wording**, not proved from the checker.

🔴 **All three end with "Consider adding `'undefined'`", and taking that advice
mechanically undoes the flag.** `name?: string | undefined` *is* the pre-flag
meaning. This is the single most common way a team enables the flag and gains
nothing — worth saying on any page that quotes the message.

### The claims

1. 🔴 **It constrains writes, not reads.** `u.name` is `string | undefined` with
   or without the flag, because an absent property reads as `undefined` at
   runtime. **Consequence:** errors cluster at object *construction*, not across
   consuming code, which is why it is directory-scoped-friendly like
   `noUncheckedIndexedAccess` and unlike `strictNullChecks`. This is the most
   misread thing about the flag.

2. 🔴 **The soundness argument — the flag is what makes object spread's type
   correct.** `{ ...defaults, ...opts }` with `opts: { timeout?: number }` is
   typed `number`; a caller passing `{ timeout: undefined }` makes the runtime
   value `undefined`, because spread copies **keys**, not defined values. Nothing
   else in the language detects this. **Frame it as: spread is the feature that
   needed the flag, not a victim of it.**

3. **`JSON.stringify` drops `undefined`-valued keys and `JSON.parse` cannot
   produce `undefined` at all.** So a parsed body's properties are only ever
   absent, `null`, or a value — an explicit `undefined` in a request body was put
   there by your own code, essentially always by a defaults-merging spread.
   Therefore a boundary type permitting explicit `undefined` describes an
   unreachable state while hiding the reachable ones.

4. **Three-state payload model:** `field?: T | null` — absent = leave, `null` =
   clear, value = set. **Only expressible honestly with the flag on**; without it
   the type admits a fourth state that `'k' in patch` and
   `patch.k !== undefined` interpret differently.

5. **`Partial<T> = { [P in keyof T]?: T[P] }`** (read from `lib.es5.d.ts`), so it
   produces optional properties and is therefore exact under the flag. **This is
   the single largest error bucket in any migration**, because `Partial` is in
   most patch/update/options/props signatures.

6. 🔴 **`Required<T>` uses `-?`, which strips optionality *and* `undefined` from
   the property type.** So `{a?: string}` and `{a?: string | undefined}` both
   become `{a: string}` — `Required<Partial<T>>` is **not** the identity, it
   erases which properties were ever allowed an explicit `undefined`.

7. **`TS2790` — *"The operand of a `'delete'` operator must be optional."*** Not
   part of this flag, but interacting: `delete` is the only operation producing
   the absent state after construction, and it needs `?`. A codebase that
   "fixed" the flag by converting everything to `k: T | undefined` has quietly
   made those fields undeletable.

8. 🔴 **`skipLibCheck` is not the fix and gets proposed anyway.** It skips
   checking *inside* `.d.ts` files; assignability at **your** call site is
   checked regardless. If someone offers it for one of these errors, the
   diagnosis is wrong.

9. **Residual risk the flag does not remove:** a library can hand you an object
   with an optional property present-and-`undefined` at runtime while its
   `.d.ts` declares it optional. The flag governs what your code constructs, not
   what crosses the boundary. Mitigation is a boundary module.

10. **Without `strictNullChecks` the flag does nothing** — `undefined` is already
    in every type, so there is no case to reject. Enabling it in a non-strict
    codebase is a config advertising a guarantee nobody is enforcing.

11. **Destructuring defaults never had the bug.** `{ timeout = 5000 }` fires on
    `undefined` whether absent or explicit — value-based. Spread and
    `Object.assign` are key-based. **A codebase applying defaults by
    destructuring gains less from the flag**, and saying so is what keeps the
    page honest rather than promotional.

12. **The migration metric: assertions added ÷ errors fixed.** Near zero means the
    errors were resolved; anything else means the flag was enabled and then
    suppressed — worse than not enabling it. Mirrors the `!`-count metric topic
    02 uses for `noUncheckedIndexedAccess`.

13. **The `if (x)` regression.** The fastest way to clear a `TS2412` is
    `if (limit) q.limit = limit`, which drops `limit = 0`. The correct guard is
    `!== undefined`. **Grep the migration diff for it** — the flag exposes the
    site and the lazy fix introduces a new bug there.

## Topic 06 · The other correctness flags

### From the option records — all eight, and the point of reading them

**Every one of these has `defaultValueDescription: false` and NO `strictFlag`**,
except the two noted. That single sweep settles "is it in `strict`" for the whole
family without consulting a word of prose.

| Option | Description string (verbatim) | Default |
|---|---|---|
| `noImplicitOverride` | *"Ensure overriding members in derived classes are marked with an `override` modifier"* | `false` |
| `noPropertyAccessFromIndexSignature` | *"Enforces using indexed accessors for keys declared using an indexed type"* | `false` |
| `noFallthroughCasesInSwitch` | *"Enable error reporting for fallthrough cases in switch statements"* | `false` |
| `noImplicitReturns` | *"Enable error reporting for codepaths that do not explicitly return in a function"* | `false` |
| `noUnusedLocals` | *"Enable error reporting when local variables aren't read"* | `false` |
| `noUnusedParameters` | *"Raise an error when a function parameter isn't read"* | `false` |
| `allowUnreachableCode` | *"Disable error reporting for unreachable code"* | 🔴 **`void 0`** |
| `allowUnusedLabels` | *"Disable error reporting for unused labels"* | 🔴 **`void 0`** |

### 🔴 Three finds not in the prose documentation

1. **`noFallthroughCasesInSwitch` sets `affectsBindDiagnostics: true`** — alone in
   the group; the others set only `affectsSemanticDiagnostics`. **Consequence:**
   the check runs during **binding**, when the control-flow graph is built, so it
   is **purely syntactic** — no type information needed, works on `.js` under
   `checkJs` and on files full of `any`. **Cost of that:** it cannot tell an
   intentional fallthrough from an accident, and there is **no compiler
   equivalent of ESLint's `// falls through`** comment. You restructure.
2. **`allowUnreachableCode` / `allowUnusedLabels` default to `void 0` =
   `undefined`, a genuine THIRD state.** `undefined` → **suggestion** (editor
   greys it out, build passes; `TS7027` / `TS7028`), `true` → silent, `false` →
   build error. 🔴 **So unreachable code is already being reported to every
   developer today and is invisible in CI.** ⚠️ **Inverted polarity** — these are
   `allow*` flags, so `false` is the strict setting, which reads backwards in a
   config where everything else is turned on.
3. **`noPropertyAccessFromIndexSignature` alone carries
   `showInSimplifiedHelpView: false`** — absent from plain `tsc --help`. ⚠️ Record
   this as an observation about **presentation**, not as evidence the flag is
   discouraged; no documentation says that, and the page says so explicitly.

### Diagnostics

**The five `override` errors:** `TS4112` (containing class does not extend
anything) · 🔴 **`TS4113`** (*"cannot have an `override` modifier because it is
not declared in the base class"* — **the rename, and the flag's entire payoff**)
· **`TS4114`** (*"must have an `override` modifier"* — the migration cost) ·
`TS4115` (**parameter property** overriding a base member) · `TS4116` (overriding
an **abstract** method).

**`TS4111`** — *"Property `'{0}'` comes from an index signature, so it must be
accessed with `['{0}']`."* Unusually, **the message contains its own fix.**

**Control flow:** `TS7029` *"Fallthrough case in switch."* · `TS7030` *"Not all
code paths return a value."* · `TS7027` *"Unreachable code detected."* · `TS7028`
*"Unused label."*

**Seven unused-code codes:** `6133` *"'{0}' is declared but its value is never
read."* · `6138` *"**Property** '{0}' is declared but its value is never read."* ·
`6196` *"'{0}' is declared but never used."* · `6192` *"All imports in import
declaration are unused."* · `6198` *"All destructured elements are unused."* ·
`6199` *"All variables are unused."* · `6205` *"All type parameters are unused."*
📌 The four "All …" variants exist so an **editor can remove the whole
declaration** — they are fix-region descriptions, not just locations. ⚠️ `6133`
(*"its value is never read"*) is the **value** side; `6196` (*"declared but never
used"*) is the **type** side.

### The claims

1. 🔴 **The `noImplicitOverride` argument, in one sentence:** without `override`,
   *"I am replacing the base implementation"* and *"I am adding a new method"*
   are **written identically** — so renaming a base member converts one into the
   other, in a different file, with **no error anywhere**. Surfaces in production
   as behaviour: auth that stops applying, a hook that stops firing.
   **`TS4114` = cost, `TS4113` = payoff.** A `TS4113` on the *first* enable is a
   live bug and is the best available argument for the whole group.
2. **`override` is erased** — no runtime meaning, so it is safe under Node's
   strip-only mode (unlike a parameter property, which emits) and gives **zero**
   runtime guarantee.
3. **What `noImplicitOverride` does NOT cover:** `implements` (that is `TS2420`),
   properties assigned in a constructor body, object literals, and **a missing
   `super.method()` call**.
4. 🔴 **`noImplicitReturns` is NOT redundant with `strictNullChecks`.** With an
   annotation, `strictNullChecks` already catches it. **Without one, TypeScript
   infers `T | undefined`** — the missing return becomes a **wider inferred
   type** rather than an error, which is exactly the thing that does not look
   wrong in review. **This is the whole argument for the flag.**
5. **A bare `return;` does not fix `TS7030`** — the error is the *inconsistency*
   between paths, and a bare return is that inconsistency written explicitly.
   Honest fixes: return a real value, or widen the type deliberately.
6. **`noImplicitReturns` is disabled by a `void` or `any` return type**, so it
   degrades exactly where `any` has spread — another check `any` silently
   switches off.
7. **Stacked empty `case`s are NOT fallthrough**, nor is a clause ending in
   `break` / `return` / `throw` / `continue`. This exemption is why the flag
   produces far fewer errors than its name suggests, and it is the most useful
   single fact about it.
8. 🔴 **`noPropertyAccessFromIndexSignature`'s real argument is not "brackets are
   safer".** It is that an index signature makes **every misspelling legal**:
   `config.apiUrI` resolves through the index signature to `undefined` with no
   error. The flag restores the distinction between a declared name and a
   looked-up string. It pairs with `noUncheckedIndexedAccess` as **syntax vs
   type** on the same construct.
9. **`noUnusedLocals` / `noUnusedParameters` do not catch bugs** — say so plainly.
   Unused code is surplus, not wrong. **The `_` prefix is a COMPILER rule, not a
   convention**, and ⚠️ it exempts **parameters only** — an unused `const _x` is
   still `TS6133`. Neither flag reports **exported** symbols, which is where most
   dead code actually lives.
10. **The honest "this belongs in the linter" case:** they break the build on
    temporarily-incomplete code, `eslint --fix` can remove the declaration and
    `tsc` cannot, and the linter rule is far more configurable. **Rebuttal:** `tsc`
    runs in CI regardless. **Resolution: a CI-only second config** — the one place
    in this phase where per-job configs are the recommendation rather than a smell.
11. 🔴 **"Not in `strict`" is not a ranking**, and it gets used as one. Two
    *different* reasons: the unused-code pair are excluded on **principle** (not
    correctness flags at all); the correctness ones are excluded on **history**
    (`strict` is a compatibility surface; adding to it breaks builds on upgrade,
    and it has only grown twice — 4.4, 5.6).
12. **Adopt one flag per commit.** These are individually cheap; the only way to
    make them expensive is to batch six into one unattributable error list.
13. 🔴 **An `@ts-ignore` over any error in this group is always pure
    suppression** — unlike `noUncheckedIndexedAccess`, nothing here has a fix that
    requires an assertion. The fixes are a keyword, a `break`, a `return`, a
    rename, a deletion. **This makes the group uniquely easy to audit.**

## Topic 07 · Where TypeScript is unsound by design

### The reframe — sort the holes by what you can DO about them

Most sources give a flat list of six. Sorted by remedy they are **seven**, and
the shape changes completely:

| Kind | Holes | Consequence |
|---|---|---|
| **You write them** | `any` · `as` · `!` | the **only** ones visible in a diff — greppable, countable, fixable by policy. 🔴 **This is why the phase's metric is assertions-per-error-fixed:** not because they are the worst, but because they are the only *manageable* ones |
| **Closable by a flag** | index access · object spread over optionals | `noUncheckedIndexedAccess` · `exactOptionalPropertyTypes` |
| **Honest consequence** | `Object.keys` → `string[]` | see below — a `keyof T` return would be *worse* |
| 🔴 **Neither** | **mutation through an alias** · **method parameter bivariance** | nobody opts in, no flag removes them, both throw on a line where every type is right. **These two are the ones to memorise** |

### The claims

1. 🔴 **`Object.keys(o): string[]` is the HONEST answer, not an oversight.**
   Structural typing lets a value carry properties its type never declared —
   `{x,y,z}` is assignable to `{x,y}` — so `Object.keys` on it returns three
   strings. **A `keyof T` return would claim two: a LARGER unsoundness, and less
   visible.** Read from `lib.es5.d.ts` (`keys(o: object): string[]`) and
   `lib.es2017.object.d.ts` (`entries<T>(o: {[s:string]:T}|ArrayLike<T>):
   [string,T][]`). ⚠️ **`Object.entries` has a second problem** — its
   heterogeneous overload `entries(o: {}): [string, any][]` **injects `any`
   without anyone writing it**. Safe replacement: don't iterate keys; list the
   fields with `as const`.
2. 🔴 **Both flag-fixes work by removing a possible INPUT, not by adding a
   check.** `exactOptionalPropertyTypes` forbids the explicit `undefined`, so the
   compiler's model of object spread becomes *true*. **"Make the wrong state
   unrepresentable rather than detected"** is a recurring shape in the language —
   name it on future pages.
3. **Method bivariance exists *for* array covariance.** `Array<Dog>` assignable
   to `Array<Animal>` requires `push(item: Dog)` to be assignable to
   `push(item: Animal)`, which contravariance forbids — so **making method
   parameters strict would break the standard library.** `strictFunctionTypes`
   (`strictFlag: true`) therefore exempts method syntax. **Mitigation is one line
   and free: declare callbacks as PROPERTIES, not methods.**
4. 🔴 **`readonly` on a property is aliasable.** Two types differing only in
   `readonly` are mutually assignable, so passing the object somewhere that omits
   the modifier makes it writable **through the original reference**. ⚠️ **But
   `readonly T[]` is NOT assignable to `T[]`** — arrays got the stricter rule
   because handing out a mutable alias is the whole bug. **That asymmetry is the
   practical defence against array covariance: take `readonly T[]` in parameters,
   since the bug requires a WRITE.**
5. **Array covariance, demonstrable with no assertion:** `const dogs: Dog[]` →
   `const animals: Animal[] = dogs` → `animals.push(new Cat())` →
   `dogs[1].fetch()` throws. Every line type-checks. **The unsoundness is not the
   assignment — it is that the assignment creates two names for one array with
   different opinions about it.**
6. **Three holes boundary validation does NOT cover:** mutation through an alias,
   method bivariance, index access — all occur *inside* already-validated code.
   Conveniently all three have essentially free mitigations, so **the expensive
   defence (validation) covers the boundary and the cheap ones cover the
   interior.** Useful asymmetry to state.
7. **`as unknown as T` is a DIFFERENT construct from `as T`** and should be read
   as such — the compiler blocks unrelated-type assertions with `TS2352`, so the
   double step is an explicit statement that the types are unrelated. Plain `as`
   deserves a question in review; the double step deserves a written
   justification.
8. **A large share of `as` uses are conformance claims written with the wrong
   keyword** — `satisfies` checks the value *and* keeps the narrower inferred
   type. Swapping it removes the hole for free.
9. **The Design Goals anchor:** *"Apply a sound or 'provably correct' type
   system"* is listed under **Non-goals**, with *"Instead, strike a balance
   between correctness and productivity."* 🔴 **Cite this whenever "TypeScript is
   unsound" is offered as a criticism** — it is a stated design position, not an
   unfixed bug, and the useful question is *where*, not *whether*.
10. **The provenance framing, which is the page's actual takeaway:** stop reading
    a type as a guarantee; read it as **a claim with a known provenance.** From a
    literal or a parser → a fact. From an `as`, an index, an alias, or a
    method-syntax callback → a claim. The seven holes are exactly the set of
    places where you need to know which one you hold.

### Debts topic 07 created

- **Topic 08** owes *"an `@ts-ignore` over any topic-06 error is always pure
  suppression"* — nothing in that group has a fix requiring an assertion.
- **Topic 09** owes **why excess property checking applies to fresh literals
  only**, which is the heuristic layered over the same structural-typing fact
  that forces `Object.keys` to return `string[]`.
- **Topic 12** owes holes 1–3 as a *process* problem.

### Debts topic 06 created

- **Topic 07** owes **object spread's incorrect result type** (from topic 05) and
  **method bivariance** (from topic 01) as catalogued soundness holes.
- **Topic 08** owes *"why a suppression over a topic-06 error is never
  justified"*.
- **Topic 11** owes the typescript-eslint rules that go beyond `TS6205`, incl.
  `no-unnecessary-type-parameters`, plus the `no-unsafe-*` family already owed by
  topic 03.

### Debts topic 05 created

- **Topic 07** (unsound by design) owes **object spread's incorrect result type**
  as one of the holes — topic 05 chunk 03 names it and defers the catalogue.
- **Topic 12** (assertion discipline) owes the **assertion-ratio metric** and the
  `{ k: maybeUndefined as string }` anti-fix — chunks 03 and 04 both point at it.
- **Phase 12** owes **`skipLibCheck` as a performance lever**; chunk 04 covers
  only the correctness half and links phase 7 for the rest.

## Topic 10 · The error codes you will actually meet — the load-bearing claims

**14 chunks / 3,808 lines, 2026-08-17.** Every claim read from files on disk: the
5.9.3 numbered diagnostic table and checker source in
`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`, cross-checked against
the 7.0.2 native binary. **No sandbox, no console block.** Full find list with
line numbers: [[devbible-typescript-part-b]] finds 1–21.

### The organising claim — diagnostics are ladders, generic is the last rung

**Three independent ladders**, each trying five or six *specific* diagnoses before
the vague one:

| Ladder | Function | Generic fallback |
|---|---|---|
| property lookup | `reportNonexistentProperty` (~79902) | `TS2339` |
| name lookup | `getCannotFindNameDiagnosticForName` (~73822) + `checkAndReportErrorForMissingPrefix` (~52726) | `TS2304` |
| element access | the `getIndexedAccessType` branch (~66826) | `TS7053` |

🔴 **So a bare generic message is a STRONGER statement than a specific one** — the
compiler has already ruled out every actionable cause it knows. For `TS2339` that
is: a union member (it names the *first failing* member, not the union), a static
member (`TS2576`), a missing `await` (`TS2773` related), a `lib` gap (`TS2550`), a
typo (`TS2551` + `TS2728`), and a missing `dom` lib (`TS2812`, gated on a **regex
over the type NAME**). What is left is that the *type* is wrong.

📌 **This generalises to codes nobody has met**, which is why it is the topic's
spine and the basis of chunk 14's routine.

### Claims worth reusing elsewhere

1. 🔴 **The code space, counted: 2,073 diagnostics in 13 ranges.** 1xxx 449 parser
   · 2xxx 530 checker · 4xxx 110 declaration emit · 5xxx 64 options · 6xxx 474
   (431 are `--help` text) · 7xxx 53 `noImplicitAny` · 8xxx 35 · 9xxx 34
   `isolatedDeclarations` · 17xxx 20 JSX · 18xxx 51 **no theme** · 69xxx 1 · 80xxx
   10 · 90xxx 50 · 95xxx 192. **242 of them are quick-fix MENU LABELS.**
2. 🔴 **TypeScript has no warning level.** Category enum is
   `0 Warning · 1 Error · 2 Suggestion · 3 Message` and **`Warning` is used by
   nothing**. That is why suppression directives and strictness flags carry all the
   weight a warning level would — reusable in any argument about "just make it a
   warning".
3. 🔴 **A flag changes a finding's CATEGORY, not its existence — three instances.**
   The 7043–7050 Suggestion twins (`noImplicitAny`), `TS2568` in unchecked JS
   (`checkJs`), and `TS2686` via `errorOrSuggestion(!allowUmdGlobalAccess, …)`.
   **The compiler almost never stops computing a finding; it stops failing on it.**
   ⚠️ Same mechanism topic 06 found independently on `allowUnreachableCode`'s
   `void 0` default. **Four instances now — this is a named TypeScript design.**
4. 🔴 **The spelling distance is WEIGHTED**: substitution **2**, case-only **0.1**,
   insert/delete 1, with threshold `floor(len*0.4)+1`. **Cliff at five
   characters** — a transposition or wrong letter needs a 5+ character name, so
   `obj.nmae` for `name` gets nothing and `lenght` for `length` does. **One
   candidate only, ties break on declaration order.** Drives `TS2551` `TS2552`
   `TS2724` `TS2820` `TS2561`. 📌 **The corpus's only quantified argument for
   longer identifiers**, and it applies to string-literal union members too.
5. 🔴 **`TS7053` is `noImplicitAny`, not a type error** — the whole branch is inside
   `if (noImplicitAny && …)`, so with the flag off the expression silently becomes
   `any`. It is a **wrapper**, and the inner code is the fork in the fix: `TS2339`
   inside = you named a bad key (fix your code); **`TS7054` inside = the key is a
   runtime value** (fix the type: `keyof T`, or a `Record`).
6. 🔴 **Four named/anonymous PAIRS report one check twice**, selected on
   `isEntityNameExpression(node) && nodeText.length < 100`: 18046/2571,
   18047/2531, 18048/2532, 18049/2533. **The anonymous form means the expression
   has no name, so it cannot be narrowed in place** — which is the *mechanism*
   behind topic 04's extract-to-a-`const` advice and shows where it fails:
   **invocation (`TS2721`–`TS2723`) has no named form at all.**
7. 🔴 **A forgotten `await` is diagnosed under at least three codes** —
   `TS2367`, `TS2339` and `TS2801` — all via `errorAndMaybeSuggestAwait`, which
   hypothetically awaits both sides and attaches `TS2773` as **related
   information**. ⚠️ Related info prints separately and CI formatters drop it, so
   the durable sight-read is: **a `Promise<…>` in the error text means `await`.**
8. 🔴 **`TS2367` is `tryGiveBetterPrimaryError` for exactly four operators** —
   `===` `==` `!==` `!=`. Anything else is `TS2365`. **And a `TS2367` on a value
   that arrived through an `as` or `JSON.parse` is the ASSERTION being wrong, not
   the comparison** — the clearest concrete instance of topic 07's unsoundness
   argument.
9. 🔴 **The always-decided-condition family is seven codes**: `TS2367` `TS2774`
   `TS2801` `TS2839` (explains reference-vs-value equality — the compiler teaching
   a *JavaScript* semantic) `TS2845` `TS2872` `TS2873`. All present in 7.0.2.
   ⚠️ **Constrains topic 11**: `TS2872`/`TS2873` mean the compiler natively covers a
   slice of `no-unnecessary-condition`. **The leftover is narrowing-awareness** —
   the compiler reasons about expression *kind* and *zero overlap*; the rule
   additionally reasons about narrowing already performed.
10. 🔴 **`TS2589`: depth `100`, count `5,000,000`, and the count RESETS PER
    EXPRESSION** (`checkExpression`, `checkSourceElement`, `checkDeferredNode`). So
    it is one expression's fault, never project size; **splitting a chain into
    named intermediates is a real fix**; and "it works in the playground" means a
    different *surrounding expression*. `TS2590` has two thresholds — cross-product
    union ≥ 100,000, and subtype reduction at 100,000 comparisons with an estimate
    over 1,000,000. ⚠️ **A suppressed `TS2589` still costs the work**, so the editor
    stays slow and the signal is gone.
11. 🔴 **The compiler prints npm install commands**, from a hardcoded `switch` on
    the identifier's text: `@types/node` for `process`/`require`/`Buffer`/`module`,
    jest-or-mocha for `describe`/`suite`/`it`/`test`, `@types/jquery` for `$`,
    `@types/bun` for `Bun`, and a `lib` suggestion for 18 named ES globals.
    🔴 **Each install message exists TWICE**, selected by whether
    `compilerOptions.types` is set — because **an explicit `types` array is an
    ALLOWLIST, not an addition.** The long variant means installing will not be
    enough. Most misunderstood thing about `types`, and the code number carries it.
12. 🔴 **`TS2719`** *"Two different types with this name exist, but they are
    unrelated"* — **a lockfile problem, not a type problem.** If two type names in a
    `TS2322` are the same string, read the lockfile.
13. **`TS2352` quotes its own workaround** (*"convert the expression to 'unknown'
    first"*) — deliberate friction because `as unknown as` is **greppable**.
    ⚠️ It only fires when the types barely overlap, **so a plain `as` being accepted
    is NOT evidence it is safe.**
14. **Assignability elaboration is 15 codes.** Skim for `TS2201`/`TS2328` (the
    fault is inside a *function type*), `TS2684` (a method lost its receiver),
    `TS2411` (an index signature is the real constraint). 🔴 **`TS2328` is the only
    place the compiler states contravariance out loud**, and the
    property-vs-method form of a callback declaration is the free half of the
    method-bivariance mitigation.
15. **`TS2793`** — *"the call would have succeeded against this implementation"* —
    means the **overload list** is wrong, not your call. Fix is a declaration, not a
    cast. `TS2772` labels each block with its candidate number and signature, which
    is what makes topic 04's "match on arity first" mechanical.
16. **`TS2554` names the missing argument** on a second line: `TS6210`, `TS6236`,
    and `TS6211` (a destructuring pattern, hence unnameable). Related info pointing
    at the *declaration* file, which is why it reads as a separate error.
17. **Parentheses get seven dedicated codes** — `TS2560` `TS2774` `TS7052` `TS1209`
    `TS1329` `TS6212`, plus `TS6234` for the inverse (a `get` accessor called).
    🔴 **`TS2774` is a real bug class**: a method in an `if` is always truthy, so a
    permission gate always opens.
18. **`TS2749`** hands you `typeof` — the most useful suggestion in the language,
    because `typeof` in a type position is a different operator from the expression
    one. Mirror is `TS2693`, which has no easy fix.

### 🔴🔴 The correction, and the methodological limit it exposed

**`suppressExcessPropertyErrors` and `suppressImplicitAnyIndexErrors` no longer
function.** By version: works ≤ 4.9 · works + `TS5101` on 5.0–5.4 · **inert +
`TS5102` from 5.5**, unsilenceable because `canBeSilenced` is only computed when
`!mustBeRemoved` · **absent from 7.0.2 → `TS5023`**. `ignoreDeprecations` accepts
**exactly one value, `"5.0"`**; `"5.5"` is `TS5103`.

⚠️ **THE LESSON, which applies to the rest of this corpus:** both option records in
5.9.3 **still carry `affectsSemanticDiagnostics: true`** and present-tense
descriptions, four minor versions after the checker stopped reading them.
🔴 **The option table is authoritative about defaults, categories and whether a
name is accepted — NOT about whether a flag still functions.** Cross-check by
grepping an option's **consumers**, not its declaration; two references, both
inside `checkDeprecations`, means inert. Topics 05 and 06 leaned on that table
heavily, so the limit had to be stated.

✅ Topics **03, 08 and 09 were repointed** at this in the same pass (`85c25e68`).

Related: [[devbible-typescript-part-b]] · [[devbible-typescript-concepts-phase3]]
· [[devbible-typescript-phase0]] · [[devbible-never-compress-to-fit-cap]]
