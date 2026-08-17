---
title: "Three designs, one mistake"
sidebar_label: "02 · Three designs, one mistake"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. `TS2345`, `TS2769`, `TS2770` and `TS2772` — with their exact
> `{0}` placeholder text — were read out of the **compiler's own numbered
> diagnostic table** (**TypeScript 5.9.3**, `sandbox/ts-p0`) and each string was
> confirmed present in the installed **TypeScript 7.0.2** native compiler rather
> than recalled. **No sandbox, no console block** — the multi-line error shapes
> below are **assembled from the quoted message templates**, restated where they
> appear, and the compiler's exact indentation of related information is not
> reproduced.

[Chunk 01](./01-the-error-is-the-interface.md) established that failures print
types, not programs. This is the demonstration: **one mistake, three designs, three
completely different experiences for the person who made it.**

The API is a `parse` that returns a `Date` for `"date"` and a `number` for
`"number"`, and must reject anything else. The mistake is a typo — `"dat"`.

## Version A — one conditional type, unconstrained

```ts
type ParseResult<K> =
  K extends "date" ? Date :
  K extends "number" ? number :
  never;

declare function parse<K extends string>(kind: K, raw: string): ParseResult<K>;

const bad = parse("dat", "2026-08-17");
//    ^? const bad: never
```

The call **compiles**. `"dat"` satisfies `K extends string`, the conditional falls
through to `never`, and the mistake becomes a variable of type `never` that fails
somewhere else entirely — a file away, in code that did nothing wrong. **There is no
diagnostic at the typo at all.**

⚠️ **This is the worst outcome in the topic and also the default one.** Nobody
chooses it; it is what you get from writing the obvious conditional with a `never`
fallback. The type is *correct* — `"dat"` really is not a valid kind, and `never`
really is the honest answer — and it is still the least useful of the three.

📌 **Why `never` in particular is so bad here:** it is assignable to everything, so
it does not fail at the assignment that created it. It fails at the first place
somebody tries to *use* the value, which is arbitrarily far from the mistake and
usually in code with no relationship to the typo.

## Version B — the same conditional, with the input constrained

```ts
type Kind = "date" | "number";
type ParseResult<K extends Kind> = K extends "date" ? Date : number;

declare function parse<K extends Kind>(kind: K, raw: string): ParseResult<K>;

// parse("dat", "2026-08-17");
// ❌ TS2345: Argument of type '"dat"' is not assignable to parameter of type 'Kind'.
```

One line of change, and the failure moved from *somewhere else, unexplained* to
*here, named*. The message even names the alias — `Kind` — so the reader can jump
to the definition and read the two valid values.

📌 **Notice what else changed: the `never` branch disappeared**, because the
constraint made it unreachable. **An unreachable fallback is the proof a constraint
was the right tool** — if the "impossible" branch deletes cleanly once a bound is
added, it was doing the bound's job badly.

## Version C — two overloads

```ts
declare function parse(kind: "date", raw: string): Date;
declare function parse(kind: "number", raw: string): number;

// parse("dat", "2026-08-17");
// ❌ TS2769: No overload matches this call.
//    TS2772: Overload 1 of 2, '(kind: "date", raw: string): Date', gave the following error.
//      TS2345: Argument of type '"dat"' is not assignable to parameter of type '"date"'.
//    TS2770: The last overload gave the following error.
//      TS2345: Argument of type '"dat"' is not assignable to parameter of type '"number"'.
```

⚠️ **Assembled from the quoted message templates, not pasted from a run.**

This is the richest failure of the three, and the reason is structural: **overloads
are a list of candidates, so the compiler can enumerate them.**

> **`TS2769`: No overload matches this call.**
>
> **`TS2772`: Overload `{0}` of `{1}`, `'{2}'`, gave the following error.**
>
> **`TS2770`: The last overload gave the following error.**

`TS2772` prints **the signature that was tried**, in full. A conditional type is not
a list of candidates by the time anything is checked; it is one resolved type, so
there is nothing to list.

⚠️ **The related-information design is also why overload errors get a bad
reputation.** With eight overloads you get eight nested reasons, and the useful one
is not necessarily first. That is a real cost — but it is a cost of *volume*, and the
reader can work through it. Version A's cost is *absence*, and no amount of reading
recovers it.

## The rule the comparison yields

> **Enumerable candidates produce enumerable errors.**

Anything the compiler holds as a **list** — overload signatures, the members of a
discriminated union — can be listed back in the message, each with its own reason.
Anything it must **resolve** to a single type — a conditional, a mapped type, a
template expansion — can only be printed as a value.

📌 **This is not "always use overloads".** Overloads have documented problems of
their own, including a pass-through failure a conditional handles correctly and two
shapes the handbook explicitly tells you not to write. That argument, with the
handbook quoted, is [chunk 06](./06-what-to-write-instead.md). What this comparison
settles is narrower and mechanical: **a design the compiler can list reports better
than one it must resolve.**

## The same three designs, ranked by every axis that matters

Judgement, drawn from the mechanics above rather than from documentation:

| | A · unconstrained conditional | B · constrained conditional | C · two overloads |
|---|---|---|---|
| Error at the typo | **none** | `TS2345`, at the call site | `TS2769` + per-candidate |
| Names something a human wrote | no | **yes — `Kind`** | **yes — each signature** |
| Scales to 20 kinds | yes | **yes** | badly — 20 signatures |
| Scales to *open* input | **yes** | yes, if the bound is open | no |
| Return type varies by input | yes | **yes** | yes |
| Reads as documentation | no | partly | **yes** |
| Cost of one more kind | one line | one line | one signature |

