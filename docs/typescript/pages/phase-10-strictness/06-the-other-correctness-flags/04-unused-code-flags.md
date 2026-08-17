---
title: "The unused-code flags"
sidebar_label: "04 · Unused-code flags"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own option table** in the **TypeScript
> 5.9.3** build. `noUnusedLocals` — *"Enable error reporting when local variables
> aren't read"*; `noUnusedParameters` — *"Raise an error when a function
> parameter isn't read"*; both `defaultValueDescription: false`, neither carrying
> `strictFlag`. 🔴 `allowUnreachableCode` and `allowUnusedLabels` carry
> `defaultValueDescription: void 0` — **`undefined`, not `false`** — which is the
> three-state behaviour described below. The **seven** unused-code diagnostics
> come from the numbered table. **No sandbox, no console block.**

The two flags in this group that are not about correctness at all, plus two
neighbours whose option records reveal something the others do not.

> **`noUnusedLocals` and `noUnusedParameters` do not catch bugs.** Unused code is
> not wrong, it is dead — and the argument for these flags is entirely about the
> *signal* a leftover variable carries, which is usually "this refactor was
> abandoned halfway".

## The seven diagnostics

More than people expect, and the specific one you get tells you what kind of dead
thing you have:

| Code | Message |
|---|---|
| `TS6133` | *"`'{0}'` is declared but its value is never read."* |
| `TS6138` | *"**Property** `'{0}'` is declared but its value is never read."* |
| `TS6196` | *"`'{0}'` is declared but never used."* |
| `TS6192` | *"All imports in import declaration are unused."* |
| `TS6198` | *"All destructured elements are unused."* |
| `TS6199` | *"All variables are unused."* |
| `TS6205` | *"All type parameters are unused."* |

📌 **The four "All …" variants exist so the editor can grey out and remove the
whole declaration** rather than each name inside it. That is why they read like
UI messages — they are: the compiler is describing a fixable region, not just a
location.

⚠️ **`TS6133` and `TS6196` differ in a way worth knowing.** *"…its value is never
read"* is about a **value** binding — a variable or parameter that exists at
runtime. *"…is declared but never used"* is about a **type-side** declaration —
an interface, type alias or import used in no type position. Same symptom,
different halves of the language, and the fix differs accordingly.

## `noUnusedLocals`

Reports a local binding that is never read:

```ts
function handler(req: Request) {
  const user = req.user;          // TS6133 if never used below
  return respond(200);
}
```

It is scoped to **locals**. An exported unused symbol is not reported, because
the compiler cannot know whether something outside the program uses it. So the
flag says nothing about dead exports, which is usually where the real dead code
in a codebase accumulates — that is a job for a bundler's tree-shaking report or
a dedicated tool, not for `tsc`.

## `noUnusedParameters` and the underscore rule

```ts
app.use((err, req, res, next) => { … });   // TS6133 on `req` and `next`
```

Express middleware is the canonical case: the four-argument signature is
**required** for Express to recognise an error handler, and you frequently use
only two of the four. The parameters cannot be deleted.

🔴 **The escape is a leading underscore, and it is a compiler rule, not a
convention:**

```ts
app.use((err, _req, res, _next) => { … });   // no error
```

A parameter whose name begins with `_` is exempt from `noUnusedParameters`. This
is the reason the `_`-prefix style exists in TypeScript codebases at all, and it
is worth knowing that it is enforced by the compiler rather than by taste.

⚠️ **The exemption applies to parameters, not to locals.** An unused `const _x`
is still `TS6133` under `noUnusedLocals`. The two flags do not behave
symmetrically here, which surprises people who assume `_` is a general "ignore
this" marker.

📌 **Destructured elements follow the parameter rule when they are parameters.**
`function f({ a, _b })` exempts `_b`; a destructured local does not get the
exemption and produces `TS6198` when nothing in it is used.

## 🔴 The neighbours with a third state

Two adjacent options in the same `Type_Checking` category behave differently from
every flag in this topic, and the option record is where you can see it:

| Option | Default in the record |
|---|---|
| `noUnusedLocals`, `noUnusedParameters`, and the four other flags in this topic | `false` |
| **`allowUnreachableCode`** | **`void 0`** — i.e. `undefined` |
| **`allowUnusedLabels`** | **`void 0`** — i.e. `undefined` |

`undefined` is a genuine third state, not a missing value:

- **`undefined`** — reported as a **suggestion**. Editors grey the code out; the
  build does not fail. `TS7027` *"Unreachable code detected."* and `TS7028`
  *"Unused label."*
- **`true`** — allowed silently, no suggestion.
- **`false`** — a hard error that fails the build.

🔴 **So unreachable code is already being reported to you today, in the editor,
with no configuration at all** — and it is invisible in CI unless you set the
option to `false`. A team that has never heard of `allowUnreachableCode` is
nonetheless seeing its output every day as greyed-out code and reading it as an
editor feature.

⚠️ Note the **inverted polarity**: these two are `allow*` flags, so `false` is the
strict setting. Setting `allowUnreachableCode: true` to "turn on the check" does
the opposite, and it is an easy mistake to make in a config where every other
correctness option is turned *on*.

## The honest argument: this belongs in the linter

The strongest objection to `noUnusedLocals` and `noUnusedParameters` is not that
they are wrong but that they are in the wrong tool:

