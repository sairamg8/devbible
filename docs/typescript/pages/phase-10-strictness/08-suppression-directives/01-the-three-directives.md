---
title: "The three directives"
sidebar_label: "01 · The three directives"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **compiler's own diagnostic table** in the
> **TypeScript 5.9.3** build for `TS2578` — *"Unused `'@ts-expect-error'`
> directive."* — and the **option table** for `checkJs` (*"Enable error reporting
> in type checked JavaScript files"*, `defaultValueDescription: false`) and
> `allowJs` (*"Allow JavaScript files to be a part of your program. Use the
> `checkJs` option to get errors from these files"*). **No sandbox, no console
> block.**

Three comment directives that turn the compiler off, differing in **scope** and
in **what happens when the error goes away**. The second difference is the whole
topic.

> **`@ts-ignore` and `@ts-expect-error` do the same thing today and opposite
> things in six months.** One stays silent forever; the other fails the build the
> moment it becomes unnecessary. That is the only property that matters.

## What each one does

```ts
// @ts-expect-error — suppresses the NEXT line, and errors if there is nothing to suppress
// @ts-ignore      — suppresses the NEXT line, unconditionally
// @ts-nocheck     — suppresses the ENTIRE FILE, must be at the top
// @ts-check       — the inverse: turns checking ON for a single .js file
```

| Directive | Scope | When the error disappears |
|---|---|---|
| **`@ts-expect-error`** | next line | 🔴 **`TS2578` — the build fails** |
| **`@ts-ignore`** | next line | nothing. silent forever |
| **`@ts-nocheck`** | whole file | nothing, and you cannot tell |
| `@ts-check` | whole file | n/a — it enables checking |

📌 **All four are comments**, which is worth stating plainly: they are invisible
to the type system's own tooling, they do not appear in a `.d.ts`, and no type
signature anywhere records that a value passed through one.

## `@ts-expect-error` and `TS2578`

The directive asserts *"the next line has an error"*. If it does not:

```ts
// @ts-expect-error
const n: number = 42;     // TS2578: Unused '@ts-expect-error' directive.
```

That inversion is the entire design. Suppressing an error is normally a
write-once decision that nobody revisits; this makes the compiler revisit it for
you, on every build, forever.

**It also makes the directive a testing tool**, which is its second use and the
one that appears in library codebases:

```ts
expectString(42);
// @ts-expect-error — must reject a number
expectString(42);
```

If a refactor accidentally widens `expectString` to accept `number`, the *test*
breaks. Type-level tests are otherwise awkward to write; this is the cheapest
form of one.

⚠️ **It suppresses whatever error is there, not the error you meant.** If the
line acquires a *different* error later, the directive absorbs that too and
`TS2578` never fires. So it self-cleans when the line becomes correct, and it
does **not** protect against the error changing underneath it. That is a real
limitation and the reason for the description convention in
[chunk 02](./02-why-expect-error-wins.md).

## `@ts-ignore`

Identical suppression, no follow-up:

```ts
// @ts-ignore
legacyThing.doStuff();
```

The error may have been fixed three refactors ago. The directive stays, the line
is never re-checked, and nothing tells you. **An `@ts-ignore` in a mature
codebase is more likely to be stale than live** — and a stale one is worse than
useless, because it reads as a considered decision and is actually a fossil.

🔴 **There is no case where `@ts-ignore` is preferable to `@ts-expect-error`
except one**, and it is narrow: when the error is **conditional** — present under
one `tsconfig` or TypeScript version and absent under another. A library building
against multiple compiler versions genuinely cannot use `@ts-expect-error`,
because `TS2578` would fire on whichever version does not produce the error.
Outside that case, the choice is between a directive that expires and one that
does not.

## `@ts-nocheck`

```ts
// @ts-nocheck
// … the entire file is now unchecked
```

Must be the **first** comment in the file. It is not a directive so much as an
opt-out, and its danger is proportion: one line disables an arbitrary number of
checks, and nothing in the file's body indicates that it is unchecked. A reader
five hundred lines down has no signal at all.

**Its behaviour differs between file types**, and this is the part people get
wrong:

- **In a `.ts` file** it disables checking entirely. It is a blunt instrument and
  almost always the wrong tool — a file that cannot be type-checked should be
  `.js` with `allowJs`, so that its status is visible in its *name*.
- **In a `.js` file** it only matters when `checkJs` is on, since JavaScript is
  unchecked by default. There it is the escape hatch for the one legacy file that
  will not comply — which is its intended use.

📌 **`@ts-check` is the mirror image and is genuinely useful**: it turns checking
on for a single `.js` file without setting `checkJs` project-wide. That is the
low-risk way to start type-checking a JavaScript codebase — one file at a time,
opting in rather than out.

## Where they do not work

Bounding them, because each of these surprises someone:

- **Not on a `.d.ts` declaration's consumers.** Suppressing at a declaration does
  nothing for the call sites; the error is raised where the type is used.
- **Not across a multi-line expression.** The directive covers the next *line*,
  so a call split across four lines may report on a line the comment does not
  govern. Reformatting the expression is usually the fix.
- **Not on syntax errors.** These suppress *semantic* diagnostics. A parse error
  is still a parse error.
- **Not on the compiler options themselves.** A file that fails because of a
  missing `types` entry or an unresolvable module may report on a line no comment
  can precede.

## Gotchas

**Symptom:** `TS2578` on a line that "obviously" still has an error.
**Cause:** the error moved — a reformat, or the expression now spans lines and
the reported line is not the one after the directive.
**Fix:** move the directive, or collapse the expression onto one line.

**Symptom:** `@ts-expect-error` cannot be used because CI builds against two
TypeScript versions.
**Cause:** the error exists on one version and not the other, so `TS2578` fires
on the second.
**Fix:** this is the one legitimate `@ts-ignore`. Comment it as version-specific
so it is not "cleaned up" later.

**Symptom:** a file has no errors and is also completely unchecked.
**Cause:** `@ts-nocheck` at the top, which nothing in the body advertises.
**Fix:** grep for it. If a file genuinely cannot be checked, make it `.js` so its
status is in its name.

**Symptom:** `@ts-nocheck` in a `.js` file appears to do nothing.
**Cause:** `checkJs` is off, so the file was never being checked.
**Fix:** none needed — but the directive is then noise and can be removed.

**Symptom:** an `@ts-expect-error` silently stopped catching the thing it was
documenting.
**Cause:** the line acquired a different error, which the directive now absorbs.
**Fix:** always write a description after the directive so a reader can tell what
it was for — [chunk 02](./02-why-expect-error-wins.md).

**Symptom:** a suppression above a declaration does not silence the call sites.
**Cause:** the error is raised at the use, not the declaration.
**Fix:** fix the declaration, or suppress at each use — which is usually the
signal that the declaration is wrong.

## Interview questions

**What is the difference between `@ts-ignore` and `@ts-expect-error`?**
They suppress identically today. The difference is what happens when the
underlying error is fixed: `@ts-expect-error` becomes `TS2578` and fails the
build, while `@ts-ignore` stays silent forever. One expires; the other becomes a
fossil that reads like a decision.

**Is there any case where `@ts-ignore` is the right choice?**
One: when the error is conditional across compiler versions or configs. A library
building against several TypeScript versions cannot use `@ts-expect-error`,
because `TS2578` fires on whichever version does not produce the error. Outside
that, there is no case.

**What is the second use of `@ts-expect-error`?**
Type-level testing. Putting it above a call that *should* fail asserts that the
call is rejected, so if a refactor accidentally widens the signature the test
breaks. Type-level tests are otherwise awkward to write, and this is the cheapest
form of one.

**What is the weakness of `@ts-expect-error`?**
It suppresses whatever error is on the next line, not the error you had in mind.
If that line later acquires a different error, the directive absorbs it and
`TS2578` never fires. It self-cleans when the line becomes correct; it does not
notice when the problem changes.

**Why is `@ts-nocheck` in a `.ts` file almost always wrong?**
Because it disables an arbitrary number of checks from one line, and nothing in
the file's body signals that it is unchecked — a reader five hundred lines down
has no idea. If a file genuinely cannot be type-checked, it should be a `.js`
file under `allowJs`, so its status is visible in its name rather than in a
comment at the top.

**What does `@ts-check` do and when is it useful?**
The inverse: it turns type checking on for a single `.js` file without enabling
`checkJs` project-wide. It is the low-risk way to begin type-checking a
JavaScript codebase — file by file, opting in rather than opting out.

---

← [Topic index](./README.md) · Next → [02 · Why expect-error wins](./02-why-expect-error-wins.md)
