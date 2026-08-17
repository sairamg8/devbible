---
title: "Editor performance"
sidebar_label: "07 · Editor performance"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript wiki's Performance** page (its
> *Performance Tracing* and editor guidance), the **`tsconfig` reference** for
> `include`, `types`, `disableSourceOfProjectReferenceRedirect` and `composite`, and
> **typescript-eslint's** *Typed Linting → Performance* page. ⚠️ **Editor-specific
> command names differ by editor and are described rather than quoted.** The four
> ways the editor and the build disagree are
> [phase 0 · 09](../phase-0-how-typescript-runs/09-language-server-vs-build.md)'s.
> **No timing figure is ours. No console block.**

[Topic 06](./06-diagnosing-a-slow-compile/README.md) diagnosed the *build*.
**The editor is a different process doing a different job**, and treating the two as
one problem is why "the editor is slow" investigations stall.

## 🔴 What actually differs

| | The build | The language server |
|---|---|---|
| Lifetime | starts, runs, exits | **runs for days** |
| Work unit | the whole program, once | 🔴 **a query per keystroke** |
| Memory | reclaimed at exit | **held the entire time** |
| Scope | one project | 🔴 **every project you have open** |
| Emit | maybe | never — it is always checking |

**Two of those rows generate almost every editor complaint:**

1. 🔴 **A cost the build pays once, the editor pays repeatedly.** One expensive type
   in a file you are editing is amortised to nothing in CI and is felt on every
   keystroke. **The same type has a completely different price in the two places.**
2. 🔴 **The server holds everything in memory, for days.** A program that is merely
   large in CI is a resident cost here, and it accumulates across every project the
   window has touched.

📌 **So the editor can be slow on a project whose build is fine** — and that is not a
contradiction to explain away, it is the expected consequence of a different work
unit.

## The causes, in the order worth checking

1. 🔴 **Program size — the same three causes as
   [topic 06](./06-diagnosing-a-slow-compile/01-measure-before-you-guess.md)** (wide
   `include`, barrel files, un-narrowed `types`), **but weighted differently.** In a
   build, a large program costs time once. In the editor it costs **memory
   permanently** and widens every completion query. **This is still the first thing
   to look at.**
2. 🔴 **A second program you forgot you were running.** If type-aware linting is
   enabled *in the editor*, the linter builds **its own program** — so the window is
   holding two ([phase 10 · 11](../phase-10-strictness/11-typescript-eslint/README.md)).
   ⚠️ **This is the most commonly missed cause**, because the lint plugin is
   configured as a linter and nobody counts it as a compiler.
3. **Several projects open at once**, each with its own program. A monorepo window
   with six packages open is six programs.
4. **One expensive type in a file under active edit** — the amortisation point
   above. [Topic 06 · chunk 02](./06-diagnosing-a-slow-compile/02-the-shapes-that-are-slow.md)
   identifies the shapes; the editor is where you *feel* them.
5. **A version mismatch** between the editor's bundled compiler and the workspace's
   ([topic 02 · chunk 03](./02-typescript-7-for-tooling/03-upgrading-in-stages.md)) —
   which is a correctness problem first and sometimes a performance one too.

## 🔴 Restarting the server is a diagnostic, not a fix

Everyone's first move, and it is worth understanding what it tells you:

> **If restarting makes it fast again, the problem is accumulated state, not project
> size.** A project that is too large is slow again immediately; one that degraded
> over hours was leaking or accumulating.

⚠️ **A slow editor that needs restarting twice a day is a bug worth reporting**, with
the server log attached — and it is a *different* investigation from the one this
topic mostly describes. **Do not spend a week narrowing `include` globs for a
problem that a restart fixes.**

## What actually helps

| Change | Why it works here specifically |
|---|---|
| 🔴 **Narrow the program** | fewer files resident, smaller completion surface — the same fix as the build, with a larger payoff |
| 🔴 **Kill the second program** | run type-aware lint **in CI only** if the editor is the constraint; you keep the check and lose the resident cost |
| **Project references** | let the server load dependencies as **declarations** rather than sources |
| **Close projects you are not working in** | each open project is a program |
| **Import from modules, not barrels** | narrows the graph the server has to resolve for completions |
| **More memory** | ⚠️ unglamorous, and the server is a long-lived process where it matters more than in a build |

📌 **The second row is the highest-value one and the least considered.** Type-aware
linting in the editor gives you fast feedback on rules whose failures would be caught
in CI a few minutes later — **so it is a real trade rather than a free feature**, and
on a constrained machine it is the first thing to give up.

