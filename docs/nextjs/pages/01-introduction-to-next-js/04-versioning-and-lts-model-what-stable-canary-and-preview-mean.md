---
title: "Next.js supports major lines, not minors — 16.x is Active LTS and 15.x is Maintenance LTS, and on the maintenance line a semver-minor bump is allowed to break you"
sidebar_label: "04 · Versioning and the LTS model"
sidebar_position: 5
description: "The release channels — canary, stable, and what 'preview' actually is — plus the two LTS phases, why the policy's unit is the major version, the two-year maintenance clock, and how to read a release channel before betting a production app on a feature."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against the [Next.js Support Policy](https://nextjs.org/support-policy), the [16.3 release post](https://nextjs.org/blog/next-16-3) (`publishedAt` August 3rd 2026) and the [installation docs](https://nextjs.org/docs/app/getting-started/installation) (page header `version: 16.3.4`, `lastUpdated` 2026-07-21).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**The question this page answers is the one you have to answer before you can adopt anything else in this book: given a feature you just read about, is it safe to put in production, and how long will the version you are on keep receiving security patches? Next.js answers that with two independent axes that people routinely collapse into one — a *release channel* (where a build comes from) and an *LTS phase* (how long a released line is supported). Getting them confused is how teams end up on a version that still installs fine and quietly stopped receiving patches months ago.**

## 🔴 The single most-repeated mistake: the policy is about majors

Read the support policy carefully and one word does all the work:

> A **major** version of Next.js remains in Active LTS until the subsequent major version is released.

**The unit of support is the major line — `16.x`, `15.x` — never the minor.** This matters because almost everyone, including an earlier revision of this very chapter, writes it as "Active LTS is 16.3, Maintenance LTS is 15.5". That is wrong in a way that changes decisions: it implies 16.2 has fallen out of support (it has not — it is on the Active line) and that 15.5 is a supported *version* rather than simply the newest minor released so far on the maintenance line.

| Major line | Release date | Status |
|---|---|---|
| **16.x** | Oct 21, 2025 | **Active LTS** |
| **15.x** | Oct 21, 2024 | **Maintenance LTS** |

When 17.0 ships, 16.x moves to Maintenance LTS and 15.x falls off the table entirely. Nothing about 16.3 specifically is what makes it supported; being a `16.x` is.

## The two LTS phases, and what each actually promises

**Active LTS** — the current major. Quoted: it *"benefits from new features, regular bug fixes, performance improvements, and security patches."* All four. This is the only line that gets features.

**Maintenance LTS** — the previous major, entered *"upon release of a new major"*. Quoted, Next.js commits to shipping *"only critical bug fixes and essential security updates."* Note the two qualifiers doing the limiting: **critical** and **essential**. An ordinary bug that annoys you is explicitly not in scope on this line, and no feature ever will be.

**Maintenance lasts two years from the major's initial release** — not two years from when it entered maintenance. That distinction shortens the window considerably, because a major spends roughly its first year as Active LTS. A major released in October gets about one year of Active plus about one year of Maintenance, not two years of Maintenance on top.

### Work out your own cliff date, and do it now

The rule is mechanical, so apply it to your own version rather than trusting a number someone wrote down:

```text
maintenance ends = <major's initial release date> + 2 years
```

For **15.x**: released Oct 21, 2024, so its maintenance window closes around **Oct 21, 2026**. At the time this page was verified — 2026-09-04 — that was about seven weeks away. 🔴 **Re-derive it at read time.** The arithmetic is the durable part; any interval quoted in prose starts rotting the day it is written. If you are on 15.x today, the honest read is that you are near the end of security support, not comfortably inside it.

## 🔴 On Maintenance LTS, a minor bump is allowed to break you

This is the sharpest line in the whole policy and it inverts a habit almost every team has:

> For Maintenance LTS versions, updates will land as semver-minor releases, even if they are breaking changes.

The usual discipline — *pin the major, let minors float, they are safe by semver* — is **wrong on the maintenance line**. Vercel has reserved the right to ship a breaking change as `15.5.x → 15.6.0` because there is no other slot to put it in: bumping the major would create a new major line, which is precisely what a maintenance line exists to avoid.

Practically: on `15.x`, `"next": "^15.5.0"` is not the conservative choice people think it is. Pin exactly and upgrade deliberately.

```json
// package.json — on a MAINTENANCE line, ^ is a risk, not a convenience
{
  "dependencies": {
    "next": "15.5.24"
  }
}
```

```json
// On the ACTIVE line, ^ behaves the way semver leads you to expect
{
  "dependencies": {
    "next": "^16.3.4"
  }
}
```

The same caret means two different things depending on which line you are on. That is not a quirk to memorise so much as a reason to know which line you are on at all times.

## The release channels — canary, stable, and the thing called "preview"

**Canary** is a real, documented channel: *"Next.js publishes new versions to the `canary` channel daily."* These are pre-release builds that undergo internal testing before promotion, and the docs are explicit that production traffic should not be served from them. Canary is where you go to confirm a fix landed, or to reproduce a bug against `main` before filing it.

**Stable** is what `next@latest` installs, and what enters the LTS phases above.

**"Preview" is where the corpus has to be careful, because it is not defined the way the other two are.** The support policy page names only canary and stable/LTS. There is a `preview.nextjs.org` documentation site, described on the installation page as somewhere to *"explore features before they ship in a stable version"*, and 16.3 genuinely did have a preview release a month before GA. But **no formal definition of a preview channel tier was found in the primary sources.** Treat "preview" as observed practice — a marketing and docs staging surface around a specific upcoming release — rather than a third supported channel with its own guarantees. If a page in this book implies otherwise, that page is over-claiming.

⚠️ **There is a fourth thing that is not a channel at all, and it is the one that actually bites: experimental flags inside a stable release.** `experimental.turbopackRustReactCompiler` and `experimental.useOffline` ship *in stable 16.3*. Installing a stable version tells you nothing about whether the feature you enabled inside it is stable. The channel governs the build; the `experimental` key governs the feature.

## How to read a release channel before adopting a feature

Four questions, in order. Any "no" stops the adoption.

1. **Is the feature behind an `experimental.*` key?** If yes, it is experimental regardless of how stable the release is. Budget for it changing shape or disappearing.
2. **Is it behind a non-experimental config flag** (`cacheComponents`, `partialPrefetching`, `reactCompiler`)? Then it is opt-in but supported — a deliberate default-off, usually because it changes behaviour rather than because it is unfinished.
3. **Which major line will it force me onto?** A feature that landed in 16.3 is unavailable on 15.x forever; maintenance lines do not get features. "We'll adopt it later" is really "we'll do the major upgrade later".
4. **What is my exit?** For anything from (1) or (2), the exit is deleting the flag. Make sure that is actually true — a feature you have written code *against* (importing `catchError` from `next/error`, calling `useOffline`) is not removable by flipping a flag back.

## Security releases patch both lines, and that is the payoff

The August 2026 security release shipped as **16.3.3 and 15.5.24** — one patch on each supported line. This is the concrete value of the Maintenance LTS phase and the reason "which line am I on" is the question that decides how cheap patching is:

- **On a supported line** — a patch release. A version bump, a redeploy, done.
- **Off the end of maintenance** — no patch exists. Your options are a major upgrade under time pressure, or a fork. Both are expensive; the second is expensive forever.

Two 2026 CVEs make this concrete rather than theoretical. **GHSA-2xp9-vwfh-vxw4** was an unauthenticated RCE through `libheif` under `sharp` on an attacker-controlled AVIF image, mitigated by disabling AVIF optimization upstream. **CVE-2026-75604** was an unauthenticated RCE on Windows-hosted servers, with **no workaround** — the only remedy was patching to 16.3.3 or 15.5.24. A "no workaround" advisory is exactly the scenario where being on an unsupported line stops being a paperwork problem.

### The corollary: a patch bump is not always small

The pin for this track sits at 16.3.4, and the span from 16.3.1 to 16.3.4 **crosses the August security release that disabled AVIF optimization**. Someone reading only the version numbers would treat that as a routine patch bump; someone reading the release notes would notice an image-format behaviour change inside it. 🔴 **Read the notes across the range you are actually crossing, not just the two endpoints.** This is why the version pin in `src/data/pins.js` carries a comment rather than a bare number.

## Where the version floors live

Version policy is not only about Next.js itself. The floors move between majors and are the most common cause of a CI failure that looks like a Next.js bug:

| | Floor, as of 16.3.4 |
|---|---|
| **Node.js** | **20.9** — not "20+"; the patch component is load-bearing |
| **TypeScript** | **5.1.0** |
| Browsers (zero-config) | Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+ |

🔴 **React is the exception, and it does not work the way the others do.** The App Router *"uses React canary releases built-in, which include all the stable React 19 changes, as well as newer features being validated in frameworks"* — while the Pages Router *"uses the React version from your `package.json`"*. So on the App Router, the React in your lockfile is not the React that renders your app. You still declare `react` and `react-dom`, but the docs are explicit that this is *"for tooling and ecosystem compatibility"*, not version selection. This is covered in full on [07 · Key framework shifts](07-key-framework-shifts-stable-react-compiler-support.md).

## Staying current is a first-class command

```bash
npx next upgrade
```

Beyond bumping the dependency, this *"updates the documentation bundled inside the `next` package at `node_modules/next/dist/docs/`"*. That bundled-docs mechanism is why Vercel retired its earlier documentation Skills — the version-matched docs now travel with the install, and `next dev` maintains an `AGENTS.md` block pointing at them. The practical consequence for you: **an AI agent working in your repo reads the docs for the version you actually have**, not for whatever was current when the model was trained. That is only true if you upgrade, though; a stale install means an agent confidently working from stale docs.

## Gotchas

**★ Symptom: an audit flags a known CVE, you go to bump the patch version, and there is no patch to bump to.** Cause: the major line left Maintenance LTS. Support is two years from the **major's initial release**, not from when it entered maintenance, so the window is roughly a year shorter than most people assume. Fix: derive the cliff date for your own major the day you adopt it, and put it in the calendar rather than in someone's head.

```text
15.x released Oct 21 2024  ->  maintenance ends ~Oct 21 2026
16.x released Oct 21 2025  ->  Active LTS until 17.0 ships, then two years total from Oct 21 2025
```

**★ Symptom: a `15.5.x → 15.6.0` bump breaks the build, and everyone insists that is impossible because minors are non-breaking.** Cause: on a Maintenance LTS line, updates land as semver-minor releases *even if they are breaking changes* — it is documented policy, not an accident. Fix: pin exactly on a maintenance line. The caret you would use safely on 16.x is a live risk on 15.x.

```json
{ "dependencies": { "next": "15.5.24" } }
```

**★ Symptom: you install a stable release, enable a feature from its announcement post, and it changes behaviour or vanishes in the next minor.** Cause: the feature was behind an `experimental.*` key. A stable release contains experimental features; the channel describes the build, not each feature inside it. Fix: grep your own config for `experimental` before every upgrade — that list is your actual risk register.

```ts
// next.config.ts — everything under this key is opt-in RISK, in a stable release
const nextConfig: NextConfig = {
  reactCompiler: true,                              // supported, opt-in
  experimental: { turbopackRustReactCompiler: true } // 🔴 experimental
}
```

**★ Symptom: "we're on the latest 15, so we're current" — and the team is a full major behind on security posture.** Cause: confusing *newest minor on a line* with *supported line*. 15.5 being the newest 15.x says nothing about whether 15.x is Active or Maintenance. Fix: state the position as the major line and its phase — "15.x, Maintenance, ends Oct 2026" — never as a bare version number.

**★ Symptom: a patch-level bump quietly changes image output.** Cause: the 16.3.1→16.3.4 range spans the August 2026 security release, which disabled AVIF optimization. Patch-level version arithmetic implies "no behaviour change"; a security release inside the range breaks that implication. Fix: read release notes across the whole range you are crossing, not just the endpoint.

**Symptom: CI fails on `next build` with a Node error after a green local run.** Cause: the floor is **20.9** specifically, and a CI image pinned to a `20.x` older than 20.9 satisfies a naive "Node 20+" check while failing the real requirement. Fix: pin the CI Node version at or above 20.9 explicitly, and treat "20+" in any document — including older pages of this book — as imprecise.

**Symptom: you pin React to fix a React-level bug on the App Router and nothing changes.** Cause: the App Router bundles React canary internally; your `package.json` React governs tooling, not rendering. Fix: track the Next.js version instead — that is what moves the bundled React. On the Pages Router the pin does work, which is why the two routers give different answers to the same question.

**Symptom: a feature works locally and is missing in a teammate's checkout on the same "version".** Cause: one of you is on canary. Canary publishes daily, so two installs a day apart are genuinely different builds, and `next@canary` in a lockfile does not describe a reproducible version. Fix: never let canary into a shared lockfile; use it in a scratch checkout to confirm a fix, then wait for the stable release.

**Symptom: an AI agent writes App Router code against APIs that no longer exist.** Cause: it is working from training data rather than the version-matched docs bundled at `node_modules/next/dist/docs/`. Fix: run `next upgrade` so the bundled docs and the `AGENTS.md` block are current — an agent pointed at stale bundled docs is confidently wrong in exactly the same way.

## Interview questions

**★ Next.js says 16.x is Active LTS and 15.x is Maintenance LTS. What does each phase actually guarantee, and how long does support last?**
Active LTS is the current major and receives everything — new features, regular bug fixes, performance improvements and security patches. A major stays there until the next major ships. Maintenance LTS is the previous major and receives only critical bug fixes and essential security updates: no features, and not every bug qualifies. The crucial detail is the clock — maintenance runs for two years from the major's **initial release**, not from when it entered maintenance. Since a major typically spends about a year as Active first, the real maintenance window is closer to a year than two.

**★ Your team is on 15.5.x with `"next": "^15.5.0"` in package.json. What is wrong with that, specifically?**
On a Maintenance LTS line, updates land as semver-minor releases even when they contain breaking changes — that is documented policy, because there is no other slot to put a fix in without creating a new major line. So the caret, which is the safe conservative choice on the Active line, permits a breaking upgrade on the maintenance line. Pin exactly. The deeper point is that the same version range expression means different things depending on which LTS phase the line is in, so you cannot reason about the range without first knowing the phase.

**★ A colleague wants to adopt a feature announced in the 16.3 release post. Walk me through how you decide whether it can go into production.**
Four checks. Is it behind an `experimental.*` key — if so it is experimental no matter how stable the release is, because the channel describes the build and not each feature in it. If not, is it behind an ordinary config flag like `cacheComponents` — that means supported but default-off, usually because it changes behaviour rather than because it is unfinished. Third, which major line does it force us onto: features never land on a maintenance line, so "adopt later" really means "do the major upgrade later". Fourth, what is the exit — flipping a flag back is only a real exit if we have not written code against the feature's imports.

**What is the difference between the canary channel and a preview release?**
Canary is a documented channel: daily pre-release builds, internally tested, explicitly not for production traffic. It is where you confirm a fix landed against `main`. "Preview" is less formal than people assume — the support policy names only canary and stable, and while there is a `preview.nextjs.org` docs site and 16.3 did have a preview release before GA, no primary source defines a preview channel with its own support guarantees. The honest description is a docs and announcement staging surface around a specific upcoming release, not a third tier.

**Why is it wrong to say "we're on the latest 15, so we're current"?**
It conflates the newest minor on a line with the line's support phase. 15.5 being the newest 15.x tells you nothing about whether 15.x is Active or Maintenance — and it is Maintenance, with a window closing around October 2026. State a position as the major line plus its phase and cliff date, never as a bare version number.

**Both 16.3.3 and 15.5.24 shipped on the same day. What was that, and what does it tell you about the support model?**
That was the August 2026 security release, patching both supported lines at once. It is the concrete payoff of Maintenance LTS: on a supported line a critical CVE costs you a version bump and a redeploy, while off the end of maintenance no patch exists at all and your options narrow to an emergency major upgrade or a fork. CVE-2026-75604 that year had **no workaround**, which is the scenario that turns an unsupported line from a paperwork problem into an outage.

**You are on the App Router and want a specific React version. How do you get it?**
You largely do not, and that surprises people. The App Router uses React canary releases built-in — including all stable React 19 changes plus features being validated in frameworks — so the `react` and `react-dom` entries in package.json exist for tooling and ecosystem compatibility rather than version selection. The Next.js version is what moves the bundled React. The Pages Router behaves the way you would expect and uses the React version from package.json, which is why the same question has two different answers in one codebase mid-migration.

**A patch bump from 16.3.1 to 16.3.4 changed how images are served. How is that possible?**
Because that range spans the August 2026 security release, which disabled AVIF optimization to mitigate an unauthenticated RCE through `libheif` under `sharp`. Patch-level arithmetic implies no behaviour change, and a security release inside the range violates that implication — mitigations frequently *are* behaviour changes, since turning a vulnerable path off is often the fastest safe fix. The habit worth building is reading notes across the whole range you cross rather than diffing the endpoints.

**Why does `next upgrade` matter beyond bumping a dependency?**
It also updates the documentation bundled inside the package at `node_modules/next/dist/docs/`, and `next dev` maintains an `AGENTS.md` block pointing agents at those docs. That mechanism is why Vercel retired the earlier documentation Skills — version-matched docs now travel with the install. The practical consequence is that an AI agent in your repo reads docs for the version you actually have, but only if you upgrade; a stale install produces an agent that is confidently wrong about your own codebase.

---

← Prev [03b · Hybrid static/dynamic](03b-hybrid-static-dynamic-and-the-cost-model.md) · [Index](01-explanation.md) · Next → [05 · Project setup](05-project-setup-create-next-app-turbopack-defaults-typescript.md)
