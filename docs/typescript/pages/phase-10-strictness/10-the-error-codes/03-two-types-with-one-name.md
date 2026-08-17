---
title: "Two types with one name, and the wrong fix"
sidebar_label: "03 · One name, two types"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **numbered diagnostic table** in the **TypeScript
> 5.9.3** build — `TS2719`, `TS2820`, `TS2352`, `TS2739`, `TS2740`, `TS2741`,
> `TS2559`, `TS2560`, `TS2728` — each template quoted verbatim from that table.
> The `as unknown as` guidance is quoted from `TS2352`'s **own message text**, not
> from a style guide. Weak-type detection was **measured in phase 1** and is cited
> from there rather than re-derived. **No sandbox, no console block.**

Three assignability failures whose first line actively misleads you, and then the
fix everybody reaches for and should not.

> **The three worst first lines in TypeScript**, in order of how much time they
> waste: `Type 'X' is not assignable to type 'X'`; a missing-property list you
> deliberately left out; and an obvious typo with no suggestion attached. All
> three have a **second line or a mechanical reason** that settles them
> immediately, and all three are commonly "fixed" with an assertion that hides a
> real defect.

## 🔴 `TS2719` — when both types have the same name

```text
Type 'Request' is not assignable to type 'Request'.
  Two different types with this name exist, but they are unrelated.
```

The second line is `TS2719`, and it exists precisely because the first line is
unreadable. It means **two copies of the same declaration are in the program**.
Almost always one of:

- **two versions of a `@types/*` package** — one hoisted to the root
  `node_modules`, one nested under a dependency
- **a package installed twice** at different versions, each bringing its own
  types
- **a monorepo** where two workspaces resolved different copies of the same
  package
- **a global type and an imported one** sharing a name — `Request` from
  `lib.dom.d.ts` versus Express's `Request` is the canonical case
- **two `declare global` blocks** in different packages augmenting the same
  interface with incompatible shapes

**Nothing about your code is wrong.** The fix is in the dependency tree:

```bash
npm ls @types/express        # or:  yarn why @types/express
```

Then deduplicate, pin the version, add a `resolutions`/`overrides` entry, or —
last resort — point a `paths` alias at the copy you want to win.

⚠️ **This is the single most misdiagnosed assignability error**, because the first
line invites you to stare at a type that is identical to itself and conclude the
compiler is broken. 🔴 **The rule: if the two type names in a `TS2322` are the
same string, stop reading types and go read your lockfile.**

📌 **The `dom`-versus-Node collision is the version of this you will meet most.**
When `lib` includes `dom`, globals like `Request`, `Response`, `Headers`,
`FormData` and `Event` exist twice — once from the DOM and once from whatever
server framework or Node type package you installed. It is worth *never* naming
a local type `Request` or `Response` for this reason alone.

## 🔴 `TS2820` — the spelling suggestion, on a union of literals

```text
Type '"activ"' is not assignable to type '"active" | "inactive" | "pending"'.
  Did you mean '"active"'?
```

That second clause is its own template, `TS2820` — *"Type '{0}' is not assignable
to type '{1}'. Did you mean '{2}'?"* — and it is the **same similarity machinery**
that produces `TS2551` for property names.
[Chunk 08](./08-the-spelling-budget.md) has the exact edit-distance budget.

It matters most here because **string-literal unions are where typos are both
most likely and least visible**: a status, a variant, an event name, a
feature-flag key. The value looks like data, so nobody proofreads it.

📌 **And when you do *not* get the suggestion on an obvious typo, the reason is
mechanical rather than arbitrary** — the edit distance fell outside a budget that
scales with the name's length. A one-character slip in a two-character literal
can never produce a suggestion.

⚠️ **The suggestion is not always the answer.** `TS2820` reports the *closest*
member, and on a union of similar names — `"draft" | "drafts"`, `"user" |
"users"` — the closest is a coin flip. Read the union, not the suggestion.

## The missing-property family, and why the count is the diagnosis