⚠️ **Project references have a caveat worth knowing**: the server can be pointed at a
referenced project's *sources* or its *built declarations*, and which one you get
changes both the memory profile and whether you need a build before "go to
definition" works. **Phase 6 · 13 · Project references** *(lane D's topic)* owns the
mechanism.

## The measurement

⚠️ **The editor's own tooling is the way in, and it is editor-specific** — the
language server can be asked to produce a log, and the wiki's *Performance Tracing*
guidance applies to the server as well as to a build.

🔴 **But the cheapest useful measurement is one you already know how to take: run
`--extendedDiagnostics` on the same project**
([topic 06](./06-diagnosing-a-slow-compile/01-measure-before-you-guess.md)). **If the
build reports an enormous program, you have your answer without touching the editor
at all** — and if the build is small and clean, the problem is one of the
editor-specific causes above rather than the project.

## Gotchas

**Symptom:** the build is fast and the editor is slow.
**Cause:** different work units — the editor pays per keystroke and holds the program
for days.
**Fix:** 🔴 not a contradiction. Check program size first anyway, then the causes
that only exist in the editor: a second program, several projects open, one
expensive type in the file you are editing.

**Symptom:** the editor got slow and a restart fixes it.
**Cause:** accumulated state, not project size — a project that is too big is slow
again immediately.
**Fix:** ⚠️ report it with a server log. **Do not narrow `include` globs for a
problem a restart resolves.**

**Symptom:** memory use is far higher than the project seems to justify.
**Cause:** most often a second program from in-editor type-aware linting, or several
projects open at once.
**Fix:** 🔴 run type-aware lint in CI only, and close projects you are not in. The
lint plugin is the cause people never count, because it is configured as a linter.

**Symptom:** completions are slow in one file and fine everywhere else.
**Cause:** an expensive type in that file — the cost the build amortises and the
editor does not.
**Fix:** topic 06 · chunk 02. 📌 The editor is the best detector for this, because it
is where the price is actually paid.

**Symptom:** "go to definition" lands in a `.d.ts` inside a monorepo.
**Cause:** the server is resolving the referenced project's declarations rather than
its sources.
**Fix:** a project-references configuration question rather than a performance one —
but the two settings trade against each other, which is why it shows up here.

**Symptom:** the editor reports errors CI does not.
**Cause:** a different compiler version or a different file set — phase 0 · 09.
**Fix:** point the editor at the workspace version. ⚠️ **A correctness problem
first**; treating it as a performance symptom wastes the investigation.

**Symptom:** narrowing `include` helped the build and not the editor.
**Cause:** the editor's program is determined by the files you open, not only by the
config.
**Fix:** it still helps — but check the other resident costs, because in the editor
the config is one input among several.

## Interview questions

**Why can the editor be slow when the build is fast?**
Because they do different work. The build checks the whole program once and exits;
the language server answers a query per keystroke and holds the program in memory
for days. So a cost the build amortises to nothing — one expensive type in a file you
are editing — is paid repeatedly in the editor, and a merely large program becomes a
permanent resident cost.

**What is the most commonly missed cause?**
A second program. If type-aware linting is enabled in the editor, the linter builds
its own program, so the window is holding two. It goes unnoticed because the plugin
is configured as a linter rather than as a compiler consumer, and it is the highest-
value thing to turn off when the machine is the constraint — you keep the check in
CI and lose the resident cost.

**Restarting the server fixes it. What does that tell you?**
That the problem is accumulated state rather than project size — a project that is
too large is slow again immediately, while one that degraded over hours was leaking.
That makes it a bug to report with a server log, and it means narrowing config globs
is the wrong investigation.

**How would you measure it without editor-specific tooling?**
Run `--extendedDiagnostics` on the same project. If the build reports an enormous
program you have the answer without touching the editor; if the build is small and
clean, the cause is one of the editor-only ones — a second program, multiple open
projects, or an expensive type in the file being edited.

**Do the same fixes work as for a slow build?**
The program-size ones do, with a bigger payoff, because fewer files means less
resident memory and a smaller completion surface rather than just less work once.
But the editor adds fixes that have no build equivalent: closing projects, moving
type-aware lint to CI, and letting project references load declarations instead of
sources.

**Is in-editor type-aware linting worth it?**
It is a trade rather than a free feature. It gives fast feedback on rules whose
failures CI would report a few minutes later, at the cost of a second resident
program. On a constrained machine it is the first thing to give up, and giving it up
costs you nothing in coverage — only in latency.

---

← [06 · Diagnosing a slow compile](./06-diagnosing-a-slow-compile/README.md) · [Phase 12 index](./README.md)
