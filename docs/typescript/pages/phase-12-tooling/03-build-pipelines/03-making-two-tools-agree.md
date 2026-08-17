---
title: "Making two tools agree"
sidebar_label: "03 · Making two tools agree"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **`tsconfig` reference** for `target`, `jsx`,
> `paths`, `experimentalDecorators`, `useDefineForClassFields`, `sourceMap` and
> `declarationMap`, the **esbuild** and **swc** documentation on which `tsconfig`
> fields each reads, and the **TypeScript 5.9.3 diagnostic table read from disk**
> (`sandbox/ts-p0`). ⚠️ **Module format and `esModuleInterop` are phase 6's**
> (topics 01, 02 and 09) and are linked rather than restated.
> **No timing figure is ours. No console block.**

Both shapes in [chunk 02](./02-the-two-shapes.md) end with two tools reading the
same source tree. **They do not read the same configuration**, and the gap between
what they read is where a whole class of green-build-wrong-output bugs lives.

## 🔴 The distinction that matters: settings that change *meaning*

Not every mismatch is a problem, and treating them all as one is why "just make the
configs identical" is bad advice — some settings genuinely belong to one tool.

| Kind | Example | If they disagree |
|---|---|---|
| **Output settings** | `outDir`, minification, target format | ⚪ fine — the bundler owns its output |
| 🔴 **Meaning settings** | `paths`, `jsx`, `experimentalDecorators`, `useDefineForClassFields` | ⚠️ **the checker and the emitter disagree about what the program IS** |

**Only the second kind matters, and it matters a lot**: the compiler approves a
program the bundler did not produce. **Nothing fails.** The build is green, the
types are green, and the output is wrong.

## The four that actually bite

1. 🔴 **`paths`.** The compiler resolves `@app/thing` because `tsconfig.json` says
   so; the bundler resolves it only if *it* has been told the same. ⚠️ **The failure
   is at runtime, as a module-not-found**, long after both checks passed — and the
   fix is a duplicated mapping in the bundler config that nothing keeps in sync. **A
   plugin that reads `paths` from `tsconfig.json` removes the duplication**, which
   is why it is worth having rather than being a convenience.
2. **`jsx`.** Which JSX transform runs is a compile-time decision; if the checker
   assumes one and the bundler applies another, you get either a runtime error about
   a missing import or a silently unused one.
3. 🔴 **`experimentalDecorators`.** There are **two incompatible decorator
   systems**, and this flag chooses. If the checker and the transformer disagree,
   decorators are checked as one and emitted as the other. 📌 Phase 4 · 13 covers the
   two systems; the pipeline consequence is that this is a settings agreement, not a
   preference.
4. 🔴 **`useDefineForClassFields`.** It changes whether a class field is an
   assignment or a `defineProperty` — **a semantic difference, not a syntactic one**,
   and it is implied by `target`. So a bundler configured with a different `target`
   than the compiler produces class instances that behave differently from the ones
   the checker reasoned about.

⚠️ **Notice what these have in common: none of them fails loudly.** Each produces
working-looking output whose behaviour differs from what was checked, which is why
they are worth a checklist rather than a debugging session.

## One config, or two?

**One, with the bundler reading it, wherever the bundler supports that.** The rule:

> 🔴 **Duplicate a setting only when you can also state which tool owns it.** If two
> files carry `paths` and neither is authoritative, they will diverge — and the
> divergence shows up as a runtime failure in an unrelated part of the app.

📌 **Where a second config is right:** when the two tools genuinely need different
*programs* — a build config narrower than the check config, tests excluded from the
published output. That is a deliberate scope decision, and
[topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md)
already says to treat it as a coverage decision rather than a build detail.

⚠️ **What a bundler reads from `tsconfig.json` is partial and tool-specific.**
Assume nothing: the settings above are the ones to confirm rather than infer, and
"we point it at the tsconfig" is not the same as "it honours all of it".

## Source maps across the seam

In [shape 2](./02-the-two-shapes.md) two tools emit two kinds of map, and they are
not alternatives:

