---
name: devbible-typescript-build-progress
description: THE TypeScript resume point — who holds it, what phase is in flight, the exact next action, and the traps; children hold the finished-phase detail and the per-phase claims
metadata:
  type: progress
---

:::danger THERE ARE NO WORKTREES — WORK ON `main`
Every devbible worktree and branch was merged into `main` and **deleted** on
2026-08-15. All TypeScript content is on `main` at
`/mnt/Storage/Backup/Knowledge/devbible`. Ignore any "worktree", "branch" or
"merge at the phase close" instruction in older text. `main` builds 0 warnings /
0 broken links, so **a break there is yours**. Record:
[[devbible-worktree-consolidation-20260815]].
:::

## 🔴 LIVE — TypeScript **Part A**, session `65de22b3`, 2026-08-17

(took over from `8b70b2f9`, which took over from `bbd2d39d`. The instruction was the
whole message — **"pick ts a"** — plus a mid-turn *"make sure you adhere hard coded rules
especially about file size ?"*, answered with measurements rather than assurances; see the
rule-1 evidence at the end of the topic-11 and topic-12 records.)

Taken on the user's instruction **"Ok take part a"** (2026-08-17), given with the
file-size rule restated for the Nth time: *"it should be 300 lines but it was
never a content budget you can explain upto 1000 lines or more just split them
into multiple chunks to bring 300 lines filesize so it would be easy to read and
rest of the chunks import them into main file."* Took over from session
`3af83cbb`, which had held it since 2026-08-15.

⚠️ **Part B (`27931e79` or a successor) is LIVE AGAIN as of 2026-08-17** — it
moved phase 10 to 5/13 and edited `docs/README.md`'s TypeScript row while this
session was writing. Re-read every shared file immediately before editing it.

| | |
|---|---|
| **Scope** | 🔴 **NARROWED 2026-08-17 to phase 5 only** — `docs/typescript/pages/phase-5-type-level/`. Phases 2, 3 and 4 are complete; **phase 6 was split off as Part C** ([[devbible-typescript-split-part-c]]) on the user's instruction *"Can you split your work into half ? create typescript phase c ?"* |
| **Not mine** | 🔴 **Phase 6 — Part C's, from 2026-08-17.** Never create `phase-6-modules-build/` here. Also phases 10 and 12 (Part B, live) and phase 7 (closed at 5/5) |
| **Where** | `/mnt/Storage/Backup/Knowledge/devbible`, `main` |
| **Standing authorisation** | Run all phases **without pausing for approval** (below) |
| **Cadence** | 🔴🔴 **RE-TIGHTENED 2026-08-17 at ~80% usage** — *"We are nearing 80% of usage so make sure you switch saving progress to per file."* **One commit per FILE, no pairing.** Session `8b70b2f9` had been committing chunks in pairs (01–03, 04–05, 06–07, 08–09) — that is what this instruction stops. Write one chunk → commit it → update and commit the memory → only then start the next. Previously: 🔴 **Per FILE, tightened 2026-08-15** — *"We are almost already reached almost 90% so make sure your saving session progress now onwards perfile completion."* Write → boards → commit → memory, every file. |

### Standing authorisation

User, 2026-08-13: *"go ahead with phase 0 and do not wait for me till the
typescript finishes"* and *"Do not wait for me finish typescript i am stepping
outside"*. The normal stop-and-report-per-step rule
([[devbible-incremental-scope]]) is **suspended for TypeScript**.

Also standing: *"if build is failed try to wait for few mins, and skip for that
and check later"* — build warnings from other sessions' languages are not mine.
Check only that no warning names `typescript`.

## State

| | |
|---|---|
| Syllabus | **Done** — 13 phases, 187 topics, 4 parts, UI wired. 57+46+44+40 = 187 badges, verified on disk |
| Phases 0, 1, 2 | ✅ **COMPLETE** — 43 topics, 55 files. Detail: [[devbible-typescript-history]] |
| **Phase 3 · Generics** | ✅ **COMPLETE 14/14** — **31 files**, 0 over cap, **build-verified 0 warnings / 0 broken** |
| **Phase 5 · Type-level programming** | ✅ **COMPLETE 16/16** — 65 files, 14,031 lines, 64–295 per file, 0 over cap |
| **Phase 4 · Classes and declarations** | ✅ **COMPLETE 14/14** — 29 files, 5,691 lines, 0 over cap (2026-08-17, `3f25f093`) |
| TypeScript overall | **108 of 136 in-scope topics · 341 page files** (disk-verified 2026-08-17, recomputed from `progress.js` + `find`; four lanes move this). The 136 denominator is post-cut: 187 minus Part B's dropped phases 8, 9, 11 and phase 7's ten Understand rows |
| Part A remaining | ✅ **NOTHING — lane A is finished.** Phase 6 went to **Parts C and D** on 2026-08-17 |

### Phase 3 — Generics, ✅ 14/14

| # | Topic | Tier | Files |
|---|---|---|---|
| 01 | Generic functions and inference | Master | 3 (273 · 268 · 51) |
| 02 | Constraints (`T extends …`) | Master | 3 (258 · 255 · 54) |
| 03 | Generic interfaces and type aliases | Master | 3 (243 · 228 · 60) |
| 04 | `keyof` | Master | 3 (238 · 251 · 55) |
| 05 | The `getProp` pattern | Master | 3 (200 · 239 · 63) |
| 06 | Indexed access types `T[K]` | Understand | 1 (264) |
| 07 | The `typeof` type operator | Understand | 1 (280) |
| 08 | Default type parameters | Understand | 1 (250) |
| 09 | Generic classes | Understand | 1 (290) |
| 10 | Inference sites and contextual typing | Understand | 1 (269) |
| 11 | `infer` in conditional types | Understand | 1 (~280) |
| **12** | **`const` type parameters** | Understand | **1 (289)** — `247173b4`, 2026-08-15 |
| **13** | **When *not* to write a generic** | Understand | **1 (293)** — `54b380a9`, 2026-08-15 |
| **14** | **Variance** | Know | **1 (281)** — `ae086a64`, 2026-08-15 (with the phase close) |

## 🔴 EXACT RESUME POINT

🏁 **PHASE 5 IS COMPLETE — 16/16. Lane A has NO queued work.**

🏁🏁 **AND SO IS ALL OF TYPESCRIPT — 136/136, verified 2026-08-17 by summing `progress.js`:**
0→13/13 · 1→17/17 · 2→13/13 · 3→14/14 · 4→14/14 · **5→16/16** · 6→16/16 · 7→5/5 · 10→13/13 ·
12→15/15. **All four lanes report 0 remaining** in `docs/typescript/pages/README.md`. Lane B
closed phase 12 (`978baa56`), C closed 6/6, D closed 10/10.

🔴🔴 **BUT THE SITE DOES NOT BUILD, AND NOBODY OWNS THE BREAKAGE ANY MORE.** TypeScript is
marked 136/136 **written** while **three committed pages fail MDX compilation**, which fails
the *whole-site* build for **every language and every session**, not just TypeScript. Verified
2026-08-17 by compiling all **419** TypeScript pages: **416 pass, 3 fail** — and their commits
are **unchanged** since they were first recorded, so they were not fixed on the way out.

| File | Cause | Owning lane, now CLOSED |
|---|---|---|
| `phase-10-strictness/10-the-error-codes/06-the-name-is-wrong.md` | *"Expected a closing tag for `<User>` (52:67-52:73) before the end of `emphasis`"* — an unfenced `<User>` in prose | **B**, `b77e4b66` |
| `phase-10-strictness/11-typescript-eslint/05-strict-boolean-expressions.md` | *"Unexpected closing slash `/` in tag, expected an open tag first"* | **B**, `bd78ca63` |
| `phase-6-modules-build/11-publishing-a-typed-package/05-export-equals-vs-default.md` | *"Could not parse expression with acorn"* — a bare `{…}` read as a JSX expression | **D**, `6a9eebf2` |

⚠️ **The usual rule — "a defect in another lane belongs to its owning session" — has run out.**
Both owning lanes are finished, so leaving these is not deferring to anyone; it is leaving the
repository permanently unbuildable. **Whoever picks TypeScript up next should fix them**, and
the fix is the same shape in each: **fence the angle brackets or braces in backticks.** They
are three prose typos, not content decisions.

📌 **Reproduce without a build** (no registry claim needed) — compile each page with
`@mdx-js/mdx`'s `compile()`, awaited, with YAML frontmatter stripped. ⚠️ **The script must run
from the project root**, because `@mdx-js/mdx` resolves out of the project's `node_modules`.

