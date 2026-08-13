---
title: "Versions and release channels"
sidebar_label: "08 · Versions and channels"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the npm registry. Every version and date is
> printed by `sandbox/react-p0/ex08-versions-channels.mjs`, which queries
> `npm view` directly.

**React publishes four channels from one repository. `latest` is the only one
an application should install; frameworks are the intended audience for
`canary`.**

## The channels

```console
$ node ex08-versions-channels.mjs
=== react dist-tags — what `npm install react@<tag>` gives you ===
  beta          19.0.0-beta-26f2496093-20240514
  rc            19.0.0-rc.1
  next          19.3.0-canary-d5736f09-20260507
  latest        19.2.8
  backport      19.0.8
  experimental  0.0.0-experimental-22e4f993-20260811
  canary        19.3.0-canary-22e4f993-20260811
```

| Tag | What it is | Who should use it |
|---|---|---|
| **`latest`** | The stable release. Semver applies | **You** |
| `canary` | Every commit that passes CI, published continuously. Individual features may be incomplete | Frameworks that pin an exact build |
| `experimental` | Canary plus unreleased experiments. No stability promise at all | React's own team, and demos |
| `next` | An alias that trails `canary` | Nobody, in practice |
| `beta` / `rc` | Frozen pre-releases from a past major cycle | Nobody now — note `beta` still points at a **2024** build |

The `beta` tag pointing at `19.0.0-beta-…-20240514` is worth noticing: dist-tags
are not automatically retired. `npm install react@beta` in August 2026 installs a
two-year-old pre-release of a version that shipped long ago.

## Canary is not "the nightly build you should try"

```console
=== how many canaries were published in the same window? ===
  total canary builds published     614
  newest canary                     19.3.0-canary-22e4f993-20260811  (2026-08-12)
  stable minors in the same period  3
```

614 canary builds against 3 stable minors. Canary exists so that frameworks can
adopt features — Server Components most of all — before they are in a stable
React, by pinning one exact build and testing against it.

The framework then takes responsibility for that build's behaviour. If you pin a
canary yourself, you have taken on that responsibility with none of the test
suite. Note also that the canary in the registry's `time` map is newer than the
one `dist-tags` points at, because the tag is moved separately from publishing.

## The stable line, and how it actually moves

```console
=== minor releases only — how often does the feature line move? ===
  19.0.0     2024-12-05
  19.1.0     2025-03-28
  19.2.0     2025-10-01
  latest minor  19.2.0
  released      2025-10-01
  days since    316
```

**React 19.2 is 316 days old and is still the newest feature release.** There is
no 19.3. This is normal for React and worth internalising: the gap between
feature releases is measured in quarters, and the ecosystem's churn — routers,
frameworks, state libraries — is not React's churn.

## Patches land on three lines at once

```console
=== publish dates of the 19.x stable line ===
  19.2.1     2025-12-03
  19.1.2     2025-12-03
  19.0.1     2025-12-03
  19.2.2     2025-12-11
  19.1.3     2025-12-11
  19.0.2     2025-12-11
  19.2.3     2025-12-11
  …
  19.2.8     2026-07-21
  19.1.9     2026-07-21
  19.0.8     2026-07-21
```

Three patches published the same day, three times over, is the signature of a
**security backport**: the fix goes to 19.2, 19.1 and 19.0 simultaneously so
that applications pinned to an older minor can take it without a feature
upgrade. The December 2025 dates line up with the two Server Components
advisories — covered in Phase 10.

The `backport` dist-tag exists for exactly this: it points at `19.0.8`, the
patched build of the **oldest** supported 19 line.

**What this means for you:** patch upgrades within your minor are safe and
sometimes urgent. Take them.

## What to pin

```jsonc
// package.json
{
  "dependencies": {
    "react": "19.2.8",        // exact, not ^ — react and react-dom must match
    "react-dom": "19.2.8"
  }
}
```

Pin `react` and `react-dom` to the **same exact version**. A caret range is
usually fine for other packages, but these two share private internals, and a
lockfile that resolves them to different patches is a class of bug that is
miserable to diagnose.

Then upgrade both together, deliberately, and read the changelog.

## The ecosystem moves faster than React

```console
=== the ecosystem versions a 2026 project actually installs ===
  react-router                 latest=8.3.0
  next                         latest=16.3.0
  @vitejs/plugin-react         latest=6.0.5
  eslint-plugin-react-hooks    latest=7.1.1
  babel-plugin-react-compiler  latest=1.0.0
```

React had three minors in twenty months; React Router shipped a major in June
2026 and three minors by July. When something "changed in React" and you cannot
find it in React's changelog, check the router or the framework first — that is
usually where it changed.

## Governance

React moved to the **React Foundation**, hosted by the Linux Foundation, on
24 February 2026. Practically, for you:

- The repository, the release process and the team are unchanged day to day.
- Governance is no longer solely Meta's, which matters for long-term dependency
  risk assessments — the question "what if Meta loses interest?" now has a
  structural answer.
- Significant changes still go through the public RFC process before they ship.

## Gotchas

**Symptom:** `npm install react@beta` installs something from 2024.
**Cause:** dist-tags are not retired when a cycle ends; `beta` still points at a
19.0.0 pre-release.
**Fix:** install `latest`, or an exact version. Never install by an old
pre-release tag.

**Symptom:** a feature that "exists in React" is `undefined` at runtime — most
often `ViewTransition`.
**Cause:** it is in the experimental channel, not in `latest`. See the syllabus
README for the measured diff.
**Fix:** check `Object.keys(require('react'))` in your installed version before
believing a blog post.

**Symptom:** confusing runtime errors deep inside `react-dom` after an upgrade.
**Cause:** `react` and `react-dom` resolved to different versions.
**Fix:** `npm ls react react-dom`; pin both to the same exact version.

**Symptom:** you are on 19.0.x and a CVE is announced.
**Cause:** none — this is the supported case.
**Fix:** take the patch on your own line (19.0.8), not a jump to 19.2.

## Interview questions

**★ What are React's release channels?**
`latest` (stable, semver), `canary` (every passing commit, for frameworks),
`experimental` (canary plus unreleased experiments, no guarantees), plus the
frozen `beta`/`rc` tags from past cycles. Applications use `latest`.

**★ Why does Next.js ship a canary React?**
Server Components and related APIs land in canary long before a stable release.
Frameworks pin an exact canary build, test against it, and take responsibility
for it, which is what lets those features exist in a framework before React
declares them stable.

**Why must `react` and `react-dom` be the same version?**
They share private internals that are not a versioned API. Mismatches produce
undefined behaviour, usually as an incomprehensible error inside the renderer.

**What does it mean when three React patches ship on the same day?**
A backport — the same fix applied to every supported minor line so that apps
pinned to an older minor can take a security patch without a feature upgrade.
The `backport` dist-tag points at the oldest supported line's patched build.

**How often does React ship features?**
Rarely. 19.0 in December 2024, 19.1 in March 2025, 19.2 in October 2025, and
nothing since — 316 days as of this writing. Most perceived React churn is
router and framework churn.

---

← Prev: [StrictMode](07-strictmode.md) · Index: [Phase 0](README.md) · Next → [What changed in React 19](09-what-changed-in-19.md)
