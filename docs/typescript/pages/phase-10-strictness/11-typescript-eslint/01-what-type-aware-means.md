---
title: "What \"type-aware\" means, and what it costs"
sidebar_label: "01 · What type-aware means"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's own documentation** — the
> *Getting Started → Typed Linting* page, the *Troubleshooting → Typed Linting →
> Performance* page, and the *Users → Configs* page — with every cost claim quoted
> verbatim from those pages rather than estimated. ⚠️ **typescript-eslint is not
> installed in this repo**, so nothing here is read from its source the way this
> phase reads the compiler's; the rule metadata comes from each rule's own
> documentation page and is attributed as such. **No sandbox, no console block, no
> timings of our own.**

Every other page in this phase has been about a compiler flag. This topic is about
the checks that are **not** the compiler's, why they need the compiler anyway, and
what they cost.

> **A type-aware lint rule is an ESLint rule that asks the TypeScript compiler
> questions.** That single fact explains everything else about them: what they can
> catch that no syntactic rule could, why they cannot be free, and why they are
> configured separately from every other rule you have.

## The distinction that organises the whole topic

ESLint rules come in two kinds, and the difference is not about strictness:

| | Syntactic rules | 🔴 Type-aware rules |
|---|---|---|
| What they see | the **syntax tree** of one file | the syntax tree **plus every type in the program** |
| Can they know `x` is a `Promise`? | no | yes |
| Can they follow an `import`? | no | yes |
| Setup | none | a `tsconfig`-aware parser option |
| Cost | negligible | 🔴 **roughly a full type-check** |

📌 **`no-unused-vars` can be syntactic; `no-floating-promises` cannot.** Knowing
that `doThing()` returns a `Promise` requires resolving `doThing`, which may be
three packages away. There is no version of that check that reads one file.

## Turning it on

```js
// eslint.config.js — flat config
export default [
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
```

`projectService: true` — the documentation's description is *"indicates to ask
TypeScript's type checking service for each source file's type information"*.

📌 **`projectService` is the modern option and it replaces enumerating `project`
paths.** That matters for cost, not just tidiness — see below.

## 🔴 The cost, in the project's own words

This is the part worth quoting rather than estimating, because the maintainers are
unusually direct about it:

> *"Typed rules come with a catch. By using typed linting in your config, you
> incur the performance penalty of asking TypeScript to do a build of your project
> before ESLint can do its linting."*
> — *Getting Started → Typed Linting*

> *"Running typed linting on a project is generally as slow as type checking that
> same project."*
> — *Troubleshooting → Typed Linting → Performance*

> *"if you're using type-aware linting, your lint times should be roughly the same
> as your build times."*
> — the same page, stating the **expectation**

🔴 **So the budget is not a guess: type-aware lint ≈ one `tsc` run.** If your
`tsc --noEmit` takes 40 seconds, expect lint to take about 40 seconds, and treat
anything much worse as misconfiguration rather than as the normal price.

📌 **That reframes the CI question.** The honest comparison is not "lint got
slower" but *"we now run two type-checks per CI job"* — and the fix is usually to
notice that, not to disable rules. [Chunk 07](./07-adoption-and-ci-cost.md) is the
arithmetic.

⚠️ **The documentation gives no multiplier or timing figures beyond the "roughly
the same as your build" expectation**, and neither does this page. Any specific
number you see quoted for "typed linting is N× slower" is somebody's project, not
a general fact.

## 🔴 The one misconfiguration that dominates: wide `include` globs

The performance page names this specifically:

> *"If you provide very wide globs in your `include` (such as `**/*`), it can
> cause many more files than you expect to be included in this pre-parse."*

…and the consequence is that TypeScript ends up parsing **build artifacts** —
`dist/`, `coverage/`, generated clients — which *"can heavily impact
performance"*. Its advice:

> *"Always ensure you provide globs targeted at the folders you are specifically
> wanting to lint."*

📌 **The good news, and the reason to prefer `projectService`:** the page states
that the project service *"requires no additional configuration for wide TSConfig
includes"*. So the single highest-value performance action is often **switching
from `project` to `projectService`**, not narrowing globs by hand.

⚠️ **If you are still on `project`**, the advice is to prefer *"paths that use a
single `*` at a time"* over recursive `**` globs, to reduce disk IO. And one
`projectService`-specific cost: differing `extraFileExtensions` across files
triggers **full project reloads**, because the underlying TypeScript server
restarts.

## The four presets, and which one you actually want

| Config | Contains | Needs types? |
|---|---|---|
| `recommended` | *"Recommended rules for code correctness that you can drop in without additional configuration."* | no |
| 🔴 `recommended-type-checked` | `recommended` **plus** the type-aware correctness rules | **yes** |
| `strict` | `recommended` **plus** rules that *"can also catch bugs but are more opinionated"* | no |
| 🔴 `strict-type-checked` | `strict` plus its type-aware additions | **yes** |
| `stylistic` / `stylistic-type-checked` | consistency, explicitly *"without impacting logic"* | the second, yes |
| `*-type-checked-only` | **only** the type-aware rules from the matching config | yes |

🔴 **`strict` and `strict-type-checked` are not semver-stable**, and the docs say so
plainly:

> *"This configuration is not considered 'stable' under Semantic Versioning
> (semver). Its enabled rules and/or their options may change outside of major
> version updates."*

⚠️ **Read that as an operational fact, not a disclaimer.** A patch release of
typescript-eslint can add a rule to `strict-type-checked` and break your CI on a
day you changed nothing. **If your build must not break on dependency updates,
extend `recommended-type-checked` and list the strict rules you want
individually.** That is a real trade — the strict config is genuinely better at
finding bugs — and it should be a decision rather than a default.

