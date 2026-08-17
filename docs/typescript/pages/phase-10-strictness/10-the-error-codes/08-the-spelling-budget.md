---
title: "The spelling budget — why some typos get help and others do not"
sidebar_label: "08 · The spelling budget"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **reading the two functions that decide every "Did you
> mean" in TypeScript** — `getSpellingSuggestion` (line 3489) and
> `levenshteinWithMax` (line 3513) in the **TypeScript 5.9.3** build
> (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`). ⚠️ **The tables of
> worked cases below were computed by evaluating those two functions exactly as
> written** — arithmetic on a pure function whose source is quoted here — **not by
> running `tsc`.** There is no console block on this page and no compiler was
> invoked; the numbers are derivations, and are labelled as such wherever they
> appear.

Four codes in this topic depend on one function, and it behaves nothing like the
edit distance you would assume.

| Code | Where |
|---|---|
| `TS2551` | a property name — [chunk 06](./06-the-name-is-wrong.md) |
| `TS2552` | an identifier — [chunk 07](./07-cannot-find-name.md) |
| `TS2724` | an imported member — *"'{0}' has no exported member named '{1}'. Did you mean '{2}'?"* |
| `TS2820` | a string-literal union member — [chunk 03](./03-two-types-with-one-name.md) |
| `TS2561` | an excess property — [topic 09](../09-excess-property-checks/01-freshness.md) |

> 🔴 **A missing suggestion is not the compiler declining to help. It is a
> measurement coming out over budget.** And the budget scales with the length of
> the name you typed — so **the same typo gets a suggestion on a long name and
> silence on a short one.**

## The gate: two filters and a threshold

From `getSpellingSuggestion`, in order:

```js
const maximumLengthDifference = Math.max(2, Math.floor(name.length * 0.34));
let bestDistance = Math.floor(name.length * 0.4) + 1;
```

1. **Length filter.** A candidate whose length differs from yours by more than
   `max(2, floor(len × 0.34))` is never even measured.
2. **Short-candidate rule.** A candidate shorter than **3 characters** is skipped
   *unless* it matches yours case-insensitively. So `id` → `Id` is possible;
   `id` → `at` never is.
3. **Threshold.** The distance must come out **strictly below**
   `floor(len × 0.4) + 1`. Each better candidate lowers the bar, so the search
   converges on the closest.

| Your name's length | Distance must be under | Length filter |
|---|---|---|
| 1–2 | **1** | ±2 |
| 3–4 | 2 | ±2 |
| 5–7 | 3 | ±2 |
| 8–9 | 4 | ±2 |
| 10–12 | 5 | ±3 to ±4 |
| 15 | 7 | ±5 |
| 20 | 9 | ±6 |

## 🔴 The distance is weighted, and a substitution costs **2**

This is the part that makes everything else counter-intuitive. From
`levenshteinWithMax`:

| Edit | Cost |
|---|---|
| characters identical | **0** |
| 🔴 **case differs only** (`d` vs `D`) | **0.1** |
| insert a character | 1 |
| delete a character | 1 |
| 🔴 **substitute a different character** | **2** |

Two consequences that explain nearly every "why did I not get a suggestion":

- **A wrong case is almost free.** `userid` → `userId` measures **0.1**, which is
  under every budget including a two-character name's. **Casing typos always get
  a suggestion.**
- **A wrong *letter* costs 2 — the same as deleting and re-inserting.** So
  substitution is never the cheap path, and a single mistyped character is
  effectively **two** edits.

### 🔴 The cliff is at five characters

Because a substitution costs 2 and a transposition is a delete plus an insert
(also 2), both need a budget of at least 3 — which starts at length 5:

| The typo you made | Costs | Shortest name that still gets a suggestion |
|---|---|---|
| wrong case, any number of letters | 0.1 each | 🔴 **1** — effectively always |
| one letter **missing** | 1 | **3** |
| one letter **extra** | 1 | **3** |
| two letters **transposed** | 2 | 🔴 **5** |
| one letter **wrong** | 2 | 🔴 **5** |
| two letters missing or extra | 2 | **5** |
| three letters missing | 3 | **8** |
| two letters wrong | 4 | **10** |

⚠️ **So `obj.nmae` for `name` gets no suggestion at all.** Four characters, a
transposition, cost 2, budget under 2. The most stereotypical typo in programming
is out of budget on the most stereotypical property name.

**Worked cases, computed from the algorithm as quoted above — not from a `tsc`
run:**

| You typed | Target | Distance | Suggested? |
|---|---|---|---|
| `nmae` | `name` | 2 | 🔴 **no** — budget is under 2 |
| `naem` | `name` | 2 | 🔴 **no** |
| `nam` | `name` | 1 | yes |
| `namee` | `name` | 1 | yes |
| `Name` | `name` | 0.1 | yes |
| `postCode` | `postcode` | 0.1 | yes |
| `userid` | `userId` | 0.1 | yes |
| `USERID` | `userId` | 0.5 | yes |
| `lenght` | `length` | 2 | yes — six characters clears it |
| `recieve` | `receive` | 2 | yes |
| `widht` | `width` | 2 | yes |
| `chidlren` | `children` | 2 | yes |
| `adress` | `address` | 1 | yes |
| `descrption` | `description` | 1 | yes |
| `clientX` | `clientY` | 2 | yes |
| `activ` | `active` | 1 | yes |
| `actiev` | `active` | 2 | yes |
| `id` | `Id` | 0.1 | yes |
| `id` | `ids` | — | 🔴 **no** — budget is under 1 |

📌 **Read the two `name` rows together.** `nam` and `namee` are helped; `nmae` and
`naem` are not. The difference is not how wrong they look — it is that a missing
or extra letter costs 1 and a swap costs 2.

## Only one suggestion, and ties go to declaration order

`getSpellingSuggestion` returns a single `bestCandidate`. Once a candidate is
found at distance *d*, the next candidate is measured with a maximum of
`d - 0.1` — so **an equally close candidate is rejected**.

🔴 **That means ties are broken by iteration order, which is the order the
properties were declared.** Two equally plausible near-matches, and you get
whichever appears first in the interface.

⚠️ **This is why a suggestion is sometimes confidently wrong.** On
`"draft" | "drafts"` or `{ userId, userIds }` the compiler is not choosing between
meanings; it stopped at the first thing that measured well enough. **Read the
target type, not the suggestion.**

## 🔴 The design conclusion: identifier length buys compiler help

This is the practical payoff, and it is quantified rather than aesthetic:

| Name | Length | What the compiler can catch |
|---|---|---|
| `id` | 2 | 🔴 **only a case error.** Nothing else, ever |
| `name` | 4 | a missing or extra letter. **Not** a swap, **not** a wrong letter |
| `userId` | 6 | swaps, wrong letters, two missing letters |
| `createdAt` | 9 | the above plus three missing letters |
| `currentUserId` | 13 | up to five units — two wrong letters *and* a case change |

**Short names are not just less readable; they are outside the range where the
compiler can guess what you meant.** That is a real argument for
`userId` over `id` and `elementCount` over `n`, and it is the only one in this
corpus with a formula behind it.

📌 **The same reasoning applies to string-literal unions**, which is where
`TS2820` lives. `"a" | "b"` gets you nothing; `"active" | "archived"` gets you
suggestions on swaps and wrong letters. **Name your statuses in words.**

## Gotchas

**Symptom:** an obvious transposition — `nmae`, `naem`, `flie` — gets no
suggestion.
**Cause:** a swap costs 2 and short names have a budget under 2.
**Fix:** nothing mechanical. Recognise that the *absence* of a suggestion carries
no information about how close you were.

**Symptom:** a casing mistake always gets a suggestion, even on tiny names.
**Cause:** a case-only substitution costs 0.1, under every budget.
**Fix:** nothing to fix — but it is worth knowing, because it means "no suggestion"
rules out a casing error and nothing else.

**Symptom:** the suggestion names the wrong member of two similar ones.
**Cause:** ties are broken by declaration order, not by plausibility.
**Fix:** read the type. And where two members differ by one character, consider
whether that is a good API.

**Symptom:** a suggestion appears for a property on one type and not on an
identically-named property of another.
**Cause:** the length filter — the *candidate* list differs, and a candidate whose
length differs by more than `max(2, floor(len × 0.34))` is never measured.
**Fix:** none. The suggestion depends on what else is in scope.

**Symptom:** you rename a variable and previously-helpful errors stop being
helpful.
**Cause:** you shortened it below the cliff. `elementCount` → `n` moves you from a
budget of 5 to a budget of under 1.
**Fix:** treat this as one more reason not to shorten identifiers.

**Symptom:** two suggestions would both be reasonable, and you want to see both.
**Cause:** the function returns exactly one candidate by construction.
**Fix:** there is no compiler setting for this. Hover the type, or use
autocomplete, which does not go through this function.

**Symptom:** a one-character property like `x` or `y` never gets suggested for
anything.
**Cause:** the short-candidate rule skips candidates under 3 characters unless
they match case-insensitively.
**Fix:** none — and note this cuts both ways: `clientX` → `clientY` *is* suggested,
because the *names* are long even though the differing character is one letter.

## Interview questions

**Why does TypeScript suggest a correction for some typos and not others?**
Because the suggestion is a measurement against a budget that scales with the
length of the name you typed: the edit distance must come in under
`floor(len × 0.4) + 1`. A missing or extra letter costs 1, a wrong letter or a
transposition costs 2, and a case difference costs 0.1. So a swap needs a name of
at least five characters, which is why `nmae` for `name` gets nothing while
`lenght` for `length` gets a suggestion.

**What is unusual about the edit distance TypeScript uses?**
It is weighted rather than uniform. Insertion and deletion cost 1, but
**substitution costs 2**, and a case-only substitution costs **0.1**. So a
mistyped letter is treated as two edits — never cheaper than deleting and
re-inserting — and a casing error is effectively free, which is why casing
mistakes always produce a suggestion regardless of name length.

**You get `TS2339` with no "did you mean" on what is obviously a typo. What does
that tell you?**
Almost nothing about how close you were. It tells you the distance came out at or
above the budget for that name's length — which, for a four-character name, a
single transposition already does. The absence of a suggestion is not evidence
that the property is unrelated to anything on the type.

**Why is a "did you mean" suggestion sometimes confidently wrong?**
Because the function returns one candidate and ties are broken by iteration order,
which is declaration order. Once something is found at distance *d*, later
candidates are measured against `d - 0.1`, so an equally close alternative is
rejected outright. On a type with two similar member names you get whichever was
declared first.

**Is there a type-system argument for longer identifier names?**
Yes, and it is the only one with a formula. The suggestion budget is
`floor(len × 0.4) + 1`, so `id` at two characters can only ever be matched on a
case difference, `name` at four cannot be matched through a transposition or a
wrong letter, and `currentUserId` at thirteen tolerates two wrong letters plus a
case change. Short names sit outside the range where the compiler can work out
what you meant. The same applies to string-literal union members, which is an
argument for spelling out statuses rather than abbreviating them.

**Which codes does this one function drive?**
`TS2551` for properties, `TS2552` for identifiers, `TS2724` for imported members,
`TS2820` for string-literal union members, and `TS2561` for an excess property in
an object literal. They are five different errors with one shared mechanism, so
the same length cliff applies to all of them.

---

← [07 · Cannot find name](./07-cannot-find-name.md) · [Topic index](./README.md) · Next → [09 · The index codes](./09-the-index-codes.md)
