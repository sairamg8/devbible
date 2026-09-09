---
title: "Angular's TypeScript window is one minor wide because two release trains run at different speeds and the pin is the seam between them — the changelog shows support arriving in a minor and being withdrawn at the next major, and nowhere does the documentation say why"
sidebar_label: "02 · Why the pin is one minor wide"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5` —
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md), entries under
> `21.2.0 (2026-02-25)` and `22.0.0 (2026-06-03)` — and the published manifests on
> `registry.npmjs.org`
> ([`@angular/compiler-cli@22.1.5`](https://registry.npmjs.org/@angular/compiler-cli/22.1.5),
> [`typescript` dist-tags](https://registry.npmjs.org/-/package/typescript/dist-tags), read 2026-09-09).
> 🔴 **No Angular documentation page stating the rationale was found**; the mechanism section below
> is labelled as a reading of source, not as doctrine. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**"Why is the range so narrow?" has two different answers and they are usually confused with each other. The technical answer — what `ngtsc` reaches into that TypeScript is free to move between minors — is argued in full, with the inventory of internals, in [13b · `ngc` is `tsc`, and the pin](../01-compiler-with-a-framework-attached/13b-ngc-is-tsc-and-the-typescript-pin.md), and this page does not repeat it. The answer this page gives is the release-management one, because that is the one that determines what you should do on a Tuesday: when does the window move, what does the record actually show about how it moves, and what follows for a project that wants to stay current. The short version is that the window is not a fence around a moment — it slides, on Angular's schedule and not TypeScript's, and every attempt to move it from your side ends at the same thrown error.**

## What the release record actually shows

Three entries from `angular/angular`'s `CHANGELOG.md` at `v22.1.5`, each quoted with its release heading, verbatim.

Under **`# 21.2.0 (2026-02-25)`**, in the `### core` table:

> `| 81cabc1477 | feat | add support for TypeScript 6 |`

Under **`# 22.0.0 (2026-06-03)`**, in the `### core` table:

> `| 8fe025f514 | feat | drop support for TypeScript 5.9 |`

Under **`# 22.0.0 (2026-06-03)`**, in `## Breaking Changes` → `### core`:

> *"- * TypeScript versions older than 6.0 are no longer supported."*

(The stray `*` after the dash is in the changelog itself, not a transcription slip. The corpus rule is that upstream text is quoted as written, typography included.)

🔴 **The dates carry the answer.** Support for the *new* TypeScript major landed in a **minor** of the previous Angular major, on 2026-02-25. Support for the *old* one was withdrawn in the **next major**, on 2026-06-03. Those are two different releases, roughly three months apart, and they do two opposite things — one adds, one removes. That gap is the migration ramp: the version in which you can move TypeScript is not the version in which you must.

⚠️ **The precise shape of the overlap is not established by these entries alone.** They show that support for TypeScript 6 was *added* in 21.2.0 and that 5.9 was *dropped* in 22.0.0. They do not, by themselves, prove that v21.2's range literally accepted both at once rather than moving from one to the other — `MIN_TS_VERSION` and `MAX_TS_VERSION` at tag `v21.2.0` were not read while writing this page. State it the way the record states it: **added in a minor, removed at the next major.** The natural reading is a widened window, and the natural reading is not evidence.

## Two release trains, and the pin is the seam

The pin is the boundary between two projects that release on unrelated schedules and have no obligation to coordinate.

| | Cadence | Where the number comes from |
|---|---|---|
| Angular majors | roughly every six months — the full cadence and its support windows belong to **09 · The release train** *(not written yet)* | Angular's own schedule |
| TypeScript releases | roughly quarterly, and the **6.0 → 7.0** major boundary happened inside this window | TypeScript's own schedule |

Measured on `registry.npmjs.org` on **2026-09-09**: `typescript@latest` was **7.0.2**, while `@angular/compiler-cli@22.1.5` declared `>=6.0 <6.1`. A whole major apart, at a moment when both projects were shipping normally and neither had done anything wrong.