🔴 **Do not silently pick up another phase.** Part A's scope was narrowed to phase 5 only on
2026-08-17, and there is no unfinished TypeScript phase left to take. **Report that lane A —
and TypeScript — is finished, name the three build blockers, and let the user choose.**

⚠️ **If the user says "typescript a" to a fresh session**, the honest answer is that the lane
is complete, with the phase-5 numbers above.

### 🏁 PHASE 5 COMPLETE — 16/16, 2026-08-17, `1a94dfd4`

**65 files · 14,031 lines · 64–295 per file · 0 over the 300-line cap · 694 links, 0 broken.**
Concept record: [[devbible-typescript-concepts-phase5]].

**Topic 16 · Higher-kinded types (229 lines, *When Needed*)** closed it — a **capability-gap**
topic with **no release notes to cite because nothing shipped**. Generics take types, not type
constructors, so no single interface covers `Array`, `Promise` and a user's `Option`;
⚠️ **the failure looks like a signature that almost works**, which is why people loop on it.
Then **defunctionalisation**: pass a key, keep a registry interface parameterised by the
element type, and 📌 **type application becomes an indexed access** (`Kind1<A>["Array"]`).
Five costs stated, the decisive one being that **every reader must learn the encoding**.

#### 🔴 The phase close found a real defect — read this before editing `docs/README.md`

The isolated build was claimed in the registry and run, and it **failed**. Worth it:

**`docs/README.md` was MDX-broken.** 🔴 **An unescaped `|` inside a code span still splits a
GFM table cell.** `` `instantiationDepth === 100 || instantiationCount >= 5e6` `` ends the
cell mid-span, which unbalances the backticks for the **rest of the row**, so the next `<=` or
`<Foo>` is parsed as JSX. **14 pipes escaped as `\|`** — 8 on Part A's row, 4 on C's, 2 on
D's. ⚠️ **Two other lanes' rows were edited deliberately**: the file is shared and a broken
`docs/README.md` blocks every session; the change is mechanical and preserved every character.

⚠️ **Three committed pages still block the whole-site build and were NOT touched** — two of
lane B's (`phase-10-strictness/10-the-error-codes/06-…`, an unfenced `<User>` in prose; and
`11-typescript-eslint/05-…`, a stray closing slash) and one of lane D's
(`phase-6-modules-build/11-publishing-a-typed-package/05-…`, an unparseable expression). Named
with causes and commits in `shared/session_build_devserver_registry.md`.

**So phase 5 was verified by a per-file MDX compile of all 65 files (0 failures) plus a
filesystem link check — NOT by a green whole-site build.** Say it that way; do not imply a
build passed.

⚠️ **The close's forward-reference sweep found SIX more stale markers**, three of whose
targets had landed long before — including **intra-topic footers left by an earlier session**.
They are plain text, invisible to a link check. **Run the grep at every phase close.**

### ✅ Topic 15 · Union → intersection and other identities — COMPLETE (`391a2c9c`), 248 lines

🔴 **Written as RECOGNITION, not recipe** — the syllabus line is *"the tricks worth
recognising when you read library code"* and the page holds to it, closing by telling you not
to reach for them. **`UnionToIntersection` is explained, not presented:** distribution turns
`A | B` into a union of function types, then inferring one parameter from that union asks for
a type all of them accept — and **contravariance** makes that `A & B`. That one sentence is
the takeaway.

📌 **The reusable idea, named on the page: capture the whole union in a second defaulted
parameter before distributing** (`IsUnion<T, U = T>`) — the type-level equivalent of saving a
value before entering a loop, and it is behind half these identities. Also: **`IsNever` needs
the bracket form** because a naked `never` distributes over *no* members and yields `never`
rather than a branch; `IsAny` via `0 extends 1 & T`; six small identities in a table.

