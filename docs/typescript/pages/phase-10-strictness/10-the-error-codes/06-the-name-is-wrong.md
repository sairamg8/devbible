---
title: "TS2339 is the last resort — the property-lookup ladder"
sidebar_label: "06 · The name is wrong"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **reading the checker function that produces these
> errors** — `reportNonexistentProperty` in the **TypeScript 5.9.3** build
> (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`, around line 79902)
> — so the order below is the compiler's own control flow, not an inference from
> observed behaviour. Codes and templates read from the numbered table in the same
> file: `TS2339`, `TS2551`, `TS2550`, `TS2568`, `TS2576`, `TS2728`, `TS2773`,
> `TS2812`, `TS18031`, `TS18032`. **No sandbox, no console block** — this is a
> file read.

`TS2339` — *"Property '{0}' does not exist on type '{1}'."* — is the error
everybody has seen a thousand times, and almost nobody knows what it actually
means.

> 🔴 **`TS2339` in its bare form is the LAST branch of a seven-step ladder.** The
> compiler tries six more specific, more actionable diagnoses first. So a bare
> `TS2339` is not "the property is missing" — it is **"the property is missing and
> none of the six things that usually explain that are true."** That is a much
> stronger statement, and it changes what you should look at.

## The ladder, in the compiler's own order

`reportNonexistentProperty` runs these checks in sequence and stops at the first
that applies:

| # | Condition | What you get instead |
|---|---|---|
| 0 | already reported for this node and type | 🔴 **nothing** — results are cached per `(node, typeId, isUncheckedJS)` |
| 1 | the containing type is a **non-primitive union** | a `TS2339` **prefix naming the first union member that lacks it** |
| 2 | the property exists as a **`static`** member | `TS2576` *"…Did you mean to access the static member '{2}' instead?"* |
| 3 | the containing type is a **`Promise`** whose awaited type has the property | plain `TS2339` **plus `TS2773`** *"Did you forget to use 'await'?"* as related information |
| 4 | the property exists in a **later library slice** | `TS2550` *"…Do you need to change your target library? Try changing the 'lib' compiler option to '{2}' or later."* |
| 5 | a **similar name** exists on the type | `TS2551` *"…Did you mean '{2}'?"*, plus `TS2728` *"'{0}' is declared here."* |
| 6 | the type looks like an **empty DOM element** and `lib` omits `dom` | `TS2812` *"…Try changing the 'lib' compiler option to include 'dom'."* |
| 7 | none of the above | **bare `TS2339`** — with a `never`-intersection explanation prepended if applicable |

📌 **Read the ladder backwards to use it.** Each rung you *did not* get is
information. Bare `TS2339` means: not a static member, not a missing `await`, not
a `lib` gap, not a typo the compiler could recognise, not a missing DOM lib. What
is left is genuinely "this type does not have this property" — so the honest next
question is *whether the type is right*, not where the property went.

## 🔴 Step 3 — a missing `await` is one of the top causes of `TS2339`

```ts
const user = getUser();          // returns Promise<User>
console.log(user.name);          // TS2339 + TS2773
```

The message says *"Property 'name' does not exist on type 'Promise<User>'"*, and
underneath it — as a **related-information line, in a `Message` category** — sits
*"Did you forget to use 'await'?"*.

**The compiler checked.** It resolved the promised type, found `name` on it, and
attached the hint. This is not a guess.

⚠️ **The hint is easy to lose**, because related information prints as a separate
line with its own file and position, and many CI log formats and error-summary
tools drop it entirely. 🔴 **So the practical rule: if a `TS2339` names a type
starting with `Promise<`, the answer is `await`, and you do not need to read
anything else.**

📌 This is the same `errorAndMaybeSuggestAwait` machinery that attaches to
`TS2367` — see [chunk 11](./11-the-condition-is-decided.md). A forgotten `await`
is the single most-diagnosed mistake in the checker, appearing under at least
three unrelated codes.

## 🔴 Step 4 — `TS2550` means your `lib` is behind, not your code

```text
Property 'at' does not exist on type 'string[]'.
Do you need to change your target library?
Try changing the 'lib' compiler option to 'es2022' or later.
```

**The compiler knows which library slice declares the property and names it.**
Nothing about your code is wrong; the type just does not include the method
because you pinned `lib` below it.

⚠️ **This phase has already hit a case where step 4 does *not* fire and should
have.** Part B's phase 7 work found that `Error.isError` is declared in
`lib.esnext.error.d.ts`, reachable only from `lib.esnext.d.ts` — so the
`lib: ["es2024"]` this phase's own
[topic 01](../01-strict-flag-by-flag/README.md) recommends excludes it, and the
fix is to name the slice: `"lib": ["es2024", "esnext.error"]`. That is recorded in
[phase 7 · `target`, `lib` and types](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md).

🔴 **The general rule that follows: a pinned `lib` is conservative, and every new
standard-library method lands in an `esnext.*` slice before it lands in a
numbered year.** So `TS2339` on a brand-new method is a `lib` question first and
always.

## 🔴 Step 1 — on a union, the error names a type you never wrote

If the containing type is a union, the compiler finds **the first member that
lacks the property** and prefixes a `TS2339` naming *that member*:

```ts
type Shape = { kind: "circle"; r: number } | { kind: "square"; side: number };

declare const s: Shape;
s.r;      // names the SQUARE member, not Shape
```

**This is the answer to "why does my error mention a type I never referenced?"**
It is telling you which branch of the union is the problem — which is genuinely
what you need — but it reads as though the compiler picked a type at random.

📌 **And it names only the first failing member.** If three of five members lack
the property, you fix one and the next appears. That is not a regression; it is
the loop working.

**The fix is a discriminant check, not an assertion:**

```ts
if (s.kind === "circle") s.r;         // narrowed — legal
```

## Step 6 — the DOM check is a regex on the type's *name*

The most quietly specific rung on the ladder. `TS2812` fires only when **all** of
these hold:

- `lib` is explicitly set and does **not** include `lib.dom.d.ts`
- every contained type's symbol name matches
  `/^(?:EventTarget|Node|(?:HTML[a-zA-Z]*)?Element)$/`
- the type is an **empty object type**

So the compiler is pattern-matching on the *string of the type name* to guess you
meant the DOM. It is a heuristic, openly, and it exists because "my `HTMLElement`
has no properties" is otherwise an inexplicable error on a server-side project
that happens to import shared code.

📌 **Worth knowing precisely because of how narrow it is:** if your DOM-ish type
is named anything else — `SVGElement`, a custom wrapper — you get bare `TS2339`
for exactly the same underlying cause, with no hint at all.

## Step 7's extra — when the type became `never`

The fallback prepends an explanation if the type is a `never` produced by an
impossible intersection:

| Code | Template |
|---|---|
| `TS18031` | `The intersection '{0}' was reduced to 'never' because property '{1}' has conflicting types in some constituents.` |
| `TS18032` | `The intersection '{0}' was reduced to 'never' because property '{1}' exists in multiple constituents and is private in some.` |

🔴 **This is the explanation for the baffling *"Property 'x' does not exist on type
'never'"*.** Your intersection collapsed — usually `{ a: string } & { a: number }`
somewhere upstream, often through a generic constraint — and every property lookup
on it now fails. **The bug is where the intersection was formed**, not where you
read the property.

## Two more things the ladder does that you should rely on

**Results are cached, so the count is not the count.** Step 0 caches per node and
type, so one property access reports once even though the checker may visit it
several times. 📌 **Corollary: the number of `TS2339`s in your output is a count of
*sites*, not of checker passes** — a useful thing to know when a strictness
migration's error count moves in ways that look impossible.

**In a JavaScript file it is a Suggestion, not an error.** Under `allowJs` without
`checkJs`, step 5 uses `TS2568` — *"Property '{0}' **may** not exist on type
'{1}'. Did you mean '{2}'?"* — and it is reported at **Suggestion** category, so it
greys out in an editor and never fails a build. The hedged wording ("may not") is
deliberate: in unchecked JS the compiler's type is a guess.

## Gotchas

**Symptom:** `TS2339` on a type whose name starts with `Promise<`.
**Cause:** a missing `await`. The `TS2773` hint is attached but printed as a
separate line.
**Fix:** `await`. Do not read the rest of the error.

**Symptom:** the `TS2773` hint never appears in your CI logs.
**Cause:** related information is a separate diagnostic with its own position, and
many log formatters drop it.
**Fix:** rely on the `Promise<` in the type name instead. Or check the error in an
editor, where related information is a clickable line.

**Symptom:** the error names a union member you never referenced.
**Cause:** step 1 — the compiler names the **first** member lacking the property.
**Fix:** narrow with a discriminant. Expect a second error naming the next
failing member; that is progress.

**Symptom:** *"Property 'x' does not exist on type 'never'"*.
**Cause:** an intersection collapsed to `never` upstream. `TS18031`/`TS18032`
explain which property caused it.
**Fix:** go find where the intersection is formed. Nothing at the read site can
help.

**Symptom:** a brand-new standard-library method does not exist.
**Cause:** `lib` is pinned below the slice that declares it.
**Fix:** read `TS2550` — it names the slice. And if you get **bare** `TS2339`
instead, check whether the method lives in an `esnext.*` slice, which the
year-numbered libs do not include.

**Symptom:** `instance.method()` fails, where `method` obviously exists on the
class.
**Cause:** `TS2576` — it is `static`. Call it on the class.
**Fix:** `MyClass.method()`.

**Symptom:** a typo produces no suggestion at all.
**Cause:** the edit-distance budget scales with the property's length.
[Chunk 08](./08-the-spelling-budget.md) has the exact numbers.
**Fix:** none mechanically — but longer, more distinctive property names make the
compiler measurably more helpful.

**Symptom:** the same property error in a `.js` file greys out instead of failing.
**Cause:** `TS2568`, Suggestion category, because `checkJs` is off.
**Fix:** `checkJs`, or `// @ts-check` at the top of that file.

**Symptom:** bare `TS2339` and you are certain the property exists at runtime.
**Cause:** the ladder has ruled out every cause it knows, so the *type* is wrong —
a stale `.d.ts`, an interface that was never updated, or a value whose declared
type is narrower than the thing you actually have.
**Fix:** fix the type, or validate at the boundary. This is the one case where the
answer is genuinely "the declaration is out of date", and an assertion here hides
that permanently.

## Interview questions

**What does a bare `TS2339` actually tell you?**
More than it looks like. It is the last branch of a seven-step ladder in
`reportNonexistentProperty`, so by the time you see the unadorned message the
compiler has already ruled out a static member, a missing `await`, a `lib` that is
too old, a recognisable typo, and a missing DOM library. What remains is that the
type genuinely lacks the property — which makes the right question "is this type
correct?" rather than "where did the property go?".

**You get `Property 'name' does not exist on type 'Promise<User>'`. What is the
compiler doing?**
It resolved the promised type, found `name` on it, and attached `TS2773` — *"Did
you forget to use 'await'?"* — as related information. That is a verified
diagnosis, not a guess. The practical shortcut is that any `TS2339` naming a
`Promise<…>` type is a missing `await`, and the hint is worth knowing about
because CI log formats frequently drop related-information lines.

**Why does a property error sometimes name a type you never wrote?**
Because on a union the compiler names the first member that lacks the property,
not the union itself. That is the information you need — it identifies the
failing branch — but it reads as arbitrary. The fix is narrowing with a
discriminant, and you should expect a second error naming the next failing member
afterwards.

**What does `Property 'x' does not exist on type 'never'` mean?**
That an intersection somewhere upstream collapsed to `never`, usually because two
constituents declared the same property with conflicting types, or because one
declared it private. `TS18031` and `TS18032` say which property caused it. The bug
is at the point the intersection is formed; nothing you do at the read site will
help.

**A new array or string method does not exist on your type. What do you check
first?**
`lib`. `TS2550` names the exact library slice that declares it. And if you get a
bare `TS2339` with no hint, check whether the method is only in an `esnext.*`
slice — a year-numbered `lib` like `es2024` deliberately excludes those, which is
how `Error.isError` ends up missing on a runtime that has it.

**Why do property errors behave differently in `.js` files?**
Under `allowJs` without `checkJs` the spelling branch reports `TS2568` — *"may not
exist"* — at Suggestion category, so it greys out in the editor and never fails
the build. The hedged wording is deliberate: without checking enabled, the
compiler's inferred type for a JavaScript value is a guess, and it says so.

---

← [05 · Callable or not](./05-callable-or-not.md) · [Topic index](./README.md) · Next → [07 · Cannot find name](./07-cannot-find-name.md)