| Map | Produced by | Answers |
|---|---|---|
| `sourceMap` | the bundler (or `tsc`) | *which source line is this stack frame?* |
| 🔴 `declarationMap` | **`tsc` only** | *which source line is this **type** from?* |

🔴 **`declarationMap` is the one libraries forget, and it is the one consumers
notice.** Without it, a consumer's "go to definition" lands in your `.d.ts` — a
generated file with no implementation — instead of your source. It costs a flag.

⚠️ **It only helps if the sources it points at are actually published**, which is
where this hands over to **phase 6 · 11 · Publishing a typed package** *(that
topic's job)*.

## Gotchas

**Symptom:** an import works in the editor and fails at runtime with
module-not-found.
**Cause:** `paths` is configured for the compiler and not for the bundler.
**Fix:** 🔴 a plugin that reads `paths` from `tsconfig.json`, so there is one source
of truth. A duplicated mapping is a divergence waiting to happen.

**Symptom:** class fields behave differently from what the types imply.
**Cause:** `useDefineForClassFields` differs between the checker and the transform —
often because their `target` settings differ, since it is implied by `target`.
**Fix:** align `target`. ⚠️ This is a semantic difference, so nothing about it looks
wrong in a diff.

**Symptom:** decorators type-check and misbehave at runtime.
**Cause:** the two incompatible decorator systems, chosen by
`experimentalDecorators`, and the two tools disagreed.
**Fix:** set it identically in both. 📌 It is a settings agreement, not a style
choice.

**Symptom:** a consumer's "go to definition" lands in a `.d.ts` file.
**Cause:** no `declarationMap`.
**Fix:** enable it, and make sure the sources it references are in the published
package — otherwise it points at files that are not there.

**Symptom:** "we made the configs identical" and something still broke.
**Cause:** identical is the wrong goal — the bundler legitimately owns its output
settings, and what a bundler reads from `tsconfig.json` is partial anyway.
**Fix:** ⚠️ align the settings that change *meaning*; let each tool own its output.

**Symptom:** two `tsconfig` files drifted apart over a year.
**Cause:** both were authoritative for the same setting.
**Fix:** `extends`, with the shared meaning-settings in the base. 📌 And
`--showConfig` ([topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md))
prints what the chain actually resolved to, which ends the argument in one command.

## Interview questions

**Which configuration mismatches between a bundler and `tsc` actually matter?**
The ones that change what the program *means* — `paths`, `jsx`,
`experimentalDecorators`, `useDefineForClassFields` — as opposed to output settings
like `outDir` or minification, which the bundler legitimately owns. A meaning
mismatch means the compiler approved a program the bundler did not produce, and
nothing fails: the build is green and the output is wrong.

**Why is `paths` the most common one?**
Because the compiler resolves the alias from `tsconfig.json` and the bundler only
does if it has been told separately, so the failure is a runtime module-not-found
after both checks passed. The fix is a plugin that reads `paths` from the tsconfig,
so there is a single source of truth rather than a duplicated mapping nothing keeps
in sync.

**Why does `useDefineForClassFields` belong on that list?**
Because it changes whether a class field is an assignment or a `defineProperty` —
semantics, not syntax — and it is implied by `target`. So two tools with different
`target` settings produce class instances that behave differently from the ones the
checker reasoned about, with nothing in the diff to suggest it.

**One config or two?**
One where the bundler can read it. Duplicate a setting only when you can say which
tool owns it, because two files carrying `paths` with neither authoritative will
diverge. A second config is right when the tools need genuinely different
*programs* — a narrower build scope, tests excluded from output — and that is a
coverage decision, not a build detail.

**What is `declarationMap` and why do libraries forget it?**
It maps declarations back to the source that produced them, so a consumer's "go to
definition" lands in your source instead of a generated `.d.ts`. It is forgotten
because nothing in your own repository notices its absence — only consumers do — and
it only works if the referenced sources are actually in the published package.

---

← [02 · The two pipeline shapes](./02-the-two-shapes.md) · [Topic index](./README.md) · [Phase 12 index](../README.md)