**That is the steady state, not an incident.** For most of any given year, `typescript@latest` is ahead of what the current Angular accepts, because TypeScript ships more often. A project that treats "is my TypeScript the newest?" as the health question will therefore be permanently, correctly, unhealthy — and the tooling that asks that question on your behalf (`npm outdated`, an update bot's default configuration) will keep saying so.

⚠️ **None of this is a permanent fact about TypeScript 7 or about Angular 22.** It is an arithmetic relationship measured on a date. Written correctly, the claim is: *Angular 22.1.5 declares `>=6.0 <6.1`, and `typescript@latest` was 7.0.2 on 2026-09-09.* The way to keep it true is to re-measure it rather than to remember it — one registry read answers it for any version:

```bash
# What the installed compiler actually demands
node -p "require('@angular/compiler-cli/package.json').peerDependencies.typescript"

# What a version you have not installed demands
npm view @angular/compiler-cli@22.1.5 peerDependencies.typescript

# What npm would give you if you asked for "the latest TypeScript"
npm view typescript version
```

The third line is the one worth running before you accept an automated dependency PR.

## Why the window is narrow at all — a reading, not a doctrine

🔴 **No Angular documentation page was found that states the rationale.** Not the compiler-options reference, not the release notes, not the changelog. What follows is a reading of the compiler's own source, and it is offered as a reading.

The chain is short, and every link is a fact quoted elsewhere in this topic or in topic 01:

- `@angular/compiler-cli` constructs and owns a `ts.Program` — `NgtscProgram`, whose constructor is quoted in [01b](01b-the-check-inside-the-compiler.md).
- It calls TypeScript's configuration API directly, `ts.readConfigFile` and `ts.parseJsonConfigFileContent`, to load your `tsconfig.json` — see **04 · `angularCompilerOptions` and how it inherits** *(not written yet)*.
- It reads `ts.version` off the module object at runtime, rather than off a manifest ([01b](01b-the-check-inside-the-compiler.md)).
- It **generates type-check blocks**: synthetic TypeScript that TypeScript is then asked to check, which is what template type checking actually is — see [14 · Template type checking](../01-compiler-with-a-framework-attached/14-template-type-checking.md).
- Its diagnostic categories map onto `ts.DiagnosticCategory`, so Angular's error surface *is* TypeScript's error surface ([13c](../01-compiler-with-a-framework-attached/13c-the-ng-error-code-is-a-typescript-code.md)).

**Angular does not *use* TypeScript; it *drives* TypeScript.** A library that imports a few types can safely accept a caret range, because the surface it touches is the part semver protects. A tool that emits code into another compiler's program, walks that compiler's AST and reads its diagnostics is coupled to that compiler's *implementation*, which semver says nothing about. A one-minor window is what that coupling costs, and [13b](../01-compiler-with-a-framework-attached/13b-ngc-is-tsc-and-the-typescript-pin.md) enumerates the specific internals — `ts.SyntaxKind`, transformer factories, the type checker, node positions — that make it concrete.

The one piece of hard evidence that the two decisions are coupled rather than merely coincident is that Angular ships the range **twice**: once as a peer range in `package.json`, and once as two constants inside the compiler that no consumer can configure. A dependency you merely *use* does not get a second, unconfigurable check.

## The posture that follows

If the window moves on Angular's schedule, then TypeScript is not a dependency you upgrade — it is a dependency that gets upgraded *for* you, when you move Angular.

```json
"devDependencies": {
  "typescript": "~6.0.2"
}
```

That range is the one the CLI writes into a new workspace, and leaving it alone is the entire maintenance strategy. When it needs to move, [04 · `ng update`, not `npm install`](../04-ng-update-not-npm-install/README.md) is the mechanism that moves it — including the [peer-dependency gate](../04-ng-update-not-npm-install/05-the-peer-dependency-gate.md) that refuses to write a plan whose peer ranges do not line up, and the [one-major-at-a-time rule](../04-ng-update-not-npm-install/02-one-major-at-a-time.md) that stops you skipping the release in which the window moved.

⚠️ Angular's older majors continue to receive releases, so "which TypeScript does Angular support" has a different answer per major. **The pins of the v19, v20 and v21 lines were not measured for this page** — read each one from the registry rather than assuming it follows the same arithmetic.

## Gotchas

**★ Symptom: "I upgraded TypeScript, Angular broke, so I will upgrade Angular to match."** Cause: the causality is inverted. Angular decides which TypeScript versions are acceptable; TypeScript has no opinion about Angular. Upgrading Angular to chase a TypeScript you installed puts a major framework upgrade on the critical path of a change nobody asked for. Fix: put TypeScript back first, then decide about Angular on its own merits:

```json
"devDependencies": {
  "typescript": "~6.0.2"
}
```

**★ Symptom: an automated dependency PR bumps `typescript` a minor or a major and the install step passes.** Cause: the install step is not where the range is enforced ([01](01-the-typescript-peer-pin.md)), and a pipeline that installs without compiling cannot see the enforcement that matters. Fix: make TypeScript a version your bot is not allowed to move on its own, and let the Angular upgrade move it. In an Angular project a TypeScript bump is never an isolated dependency update, whatever the diff looks like.

**★ Symptom: `typescript` sits in `dependencies` rather than `devDependencies`.** Cause: hand editing, or a copy from a non-Angular project. The CLI writes it to `devDependencies`; it is a compile-time tool and nothing in your shipped bundle imports it. Nothing fails loudly, which is why it survives. Fix:

```json
"dependencies": {
  "@angular/core": "^22.1.5"
},
"devDependencies": {
  "typescript": "~6.0.2"
}
```

**★ Symptom: a shared monorepo pins one TypeScript across Angular and non-Angular packages, and the non-Angular team wants to move it.** Cause: Angular's constraint is the tightest one present, so it governs the whole hoisted tree whether or not that was anyone's intention. Fix: either accept that the repo's TypeScript is Angular's TypeScript, or stop hoisting it — a per-package `typescript` with no root copy is the only arrangement in which the two halves can disagree, and it must be *verified*, not assumed:

```bash
npm ls typescript --all      # expect one path per package that needs its own
```

**★ Symptom: someone widened the range to `^6.0.0` to make the peer warning stop.** Cause: a caret admits `6.1.0` and above, which is outside both the declared peer range and the compiler's own interval; the warning stops and the failure moves. Fix: the tilde is load-bearing, not stylistic — `~6.0.2` cannot leave the window and `^6.0.0` can.

**Symptom: you want a language feature that shipped in a TypeScript the pin excludes.** Cause: there is no supported configuration in which Angular 22.1.5 compiles with TypeScript 6.1 or 7.x, and `disableTypeScriptVersionCheck` removes the message rather than the incompatibility ([01b](01b-the-check-inside-the-compiler.md)). Fix: the honest answer is to wait for the Angular release that widens the window, and to plan around not having the feature until then. There is no flag that buys it.

**Symptom: two Angular majors in one workspace — a v21 library and a v22 application — and a single hoisted `typescript`.** Cause: each major declares its own range, and there is no guarantee the two ranges intersect. Fix: read both, do not infer either:

```bash
npm view @angular/compiler-cli@21.2.22 peerDependencies.typescript
npm view @angular/compiler-cli@22.1.5 peerDependencies.typescript
```

If they do not overlap, the two majors cannot share a hoisted TypeScript, and that is a workspace-layout problem rather than a version problem.

**Symptom: a multi-major upgrade was budgeted for Angular API changes and overran on unrelated type errors.** Cause: every rung of the ladder also moves the TypeScript window, so your own code has to compile under a different TypeScript at each step — [02b · Running the ladder](../04-ng-update-not-npm-install/02b-running-the-ladder.md) lists TypeScript, Node and every Angular library as travelling with each rung. Fix: read the range for each rung *before* starting, and budget a compile-fix pass per rung rather than one at the end:

```bash
npm view @angular/compiler-cli@21.2.22 peerDependencies.typescript
npm view @angular/compiler-cli@22.1.5 peerDependencies.typescript
```

**Symptom: `npm outdated` has reported `typescript` as behind for months and the team has stopped reading its output.** Cause: it is behind on purpose, permanently, by the design of the pin — and a report that is always red trains people to ignore reports. Fix: exclude `typescript` from that report rather than tolerating a permanent false positive, and get the signal from `ng update` instead, which knows about Angular's window.

**Symptom: a blog post or an answer says "Angular 22 supports TypeScript 7".** Cause: a claim about a moving window, written on a date, repeated after the date. Fix: the claim is checkable in one command, and the manifest outranks any prose:

```bash
npm view @angular/compiler-cli@22.1.5 peerDependencies.typescript
```

## Interview questions

**★ Why can Angular not simply accept `^6.0.0`?**
Because a caret covers everything up to the next major, including `6.1`, `6.2` and so on, and the surfaces Angular depends on are not the surfaces semver protects. `@angular/compiler-cli` constructs `ts.Program`s, generates synthetic TypeScript for template type checking, walks the AST and maps its diagnostics onto TypeScript's — implementation surface, not the language. A range one minor wide is the compiler stating that it has been tested against exactly one minor. The detail worth adding is that the range is not even expressed as a semver range in the enforcement path: it is two string constants, `MIN_TS_VERSION` and `MAX_TS_VERSION`, compared by Angular's own `compareVersions`. A project ships a second, unconfigurable copy of a constraint only when the constraint is not advisory.

**★ When does Angular add support for a new TypeScript major, and when does it drop the old one?**
The changelog for `v22.1.5` shows both events. `add support for TypeScript 6` appears under `21.2.0 (2026-02-25)` — a *minor* of the previous major. `drop support for TypeScript 5.9` appears under `22.0.0 (2026-06-03)` — the *next major*, three months later, and the breaking-changes section states it as *"TypeScript versions older than 6.0 are no longer supported."* So support arrives early and removal waits for a major boundary, which is a deliberate ramp: there is a release in which you may move TypeScript before there is a release in which you must. The careful version of this answer notes that the changelog entries show an addition and a removal at two different releases and do not by themselves prove the intervening range accepted both simultaneously.

**★ Your CI pipeline installs `typescript@latest`. What breaks, and when?**
Nothing at install — the peer declaration in `@angular/compiler-cli` is optional, and even the required one in `@angular/build` is silenced by the flags CI pipelines tend to carry. The first `ng build` then throws before any analysis, with a message naming a version and no file. The timing is the interesting half of the answer: the failing step is not the step that caused it, and the log of the step that caused it looks clean. The fix is a pinned range in `package.json` and the removal of any unpinned install from the pipeline.

**★ Is the one-minor pin a design defect?**
It is a cost, deliberately paid, and the trade is visible in the source. Angular's compiler is a TypeScript transformer plus a type-check-block generator, which buys template type checking, real diagnostics with real source positions, and `.d.ts` emission that other tooling understands — none of which is available to a framework that keeps TypeScript at arm's length. The invoice for that is coupling to TypeScript's implementation, and the pin is Angular declining to pretend otherwise. The alternative — a caret range and a compiler that breaks in some minor without warning — would be worse in every way except the one that shows up in `npm outdated`.

**Does Angular document why the range is one minor wide?**
No page stating the rationale was found — not the compiler-options reference, not the release notes, not the changelog. What exists is evidence: the range is shipped twice, once as a peer range and once as constants inside the compiler, and the compiler's source shows it consuming TypeScript's internal surfaces throughout. The argument from that evidence is strong, but it is an inference, and the honest form of the answer says so. Being able to distinguish *"the source implies this"* from *"the documentation says this"* is most of what makes a claim about a framework trustworthy.

**A colleague wants to skip from Angular 21 to 23 in one step to reduce disruption. What does the TypeScript pin have to do with it?**
The window moves with the major, so a two-major hop is also a two-window hop, and the intermediate release — the one that added support for the TypeScript you are landing on — is the one you skipped. The CLI refuses this independently of TypeScript, which [04 · One major at a time](../04-ng-update-not-npm-install/02-one-major-at-a-time.md) covers. The TypeScript angle is the reason the refusal is doing you a favour rather than being pedantic: the ramp only exists if you stand on each rung.

{/* FOOTER */}