⚠️ **Two honesty calls made deliberately.** Type-level **equality** depends on how the checker
compares two *deferred conditional types* — **unspecified** — so it is described and
explicitly not recommended (*"if two types being identical is load-bearing, that is a test, not
a type"*). And **union-to-tuple is included as a WARNING**: member order is not guaranteed, it
is a recursion over an unbounded set, and nearly every use wants a mapped type or a runtime
array instead.

⚠️ **Shared-file trap hit here, worth recording:** `docs/README.md`'s TypeScript row **moved
between reading it and writing**, so the edit's assertion failed and the topic-15 board update
was left out of the content commit. **The assertion is what caught it** — a bulk `sed` would
have silently clobbered the other lane. Fixed in a follow-up commit (`aeb971c3`) by re-reading
and keeping their recomputed counts.

### ✅ Topic 14 · `NoInfer<T>` — COMPLETE (`0dd1de41`), one file, 272 lines

📌 **The 5.4 release notes were FETCHED — do not re-fetch.** *The `NoInfer` Utility Type* is
quoted throughout: `createStreetLight`, the `"blue"` case, the `D extends C` workaround with
its error text, the *"gives a signal to TypeScript not to dig in"* sentence and the
*"Excluding the type of `defaultColor` from being explored for inference"* sentence.

🔴 **The framing that makes the page work: NOTHING WENT WRONG in the failing case.** `C` in
two parameters means **two inference sites**, and the algorithm correctly found a type
satisfying every candidate. **The bug is in the signature** — it says the parameters are
related when the intent was that one *constrains* the other. A two-position type parameter is
**symmetric by default**; `NoInfer` is how you make it asymmetric.

⚠️ **The 5.4 notes independently state phase 3 topic 13's rule** — *"using a type parameter
only once in a signature is often a code smell"* — while rejecting the `<C extends string, D
extends C>` workaround. **The language shipped a feature to remove a documented exception to a
rule this corpus argues elsewhere.** Strong cross-link, made on the page.

**Settled precisely:** `NoInfer<T>` **removes the position as an inference site and does
nothing else** — the argument is still *checked*, which is why `"blue"` errors rather than
being silently ignored, and it **cannot fix a constraint that is too loose**. 🔴 **Marking
the wrong parameter fails SILENTLY**: put it on the source of truth and no inference candidate
remains, so `C` comes from the other argument or falls back to its constraint, and **nothing
errors at the definition**. Rule: **mark the consumers, never the source.**

📌 **The one-line test, worth reusing:** *if a wrong argument widens the inferred type instead
of producing an error, that position should be `NoInfer`.* Five shapes given: a default drawn
from a list · a callback parameter fixed by an earlier argument · an initial state · a builder
step · **any existing single-use type parameter bounded by another one**, which is the old
workaround in disguise.

⚠️ **`NoInfer` is an INTRINSIC**, not expressible as a type alias, which is why it needed a
release rather than a `lib` addition. The pre-5.4 community emulation is mentioned as
recognisable-in-old-code and **explicitly not recommended**.

### ✅ Topic 13 · Tuple manipulation — COMPLETE (`3b61c698`)

`13-tuple-manipulation/` + `_category_.json` + README. 📌 **The 4.0 release notes were
FETCHED this session — do not re-fetch.** *Variadic Tuple Types* and *Labeled Tuple Elements*
are both quoted verbatim across chunks 01–03: the `concat` overload pile, *"death by a
thousand overloads"*, the `tail`/`r1`/`r2` example, the `Unbounded` example, the
`foo(...args: [string, number])` parameter-list argument, `type Range = [start: number, end:
number]`, the all-or-none rule and the destructuring note.

**Chunk 01 · The accessors, 219 lines, `6710792e`.** `Head`/`Tail`/`Last`/`Init`/`Length`.
Two decisions made explicitly: 🔴 **`readonly` on every pattern** (without it an `as const`
tuple — the commonest way to *get* a tuple — silently falls to the base case), and **`never`
for a missing ELEMENT vs `[]` for a missing LIST** (returning `never` from `Tail` poisons
everything downstream). `Last`/`Init` are one-liners **only because 4.0 relaxed "A rest
element must be last in a tuple type"** — the reverse-then-head shape in old code is a
workaround, not an idiom. ⚠️ `Length<string[]>` is `number`, so `Length<T> extends 0` takes
the wrong arm for arrays.

**Chunk 02 · Variadic tuple types, 229 lines, `b73eee5f`.** The notes are explicit it is
**TWO** changes — generic spreads in tuple syntax, and rest elements anywhere. 🔴 **The
headline is the rule the notes state once and nobody repeats: spreading a type without a
known length makes the result unbounded and absorbs every following element.** So **positions
before an unbounded spread survive and positions after it do not** — the silent failure of
mixing a tuple and a plain array. Also: **`readonly any[]` as the constraint** (the notes'
own `Arr`; `unknown[]` rejects `as const` arguments), and 🔴 **if an operation can be a
spread it should be** — `Push`/`Unshift`/`Concat` are one step regardless of length, where a
recursive `Push` pays an instantiation per element.

**Chunk 03 · Labels, optionality and the spread rule, 266 lines, `5214c591`.** 🔴 **Spread
preserves, rebuilding destroys** — topic 10 chunk 02's argument restated as a tuple rule: a
spread copies **structure**, indexed access copies **element types**, and labels, `?` and the
rest element are structure. `[Args[0], Args[1]]` gives anonymous required elements, and
`Args[1]` on an optional element is `number | undefined`, **silently changing the arity**.
🔴 **There are exactly two structure-preserving operations: a spread, and a homomorphic
mapped type** (topic 12 chunk 01's `instantiateMappedTupleType` read). ⚠️ **`infer` sits
between them and is the case that bites** — the inferred tail keeps its labels, the inferred
head loses its own, so reassembling `[A, ...R]` trips the all-or-none rule.

**Chunk 04 · `bind`, `curry` and partial application, 237 lines, `a72ed465`.** The notes'
`partialCall` quoted with **all four error cases**, because the *placement* is the point —
wrong type in the head args, too many head args, too few tail args, wrong type in the tail
args, and **every one lands on the caller's call, never inside the helper**. 🔴 **The move
that makes it work: the wrapped function's parameter list is declared as TWO spreads of TWO
type parameters** (`f: (...args: [...T, ...U]) => R` with `...headArgs: T`), so head
arguments fix `T` and `U` is inferred. Currying is the recursive counterpart, with three
decisions: nested not tail (irrelevant at parameter-list lengths), **base case is `R`, not
`() => R`** (the commonest bug), and **labels are unavoidably lost** because taking parameters
one at a time is a rebuild. 🔴 **The four walls — overloads, generics, `this`, construct
signatures — share ONE root cause: a tuple describes one call shape and a function type can
carry several.** ⚠️ **4.0 did NOT fix `bind`**; the notes only say they expect they *may* be
able to.

**Chunk 05 · The limits, 200 lines, `3b61c698`.** The three ceilings applied to tuples, with
**10,000 elements** singled out as the only one that is about tuples rather than recursion
and the only one no rewrite moves. 🔴 **Its most reusable section is the ordering to run
BEFORE writing any recursive tuple type: spread → indexed access → homomorphic mapped type →
only then recursion.** Step three is the one people forget — `{ [K in keyof T]: F<T[K]> }`
maps every element in one step **and keeps labels and element flags**, and a large share of
hand-written recursive walks are exactly that. Four shapes a tuple is the wrong tool for
(runtime-length list, overload set, named record, arithmetic), a four-clause earns-it test,
and the closing line: **variadic tuples are excellent for parameter lists and poor for
anything resembling data, and the syntax hides it.**

✅ **TOPIC 13 CLOSED: 5 chunks + README, 1,211 lines** (219 · 229 · 266 · 237 · 200 · 60),
0 over the cap, 0 broken links in phase 5 (646 links). **Eight inbound forward references
repointed** — topic 06 README + chunk 01, topic 07, topic 10 README + chunks 02/03, topic 11
README, topic 12 chunk 05. ⚠️ **Trap: `07-template-literal-types.md` is a FLAT file in the
phase directory**, so its link to a topic directory is `./13-…/README.md`, not `../` — the
link check caught it, a careless bulk edit would not have.

### ✅ Topic 12 · `DeepPartial` / `DeepReadonly` — COMPLETE (`c5ed1810`)

`12-deep-helpers/` + `_category_.json` + README. **Chunk 01 · The naive version, 207 lines,
`50e128a8`.**

🔴🔴 **THE FIND, read from 5.9.3's `instantiateMappedType` → `instantiateConstituent`
(~line 68097) — bank it, do not re-derive:**

```js
function instantiateConstituent(t) {
  if (t.flags & (3 /* AnyOrUnknown */ | 58982400 /* InstantiableNonPrimitive */
                 | 524288 /* Object */ | 2097152 /* Intersection */) && …) { … }
  return t;                    // primitives come back UNTOUCHED
}
```

**A homomorphic mapped type never maps a primitive**, so the ubiquitous
`T extends object ? {…} : T` guard in every published `DeepPartial` is protecting against
something that cannot happen — while costing three real things: it makes the type a
**conditional** (so it distributes over unions), it changes the shape in error messages,
and it changes the `any` case (`any` satisfies both branches). ⚠️ **The guard IS needed —
for functions, `Date`, `Map`, class instances**, which carry the `Object` flag and *are*
mapped. That inversion is the topic's spine.

Also banked from the same function: the dispatch is **array → `instantiateMappedArrayType`
· tuple → `instantiateMappedTupleType` (preserves labels and element flags) · intersection
→ mapped and re-intersected · everything else → `instantiateAnonymousType`**, and 🔴 **there
is no function case**, which is why methods get destroyed.

🔴 **BANKED FOR CHUNK 02 — `resolveMappedTypeMembers` (line 63030) opens with**
`setStructuredTypeMembers(type, emptySymbols, emptyArray, emptyArray, emptyArray)` **and
only ever populates `members` and `indexInfos` afterwards. So a mapped type STRUCTURALLY
CANNOT carry a call or construct signature** — that is the mechanism behind
`DeepReadonly<() => void>` collapsing, not an oversight.

**Chunk 02 · What it breaks, 241 lines, `9aff59d8`.** Five failures, **all silent at the
type's definition and surfacing at a use site** — which is the framing, because that is why
they get misdiagnosed. (1) 🔴 **A mapped type structurally cannot carry a call signature**
(the `resolveMappedTypeMembers` find above), so a method becomes `{}` and the symptom is
*"This expression is not callable"* in a file that never mentions the helper. (2) **Class
instances become name-only shells** — `keyof Date` enumerates the methods, each maps to
`{}`, and `Map`/`Set` type arguments are never reached because they are not properties;
📌 `ReadonlyMap`/`ReadonlySet`/`readonly T[]` already exist and are what a serious helper
delegates to. (3) 🔴 **`DeepPartial` makes array ELEMENTS possibly `undefined`** — read from
`instantiateMappedTypeTemplate`: `IncludeOptional` + `strictNullChecks` →
`getOptionalType(propType, /*isProperty*/ true)`, and `instantiateMappedArrayType` runs the
same template for the **numeric** element, so `string[]` → `(string | undefined)[]`.
**`DeepReadonly` has no equivalent failure.** (4) **Recursive data cannot be rescued by an
accumulator** — topic 11 chunk 04's fan-out result applied; a `Json` type is `TS2589` and
the only answers are a depth cap or not applying the helper. (5) **`any` is mapped, not
passed through** (it matches `AnyOrUnknown`), so the helper's output depends on how much
`any` is in the input.

📌 **The thread tying four of the five together, and the page's spine:** `keyof` + a mapped
type describe **data**, and the helper is being applied to things that are not data. So the
guard needed is **a list of what to hand back untouched**, not `T extends object`.

**Chunk 03 · The version that holds up, 230 lines, `6d5fa150`.** The five guards **in the
order they are forced into**: `any` first (it satisfies both branches of every conditional
below it — `IsAny<T> = 0 extends 1 & T`), functions (no call signature possible),
`Map`/`Set` → `ReadonlyMap`/`ReadonlySet` (type arguments are not properties), the named
class instances, then the mapping, which by then only sees plain data. ⚠️ **`never[]` not
`any[]` for the function bound** — topic 10 chunk 01's contravariance argument, reused.

🔴🔴 **THE CHUNK'S HEADLINE, and it is a genuine inversion: `DeepReadonly` should NOT have
an array guard and `DeepPartial` MUST.** The homomorphic path has handled arrays *and
tuples* correctly since 3.1, and an array guard (`T extends readonly (infer E)[]`) **matches
tuples and flattens them** — length, positions and 4.0 labels gone. But `DeepPartial` cannot
use that path, because the optional modifier lands on the numeric element, so it needs the
array branch **and** an explicit tuple branch above it. **The two helpers are not the same
type with a different modifier: `readonly` composes with arrays, `?` does not.**

Also stated: every guard distributes (five guards = a union taken apart five times), bracket
only the guards that are about the union itself; and the **three limits no guard removes** —
the class list is hand-maintained and finite, private state is nominal so even a correct
mapping is not assignable back, and depth is untouched.

**Chunk 04 · `DeepPartial` is not `DeepReadonly`, 257 lines, `8091771d`.** The design half.
🔴 **One is a restriction, the other a widening** — every value of `DeepReadonly<T>` is a
value of `T`, so it can never describe something that does not exist; `DeepPartial` admits
values that are not `T` and thereby asserts **every subset of the structure at every depth is
meaningful**, false for most domains. **Three places it belongs — patch body, fixture
builder, config merge — all *partial in, complete out*.** A `DeepPartial<T>` that is
returned, stored in state or passed between modules has become a domain type nobody
designed, and the cost is `??` defaults invented at call sites in other files. Arrives at
chunk 03's array branch **from the domain side** (nobody patches element 3 of a list by
position), settles the `exactOptionalPropertyTypes` interaction (a patch built by spreading
carries explicit `undefined`; the flag exposed an ambiguity that was always there), and
states that a patch type expresses **well-formedness, never validity**. Also: `DeepPartial`
is not the type of parsed JSON, and `DeepRequired` is the rarer mirror whose job the
validator's return type should be doing.

**Chunk 05 · The cost and the alternatives, 231 lines, `c5ed1810`.** Three costs that
**multiply** — fan-out, a per-node cost for every guard, and topic 09 chunk 02's per-mapper
cache so the work repeats per use / per file / per keystroke. Error messages named as the
underrated cost (the checker reports the *expanded* type, truncated at 160 chars, so one bad
leaf names the root). **Six fixes cheapest-first, none needing a measurement**: resolve once
into a named top-level alias → apply to the subtree → cap the depth → hand-write it →
generate it → use something that is not a type. 📌 **What a published deep-helper library
actually sells you is the GUARD LIST, maintained** — not the four-line mapped type — and its
array/tuple decisions are not interchangeable between implementations, so check them before
adopting. Ends with the five-clause test for when a deep helper earns it.

✅ **TOPIC 12 CLOSED: 5 chunks + README, 1,225 lines** (207 · 241 · 230 · 257 · 231 · 59),
0 over the cap, 0 broken links in phase 5. **Four inbound forward references repointed** —
topic 01 chunk 03, topic 03 README, topic 11 README and topic 11 chunk 04.

### ✅ Topic 11 · Recursive types — COMPLETE (session `65de22b3`, 2026-08-17, `31e90470`)

**5 chunks + README, 1,417 lines, spread 201 · 270 · 282 · 291 · 295, 0 over the cap.**
**Chunk 05 · Capping depth deliberately, 270 lines** — the counter tuple vs the `Prev`
decrementing lookup table compared on cost/maximum/readability (📌 **the table usually wins
for a cap**, because `DeepReadonly<T, 3>` is a signature a caller can read); 🔴 **the real
content of a cap is what it RETURNS at the cap** — four answers in a table, and **`never` is
the trap** because it is assignable in enough positions that the failure surfaces far from
the cause; picking the number from your data, not the compiler's limits; and the **four
circularity diagnostics a cap cannot help** — `TS2456`, `TS2615`, and 🔴 **`TS2313`
*"Type parameter '{0}' has a circular constraint."* / `TS2716` *"…has a circular default."*,
neither previously in this corpus** — with `TS2716` flagged as the one this construction
causes (a counter default written in terms of the counter).

⚠️ **Link sweep at the close repointed NINE stale forward references** whose targets had
landed: topic 09's README + chunks 03/04 → topic 11, topic 10's chunk footers 01→02 and
02→03, topic 09 chunk 04 → topic 10, and topic 08's README + chunk 11 → topic 10. Three of
those were *intra-topic footers left stale by the previous session* — proof that the
per-topic sweep is not enough on its own and the phase-close grep is the one that catches
them.

**Boards at the close:** `progress.js` phase 5 → **11/16**, pages README 11/16,
`docs/README.md` technology row **recomputed** from `progress.js` + `find` → **103 of 136
topics, 314 files**. ⚠️ `progress.js` carried **lane D's uncommitted phase-6 bump (6→7)** in
the working tree; it was committed along rather than reverted.

### Topic 11 — the chunk-by-chunk record

🔴 **THE CHUNK PLAN GREW FROM 3 TO 5** when chunk 02's draft measured **349 lines** and was
**split on a concept boundary, not trimmed**. The plan now is: 01 the two limits · 02 the
accumulator pattern · **03 order and position** · **04 the fine print** · **05 capping depth
deliberately**. The README carries an explicit note saying why, because "the plan said three"
is exactly the pressure that produces a trimmed file.

**Chunk 02 · The accumulator pattern, 290 lines, `07c139d7`.** Built on a **verbatim fetch of
the 4.5 release notes** (*Tail-Recursion Elimination on Conditional Types*) — do not re-fetch:

- The `GetChars` / `GetCharsHelper` pair is **the compiler team's own example**, with their
  framing sentences quoted: *"Keep in mind, the following type won't be optimized, since it
  uses the result of a conditional type by adding it to a union"* and *"As long as one branch
  of a conditional type is simply another conditional type, TypeScript can avoid intermediate
  instantiations. There are still heuristics … but they are much more generous."*
- 📌 **The notes never give a number** — "much more generous" is as specific as they get. The
  1,000 is chunk 01's compiler read. Say which is which on any page that quotes both.
- **The three seeds are the identity elements** of the operation: `never` for `|`, `""` for
  concatenation, `[]` for tuple building, `unknown` for `&`. A wrong seed does not error, it
  produces a subtly wrong answer.
- 🔴 **`Acc["length"]` is why tuples are the general case** — one accumulator is both result
  and loop counter, which is what makes `Range`, `Repeat` and the depth caps expressible.
- 🔴 **A recursion whose input never shrinks terminates on a COUNTER, not on the input.**
  `Repeat<S, N>` walks a number; nothing gets smaller, so a counter tuple is the thing that
  does. Stated as the general rule: point at the strictly-decreasing parameter, or add one.
- `infer H extends string` is **4.8** and is **load-bearing, not sugar** — the pre-4.8
  hand-constrained form puts a conditional *around* the recursive call and loses tail position.
- `TS2574` *"A rest element type must be an array type."* is what an unconstrained tuple
  accumulator gives you; a union accumulator correctly needs no constraint, which is why the
  release-notes example has none.

🔴 **BANKED FOR CHUNK 04 — a THIRD ceiling, new to this corpus, read from 5.9.3
`createNormalizedTupleType` (~line 65754):**

```js
if (elements.length + expandedTypes.length >= 1e4) {
  error2(currentNode, isPartOfTypeNode(currentNode)
    ? Diagnostics.Type_produces_a_tuple_type_that_is_too_large_to_represent      // TS2799
    : Diagnostics.Expression_produces_a_tuple_type_that_is_too_large_to_represent);
```

**`TS2799` at 10,000 tuple elements is not `TS2589` and is not a recursion limit** — it fires
on the *spread*, so a doubling accumulator (`[...Acc, ...Acc]`) reaches it in 14 iterations
while the tail-call budget is untouched. That is chunk 04's headline.

Previously: **Chunk 01 · The two limits, 201 lines, `c9a1bb8c`.**

🔴🔴 **THE FIND, read from 5.9.3's `getConditionalType` — banked so nobody re-derives it:
that function is a `while (true)` LOOP, not a recursive function, guarded by
`tailCount === 1e3`. So TypeScript has TWO recursion ceilings an order of magnitude apart,
both reported as `TS2589`:**

| Shape | Ceiling | Counter |
|---|---|---|
| **Nested** (recursive call wrapped in anything) | **100** | `instantiationDepth` |
| **Tail** (recursive call IS the branch result) | **1,000** | `tailCount` |

**Three conditions for the tail-call path**, from the continue block:
1. the branch is itself a conditional with `outerTypeParameters`;
2. 🔴 **it is NOT a distributive root whose check type became a union/`never` — distribution
   BAILS OUT of the loop.** So `[T] extends [[…]]` is load-bearing for *performance* as well as
   correctness — the same syntax buying two unrelated things;
3. 🔴 **`tailCount++` only fires `if (newRoot.aliasSymbol)`** — an anonymous tail call is not
   counted. **Third independent reason to name helper types**, after caching (topic 09 chunk 02)
   and error messages (topic 08 chunk 03).

📌 **Eyeball test for tail position:** anything *around* the call in the branch (tuple, object,
union, another utility) means nested; arguments *to* the call — including `[...Acc, 1]` — do not
count, which is exactly why the accumulator conversion works.
⚠️ Page also states that 1,000 is a limit on **iterations, not cost**, and separates `TS2589`
(a limit) from `TS2615` (a structural impossibility). Phase 1 topic 15 keeps recursive **data**
types and is linked, not restated.

**README written too (`6e6860c2`)** with an explicit *"topic in progress"* admonition, chunk 01
linked, chunks 02/03 as plain text. ⚠️ **Three in-prose links in chunk 01 pointed at the unwritten
chunks and were converted to plain text** — they would have warned in every build until those
landed. **Phase 5: 0 broken links, 0 files over 300, 46 files.**

**Chunk 03 · Order and position, 293 lines, `a1242615`.** The set-aside half, written out:
`[...Acc, H]` vs `[H, ...Acc]` as a 4-row table; 🔴 **reversal is free, and is the pattern's
commonest silent bug** — the release-notes example is safe **because unions are unordered**,
not because the rewrite is, and `[C, ...Chars<R>]` vs `[C, ...Acc]` are near-identical text
with opposite meanings; **only the recursing branch must be bare**, which makes the base
branch the right home for cosmetics, the final shape change, and 📌 **the last element a
`Split` would otherwise drop** (`[...Acc, S]`, the commonest bug in hand-written splitters);
**a conditional in the ARGUMENT list keeps tail position** — the notes' *"simply another
conditional type"* covers a chain — but it is instantiated per step, so **free positionally,
multiplied in cost**. Ends with a 9-shape eyeball table and an explicit refusal to bet on
wrappers that reduce away (`X | never`) since no run here can settle it.

**Chunk 04 · The fine print, 282 lines, `6a943fdf`.** Carries the `TS2799` find above, plus:
🔴 **the public-alias split is a CORRECTNESS issue** — a defaulted type parameter is public,
so seeding the accumulator is a legal call that yields a **wrong type with no diagnostic**;
the fix is arity (public alias takes real arguments, helper takes **no defaults**). ⚠️ **Do
not inline the helper to tidy the API** — `tailCount` needs the `aliasSymbol`, so inlining
costs the 10×; control visibility with module exports. **Iterations ≠ cost**: 900 iterations
is 900 instantiations *per use*, per consuming file (per-mapper cache), per keystroke. **Three
shapes no accumulator reaches:** two recursive calls (a tree — only one can be last; a work-list
parameter is a manual CPS transform and a readability cost to price out loud), object fan-out
(topic 12's), and a step that branches on the recursive *result*. 📌 Also banked from the
message table: **`TS2590` has NO type-position variant**, so *"Expression produces a union
type…"* can appear where there is no expression.

🔴 **RESUME HERE — topic 11 chunk 05 · Capping depth deliberately** (counter tuple; decide *and document* whether the cap errors or stops — topic 09
chunk 04 step 6 already states that decision has two halves), then **update the boards to
11/16** — they are deliberately still at **10/16** because the topic is unfinished.

## ⏸ SESSION PAUSED — 2026-08-17, session `8b70b2f9`, at ~95% usage

On the user's word (*"We are reached 95% above please save session progress and enough for the
i will see you on the other side"*) — **not blocked, and nothing is half-written.**

**Delivered this session: 3 topics closed + 1 in flight, 21 files, ~4,800 lines.**

| Topic | State | Files / lines |
|---|---|---|
| 08 · Knowing when to stop | ✅ COMPLETE | 11 chunks + README, 2,795 |
| 09 · Type-level performance | ✅ COMPLETE | 4 chunks + README, 1,063 |
| 10 · Deriving one function's type | ✅ COMPLETE | 3 chunks + README, 752 |
| 11 · Recursive types | 🚧 1 of 3 chunks + README | 201 + 70 |

**Phase 5 stands at 10/16 topics; lane A has 6 left (11–16).** Boards current at `d85748b6`
(topic 10); topic 11's are intentionally not advanced.

🔴 **The four compiler-read finds this session produced, none of which were in the corpus
before — they are the reusable asset here, all in the tables above:** `TS2859` as a diagnostic
distinct from `TS2321`; `relationCount = (16e6 − relation.size) >> 3` (the comparison budget
shrinks as a project grows); `isNonGenericTopLevelType` quitting at a function body; and
**`getConditionalType` being a loop with `tailCount === 1e3`, so tail recursion gets 1,000 and
nested recursion 100.**

⚠️ **Cadence held at one commit per file** from the 80%-usage instruction onward — 8 content
commits and 8 memory commits, interleaved, so a crash could have lost at most one file.

### ✅ Topic 10 · Deriving one function's type from another — COMPLETE

`10-deriving-function-types/` + `_category_.json`. **Chunk 01 · The wrapper signature, 221
lines, `0fc35634`.** ⚠️ **This topic is the APPLIED half** — [topic 03 · chunk 04](.) owns the
extractor mechanisms (the family, the overload rule, multiple `infer` sites, `Awaited`, the
`this` pair) and is **linked, not restated**. Chunk 01 banks:

- 🔴 **`never[]` vs `any[]`, argued from contravariance:** `(...a: never[]) => unknown` is the
  *widest possible bound* (every function is assignable to it) but is **uncallable**, so a
  signature you intend to **invoke** wants `any[]`. Same decision as phase 4's
  `new (...args: any[]) => T` in `14-mixins/01-the-pattern.md` — cross-linked.
- `Promise<Awaited<ReturnType<F>>>`, never `Promise<ReturnType<F>>` — otherwise the wrapper is
  wrong for exactly the async half of its callers, and the sync case is the one people test.
- **`Parameters<F>` drops the `this` parameter**, so a naive method wrapper loses the receiver
  requirement → `ThisParameterType` / `OmitThisParameter` as an explicit choice.
- Spreading the derived tuple preserves **arity, optionality and 4.0 labelled names** — the
  strongest argument for deriving over re-typing, and what hand-written copies lose first.
- `typeof` needs a value in scope → a runtime-selected function wants a **generic** wrapper.

**Chunk 02 · What derivation quietly loses, 215 lines, `eb3c1f1f`.** Four losses, all of which
fail **at a caller, not at the wrapper**: overloads collapse to the *last* signature (⚠️ the
**return-position** half is the dangerous one — it type-checks and is untrue); a generic function
is not generic after extraction (`Parameters<typeof identity>` = `[x: unknown]`), so the remedy is
structural — declare the parameter on the **wrapper**; optionality and labels survive a **spread**
and are destroyed by rebuilding from indexed access; and making a wrapper generic to fix the first
two **adds inference sites**, which is topic 14's `NoInfer` territory. Ends with when hand-writing
beats deriving: overloaded inputs, and exported wrappers that would hit `TS7056`.

**Chunk 03 · The shapes in practice, 245 lines, `e40b6b84`** — four shapes, each with the
signature that holds up: transparent (memoize, ⚠️ **the honest weakness is the cache KEY, not the
types**) · async-ifying (retry, with the single `as Awaited<R>` defended as *containment* rather
than failure) · adapter supplying one argument (`Tail<A>` to keep arity/optionality/labels) ·
🔴 **shape 4, re-typing a parameter — flagged as the fragile one the stopping tests say to
replace with two hand-written signatures.** Decorator typing handed to phase 4 topic 13 (two
incompatible protocols) rather than picked here. **README, 71 lines, `d85748b6`.**

✅ **TOPIC 10 CLOSED: 3 chunks + README, 752 lines** (221 · 215 · 245 · 71), 0 over cap, 0 broken
links in phase 5. Defers to **13 · Tuple manipulation** and **14 · `NoInfer<T>`** as plain text —
repoint both when those land.

### ✅ Topic 09 · Type-level performance — COMPLETE

`09-type-level-performance/` + `_category_.json`. **Chunk 01 · The three budgets, 249
lines, committed `093811b9`.**

🔴 **THE FIND OF THIS TOPIC — every limit read out of 5.9.3's checker
(`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`), do not re-derive:**

| Diagnostic | Exact guard | Where |
|---|---|---|
| `TS2589` | `instantiationDepth === 100 \|\| instantiationCount >= 5e6` | `instantiateTypeWithAlias` |
| `TS2321` / `TS2859` | same `overflow` flag; message chosen by `relationCount <= 0` → **2859**, else **2321**. Depth arm is `sourceDepth === 100 \|\| targetDepth === 100` | `checkTypeRelatedTo` |
| `TS2590` | `getCrossProductUnionSize(types) >= 1e5` **and** a second site: after `count === 1e5`, `estimatedCount = count / (len - i) * len > 1e6` | `checkCrossProductUnion`; subtype reduction |
| truncation | `defaultMaximumTruncationLength = 160` · `noTruncationMaximumTruncationLength = 1e6` · `defaultHoverMaximumTruncationLength = 500` | top of the file |

🔴 **`relationCount = 16e6 - relation.size >> 3`** — JS precedence makes it
`(16e6 − cacheSize) >> 3`, so **the comparison budget SHRINKS as the project's relation
cache fills.** That is the mechanism behind *"it compiles in the playground and fails in
the repo"*, and it is the strongest single insight in this topic. Overflow is then cached
with `ComplexityOverflow` (32) / `StackDepthOverflow` (64).

📌 **Two messages cover six failures** — that framing is the page's spine.
⚠️ **The constants are 5.9.3's and are explicitly NOT claimed for 7.0.2** (Go port,
unreadable the same way); only the *shape* transfers. Say so on every page that quotes one.

**Chunk 02 · Caching and naming, 257 lines, committed `98685df8`.** 🔴 **Second find, also
read from 5.9.3 — `isNonGenericTopLevelType` requires (a) `type.aliasSymbol && !type.aliasTypeArguments`
and (b) the declaration's ancestors to reach a `SourceFile`, walking *through* `ModuleDeclaration`
but **quitting at a function body or block**. So the identical `type` alias declared inside a
function is NOT eligible for instantiation's cheapest early-out.** Practical rule on the page:
hoist type aliases out of function bodies. Also banked: `couldContainTypeVariables` memoises its
answer onto `objectFlags` (asked once per type ever); the instantiation cache is keyed
`type.id + getAliasId(...)`, lives in `activeTypeMappersCaches`, is **per active mapper** and is
`.clear()`ed when the mapper pops — hence one derived type used in twenty files is twenty pieces
of work. ⚠️ **No timings claimed anywhere — eligibility only**, since no sandbox covers this phase.

**Chunk 03 · What actually makes it slow, 246 lines, committed `754ff037`.** Seven shapes
**ranked by which budget they consume, deliberately NOT by seconds** — no sandbox covers this
phase, so a time ranking would be invented. Order: wide/computed unions (quadratic) · nested
conditionals over unions (**`TS2589` with no recursion anywhere — the phase's most misdiagnosed
shape**) · intersections in hot signatures · un-annotated composed returns (`TS7056` at the
extreme) · uncapped recursion · mapped types over generated shapes · the **editor's
per-keystroke bill**, which is why a faster `tsc --noEmit` is not evidence the editor improved.
Attribution tooling is named and handed to **phase 12 / lane B** as plain text, not developed.

**Chunk 04 · The fixes in order, 235 lines, `0b1a44e0`.** Step 0 is a **budget → fix table**
because the remedies are mutually exclusive; then seven steps ordered so everything defensible
**without a measurement** comes first, ending with *"only now, measure"* handed to phase 12.
**README, 76 lines, `9a4a4034`** — carries the five sentences to keep.

✅ **TOPIC 09 CLOSED: 4 chunks + README, 1,063 lines** (249 · 257 · 246 · 235 · 76), 0 over the
cap, 0 broken links in phase 5. **11 inbound `(not written yet)` references repointed** — topic
08 chunks 03/08/11 + its README, topic 02 README + chunk 04, topic 01 chunks 03/04, and the
three intra-topic footers. ⚠️ **Error-message truncation numbers (160/500)
retro-confirm topic 08 chunk 03's "budget" claim** — cite them there if it is ever revised.

### Topic 08 — the chunk plan as built

`08-knowing-when-to-stop/` with `_category_.json`. **Drafted flat at 384 lines and
split TWICE on concept boundaries, nothing trimmed** — the rule-1 loop working as
intended.

| Chunk | Lines | Subject |
|---|---|---|
| README | 87 | index of 11, the one-sentence version, **the four sentences to keep**, where this connects |
| 01 `01-the-error-is-the-interface.md` | 259 | cost asymmetry; what the checker *can* report — `TS2322`/`2326`/`2328`/`2345`, `TS2344` as the only human-authored diagnostic, `TS6500`/`TS6502` as locations; why branches are not reportable |
| 02 `02-three-designs-one-mistake.md` | 252 | one typo (`"dat"`) through unconstrained conditional (**no error at all**) / constrained (`TS2345` at the call site) / two overloads (`TS2769` + `TS2772`/`TS2770` per candidate). Yields **"enumerable candidates produce enumerable errors"** + a 7-axis ranking table |
| 03 `03-four-fixes.md` | 269 | name every step (wiki *Performance* quotes) · bound the input · truncation as a budget · the hover test (6 steps) |
| 04 `04-the-stopping-tests.md` | 245 | tests 1–4: explain at review speed · **open vs closed input set** (the near-mechanical one) · name the bug (with *delete it on a branch* as the empirical form) · where the failure lands |
| 05 `05-is-a-type-the-tool.md` | 265 | tests 5–7 + **the ratchet**: validate not compute · the maintainer signals · lint rule / codegen / validator / comment · `TS7056`'s *"explicit type annotation is needed"* argued as the right answer, not a defeat |
| 06 `06-what-to-write-instead.md` | 254 | two named types · discriminated union · **annotate the return** · delete the type parameter · derive **narrowly** from one source of truth |
| 07 `07-overloads-and-the-handbook.md` | 267 | the handbook's two ❌ warnings **verbatim** + the pass-through `fn` example, why `utcOffset`'s parameter is not optional, *"extraneous arguments are allowed"*, 6-row decision table |
| 08 `08-structure-and-tooling.md` | 217 | 🔴 **the lookup interface** (most conditional chains are lookup tables written as control flow) · `interface extends` over `&` · base type over wide union — wiki quoted |
| 09 `09-the-boundary-and-the-generator.md` | 227 | `satisfies` · derive **from** the schema (direction matters) · generate declarations (6-row table where the type-level parser wins no column) · `unknown` + a guard |
| 10 `10-keeping-the-ones-you-keep.md` | 292 | façade over machinery · `Prettify` once at the boundary · message-type vs `never` · bounded recursion · **the five walls** · document the BOUNDARY · pin with `@ts-expect-error` · a stated deletion criterion |
| 11 `11-the-cases-that-earn-it.md` | 248 | the six cases that earn it, each shown to clear the tests; why type-level **parsing** is right for a caller-written route pattern and wrong for an OpenAPI contract |

### 🔴 Rule 1 in action, session `65de22b3` — asked AGAIN, mid-turn, 2026-08-17

The session opened on **"pick ts a"** and the user interrupted mid-turn with
*"make sure you adhere hard coded rules especially about file size ?"*. **Answered with
measurements, not assurances** — that is the only answer this question has, and the next
session should expect to be asked a third time.

| | |
|---|---|
| Drafted over the cap | **1** — topic 11's accumulator draft at **349 lines** |
| What happened to it | **SPLIT on a concept boundary**; the material that came out earned **two chunks of its own** rather than being folded back in |
| Plan change | topic 11 went **3 chunks → 5**, and the topic README says why, in the page itself |
| Delivered | **2 topics, 12 files, 2,642 lines** (11 → 1,417 · 12 → 1,225) |
| Per-file spread | **201 · 230 · 231 · 241 · 256 · 270 · 283 · 291 · 295** (+ two 72–78 indexes) |
| Phase 5 overall | **64–295 across 56 files** — a 231-line spread, not a band |
| Over the cap at close | **0** |

📌 **The distinguishing move worth copying:** when a draft goes over, the honest response is
not "split it in half" but *"what are the two subjects in here?"* — topic 11's 349-line draft
contained the **conversion** and the **rules about order and position**, and those are two
pages, not one page cut in two. The second half then grew on its own terms.

⚠️ **This session's spread does NOT show the clustering tell** the previous one had to
confess to (217–292 from halving ~500-line drafts). Five of the twelve files are below 240.
**Report the spread every time — it is the only evidence that survives review**, because a
budgeted page and an honest one look identical in a diff.

### 🔴 Rule 1 in action — the record, because the user asked mid-topic (session `8b70b2f9`)

*"Hope your not truncating the explanation rather than splitting pages"* (2026-08-17).
**Four drafts went over the cap; each was split and BOTH halves then grew:**

| Draft | Over at | Split into | Total after |
|---|---|---|---|
| the error is the interface | **384** | 259 + 252 | **511** (+127) |
| the stopping tests | **346** | 245 + 265 | **510** (+164) |
| what to write instead | **331** | 254 + 267 | **521** (+190) |
| structure and tooling | **313** | 217 + 227 | **444** (+131) |

⚠️ **Told the user unprompted:** the resulting spread is **217–292**, which *is* rule 1's
clustering tell. The mechanism here is arithmetic (halves of ~500-line drafts land near
250), not budgeting — but it is the same shape as the phase-3 mistake, so say it out loud
rather than hoping the explanation covers it.

### Traps the splits produced — check for these after any renumber

1. **16 intra-topic links broke** when chunks were renumbered (`./05-what-to-write-instead.md`
   → `./06-…`). The filesystem link check catches these.
2. 🔴 **11 prose labels went stale and the link checker CANNOT see them** — `[chunk 05](./06-…)`
   resolves fine and reads wrong. Detect with:
   ```bash
   grep -rnoE '\[[Cc]hunk [0-9]+\]\(\./[0-9]+-' *.md | while IFS= read -r l; do
     a=$(echo "$l"|sed -E 's/.*[Cc]hunk 0*([0-9]+)\].*/\1/'); b=$(echo "$l"|sed -E 's#.*\(\./0*([0-9]+)-.*#\1#')
     [ "$a" -ne "$b" ] 2>/dev/null && echo "MISMATCH: $l"; done
   ```
3. ⚠️ **`phase-2-narrowing/11-narrowing-lost` is a DIRECTORY** — link
   `11-narrowing-lost/README.md`, not `11-narrowing-lost.md`. Same for
   `09-assertion-functions`, `10-satisfies`, `08-as-assertions`.

🔴 **NEW FIND, not previously in the corpus: `TS2859` *"Excessive complexity
comparing types '{0}' and '{1}'."* is a SEPARATE diagnostic from `TS2321`
*"Excessive stack depth comparing types '{0}' and '{1}'."*** — both exist in
5.9.3 **and** 7.0.2 (`Excessive_complexity_comparing_types_0_and_1_2859`,
`Excessive_stack_depth_comparing_types_0_and_1_2321`). Earlier pages quote only
`TS2321`. **Chunk 06's "five walls" section is where `TS2859` lands**, and topic
09 should carry it too.

📌 **Fetched this session, do not re-fetch:** the **TypeScript wiki *Performance*
page** (*Naming Complex Types*, *Using Type Annotations*, *Preferring Interfaces
Over Intersections*, *Preferring Base Types Over Unions* — all four quoted
verbatim in the memory below / chunks 03 and 05) and the handbook's **Declaration
Files → Do's and Don'ts** (*Use Union Types* and *Use Optional Parameters*, with
the `Moment.utcOffset` and `Example.diff` examples and the pass-through `fn`
example, verbatim).

⚠️ **Boundary with phase 3 topic 13, stated on the page:** `13-when-not-to-write-a-generic/`
is the **signature** level ("a type parameter appearing once relates nothing").
Topic 08 is the **type-level-program** level. Link, do not restate.

**Part A's remaining nine, in order:** 08 Knowing when to stop · 09 Type-level
performance (`TS2589`, `TS2321`, `TS7056`, `TS2590` — all four already quoted in
written pages) · 10 Deriving one function's type from another · 11 Recursive
types · 12 `DeepPartial`/`DeepReadonly` · 13 Tuple manipulation · 14 `NoInfer<T>`
· 15 Union → intersection identities · 16 Higher-kinded types (When Needed).

⚠️ **Three of those will chunk:** 11 (recursion), 12 (the deep helpers) and 13
(tuples) each have more than one file's worth. The rest are single files of
200–290, which is the shape topics 04, 05 and 07 landed at.

⚠️ **Topic 08 is the phase's spine, not filler.** Every earlier topic forward-links
to it — topic 02 chunk 04 (*"Keeping them readable"*), topic 01's `Prettify`
note, topic 07's closing paragraph. It must carry the *"a clever type that
produces an unreadable error message is a net loss"* argument in full, with the
concrete tests: what the caller's error looks like, when to name intermediates,
when two overloads beat one conditional. **Do not write it as a short opinion
page.**

📌 **Already fetched and quoted, do not re-fetch:** handbook *Mapped Types*,
*Conditional Types*, *Utility Types*, *Template Literal Types*; release notes
**2.1, 2.8, 3.1, 4.7, 4.8**. Still un-fetched for the remaining nine: the **4.1
notes** (only needed if topic 13 wants variadic-tuple history) and **5.4** for
`NoInfer` beyond the handbook's entry.

### The Understand-tier shape for the rest of phase 5

Topics 04–10 are **Understand**, 11–15 **Know**, 16 **When Needed**. Master
topics 01–03 ran 4–5 chunks; an Understand topic is normally **one file of
200–290**, chunked only when the subject genuinely has more (rule 1: write it,
then split). Do not pad an Understand topic to four chunks for symmetry, and do
not cap one that needs them.

### ✅ Phase 4 topic 14 · Mixins — the worked example of the rule the user restated

**8 files / 1,574 lines** for a *When Needed* topic, because that is what the
subject has. Drafted flat, then split on concept boundaries; the first draft had
two files at **303 and 312 lines**, and both were **split, not trimmed**:

| Chunk | Lines | Subject |
|---|---|---|
| README | 85 | index, one-sentence version, three sentences to keep |
| 01 The pattern | 240 | factory, `Constructor`, `TS2545`, the closure escape hatch |
| 02 Composing and naming | 92 | nesting, order/shadowing, `InstanceType<typeof X>` |
| 03 Constrained mixins | 147 | `GConstructor<T>`, constraining the static side |
| 04 Abstract bases and fences | 187 | `abstract new` (4.2), `TS2797`, `TS2510`, `TS2562` |
| 05 The cost in the build | 266 | `TS4060`, `TS9005`, `TS9021`/`TS9022`, `TS7056` |
| 06 Identity, statics, privacy | 284 | new class per call, `TS18032`, `TS2417`, decorators |
| 07 The alternatives | 273 | `applyMixins`, composition, the decision table |

**Findings worth reusing:**
- 🔴 **`isolatedDeclarations` forbids the mixin pattern outright** — `TS9021`
  *"Extends clause can't contain an expression"* and `TS9022` *"Inference from
  class expressions is not supported"*. An explicit return type clears `TS9007`
  but not those two. This is the strongest argument in the topic and it belongs
  in **phase 6**, which owns `isolatedDeclarations`.
- **The 7.0.2 compiler's message text is greppable.** `node_modules/typescript`
  in `sandbox/ts-p1` is **TypeScript 7.0.2**, and the native binary at
  `@typescript/typescript-linux-x64/lib/tsc` contains every diagnostic string —
  `grep -a -F` it to confirm wording. Code *numbers* still come from the 5.9.3
  JS table in `sandbox/ts-p0` (`node_modules/typescript5/lib/typescript.js`,
  `diag(CODE, …)` entries). Neither is a run: both are reads.
- ⚠️ **Two handbook quotes were wrong on first draft** and were caught by
  re-fetching the page for exact wording: it is *"You cannot use decorators to
  provide mixins via code flow analysis:"* and *"More of a gotcha than a
  constraint. The class expression pattern creates singletons, so they can't be
  mapped at the type system to support different variable types."* **Re-fetch for
  a verbatim quote; a summariser's paraphrase inverted the first one.**

## Per-phase closing checklist

The phase-2 close is the worked example; do all six.

1. Every page ≤300 lines, **spread not clustered** — chunk on a concept boundary
   if not.
2. Syllabus part file (`docs/typescript/syllabus/0N-*.md`) → add the 📖
   **Explanation written** link, in `.md` form.
3. Phase `README.md` → recount to "N topics · M files · complete", and link every
   topic row.
4. `src/data/progress.js` → set `pages` and **drop `pagesPlanned`**.
5. `docs/typescript/pages/README.md` → mark ✅ written. `docs/README.md` →
   technology row + claims row.
6. **Full clean rebuild** — `rm -rf .docusaurus node_modules/.cache` first —
   and confirm **`[SUCCESS]` BEFORE interpreting any grep**. Then write
   `reference_typescript_phaseN.md`, index it, commit the store.

### 🔴 Open defect in Part A's own phases — fix when passing

**5 chunk directories carry no `_category_.json`**, so the sidebar shows the raw
directory name instead of a label:

```
phase-3-generics/12-const-type-parameters/
phase-3-generics/13-when-not-to-write-a-generic/
phase-4-classes-declarations/01-module-augmentation/
phase-4-classes-declarations/02-access-modifiers/
phase-4-classes-declarations/05-interface-declaration-merging/
```

Two of these have their label sitting in an **orphan doubled path** committed by
a write that ran from the wrong cwd —
`docs/javascript/pages/docs/javascript/pages/…` is the JavaScript equivalent;
check for a TypeScript one before writing new files. **Move, do not just
delete.** ⚠️ *Phase* directories correctly have none (README frontmatter plus
autogeneration); this is about *topic chunk* directories only.

## 🔴 Traps — read before touching a shared file

- **`src/data/progress.js` — ANCHOR ON THE SLUG, and assert the count.** At
  phase 3 topic 05 a numeric-pattern edit (`topics: 14, pages: 4, pagesPlanned:
  14`) matched **two** rows: TypeScript's `phase-3-generics` **and JavaScript's
  `phase-10-events`**. The `count(old)==1` assert stopped it. Always include the
  `slug:` in the match string, always assert.
- **Never `git add -A`.** Stage explicit paths. Other sessions have live edits in
  the same checkout.
- 🔴 **`git commit` needs `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars** — there is
  no readable `user.*` config and setting one is out of scope. Use
  `git commit -F -` with a quoted heredoc (backticks in `-m` get
  command-substituted).
- 🔴 **PART B IS LIVE AGAIN — another session started writing
  `docs/typescript/pages/phase-7-typescript-on-the-server/` mid-session on
  2026-08-15.** At 15:xx it was a lone untracked `_category_.json`; minutes later
  it had a README and a chunked topic 01. **Not Part A's to commit, edit or
  delete** — and its **5 broken links are theirs, mid-write, not a Part A
  regression.** ⚠️ Consequence: **the whole-site link count is no longer a clean
  signal for Part A.** Filter to `phase-{2,3,4,5,6}` before concluding anything,
  and do not "fix" a phase-7 link.
- 🔴 **Another session will commit your memory files out from under you.** The
  topic-12 store commit came back *"nothing to commit, working tree clean"* — a
  concurrent Docker session had swept all three TypeScript memory files into its
  own commit (`81fa0cf`) with `git add -A`. **Nothing was lost**; verify with
  `git show HEAD:<file> | wc -l` rather than assuming the write failed and
  redoing it.
- **Forward references to unwritten topics are bold plain text with *(not written
  yet)*, never a link** — a `.md` link to a file that does not exist yet warns in
  every build until it lands. Repoint them as each topic lands.
- 📌 **Phase directories carry no `_category_.json`** — README frontmatter plus
  autogeneration, matching phases 0–2. Only a *chunk* directory inside a topic
  gets one.
- 📌 **Pattern holding well:** Master topics → chunk directory (`README` + 2),
  Understand/Know topics → one file of 240–290.
- 🔴🔴 **CAP-CLUSTERING — I DID THIS, THE USER CAUGHT IT, AND IT WAS FIXED.**
  Phase 3's nine single-file topics landed at 250, 264, 269, 280, 280, 289, 290,
  293, 281 — **a 43-line band under the cap**, exactly the tell rule 1 names.
  The user asked directly: *"Did you followed hard rule about 300 lines fize not
  content budget?"* **The honest answer was no.** Nothing was trimmed — but each
  page was **planned to "~250–290 lines" before being written**, and a target set
  in advance is a content budget however little gets deleted afterwards.
  ⚠️ **The self-deception to watch for:** "I never cut anything" feels like
  compliance and is not. The violation happens at the *planning* step, before
  there is anything to cut, and it is invisible in the diff. **The distribution
  is the only reliable evidence, so measure it — `find … | xargs wc -l | sort -n`
  — at every phase close and read the SPREAD, not the maximum.**
  Fixed by re-opening topics 12 and 13 and expanding them into 4-file chunk
  directories (289 → 595 and 293 → 589 lines) with material the flat versions had
  no room for. **Do not write to a length in phase 4.** Write the topic, measure,
  then split. A phase whose lengths genuinely vary will show some 180s.
- ⚠️ **Converting a flat `NN-topic.md` to `NN-topic/` TAKES THE WHOLE-SITE BUILD
  DOWN while both exist** — duplicate routes on one URL, plus an unresolved
  `@site/.../NN-topic.md` import. **Docker and TypeScript Part B each diagnosed
  this independently before working out it was mine.** On a shared checkout other
  sessions build against your **working tree**, not your commits, so the window is
  real even if you commit atomically. Delete + add + repoint inbound links in one
  motion, and keep the window to minutes.
- 🔴 **Repoint forward references at the PHASE close, not just per topic.** Phase
  3 accumulated **12** stale *(not written yet)* markers in topics 01–05 whose
  targets had long since landed — invisible to a link check (they are plain text,
  not links) and only found by
  `grep -rn "not written yet" docs/typescript/pages/phase-N-*/`. Run that grep as
  part of every close.

## ✅ Green baseline — 2026-08-15

The phase-3 close ran a **real** build, not a link check. Docker chunk C's invalid
`_category_.json` had blocked *every* session's build; once they fixed it, the row
was claimed in `shared/session_build_devserver_registry.md`, and:

```
rm -rf .docusaurus-ts-a node_modules/.cache build-ts-a
DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-ts-a yarn build --out-dir build-ts-a
```

→ **`[SUCCESS]` confirmed BEFORE any grep**, then `grep -iE 'warning|broken'`
returned **0 across the entire site** — TypeScript, Docker, JavaScript, all of it.
Row cleared and artefacts deleted immediately. Cite this as the last known-green
point. ⚠️ Rule 12: **never run a build without claiming that row first.**

## Cheap link check — run after every topic

Resolves every relative `.md` link against the filesystem in a second or two.
Keep the full clean rebuild for the phase close. **554 links** at 13/14 — **0
broken in `phase-{2,3,4,5,6}`**; the 5 that report are Part B's live phase-7.

```bash
cd /mnt/Storage/Backup/Knowledge/devbible && python3 - <<'EOF'
import os,re,glob
bad=0; tot=0
for p in glob.glob('docs/typescript/**/*.md', recursive=True):
    d=os.path.dirname(p)
    for m in re.finditer(r'\]\(([^)]+\.md)\)', open(p,encoding='utf-8').read()):
        t=m.group(1)
        if t.startswith(('http','#')): continue
        tot+=1
        if not os.path.isfile(os.path.normpath(os.path.join(d,t.split('#')[0]))):
            print('BROKEN',p,'->',t); bad+=1
print(tot,'links,',bad,'broken')
EOF
```

## Evidence rule for the whole of TypeScript

🔴 **No new sandboxes.** Validate against the handbook, the release notes, and
🔴 **the compiler's own diagnostic table and `lib/*.d.ts`, read rather than
recalled** — `grep -o 'Message_id_NNNN[^)]*' <ts>/lib/typescript.js` at
`my-learning/eKommerce/ek-frontend/node_modules/typescript` (⚠️ **6.0.3**, not the
7.0.2 the corpus targets — say so on the page each time; eKommerce is
advisor-only and nothing there is changed). **No run means no console block.**

⚠️ **Limit found 2026-08-15:** 6.0.3 is the Go port, so the JS package carries the
*string table* but **not the checker**. You can quote a message; you cannot show
which code fires for a given mistake. Where that matters, say the mapping was
derived from the wording, not observed.

## ⏸ Session paused here — 2026-08-15, session `3af83cbb`

On the user's word at 93% usage (*"enough please save the session progress to
memory and i will see you on the other side"*), not blocked. **Stopped clean:**
working tree empty, every topic committed, boards current, **746 Part A links
resolving / 0 broken / 0 over cap**. Nothing is half-written — topic 14 was not
started.

🔴 **ONE TOPIC LEFT IN PHASE 4: topic 14 · Mixins** (When Needed tier — keep it
short). Then the phase close.

📌 **Its research is already banked in [[devbible-typescript-phase4-know]] via
topic 11 — do not re-derive:** the diagnostic *"A mixin class that extends from a
type variable containing an abstract construct signature must also be declared
'abstract'."*, and the `Ctor<T> = new (...args: any[]) => T` helper with the ⚠️
**`any[]` not `never[]`** reasoning (a construct signature you intend to *call*
needs parameters you can pass). Both are exactly what topic 14 is built on.

⚠️ **At the phase close, run
`grep -rn "not written yet" docs/typescript/pages/phase-4-*/`** — plain-text
forward references are invisible to a link check, and phase 3 accumulated twelve
of them.

Session narrative, the rule-1 violation and the cross-session traps:
[[devbible-session-20260815-typescript-part-a]].

## Children — open only when you need them

| File | Open it when |
|---|---|
| [[devbible-typescript-phase3]] | Writing or reviewing a phase-3 page, or at the phase close — every claim banked so far, with its source |
| [[devbible-typescript-history]] | Auditing a finished phase (0, 1, 2), tracing where an old claim came from, or making sense of a superseded session or a branch in the reflog |
| [[devbible-typescript-phase0]] · [[devbible-typescript-phase1]] · [[devbible-typescript-phase2]] | The measured datasets behind those phases |
| [[devbible-typescript-syllabus]] | The 13-phase / 187-topic plan and how it was scoped |
| [[devbible-typescript-split-parts-ab]] | The Part A/B boundary and the shared-board ownership rules |

Related: [[devbible-never-compress-to-fit-cap]] ·
[[devbible-verify-your-own-measurements]] · [[devbible-memory-file-cap]] ·
[[devbible-no-new-sandbox-scripts]]
