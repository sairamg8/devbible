---
title: "Overloads, and naming what you return"
sidebar_label: "11 · Overloads and naming"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Declaration Files →
> Do's and Don'ts*. Every ❌/✅ pair and every *"Why"* sentence is quoted from
> that page. **No sandbox, no console blocks.**

[Chunk 10](./10-designing-the-surface.md) covered general types and callbacks.
This one covers the part of the handbook's page that is not style advice at all:
**overload order changes which signature a call resolves to**, and it does so
silently.

## Function overloads

### 🔴 Ordering — specific first

> **❌ Don't** put more general overloads before more specific overloads.

```ts
/* WRONG */
declare function fn(x: unknown): unknown;
declare function fn(x: HTMLElement): number;
declare function fn(x: HTMLDivElement): string;
var myElem: HTMLDivElement;
var x = fn(myElem); // x: unknown, wat?
```

```ts
/* OK */
declare function fn(x: HTMLDivElement): string;
declare function fn(x: HTMLElement): number;
declare function fn(x: unknown): unknown;
var myElem: HTMLDivElement;
var x = fn(myElem); // x: string, :)
```

> **Why:** TypeScript chooses the *first matching overload* when resolving
> function calls.

🔴 **This is a resolution rule, not a style preference.** Overload order is
semantically significant, and getting it backwards produces no error — just
consistently useless return types. It is the highest-value item on this page.

### ✅ Optional parameters instead of trailing-parameter overloads

> **❌ Don't** write several overloads that differ only in trailing parameters
> […] **✅ Do** use optional parameters whenever possible.

```ts
/* WRONG */
interface Example {
  diff(one: string): number;
  diff(one: string, two: string): number;
  diff(one: string, two: string, three: boolean): number;
}

/* OK */
interface Example {
  diff(one: string, two?: string, three?: boolean): number;
}
```

⚠️ **With one condition, stated by the handbook:** *"Note that this collapsing
should only occur when all overloads have the same return type."* If the return
type changes with the arity, the overloads are carrying real information and must
stay.

### ✅ Union types instead of one-position overloads

> **❌ Don't** write overloads that differ by type in only one argument position
> […] **✅ Do** use union types whenever possible.

```ts
/* WRONG */
interface Moment {
  utcOffset(): number;
  utcOffset(b: number): Moment;
  utcOffset(b: string): Moment;
}

/* OK */
interface Moment {
  utcOffset(): number;
  utcOffset(b: number | string): Moment;
}
```

Same condition applies: the union is correct only because both overloads return
`Moment`. When the argument type *determines* the return type, you need the
overloads — or a conditional return type, which is
[Phase 5 · Conditional types](../../phase-5-type-level/02-conditional-types/README.md).

## The rules the handbook does not spell out

Three more that follow from everything in this topic:

1. **Name every type a consumer can obtain.** An inline object type on an export
   means the consumer cannot write the type of a variable holding it. This is the
   same argument as chunk 08's "private name" family, applied before the compiler
   has to complain.
2. **Prefer `readonly` on anything you return and do not expect mutated.** It
   costs nothing, and removing it later is not a breaking change — adding it is.
3. **Write the JSDoc in the source, not in the `.d.ts`.** Comments are carried
   into generated declarations, so a doc comment on your export reaches every
   consumer's editor. A comment written directly into a generated file does not
   survive the next build.


## Gotchas

**Symptom:** Overloads exist, and calls always resolve to the least useful one.
**Cause:** The general overload is listed before the specific ones; TypeScript
takes the first match.
**Fix:** Reorder — most specific first. ⚠️ There is **no diagnostic** for this;
the only symptom is consistently vague return types.

**Symptom:** An overload set you inherited resolves correctly for some argument
types and not others.
**Cause:** Partial ordering — some specifics are above the general signature and
some below it.
**Fix:** Sort the whole set, most specific to most general, rather than moving one
line.

**Symptom:** You collapsed overloads into optional parameters and the return type
went wrong.
**Cause:** The overloads did not all share a return type.
**Fix:** Put them back. The collapse is valid only when the return type is
constant across every overload.

**Symptom:** You collapsed two overloads into a union and callers now get a union
return.
**Cause:** The argument type was determining the return type.
**Fix:** Keep the overloads, or express the relationship as a conditional return
type.

**Symptom:** A call with a union-typed argument fails against an overload set,
even though each member of the union matches some overload.
**Cause:** Overload resolution picks **one** signature; it does not distribute
over a union argument.
**Fix:** Add a signature accepting the union — which is the handbook's `utcOffset`
advice arriving from the other direction.

**Symptom:** A consumer cannot name the type of something your function returned.
**Cause:** The return type is an inline anonymous object type.
**Fix:** Extract and export an `interface`. Anything a consumer can hold, they
should be able to name.

**Symptom:** JSDoc you added to `dist/index.d.ts` disappeared.
**Cause:** It is generated output; comments come from the source.
**Fix:** Put the doc comment on the source declaration, where it will be carried
into every build.

**Symptom:** Adding `readonly` to a returned array broke consumers.
**Cause:** It is a narrowing change — code that mutated the result stops
compiling.
**Fix:** Ship it in a major version. Note the asymmetry: *starting* with
`readonly` and relaxing later is free.

**Symptom:** An overload set has grown to eight signatures and nobody can tell
which one a call hits.
**Cause:** Overloads were added one at a time for new argument shapes.
**Fix:** Collapse what shares a return type into optional parameters and unions,
and keep only the overloads that genuinely change the return type.

## Interview questions

**★ Why does overload order matter?**
TypeScript picks the **first matching** overload, so a general signature listed
first shadows the specific ones and every call resolves to the vague return type.
There is no error for it — the only symptom is bad inference, which is what makes
it worth knowing rather than looking up.

**★ When should you collapse overloads into optional parameters or a union?**
Only when all the overloads share a return type. If the argument type determines
the return type, the overloads carry information a union would erase — keep them,
or use a conditional return type.

**★ How would you type `utcOffset()` / `utcOffset(n)` / `utcOffset(s)` properly?**
Two signatures, not three: a no-argument one returning `number`, and one taking
`number | string` returning `Moment`. The two single-argument overloads differ in
one position and share a return type, which is exactly the union case.

**★ Why should everything a consumer can hold have a name?**
Because an inline anonymous return type cannot be written down by the caller —
they can use the value but not declare a variable, parameter or field of that
type. It is the same problem the *"private name"* declaration-emit errors raise,
caught before the compiler has to.

**Does overload resolution distribute over a union argument?**
No. It selects a single signature, so a union-typed argument that matches
different overloads member by member fails. That is a second, independent reason
to prefer a union parameter over one-position overloads.

**Where do JSDoc comments in a generated `.d.ts` come from?**
The source file. Declaration emit carries comments through, which is why API
documentation belongs on the exported declaration in your `.ts` and never in the
generated output.

**Is adding `readonly` to a returned type a breaking change?**
Yes — consumers who mutated the result stop compiling. Removing it is not. That
asymmetry is the argument for putting it on from the start.

**When is a large overload set actually correct?**
When the return type genuinely varies with the argument type and a conditional
type would be less readable than the alternatives it encodes. Overloads are the
readable way to express a small, fixed set of argument/return pairings; they stop
being readable when they are enumerating optional parameters.

---

← Prev: [10 · Designing the surface](./10-designing-the-surface.md) · Next → [12 · `@internal` and `stripInternal`](./12-internal-and-strip.md)
