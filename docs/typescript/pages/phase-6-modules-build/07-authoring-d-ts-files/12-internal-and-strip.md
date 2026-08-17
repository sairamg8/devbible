---
title: "`@internal` and `stripInternal`"
sidebar_label: "12 · @internal and stripInternal"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** for `stripInternal` — its
> warning, its `@internal` example and the redacted output are quoted verbatim.
> 🔴 The detection behaviour is read from the compiler source:
> `hasInternalAnnotation` and `isInternalDeclaration` in the installed
> **TypeScript 5.9.3** build. **No sandbox, no console blocks.**

The last thing that decides what your published declaration file contains: the
members you would rather it left out. (**What it *points at*** — the triple-slash
directives — is [chunk 13](./13-triple-slash-references.md).)

## `stripInternal` — pulling the public surface back in

[Chunk 04](./04-generated-or-handwritten.md) made the case that `dist/*.d.ts` is
your API diff. When that diff shows something you did not mean to publish, and
you cannot stop exporting it — because your own code needs it across module
boundaries — `stripInternal` is the tool.

The TSConfig reference:

> Do not emit declarations for code that has an `@internal` annotation in its
> JSDoc comment.

```ts
/**
 * Days available in a week
 * @internal
 */
export const daysInAWeek = 7;

/** Calculate how much someone earns in a week */
export function weeklySalary(dayRate: number) {
  return daysInAWeek * dayRate;
}
```

With `stripInternal: true`, the emitted declaration is redacted to:

```ts
/** Calculate how much someone earns in a week */
export declare function weeklySalary(dayRate: number): number;
```

🔴 **And the warning it ships with, verbatim, because it is the whole trade:**

> This is an internal compiler option; use at your own risk, because **the
> compiler does not check that the result is valid**. If you are searching for a
> tool to handle additional levels of visibility within your `d.ts` files, look at
> api-extractor.

In other words: strip a type that a *retained* signature still refers to, and you
ship a `.d.ts` that references a name it does not declare. Nothing tells you. The
build is green and the consumer's is not.

⚠️ **It changes nothing at runtime.** The reference is explicit: *"the JavaScript
output remains the same."* `@internal` is a documentation-visibility tool, **not a
privacy or security boundary** — the code still ships, still runs, and is still
reachable by anyone who looks.

### 🔴 How `@internal` is actually detected

The option's own description says *"in their JSDoc comments"*. The implementation
is looser than that, and it is worth knowing exactly how loose. In the installed
5.9.3 build:

```js
function hasInternalAnnotation(range, sourceFile) {
  const comment = sourceFile.text.substring(range.pos, range.end);
  return comment.includes("@internal");
}
```

`isInternalDeclaration` collects the declaration's **leading comment ranges** —
any comments, not only `/** … */` blocks — and asks that question of each. Two
consequences follow, and neither is documented:

1. **A line comment works.** `// @internal` above a declaration strips it just as
   a JSDoc block does.
2. 🔴 **Any comment *containing* the string strips the declaration.** It is a
   substring test on the raw comment text, with no tag parsing. A comment that
   says *"do not mark this @internal, other packages depend on it"* removes the
   declaration from your published types — which is precisely the opposite of
   what it says.

📌 **Parameters are handled specially.** `isInternalDeclaration` looks at a
parameter's *trailing* comment ranges after the previous parameter, which is what
makes the inline form work:

```ts
export function f(a: string, /** @internal */ b: number): void;
```

### When to reach for something else

The reference names the alternative itself: **api-extractor**, for *"additional
levels of visibility"* — release tags (`@public`, `@beta`, `@alpha`,
`@internal`), a rolled-up single `.d.ts`, and an API report file that turns a
surface change into a reviewable diff. If your published surface is large enough
that `stripInternal`'s unchecked redaction worries you, that is the signal.

**The cheaper alternative is usually structural:** stop exporting it. An internal
helper reached across modules is a sign the module boundary is in the wrong
place, and moving it is a fix that needs no flag.

## Gotchas

**Symptom:** A declaration vanished from `dist/index.d.ts` and nobody added
`@internal`.
**Cause:** Some comment above it contains the string `@internal` — the check is a
substring test on the raw comment text, not a JSDoc tag parse.
**Fix:** Reword the comment. Never write the literal `@internal` in prose above a
declaration you want published.

**Symptom:** `stripInternal` is on and consumers get *"cannot find name"* inside
your `.d.ts`.
**Cause:** A stripped type is still referenced by a retained signature. The
reference warns that *"the compiler does not check that the result is valid"*.
**Fix:** Stop stripping that type, or stop referencing it from a public
signature. Consider api-extractor if this recurs.

**Symptom:** You marked something `@internal` for security reasons.
**Cause:** A misreading of what the flag does.
**Fix:** Nothing is hidden — *"the JavaScript output remains the same"*. Remove
the secret, do not hide its type.

**Symptom:** `// @internal` in a line comment worked, and you were told it had to
be JSDoc.
**Cause:** The implementation checks all leading comment ranges, not only JSDoc
blocks. The documented and actual behaviours differ.
**Fix:** Nothing to fix — but prefer the JSDoc form, since that is what the
documentation guarantees.

**Symptom:** Stripping an internal export made the build faster and the API
smaller, and a consumer's build broke a week later.
**Cause:** They were importing it. `@internal` is not a deprecation cycle.
**Fix:** Deprecate first (`@deprecated`), then strip in a major version.

## Interview questions

**★ What does `stripInternal` do, and what is the risk?**
It omits declarations whose leading comment contains `@internal` from the emitted
`.d.ts`. The risk is stated by the docs themselves: *"the compiler does not check
that the result is valid"* — strip a type a retained signature still references
and you ship a broken declaration file with a green build.

**★ Does `@internal` hide anything at runtime?**
No. *"The JavaScript output remains the same."* It is a documentation-visibility
tool, not a privacy or security boundary — the code ships and runs exactly as
before.

**★ How does the compiler decide something is `@internal`?**
It takes the declaration's leading comment ranges and asks whether the raw text
*contains* the substring `@internal`. There is no tag parsing, so a line comment
works — and so does a comment that merely mentions the word, which will strip a
declaration you meant to keep.

**What would you use instead of `stripInternal` on a large public API?**
api-extractor, which the TSConfig reference itself recommends: release tags for
graded visibility, a rolled-up declaration, and an API report that makes a surface
change show up in code review. Or, more cheaply, stop exporting the thing at all.

---

← Prev: [11 · Overloads and naming](./11-overloads-and-naming.md) · Next → [13 · Triple-slash references](./13-triple-slash-references.md)
