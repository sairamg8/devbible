---
title: "Three majors behind means three separate updates, each verified before the next begins — and every rung moves your Node version, your TypeScript version and your library peers as well as Angular"
sidebar_label: "02b · Running the ladder"
sidebar_position: 2.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Angular versioning and releases](https://angular.dev/reference/releases) (support table and
> release policy, quoted verbatim); the published manifests
> [`@angular/cli@22.1.7`](https://registry.npmjs.org/@angular/cli/22.1.7) and
> [`@angular/compiler-cli@22.1.5`](https://registry.npmjs.org/@angular/compiler-cli/22.1.5)
> for `engines` and the TypeScript peer range.
> Documentation-validated; **no sandbox run** — no update was performed and no timings are quoted.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1` · Node `^22.22.3 || ^24.15.0 || >=26.0.0`.

**[Chunk 02](02-one-major-at-a-time.md) is the rule. This is the procedure.** Three majors behind
is three separate updates, and the mistake that turns a two-day job into a two-week one is running
them back to back and testing at the end. Each rung of the ladder is a complete upgrade in its own
right: it runs that major's migrations, it moves your TypeScript version, it may move your Node
version, and it requires every Angular-ecosystem library you depend on to have a release that
accepts that major. Verifying one rung before climbing the next is not caution, it is the only way
to know which rung broke something.

## The ladder, in practice

You are on v19 and you want v22. That is three runs, in order, each one complete before the next
begins:

```bash
# 1 · get to v20
ng update @angular/cli@^20 @angular/core@^20
# run the test suite, run the app, commit

# 2 · get to v21
ng update @angular/cli@^21 @angular/core@^21
# run the test suite, run the app, commit

# 3 · get to v22
ng update @angular/cli@^22 @angular/core@^22
```

The caret form matters at every rung, for the reason
[chunk 01](01-why-npm-install-is-not-an-upgrade.md) gives: the docs recommend the latest patch of
each major, and the migrations you run are the ones shipped in the version you land on.

**Do not batch the verification.** The point of stopping at each rung is that a migration which
reports "no changes made" when it should have changed something is only diagnosable against the
version it belongs to. Three hops later you have no idea which one was wrong.

## The target-supported criterion, with the real numbers

angular.dev's *Actively supported versions* table, verbatim, as served at v22.1.5:

| Version | Status | Released | Active ends | LTS ends |
|---|---|---|---|---|
| `^22.0.0` | Active | 2026-06-03 | 2027-06 | 2028-06 |
| `^21.0.0` | LTS | 2025-11-19 | 2026-06-03 | 2027-06 |
| `^20.0.0` | LTS | 2025-05-28 | 2025-11-19 | 2026-11-28 |

> *"Angular versions v2 to v19 are no longer supported."*

⚠️ The page carries its own caveat — *"Dates are offered as general guidance and are subject to
change."*

So the v19 → v22 ladder above is legal: every *destination* on it (20, 21, 22) is supported, even
though the starting point is not. The release train the table describes is
**09 · The release train** *(not written yet)*; 🔴 note that as of v22 the cadence is **12-month
majors with 24 months of support**, not the six-month rhythm most online material still assumes.

## What else moves on every rung

An Angular major is not only an Angular major. Three other things travel with it, and each can stop
a rung dead:

**TypeScript.** `@angular/compiler-cli@22.1.5` declares `typescript: >=6.0 <6.1` as a peer — a
window one minor wide. Every rung of the ladder therefore moves your TypeScript version into a
different, narrow window, and your own code has to compile under it. Why the window is that tight
and what happens when you try to widen it is already documented at Master tier in topic 01's
[`13b · ngc is tsc and the TypeScript pin`](../01-compiler-with-a-framework-attached/13b-ngc-is-tsc-and-the-typescript-pin.md).

**Node.** `@angular/cli@22.1.7` declares `engines.node` as
`^22.22.3 || ^24.15.0 || >=26.0.0`. A rung whose Node requirement your machine or your CI image
does not satisfy fails at install time, before any migration runs. ⚠️ angular.dev's compatibility
table and the published manifest are not phrased identically here — the table gives `^26.0.0` for
the newest line where the manifest says `>=26.0.0`. **npm enforces the manifest**, so the manifest
is the number to build your CI image against.

**Every Angular library you depend on.** Each has a peer range naming the Angular majors it
accepts, and the update refuses to proceed on an incompatible peer unless you pass `--force`. The
CLI does soften this for `@angular/core` specifically, in a way that is worth understanding before
you reach for `--force` — [02c · How the CLI keeps its own promise](02c-how-the-cli-keeps-its-own-promise.md).
The gate itself, both directions of the check and what `--force` actually skips, is
[05 · The peer-dependency gate](05-the-peer-dependency-gate.md).

## Sequencing it as work, not as a command

The ladder is three upgrades, so it is three commits at minimum and usually three pull requests.
What makes it tractable:

```bash
git switch -c upgrade/v20
ng update @angular/cli@^20 @angular/core@^20 --create-commits
# → one commit for the dependency change, then one per migration
```

`--create-commits` (short flag `-C`) gives each migration its own commit, so a reviewer can look at
*"the commit `change-detection-eager` made"* rather than at nine hundred mixed lines. Merge that
rung, then branch again for the next. The alternative — one branch that climbs all three rungs —
produces a diff nobody will read carefully, on the change most likely to need careful reading.

**The rungs are not equally expensive.** They are all one major, but the amount of breakage per
major varies enormously with what that release changed. For v22 specifically, topic 01's
[`17c · the v22 upgrade wall`](../01-compiler-with-a-framework-attached/17c-the-v22-upgrade-wall.md)
enumerates what that hop actually costs and the order to take it in. Budget the ladder by reading
each target's changelog, not by multiplying the first rung by three.

## Gotchas

**★ Symptom: you are on v19, want v22, and v19 is out of support — so you assume `ng update` will
not help you at all.** Cause: conflating the two criteria. Support is required of the *target*, not
the source. Fix: v19 → v20 is a legal hop today because v20 is in LTS; run the ladder normally.
What the last hop specifically costs is written up in topic 01's
[`17c · the v22 upgrade wall`](../01-compiler-with-a-framework-attached/17c-the-v22-upgrade-wall.md).

**★ Symptom: the ladder worked but you cannot tell whether the middle hop actually did anything.**
Cause: you ran all three and tested once at the end. Fix: commit at each rung and run the
application, not just the unit tests — a behaviour-preserving migration that failed to match
anything produces no error and no test failure, only a subtly different runtime.

**★ Symptom: a rung fails during install with an engine error naming your Node version.** Cause:
that Angular major's `engines.node` excludes the Node you are running; for v22 the manifest says
`^22.22.3 || ^24.15.0 || >=26.0.0`. Fix: move Node **before** the rung, not after — the install
never completes, so no migration runs and you are left with a half-applied dependency change:

```bash
node -v                       # check against the target major's engines field
nvm install 24.15.0           # or whatever satisfies the range
nvm use 24.15.0
ng update @angular/cli@^22 @angular/core@^22
```

**★ Symptom: a rung completed, and now your own TypeScript no longer compiles although no Angular
API you use changed.** Cause: the rung moved TypeScript into a new one-minor window, and your code
met a new compiler behaviour, not a new framework behaviour. Fix: read the TypeScript release notes
for the window you landed in, and separate that fix into its own commit so the Angular migration
diff stays legible.

**★ Symptom: a rung is blocked by a library whose peer range names the previous major.** Cause: the
peer-dependency gate, which checks in both directions and fails the run rather than installing an
incompatible tree. Fix: upgrade that library to a release accepting the target major *in the same
run* by naming it on the command line, so the plan is resolved as a whole rather than in two steps:

```bash
ng update @angular/cli@^22 @angular/core@^22 some-ui-kit@^22
```

Reaching for `--force` instead installs a tree the library says it does not support, and any
failure after that is yours.

**★ Symptom: you climbed all three rungs on one branch and the pull request is unreviewable.**
Cause: three majors of migrations, three sets of dependency changes and three sets of hand-fixes in
one diff. Fix: one rung per branch, `--create-commits` inside each, merged in order. This costs
three review cycles and saves the one where nobody can tell what changed.

**★ Symptom: the ladder is fine locally and the CI image fails on every rung.** Cause: the CI image
pins a Node version, and the ladder moves the required Node range under it. Fix: treat the CI
image's Node version as part of each rung's change — update it in the same pull request as the
Angular hop that needs it, not in a separate housekeeping change later.

**★ Symptom: you skipped verifying a middle rung because "nothing in our code uses that feature",
and the final rung's migration crashed.** Cause: migrations transform source, and a migration that
was a no-op *for your features* may still have been the one that put your source into the shape the
next migration expects. Fix: verify every rung; the cost of running the test suite three times is
negligible compared with debugging a migration failure with three majors of ambiguity behind it.

## Interview questions

**★ You are on Angular 19 and 19 is out of support. Can you still use `ng update`?**
Yes. The documented criteria are that the target must be supported and that the source must be
within one major of the target. Nothing requires the *source* to be supported. v19 → v20 is a legal
hop as long as v20 is still in its support window, and from there you continue up the ladder. What
being on an unsupported version costs you is patches and security fixes, not the upgrade path.

**★ What moves on a single rung of the ladder besides `@angular/*`?**
Three things, any of which can block it. TypeScript, because `@angular/compiler-cli` declares a
peer range one minor wide — `>=6.0 <6.1` at v22.1.5 — so your compiler version changes at every
major. Node, because the packages declare `engines.node` and npm enforces it; v22's CLI manifest
says `^22.22.3 || ^24.15.0 || >=26.0.0`. And every Angular-ecosystem library you depend on, because
the peer-dependency gate checks their declared ranges against the tree the update wants to install.

**★ How would you sequence a three-major upgrade as work rather than as a command?**
One rung per branch and per pull request, `--create-commits` within each so every migration lands
as its own reviewable commit, and a full verification — test suite *and* the running application —
before starting the next rung. Merge in order. The reason is diagnostic rather than aesthetic: a
behaviour-preserving migration that silently matched nothing produces no error, and the only cheap
way to find it is to have exactly one major's worth of change to look at.

**Why verify by running the application and not just the test suite?**
Because the migrations most likely to fail silently are the behaviour-preserving ones — the opt-outs
that freeze pre-existing behaviour. If one of those does not match your code, nothing fails to
compile and no assertion breaks; the application simply behaves the way the new major behaves, which
may only be visible at runtime, under hydration, or under change detection. That is not a class of
change a unit test suite typically observes.

**Are the three rungs of a v19 → v22 ladder roughly equal work?**
No, and planning as if they are is how upgrades overrun. Each rung is one major by definition, but
the breakage per major depends entirely on what that release changed — v22 in particular carries a
substantial set of changes documented in topic 01's `17c`. Read each target's changelog and budget
per rung.

**If you must `--force` a rung past a library's peer range, what have you actually done?**
Installed a dependency tree that the library's own author says is unsupported. `--force` is
documented as *"Ignore peer dependency version mismatches"* — it suppresses the check, it does not
make the combination work. It is a legitimate tool when you know the library is compatible and its
range is merely stale, and a way to ship an unreproducible bug otherwise.

---

← Prev: [One major at a time](02-one-major-at-a-time.md) · Index: [Topic index](README.md) · Next → [How the CLI keeps its promise](02c-how-the-cli-keeps-its-own-promise.md)