| Code | Template | Almost always means |
|---|---|---|
| `TS2741` | `Property '{0}' is missing in type '{1}' but required in type '{2}'.` | **one** field — a rename, or a required field you thought was optional |
| `TS2739` | `Type '{0}' is missing the following properties from type '{1}': {2}` | **several, all named** — a partially built object |
| `TS2740` | `Type '{0}' is missing the following properties from type '{1}': {2}, and {3} more.` | **many** — the wrong object entirely |
| `TS2559` | `Type '{0}' has no properties in common with type '{1}'.` | **nothing matched** — wrong argument, or wrong argument *order* |
| `TS2560` | `Value of type '{0}' has no properties in common with type '{1}'. Did you mean to call it?` | you passed the **function** instead of its result |

🔴 **Read the count before you read the types.** One missing property is a small
mistake inside the right object. *"And 14 more"* is not a mistake inside an
object, it is the wrong object — usually the wrong variable name, or a response
wrapper passed instead of its `.data`. `TS2559` is most often two arguments
swapped, and checking the call's argument order takes five seconds where reading
the type takes a minute.

📌 **`TS2739` and `TS2740` differ only in whether the list was truncated**, so
seeing `and {3} more` is itself a signal about magnitude. Four missing properties
prints them all; fifteen does not.

⚠️ **`TS2559` is also weak-type detection**, which is a *different* rule with a
different reach — it applies to variables, not only to fresh literals. Its exact
limit was **measured in phase 1**, and where it sits among the three overlapping
object-shape rules is settled in
[topic 09](../09-excess-property-checks/03-the-second-and-third-rules.md). Do not
re-derive it; that page owns it.

📌 **`TS2728` — *"'{0}' is declared here."*** is a `Message`-category line the
compiler attaches as **related information** to several of these. In an editor it
is a clickable jump to the declaration; in `tsc` output it is an extra line with a
different file and position. It is the fastest route from a missing-property error
to the interface that demanded the property.

## The wrong fix, and the compiler's own opinion of it

The fix that appears in every hurried pull request:

```ts
const user: User = apiResponse as User;        // silences TS2322
```