**B is the default answer** for a closed set that must stay derivable, **C** for a
small closed set where the signatures *are* the documentation, and **A** is not an
answer to anything — it is what B looks like before somebody adds the bound.

## Gotchas

**Symptom:** A wrong argument produced no error, and a `never` turned up in an
unrelated file.
**Cause:** Version A — an unconstrained parameter plus a `never` fallback swallowed
the mistake, and `never` is assignable to everything so it does not fail where it is
created.
**Fix:** Bound the parameter to the union of valid inputs, then delete the fallback.

**Symptom:** After adding a constraint the `never` branch is unreachable and the
editor shows nothing about it.
**Cause:** Intended outcome, not a warning.
**Fix:** Delete the branch. Its unreachability is the evidence the constraint was
the right fix.

**Symptom:** The constrained version still reports at the wrong place.
**Cause:** The bound is wider than the valid set — `K extends string` is a bound
too, and it excludes nothing.
**Fix:** Bound to the *union of valid values*, not to a primitive.

**Symptom:** Overload errors are so long the team disabled the rule that surfaces
them.
**Cause:** Related information nests once per candidate; eight overloads means eight
reasons.
**Fix:** Reduce the candidate count — union or optional parameters where the
handbook recommends them ([chunk 06](./06-what-to-write-instead.md)) — rather than
hiding the message.

**Symptom:** A union argument that should work is rejected by the overloads.
**Cause:** The documented pass-through problem: a caller holding `number | string`
cannot satisfy any single overload.
**Fix:** That is the case *for* a union parameter or a generic; see
[chunk 06](./06-what-to-write-instead.md). It is the one place C loses outright.

**Symptom:** Somebody replaced working overloads with a conditional to "clean up the
error".
**Cause:** The long error was the feature — `TS2772` names each candidate tried.
**Fix:** Understand what was traded first. If the pass-through problem drove it, say
so; that is a real reason and a valid trade.

**Symptom:** The conditional's result is correct but hovering the call shows `never`
and nobody notices for weeks.
**Cause:** `never` is silent by construction; nothing in the editor flags a `never`
variable.
**Fix:** Name the fallback something loud — a message string type — while designing,
then replace it with a constraint before merging
([chunk 10](./10-keeping-the-ones-you-keep.md)).

**Symptom:** Version C's two signatures drifted apart during a refactor.
**Cause:** Overloads duplicate the shared parts of a signature, so a change has two
places to land.
**Fix:** That duplication is C's real cost. If the shared part is large, B keeps one
source of truth; the drift risk is what you are buying with the worse error message.

## Interview questions

**★ Same typo, three designs. What does the caller see in each?**
The unconstrained conditional gives **no error**: `"dat"` satisfies
`K extends string`, the conditional resolves to `never`, and the failure surfaces
wherever the value is finally used. The constrained version gives `TS2345`
*"Argument of type `'"dat"'` is not assignable to parameter of type `'Kind'`."* at
the call site. The overloads give `TS2769` *"No overload matches this call."* plus
`TS2772` for each candidate tried and `TS2770` for the last — the richest failure,
because overloads are an enumerable list and a resolved conditional is not.

**★ Why is `never` specifically a bad fallback for a public helper?**
Because it is assignable to everything, so it does not fail at the point it is
produced. The mistake becomes a legal value that flows onward and errors at the
first real use, arbitrarily far from the typo and usually in unrelated code. A
constraint fails at the call site instead; a named error-message type at least
survives into the reader's hover.

**★ How do you tell whether a `never` branch should have been a constraint?**
Add the constraint, then try to delete the branch. If it deletes cleanly it was
absorbing input a bound should have rejected — and the bound reports by name at the
call site where the branch reported nowhere. Keep a fallback only for cases that are
genuinely reachable and genuinely meaningless.

**★ "Enumerable candidates produce enumerable errors" — why is that a design rule?**
Because it predicts the failure mode before you write the code. Overload signatures
and discriminated-union members are lists, so the compiler can print each one with
its own reason; a conditional or mapped type must be resolved to a single type
first, leaving only a value to print. Choosing a listable design is choosing a
better error message.

**When do overloads lose outright?**
When a caller passes a value of a union type through. Each overload must be
satisfied individually, so `number | string` matches none of them, even though every
member matches one — the handbook's own example of this is in
[chunk 06](./06-what-to-write-instead.md). A single union parameter, or a generic
with a bound, handles it correctly.

**Version B and version C both report at the call site. What decides between them?**
The size of the closed set and how much of the signature is shared. Two or three
kinds whose signatures differ meaningfully: overloads, because the signatures *are*
the documentation. Many kinds, or a large shared signature that would be duplicated
per overload: the constrained conditional, because it keeps one source of truth — and
you pay for that with a message that prints a computed type rather than a list.

**Is there any case for version A?**
No. It is not a design, it is version B with the bound missing. Every property it has
— open input, derivable return — version B also has, and version B additionally
reports the mistake. If you find A in a codebase, adding the bound is a one-line,
behaviour-preserving improvement.

---

← Prev: [01 · The error is the interface](./01-the-error-is-the-interface.md) ·
[Topic index](./README.md) · Next → [03 · Four fixes that cost nothing](./03-four-fixes.md)
