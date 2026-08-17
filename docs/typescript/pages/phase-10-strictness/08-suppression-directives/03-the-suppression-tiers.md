---
title: "The suppression tiers"
sidebar_label: "03 · The suppression tiers"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own option table** in the **TypeScript
> 5.9.3** build. 🔴 Both `suppressExcessPropertyErrors` (*"Disable reporting of
> excess property errors during the creation of object literals"*) and
> `suppressImplicitAnyIndexErrors` (*"Suppress `noImplicitAny` errors when
> indexing objects that lack index signatures"*) sit in
> **`category: Backwards_Compatibility`** with `defaultValueDescription: false` —
> the only category name in the table that is a warning label. `skipLibCheck`'s
> scope is from the **`tsconfig` reference**. **No sandbox, no console block.**

The two directives are the middle of a ladder, not the whole of it. There are
**seven** ways to make a TypeScript error stop appearing, and they differ by
blast radius — which is the only axis that matters when auditing.

## The ladder, narrowest first

| # | Mechanism | Scope | Visible where |
|---|---|---|---|
| 1 | **Fix the code** | — | the diff |
| 2 | `as` / `!` | one expression | the diff — [topic 07](../07-unsound-by-design/02-the-holes-you-opt-into.md) |
| 3 | **`@ts-expect-error`** | one line, **expires** | the diff, and `TS2578` when stale |
| 4 | `@ts-ignore` | one line, forever | the diff only |
| 5 | `@ts-nocheck` | **one whole file** | one line at the top of it |
| 6 | 🔴 **`suppress*` compiler options** | **the whole project** | `tsconfig.json` |
| 7 | **Turning the flag off** | the whole project | `tsconfig.json` |

📌 **Read tiers 5–7 as a group: they are the ones where the scope is not visible
at the site.** A reader looking at a broken line in a `@ts-nocheck` file, or at a
project with `suppressExcessPropertyErrors`, sees nothing at all. That is what
makes them qualitatively different from an `as` or a directive, both of which at
least appear next to the code they excuse.

## 🔴 Tier 6 — the suppression options most people do not know exist

Two compiler options do at **project scale** what `@ts-ignore` does per line:

```json
{
  "compilerOptions": {
    "suppressExcessPropertyErrors": true,
    "suppressImplicitAnyIndexErrors": true
  }
}
```

- **`suppressExcessPropertyErrors`** turns off the excess-property check on
  object literals — the check that catches a typo'd or renamed property in a
  literal, which is [topic 09](../README.md)'s subject. Disabling it project-wide
  removes one of the highest-value checks TypeScript performs, everywhere, with
  no per-site record.
- **`suppressImplicitAnyIndexErrors`** turns off `noImplicitAny`'s complaint when
  indexing an object with no index signature — so `obj[key]` silently becomes
  `any` throughout the project. It reintroduces
  [hole 1](../07-unsound-by-design/02-the-holes-you-opt-into.md) as a default.

🔴 **Both live in `category: Backwards_Compatibility`, and that category name is
the compiler telling you what it thinks of them.** No other correctness-adjacent
option in the table carries it. They exist so that old projects keep compiling,
not so that new ones can be configured this way.

⚠️ **A codebase with either of these set is not "strict" whatever else its config
says.** They are the first thing to grep for when a project's error count seems
implausibly low for its size — far more likely than the code being unusually
good.

## Tier 7 — turning the flag off

The most honest tier, oddly. `"strictNullChecks": false` is at least *visible* in
one well-known place, is understood by everyone reading the config, and produces
no illusion of local consideration.

📌 **This is worth saying because it reframes the ladder.** The tiers are not
ordered by virtue — tier 7 is more honest than tier 6 and arguably than tier 5.
They are ordered by **blast radius**, and the audit question is always the same:
*how much of the codebase does this excuse, and can a reader at the affected line
tell?*

## Where `skipLibCheck` sits — and does not

`skipLibCheck` is often grouped with these and it is a different thing. It skips
type checking **inside `.d.ts` files**, which is a build-time trade about other
people's declarations. It does **not** suppress any error in your own code, and
it does not affect assignability at your call sites — a point
[topic 05 chunk 04](../05-exactoptionalpropertytypes/04-living-with-it.md) makes
because it gets proposed as a fix for errors it cannot touch.

Its real trade is covered in
[phase 7 · `target`, `lib` and types](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md)
for correctness, and in **phase 12 · Tooling, performance and testing** *(not
written yet)* for build time.

## Auditing the ladder

Each tier has a grep, and running all of them takes a minute:

```bash
grep -rn "@ts-ignore\|@ts-nocheck" src/          # tiers 4, 5
grep -rn "@ts-expect-error" src/ | wc -l         # tier 3 — the countable one
grep -rn " as \| as unknown as \|!\." src/       # tier 2, noisy but revealing
grep -n "suppress\|strict.*false\|skipLibCheck" tsconfig*.json   # tiers 6, 7
```

🔴 **Run the last one first on any codebase you have just joined.** One line in
`tsconfig.json` can invalidate every conclusion you would otherwise draw from the
other three, and it takes a second to check.

## Gotchas

**Symptom:** a codebase claims `strict: true` and has almost no type errors when
a flag is toggled.
**Cause:** a `suppress*` option, or a flag explicitly set to `false` below the
`strict` line.
**Fix:** read the whole `compilerOptions` block. Later keys override `strict`,
and the `suppress*` pair does not appear in most config templates.

**Symptom:** excess-property typos are not being caught anywhere.
**Cause:** `suppressExcessPropertyErrors`.
**Fix:** remove it and fix the resulting errors — most will be real renames and
typos.

**Symptom:** `obj[key]` is `any` everywhere despite `noImplicitAny`.
**Cause:** `suppressImplicitAnyIndexErrors`, which exists specifically to
suppress that.
**Fix:** remove it. Then decide between an index signature and a union-keyed
`Record` — [topic 02](../02-nouncheckedindexedaccess.md).

**Symptom:** `skipLibCheck` was enabled to fix errors in application code and
nothing changed.
**Cause:** it only skips checking *inside* `.d.ts` files.
**Fix:** the errors are yours and must be fixed. Different tool.

**Symptom:** a directive audit came back clean and the codebase is still loose.
**Cause:** the suppression is at tier 6 or 7, which greps for directives never
find.
**Fix:** audit the config first. It is one command and it dominates everything
else.

**Symptom:** removing `@ts-nocheck` from one file produced hundreds of errors.
**Cause:** correct — one line was suppressing the whole file.
**Fix:** that is the blast-radius argument. Convert to per-line directives so the
count is visible, then work it down.

## Interview questions

**How many ways are there to make a TypeScript error stop appearing?**
Seven, and they differ by blast radius: fix the code, `as`/`!`,
`@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`, the `suppress*` compiler
options, and turning the flag off. The audit question is always the same — how
much does this excuse, and can a reader at the affected line tell?

**What are `suppressExcessPropertyErrors` and `suppressImplicitAnyIndexErrors`?**
Compiler options that do project-wide what `@ts-ignore` does per line. The first
disables excess-property checking on object literals; the second makes indexing
an object without an index signature silently produce `any`. Both sit in the
compiler's `Backwards_Compatibility` category, which is the option table's way of
saying they exist so old projects keep building.

**Why grep the config before grepping for directives?**
Because a single line in `tsconfig.json` has a larger blast radius than every
directive in the codebase combined, and it is invisible from any affected line. A
clean directive audit on a project with `suppressExcessPropertyErrors` set is a
misleading result.

**Is turning a flag off worse than `@ts-nocheck`?**
Not obviously, and this is the interesting part. Turning a flag off is visible in
one well-known place and creates no illusion that anything was considered
locally. `@ts-nocheck` hides an unbounded amount of suppression behind one line
at the top of a file. The ladder is ordered by blast radius, not by virtue.

**Where does `skipLibCheck` belong on this ladder?**
Nowhere — it is a different mechanism. It skips checking inside `.d.ts` files,
which is a build-time trade about other people's declarations, and it suppresses
no error in your own code. It gets proposed as a fix for errors it cannot
possibly affect, which is why it is worth naming explicitly.

---

← [02 · Why expect-error wins](./02-why-expect-error-wins.md) · Next → [04 · A policy that works](./04-a-policy-that-works.md)
