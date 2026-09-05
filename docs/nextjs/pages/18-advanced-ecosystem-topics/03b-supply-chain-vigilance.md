---
title: "Supply-chain vigilance: the two worst Next.js vulnerabilities of 2026 were not in Next.js — one arrived through an image codec four levels down the dependency graph, and the other had no workaround at all"
sidebar_label: "03b · Supply-chain vigilance"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js August 2026 security release
> ([nextjs.org/blog/august-2026-security-release](https://nextjs.org/blog/august-2026-security-release))
> and the support policy ([nextjs.org/support-policy](https://nextjs.org/support-policy)),
> both banked for this track on 2026-09-03/04 — advisory **GHSA-2xp9-vwfh-vxw4** and
> **CVE-2026-75604**. Target: **Next.js 16.3.4** (patched line; the AVIF fix landed in
> **16.3.3 / 15.5.24**). Documentation-verified; **no sandbox run, no scanner executed**.

**The framework's own code was never at fault in the worst Next.js vulnerability of 2026, and that is the entire lesson.** An unauthenticated remote code execution reached applications through `libheif` — a native AVIF decoder sitting underneath `sharp`, which sits underneath the Next.js image optimizer, which you enabled by writing `<Image />`. Nobody in that chain wrote insecure code in the sense a code review would catch. The dependency was transitive, native, and invisible in the one file most teams treat as their dependency list. Supply-chain vigilance in this stack is therefore not "run `npm audit` in CI"; it is knowing **which of your dependencies are native, which parse attacker-controlled bytes, and which are pulled in by a framework feature rather than by an import you wrote.**

## The two 2026 incidents, and what each one teaches

⚠️ These are summarised here for the *supply-chain lesson*. The full incident record — eleven vulnerabilities and what each one teaches — lives in [chapter 10](../10-forms-authentication-and-security-hardening/14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md), and the patching cadence in [chapter 10 · the patching habit](../10-forms-authentication-and-security-hardening/15-the-patching-habit-scheduled-security-releases-and-lts.md). This page does not repeat them; it draws the dependency-graph conclusion.

### GHSA-2xp9-vwfh-vxw4 — RCE through an image codec

Unauthenticated remote code execution via `libheif`, reached through `sharp`, triggered by an **attacker-controlled AVIF image** passed to the image optimizer. Next.js mitigated it by **disabling AVIF optimization outright**, patched in **16.3.3** and **15.5.24**.

**Four things make this the canonical supply-chain case:**

1. **The vulnerable code was native, not JavaScript.** No amount of reading `node_modules` for suspicious JS would have found it.
2. **The dependency was transitive and framework-pulled.** `sharp` is not in most teams' `package.json` as a deliberate choice; it arrives because image optimization needs it.
3. **The input was attacker-controlled by design.** An image optimizer that accepts a remote URL is, definitionally, a service that parses bytes chosen by someone else.
4. **The fix was to remove a feature, not to patch a call site.** That tells you the framework had no safe way to keep using the decoder — and it tells you what your own contingency looks like: *can this application ship with AVIF turned off?*

🔴 **The concrete corpus consequence**, recorded when this track was imported: **chapter 9 teaches AVIF**, which upstream disabled. That is the one place this bible actively recommended something dangerous, and it is why an imported page nobody has vouched for scores zero here however readable it is.

### CVE-2026-75604 — the vulnerability with no workaround

Unauthenticated RCE on **Windows-hosted** servers, affecting apps running the Pages Router *and* App Router apps **without Cache Components**. Linux and macOS hosts are unaffected. 🔴 **There is no workaround** — the only remediation is upgrading.

**What this one teaches is different, and harder.** It is not about a transitive package; it is about the assumption that every vulnerability has a mitigation you can apply while you schedule the upgrade. Sometimes there is nothing between you and the patch. That converts two things from preferences into requirements:

- **A tested upgrade path you can execute inside a day.** If your Next.js upgrade takes a two-week regression cycle, "no workaround" means two weeks exposed.
- **Knowing your host OS is a security parameter.** Most teams could not answer "are any of our Next.js deployments on Windows hosts" without asking someone. A self-hosted Windows box, an on-prem IIS-fronted deployment, or a developer's machine serving an internal tool are all in scope; Vercel and typical Linux containers are not.

⚠️ **It also turns [the Pages → App Router migration](02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md) from a modernization argument into a security one** — the App Router *with* Cache Components is the configuration outside the affected set. That is a genuinely new reason to prioritise a migration that teams have been deferring on cost-benefit grounds.

## The dependency graph you actually have

The mental model that prevents both classes: **your attack surface is not your `package.json`.** Three layers, and teams audit only the first.

| Layer | Example | How it gets in | Audited by most teams? |
|---|---|---|---|
| **Direct** | `next`, `react`, `zod` | You wrote the import | ✅ Yes |
| **Transitive JS** | the resolver chain under a build tool | Another package's `dependencies` | ⚠️ Only via `npm audit` |
| **Transitive native** | `libheif` under `sharp` | A framework *feature* you enabled | 🔴 Almost never |

**Native transitive dependencies that parse untrusted bytes are the highest-risk category in the entire graph**, because they combine memory-unsafe code with attacker-chosen input, and because they are invisible to a JavaScript-shaped audit. In a Next.js app, the recurring members of that set are image decoders, font parsers, and any archive or document processing you added yourself.

### The question to ask about every feature you enable

Not "is this package safe" — you cannot know that — but: **what does this feature parse, and who chooses the bytes?**

- `<Image />` with `remotePatterns` → parses images; **a remote host chooses the bytes**.
- A file upload endpoint → parses whatever was uploaded; **the user chooses the bytes**.
- A webhook receiver → parses a payload; **a third party chooses the bytes**, and signature verification is what makes that a *known* third party.
- A Markdown or HTML renderer → parses content; if content is user-generated, the user chooses the bytes.

Each affirmative answer is a place where a transitive native dependency can end your day.

## Controls that survive contact with a real codebase

**1. Constrain what the optimizer will fetch.** `images.remotePatterns` is a security control, not a convenience. A wildcard here means any host on the internet can hand your image pipeline bytes.

```js
// next.config.js — an allow-list, not a pattern that happens to match your CDN
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.acme.com', pathname: '/assets/**' },
    ],
    // formats: ['image/webp'],  // and see the AVIF note below
  },
};
```

🔴 **Do not add `'image/avif'` back to `formats` without checking the advisory status for your installed version.** The mitigation for GHSA-2xp9-vwfh-vxw4 was to disable AVIF optimization; re-enabling it by hand is re-opening the door the patch closed.

**2. Pin with a lockfile and make CI honour it.** `npm ci` / `yarn install --immutable` install exactly the lockfile. `npm install` in CI can resolve a different transitive tree than the one you reviewed.

```bash
npm ci --ignore-scripts
```

`--ignore-scripts` is the second half: a postinstall script runs arbitrary code at install time, with your CI credentials in the environment. It is also the flag most likely to break a build that depends on a native package compiling itself, which is exactly the trade-off worth making consciously rather than by default.

**3. Audit the transitive tree, and read *why* before you act.**

```bash
npm audit --omit=dev
npm why sharp          # which of my dependencies pulled this in?
npm ls --all sharp
```

`npm why` is the command that turns "there is a finding in a package I have never heard of" into "the image optimizer pulled it in, so the question is whether I can turn off image optimization while I upgrade".

**4. Subscribe to the release channel, not to a scanner.** Next.js publishes scheduled security releases; the AVIF fix arrived in one. A scanner tells you about a CVE once a database ingests it, which is later — sometimes days later — than the release announcement.

**5. Write the patch SLA against the LTS tier you are on.** The support policy runs **Active LTS on the current major line** and **Maintenance LTS on the previous one** for two years from that major's initial release. 🔴 **On the maintenance line, updates land as semver-minor releases even when they are breaking.** So the common policy "we take minors automatically, majors deliberately" quietly becomes "we take breaking changes automatically" the moment your major line goes into maintenance. Name the line in the policy document.

## Gotchas

**★ Symptom: a critical advisory lands against a package that is nowhere in your `package.json`.** Cause: it is transitive, pulled in by a framework feature rather than an import — `sharp` under image optimization is the canonical case. Fix: resolve the path before deciding anything, then decide whether the *feature* can be disabled while you upgrade.

```bash
npm why sharp
npm ls --all sharp
```

**★ Symptom: the advisory says "no workaround" and your upgrade path takes two weeks.** Cause: remediation was treated as a scheduling problem, on the assumption that a config-level mitigation always exists first. CVE-2026-75604 had none. Fix: make the upgrade path itself the control — keep the framework within one minor of upstream so a security bump is a small diff, and rehearse it.

```bash
npm view next version          # what upstream has
npm ls next                    # what you have — the gap IS your exposure window
```

**★ Symptom: `npm audit` is clean and the application is still vulnerable.** Cause: the vulnerable code is **native**, inside a compiled dependency, and the advisory may not map to a JavaScript package version range at all — plus the audit database lags the vendor's own release announcement. Fix: treat the framework's security release channel as the primary source and the scanner as a backstop, and enumerate your native dependencies explicitly rather than trusting a JS-shaped audit to find them.

**★ Symptom: image optimization starts failing on some images after a security upgrade, and nothing in your code changed.** Cause: the mitigation for GHSA-2xp9-vwfh-vxw4 **disabled AVIF optimization**; requests relying on AVIF output no longer get it. Fix: this is the patch working. Serve WebP, and do not restore AVIF by adding it back to `formats` to "fix" the regression.

```js
// next.config.js
images: { formats: ['image/webp'] },   // deliberate, not a workaround
```

**Symptom: an audit finding is dismissed because "it's a dev dependency".** Cause: dev dependencies do not ship to production, so the reasoning looks sound — but they run in CI with repository credentials and deploy tokens in the environment, which is a different and often worse blast radius. Fix: triage dev findings on *build-time* impact rather than runtime, and keep `--ignore-scripts` in the CI install.

**Symptom: the lockfile is committed, and CI still installs a different tree.** Cause: CI runs `npm install`, which may update the lockfile, rather than `npm ci`, which installs it exactly. Fix: use the immutable install in CI, and let it fail when the lockfile is out of date instead of silently resolving something new.

```bash
npm ci        # not `npm install`
```

**Symptom: nobody can answer "are we exposed to the Windows-host CVE" during an incident call.** Cause: host OS was never treated as a security-relevant inventory item, because production is on Linux — but a self-hosted internal tool, an on-prem deployment or a partner's install may not be. Fix: record the host OS and the router/Cache-Components configuration for every deployment of the application, not just the flagship one.

**Symptom: a feature is enabled in `next.config.js` that nobody remembers turning on, and it parses remote input.** Cause: configuration accretes; `remotePatterns` in particular tends to be widened during an incident and never narrowed again. Fix: review the config's *input-accepting* settings on the same cadence as dependency upgrades, and treat a wildcard hostname as a finding in its own right.

**Symptom: you upgrade to escape an advisory and the app breaks in an unrelated way, on a minor version bump.** Cause: you are on the **Maintenance LTS** line, where breaking changes ship as semver-minor by policy. Fix: read the release notes for maintenance-line minors as if they were majors — the version number is not carrying the usual signal — and plan the move to the active line, since maintenance ends two years after that major's initial release.

## Interview questions

**★ The worst Next.js RCE of 2026 was not in Next.js code. Why does that matter more than the CVE itself?**
Because it invalidates the audit most teams actually perform. The vulnerable code was `libheif`, a native AVIF decoder reached through `sharp`, reached through the image optimizer — four levels from anything the team wrote, in a language their tooling does not inspect, pulled in by enabling a *feature* rather than by writing an import. Reviewing your own code, and even reviewing your direct dependencies, would never have surfaced it. The durable lesson is to inventory by capability rather than by package name: which of my dependencies parse bytes that someone else chooses, and which of those are native?

**★ What is the practical difference between a vulnerability with a workaround and one without?**
A workaround converts remediation into a scheduling problem — you mitigate today and upgrade on your own cadence. CVE-2026-75604 had no workaround, which means the only lever was the upgrade, and your exposure window equals your upgrade lead time. That reframes the whole risk conversation: the control is not a config flag you can reach for during an incident, it is the ordinary engineering investment that keeps you close to upstream. Teams a minor behind patch in an afternoon; teams three majors behind are exposed for weeks and cannot compress it under pressure.

**★ Why is a clean `npm audit` weak evidence?**
Three reasons that compound. It lags — the advisory database ingests a finding after the vendor announces the release. It is JavaScript-shaped — a memory-safety bug in compiled native code under a package may not map cleanly to a version range it can flag. And it audits what the lockfile declares, which is not the same as what a framework feature pulls in and activates at runtime. It is a genuinely useful backstop; it is not a statement that you are unaffected.

**★ How does the Next.js LTS model change your dependency policy?**
On the current major (Active LTS) you get features, fixes and security patches, and semver carries its usual meaning. On the previous major (Maintenance LTS) you get only critical fixes and essential security updates, for two years from that major's initial release — **and those updates ship as semver-minor releases even when they are breaking**. So a caret range or an auto-merge policy for minors, which is prudent on the active line, is an uncontrolled-change policy on the maintenance line. Any written dependency policy has to name which line the application is on, and the answer changes each time a major ships.

**Why is `images.remotePatterns` a security control rather than a configuration convenience?**
Because it decides who may hand bytes to your image pipeline. A wildcard hostname lets any host on the internet supply input to a native decoder running on your server — which is precisely the shape of the AVIF incident. Narrowing it to specific hosts and path prefixes does not eliminate a decoder vulnerability, but it removes the unauthenticated internet from the set of parties who can trigger one, which is usually the difference between an urgent incident and a scheduled upgrade.

**What would you actually change after reading the AVIF advisory, assuming you are already patched?**
Patching is the remediation; the change is to the process. Enumerate the native dependencies that parse untrusted input and write them down as an inventory item rather than rediscovering them during the next incident. Narrow `remotePatterns` to an allow-list. Decide in advance which features can be disabled under pressure — image optimization is one, and knowing that in advance is what makes "disable it while we upgrade" a decision rather than an experiment. And subscribe to the framework's security release channel so the scanner is not your first notification.

**Is `--ignore-scripts` worth the breakage it causes?**
In CI, usually yes, and the breakage is informative. A postinstall script executes arbitrary code with whatever credentials the CI environment holds, which is the classic supply-chain attack path and is not addressed by reviewing published source. Turning scripts off makes any package that genuinely needs to compile at install time fail loudly, so you learn which ones they are and can allow them deliberately. The cost is real setup friction; the benefit is that install-time code execution becomes an explicit list instead of an ambient capability.

---

← [OWASP mapping and token leakage](03-enterprise-compliance-owasp-mapping-token-leakage-prevention.md) · [Chapter index](01-explanation.md) · Next → [Framework extension and plugin development](04-framework-extension-and-plugin-development.md)