📌 **The `-only` variants exist for a specific shape:** run the cheap syntactic
config over everything, and the type-aware config over only the directories where
it pays. [Chunk 07](./07-adoption-and-ci-cost.md) uses them.

## Which rules this topic covers, and where each lives

| Rule | Preset it ships in |
|---|---|
| [`no-floating-promises`](./02-no-floating-promises.md) | `recommended-type-checked` |
| [`no-misused-promises`](./03-no-misused-promises.md) | `recommended-type-checked` |
| [the `no-unsafe-*` family](./06-the-no-unsafe-family.md) | `recommended-type-checked` |
| [`no-unnecessary-condition`](./04-no-unnecessary-condition.md) | 🔴 `strict-type-checked` |
| [`strict-boolean-expressions`](./05-strict-boolean-expressions.md) | ⚠️ **its page names no config** — opt-in |

📌 **The split is informative.** The promise rules and the `any` rules are
*correctness* rules the project is confident about, so they sit in `recommended`.
`no-unnecessary-condition` is in `strict` because it can report things that are
not bugs — for a reason this phase has already documented, and
[chunk 04](./04-no-unnecessary-condition.md) is where that connects.

## Gotchas

**Symptom:** lint takes as long as the build and it feels broken.
**Cause:** that is the documented expectation, not a fault.
**Fix:** nothing, mechanically — but stop paying for it twice.
[Chunk 07](./07-adoption-and-ci-cost.md) is about running one type-check instead
of two.

**Symptom:** lint is far slower than `tsc --noEmit` on the same project.
**Cause:** almost always wide `include` globs pulling in `dist/` and other build
output.
**Fix:** switch to `projectService`, which the docs say needs no configuration for
wide includes. Failing that, narrow the globs and prefer single `*` over `**`.

**Symptom:** a type-aware rule reports nothing at all.
**Cause:** `parserOptions` is not set, so the rule has no type information and
silently does nothing useful.
**Fix:** `projectService: true` plus `tsconfigRootDir`. ⚠️ **A type-aware rule
without types is not an error — it is quiet**, which is the worst failure mode.

**Symptom:** CI breaks after a typescript-eslint patch update, with no source
change.
**Cause:** you extend `strict` or `strict-type-checked`, which are explicitly not
semver-stable.
**Fix:** pin the version, or extend `recommended-type-checked` and enable strict
rules individually.

**Symptom:** files outside `tsconfig.json` — config files, scripts — error about
not being included in a project.
**Cause:** typed linting needs every linted file to belong to a program.
**Fix:** include them in a `tsconfig`, or scope the type-aware config so it does
not match them. This is the commonest first-day problem with typed linting.

**Symptom:** the whole project reloads constantly in the editor.
**Cause:** differing `extraFileExtensions` across files, which the docs name as
forcing full reloads of the TypeScript server.
**Fix:** make it consistent across the config.

**Symptom:** someone proposes turning type-aware linting off to speed up CI.
**Cause:** the cost is real and visible; the benefit is invisible bugs that did not
ship.
**Fix:** the presets are granular — turn off `strict-type-checked` and keep
`recommended-type-checked`, or scope by directory. Losing
`no-floating-promises` to save build time is the worst available trade, for
reasons [chunk 02](./02-no-floating-promises.md) makes concrete.

## Interview questions

**What makes a lint rule "type-aware", and why does it matter?**
It asks the TypeScript compiler for type information rather than working from the
syntax tree of one file. That is what lets a rule know a call returns a `Promise`
when the function is declared three packages away — something no single-file rule
can determine. The cost follows from the same fact: the rule needs a built program,
so the lint run does the work of a type-check.

**How much does typed linting cost?**
typescript-eslint's own guidance is that *"your lint times should be roughly the
same as your build times"*, and that *"running typed linting on a project is
generally as slow as type checking that same project"*. So the budget is one `tsc`
run. Anything substantially worse is usually misconfiguration — most often wide
`include` globs pulling build artifacts into the program.

**If typed linting is much slower than `tsc`, what do you check first?**
The `include` globs. The performance documentation calls out `**/*` specifically,
because the pre-parse then pulls in `dist/`, coverage output and generated files.
The modern fix is `parserOptions.projectService: true`, which the docs say
requires no additional configuration for wide includes; the older fix is narrowing
globs and preferring a single `*` over `**`.

**Why would you not extend `strict-type-checked`?**
Because it is explicitly not semver-stable — the docs say its enabled rules and
options *"may change outside of major version updates"*. A patch update can add a
rule and fail a build on a day nobody touched the code. If that matters, extend
`recommended-type-checked` and enable the strict rules you want by name. It is a
real trade: `strict-type-checked` finds more bugs.

**A type-aware rule is configured but reports nothing. What is wrong?**
Most likely `parserOptions` is missing, so the rule has no program to query. The
important part is the failure mode: it does not error, it goes quiet. A type-aware
rule without type information looks exactly like a codebase with no problems, which
is why verifying that a new rule reports *something* on known-bad code is worth
doing once.

**Why are `no-floating-promises` and `no-unnecessary-condition` in different
presets?**
Because the project is confident the first is always a bug and knows the second can
report things that are not. `no-floating-promises` is in
`recommended-type-checked`; `no-unnecessary-condition` is in `strict-type-checked`,
and its own documentation acknowledges that TypeScript's deliberate unsoundness can
produce false positives. The preset placement is a statement about confidence, not
about severity.

---

← [Topic index](./README.md) · Next → [02 · `no-floating-promises`](./02-no-floating-promises.md)