This fixes nothing. It asserts that the mismatch the compiler *just proved* does
not exist; the runtime shape is unchanged, and the first `user.postcode.trim()`
will still throw. It is tier 2 on
[topic 08's suppression ladder](../08-suppression-directives/03-the-suppression-tiers.md),
and it is the thing **12 · Assertion discipline** *(not written yet)* exists to
count.

🔴 **The compiler has a code for noticing you are doing this, and its message
contains the workaround it wants to make you type:**

| Code | Template |
|---|---|
| `TS2352` | `Conversion of type '{0}' to type '{1}' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.` |

So when the two types are far enough apart, a single `as` is **refused** and you
must write `as unknown as User`. **That is deliberate friction, not an
obstacle**, and the design is cleverer than it looks:

- the double assertion is **longer and uglier**, so it does not slip through
  review unnoticed;
- more importantly it is **greppable**. A team can ban `as unknown as` in CI and
  mean it, in a way it can never ban `as`.

⚠️ **The asymmetry is worth knowing:** the *closer* your two types are, the
*less* friction you get. `as` is accepted silently when the types partially
overlap — which is exactly when a mistake is most plausible. `TS2352` only fires
in the blatant cases. **So the absence of `TS2352` is not evidence the assertion
is safe.**

### The genuine fixes, in order of preference

1. **Correct the type.** If `User` says `postcode: string` and the API sends a
   number, one of the two is wrong. Find out which — this is a five-minute
   question with a permanent answer.
2. **Parse at the boundary.** An API response is `unknown` until validated. This
   is [phase 7's argument about `process.env`](../../phase-7-server/03-typing-process-env/03-why-parsing-wins.md)
   and it generalises to every input: the assertion you were about to write is a
   claim about data you have not looked at.
3. **Narrow with a guard.** A `user is User` predicate puts the check in one
   reviewable place, and the compiler holds the predicate to the shape it claims.
4. **Widen the target.** Sometimes `postcode: string | number` is simply the
   truth about the system you are integrating with, and pretending otherwise
   moves the bug rather than fixing it.
5. **`as`, with a comment saying what the compiler cannot know.** Last, and
   rarely — and if the comment cannot be written, the assertion is a guess.

## Gotchas

**Symptom:** `Type 'X' is not assignable to type 'X'` — the same name twice.
**Cause:** `TS2719`. Two copies of the declaration are in the program.
**Fix:** `npm ls`/`yarn why`, then deduplicate. Do not touch the types.

**Symptom:** the `TS2719` appears only in CI, never locally.
**Cause:** a different lockfile resolution, or a fresh install hoisting
differently.
**Fix:** commit the lockfile and install with `npm ci`/`yarn --immutable`. This
error is a dependency-tree error, so it follows dependency-tree causes.

**Symptom:** `Request` or `Response` behaves as though it has the wrong shape.
**Cause:** `lib` includes `dom`, so the DOM globals collide with your framework's
types of the same name.
**Fix:** import the framework's type explicitly and alias it, or drop `dom` from
`lib` on a server project.

**Symptom:** `TS2739` listing properties you deliberately left out.
**Cause:** they are required in the target type.
**Fix:** `Partial<T>` if the object is genuinely partial, `Pick<T, …>` for a
subset, or make them optional in the interface if that is the truth. Not `as`.

**Symptom:** a suggestion that is confidently the wrong member of a union.
**Cause:** `TS2820` reports the closest by edit distance, and near-identical
members make that a coin flip.
**Fix:** read the union. The suggestion is a hint, not an answer.

**Symptom:** `TS2352` refusing an `as` you are certain about.
**Cause:** the two types do not overlap at all, so the compiler suspects a
mistake.
**Fix:** `as unknown as T` if you are genuinely certain — and treat having to type
it as the review comment it was designed to be.

**Symptom:** an `as` that the compiler accepts without complaint, on types that
are clearly different.
**Cause:** they overlap *partially*, which is below `TS2352`'s threshold.
**Fix:** nothing to fix mechanically — but do not read the silence as approval.
The absence of `TS2352` says the types are similar, not that the assertion is
correct.

**Symptom:** `TS2559` — *"no properties in common"* — on a call you are sure
about.
**Cause:** two arguments in the wrong order, most of the time.
**Fix:** check the argument order before the types.

**Symptom:** *"Did you mean to call it?"* attached to a no-properties-in-common
error.
**Cause:** `TS2560`. You passed the function rather than its result — a missing
`()`.
**Fix:** call it. See [chunk 05](./05-callable-or-not.md) for the rest of
that family.

## Interview questions

**You get `Type 'Request' is not assignable to type 'Request'`. What do you do?**
Read the second line — `TS2719`, *"Two different types with this name exist, but
they are unrelated"* — and then go look at the dependency tree rather than the
code. Two copies of the same declaration are in the program: two `@types`
versions, a package installed twice, a monorepo resolving two copies, or a DOM
global colliding with a framework type. `npm ls` or `yarn why` finds it and
deduplication fixes it. Nothing in your source needs to change.

**How do you tell a small mistake from the wrong object entirely, without reading
the types?**
Count the missing properties. `TS2741` names one — a rename or a forgotten
required field. `TS2739` names several. `TS2740` says *"and N more"*, which means
you passed something unrelated. `TS2559` says nothing matched at all, which is
most often two arguments in the wrong order. The count is a faster diagnosis than
the types.

**Why does TypeScript sometimes refuse a plain `as`?**
`TS2352` fires when the two types do not sufficiently overlap, and its own message
tells you to convert to `unknown` first. The double assertion is intentional
friction: it is longer to write and, more usefully, greppable, so a team can have
a real policy about `as unknown as` in a way it cannot about `as`. Note the
asymmetry — the check only fires in blatant cases, so a plain `as` being accepted
is not evidence that it is safe.

**Someone silences a `TS2322` with `as`. What is your review comment?**
That the assertion changes nothing at runtime — the shapes still differ, and the
compiler has merely been told to stop mentioning it. Then ask which of the two
types is wrong, because one of them is. If the answer is "the data is
untrustworthy", the fix is validation at the boundary, which converts an
unprovable claim into a checked one in a single place.

**When is a `Did you mean` suggestion worth ignoring?**
When the union members are near-identical — `"draft"`/`"drafts"`,
`"user"`/`"users"` — because the suggestion is chosen by edit distance and has no
idea what you meant. And when it is absent: its absence means the edit distance
exceeded a length-scaled budget, not that your value is close to nothing.

---

← [02 · The shape is wrong](./02-the-shape-is-wrong.md) · [Topic index](./README.md) · Next → [04 · The call-site family](./04-the-call-site-family.md)