- **They break the build during debugging.** Commenting out three lines to test
  something makes the file stop compiling, which is hostile at exactly the moment
  you want fast feedback. Every other flag in this phase errors on code that is
  *wrong*; these two error on code that is *temporarily* incomplete.
- **A linter can autofix them and the compiler cannot.** `eslint --fix` with
  `@typescript-eslint/no-unused-vars` removes the declaration; `tsc` can only
  report it.
- **The linter rule is more configurable** — `argsIgnorePattern`,
  `varsIgnorePattern`, ignoring rest siblings — where the compiler offers only
  the `_` prefix.

**The counter-argument, and it is real:** the compiler runs in CI whether or not
the linter does, it is already parsing the file, and it costs nothing extra. On a
team without a reliable lint gate, `tsc` is the only enforcement that exists.

📌 **The common resolution is to enable them in the editor and CI but not in the
watch build** — a second `tsconfig` for CI with the two flags on, and the
day-to-day config without them. This is the only place in this phase where
"different config for different jobs" is the recommended answer rather than a
smell.

## Gotchas

**Symptom:** the build breaks while debugging because a `const` was commented
out.
**Cause:** `noUnusedLocals` treats temporarily-dead code identically to
permanently-dead code.
**Fix:** either move these two flags to CI-only, or use the linter rule, which is
autofixable and does not gate compilation.

**Symptom:** an Express error handler's unused `req` errors and cannot be
deleted.
**Cause:** Express recognises an error handler by **arity**; the parameter is
load-bearing even though it is unread.
**Fix:** rename it `_req`. The leading underscore is a compiler-level exemption
for parameters.

**Symptom:** `_unused` local still errors.
**Cause:** the underscore exemption covers **parameters only**, not locals.
**Fix:** delete the local, or use the linter's `varsIgnorePattern` if you need
the convention to apply on both sides.

**Symptom:** `TS6196` rather than `TS6133` on an unused import.
**Cause:** the symbol is used in no type position and no value position — you are
looking at the type-side message.
**Fix:** delete it. If the whole import statement is dead you will get `TS6192`
instead, which the editor can remove in one action.

**Symptom:** the flags report nothing while the codebase is visibly full of dead
code.
**Cause:** the dead code is **exported**. Neither flag reports exported symbols,
since the compiler cannot know what consumes them.
**Fix:** a tree-shaking report or a dedicated dead-export tool. `tsc` will not
find these.

**Symptom:** unreachable code is greyed out in the editor but CI passes.
**Cause:** `allowUnreachableCode` defaults to `undefined`, which is *suggestion*
severity — reported in the editor, not in the build.
**Fix:** set it to `false` explicitly to make it a build error.

**Symptom:** setting `allowUnreachableCode: true` did not enable the check.
**Cause:** inverted polarity — `allow*` flags are strict when `false`.
**Fix:** `false`. This is the one place in the phase where "on" means the wrong
thing.

**Symptom:** a type parameter is unused and nothing is reported.
**Cause:** `TS6205` covers the case where *all* type parameters are unused; a
partially-unused list needs the typescript-eslint rule
`no-unnecessary-type-parameters` — which is
[topic 11](../README.md)'s territory, and is also the rule that catches
[the unchecked-`as`-in-angle-brackets shape](../../phase-3-generics/README.md).

## Interview questions

**Do `noUnusedLocals` and `noUnusedParameters` catch bugs?**
No, and it is worth saying so plainly. Unused code is not incorrect, it is dead.
The argument for them is signal: a leftover local is usually the residue of an
abandoned refactor, and the flags make that visible. Every other flag in this
phase reports code that is wrong; these report code that is merely surplus.

**How do you keep a required-but-unused parameter, like Express's error-handler
`req`?**
Prefix it with an underscore. `_req` is exempt from `noUnusedParameters` by a
compiler rule, not a convention. This matters for Express specifically because it
recognises an error handler by arity, so the parameter cannot be removed.

**Does the underscore exemption apply to local variables too?**
No — parameters only. An unused `const _x` is still `TS6133` under
`noUnusedLocals`. The asymmetry catches people who assume `_` is a general
ignore-marker.

**What is unusual about `allowUnreachableCode`'s default?**
Its option record shows `defaultValueDescription: void 0` — `undefined`, not
`false` — and `undefined` is a real third state meaning *suggestion*. So
unreachable code is already reported today as greyed-out editor output, with no
configuration, and is invisible in CI unless the option is explicitly set to
`false`. It also has inverted polarity: `false` is the strict setting.

**Why do people argue these two flags belong in the linter?**
Because they break the build for temporarily-incomplete code, which is hostile
while debugging; because `eslint --fix` can remove the declaration and `tsc`
cannot; and because the linter rule is far more configurable than the compiler's
single `_` prefix. The counter-argument is that `tsc` runs in CI regardless and
costs nothing extra, so on a team without a reliable lint gate it is the only
enforcement there is.

**Will these flags find your dead code?**
Only the local kind. Neither reports **exported** symbols, because the compiler
cannot know what consumes them — and exported dead code is where most of it
accumulates. That needs a tree-shaking report or a dedicated tool.

---

← [03 · The control-flow flags](./03-control-flow-flags.md) · Next → [05 · Choosing and adopting](./05-choosing-and-adopting.md)
