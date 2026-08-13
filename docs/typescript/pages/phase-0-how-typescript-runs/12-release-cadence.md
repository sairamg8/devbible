---
title: "Release cadence and upgrades"
sidebar_label: "12 · Release cadence"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. Dist-tags read with `npm view typescript dist-tags`;
> default comparisons produced by `tsc --help --all` on **7.0.2** and **5.9.3**
> installed side by side (`sandbox/ts-p0/`).

**TypeScript ships often, and its version numbers do not mean what semver
usually means. A minor release can break your build — deliberately, because a
better check found a real bug.**

## What is published right now

```console
$ npm view typescript dist-tags
{
  latest: '7.0.2',
  rc: '7.0.1-rc',
  beta: '6.0.0-beta',
  next: '7.1.0-dev.20260813.1',
  dev: '3.9.4',
  insiders: '4.6.2-insiders.20220225',
  'tag-for-publishing-older-releases': '4.1.6'
}
```

| Tag | What it is | Use it? |
|---|---|---|
| `latest` | Current stable — **7.0.2** | Yes |
| `rc` | Release candidate for the next minor | Try it in CI on a branch |
| `beta` | **6.0.0-beta**, the deprecation bridge | Only as an upgrade stepping stone |
| `next` | Nightly | Reproducing a bug, or testing a fix |

The last two entries are historical debris — treat anything below 5.x on that
list as a fossil, not a channel.

## Why a minor release breaks builds

TypeScript's minors regularly add checks. Better inference finds a bug that was
always there; your build goes red without a line of your code changing. That is
the product working, but it means:

> **Pin the compiler in `devDependencies` and upgrade deliberately.** A caret
> range (`^7.0.0`) lets a colleague's fresh `npm install` produce errors yours
> does not have — the same class of confusion as
> [09 · Editor vs build](./09-language-server-vs-build.md), with no clue about
> the cause.

Pin it, upgrade in its own pull request, and read the release notes for that
version only.

## The 5 → 6 → 7 path

| Version | What it is |
|---|---|
| **5.9.3** | Last of the JavaScript-implemented 5.x line |
| **6.0** | Same codebase, carrying deprecations and warnings — the bridge |
| **7.0.2** | The native compiler ([07](./07-typescript-7-native-compiler.md)) |

The intended route is **through 6.0**: upgrade, fix what it warns about while
still on the familiar implementation, then move to 7. Application code often
jumps straight to 7 without trouble; **tooling is where the risk is**, because
the compiler API moved out of the package root.

Defaults that changed, measured:

| Option | 5.9.3 | 7.0.2 |
|---|---|---|
| `strict` | `false` | **`true`** |
| `esModuleInterop` | `false` | **`true`** |
| `moduleResolution` | `Node` / `Classic` | **`bundler`** or `node16`/`nodenext` |

A project that never set these explicitly will behave differently on 7. Setting
them explicitly *before* upgrading turns a surprise into a no-op.

## An upgrade that does not ruin a week

1. **Pin the current version** and make sure CI is green.
2. **Write the old defaults down** — `strict`, `esModuleInterop`,
   `moduleResolution` — so the upgrade cannot change behaviour silently.
3. **Upgrade in its own PR**, nothing else in it.
4. **Run `tsc --noEmit` and read the first ten errors only.** They are usually
   two or three causes repeated.
5. **Audit tooling** — anything importing `typescript`: lint plugins, codemods,
   `ts-morph`, custom transformers.
6. **Decide about new checks separately.** If the upgrade also enables stricter
   behaviour, land the version bump first with the old flags, then tighten in a
   follow-up.

## Reading release notes usefully

Skip the feature tour; go to **breaking changes** and **`lib.d.ts` updates**.
The second is the sneaky one: TypeScript ships updated DOM and ES library
declarations, so a `lib.d.ts` change can produce errors in code you did not
write and did not import. That is a common cause of "the upgrade broke a file
nobody touched".

## Trade-off

**Upgrading promptly** keeps the diff small and gets better inference and speed.
Each bump can cost a day of error triage.

**Staying put** is free until it is not: dependencies begin requiring newer
compilers, `@types` packages assume newer syntax, and eventually you face several
majors at once — which is how a one-day upgrade becomes a project.

## Gotchas

**Symptom:** Build broke after `npm install`, no source changes
**Cause:** A caret range let a new minor in, and it added a check.
**Fix:** Pin the exact version in `devDependencies`.

**Symptom:** Errors in files nobody edited after an upgrade
**Cause:** Updated `lib.d.ts` declarations changed built-in signatures.
**Fix:** Read the lib-change section of the release notes; pin `lib` explicitly.

**Symptom:** Two developers see different errors on the same commit
**Cause:** Unpinned compiler, or an editor using its bundled version.
**Fix:** Pin, and point the editor at the workspace version
([09](./09-language-server-vs-build.md)).

**Symptom:** A lint rule or codemod fails after moving to 7
**Cause:** It imported the old root `typescript` API.
**Fix:** Update the tool, or hold it on 5.x until it supports the new surface.

## Interview questions

**★ Why can a TypeScript minor upgrade break your build?**
Because minors add and improve checks. Nothing in your code changed; the compiler
got better at finding what was already wrong. Semver's "minor is safe" intuition
does not transfer, so the compiler is pinned and upgraded deliberately.

**★ What is TypeScript 6.0 for if 7.0 is out?**
It is the bridge — the JavaScript-implemented codebase carrying deprecations and
warnings, so a large project can fix issues on the familiar compiler before
switching to the native one.

**Which part of an upgrade is riskiest?**
Tooling that imports `typescript`, because the compiler API moved out of the
package root in 7. Application code is mostly affected by changed defaults, which
is a config conversation.

**What do you read in the release notes?**
Breaking changes and `lib.d.ts` updates. The library declaration changes are what
produce errors in files you never touched.

---

← Prev: [Project layout](./11-project-layout.md) · Next → [The Playground and `@ts-check`](./13-playground-and-ts-check.md)
