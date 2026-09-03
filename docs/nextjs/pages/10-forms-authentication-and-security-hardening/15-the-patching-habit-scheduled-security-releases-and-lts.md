---
sidebar_position: 15
title: "Next.js moved to pre-announced monthly security releases in July 2026 because LLM-assisted vulnerability research changed the arrival rate — and the correct response is a habit, not a heroic upgrade"
sidebar_label: "The patching habit"
description: "The Next.js security release program, why it exists, what the Active/Maintenance LTS split is for, how to build a patching cadence around pre-announcements, and the dependency hygiene the 2026 record demands."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [Next.js Security Release and Our Next Patch Release](https://nextjs.org/blog/next-security-release-program) (13 July 2026), [July 2026 Security Release](https://nextjs.org/blog/july-2026-security-release), [Upcoming August Security Release](https://nextjs.org/blog/upcoming-nextjs-security-release-august-2026), [Update: August Next.js Security Release](https://nextjs.org/blog/nextjs-security-release-august-2026-update), and [August 2026 Security Release](https://nextjs.org/blog/august-2026-security-release).
> Target: **Next.js 16.3.4**. **16.3 = Active LTS, 15.5 = Maintenance LTS.** Prior page: [14 · The 2026 CVE record](14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md).

**In July 2026 the Next.js team explained why they were formalising a security release schedule, and the reason is worth stating precisely: the volume of vulnerability research is rising fast, driven by LLM-assisted discovery. They cite Mozilla disclosing 271 issues in a single Firefox release, all surfaced by an AI research tool, and say plainly that they run the same class of tooling against Next.js themselves. That changes what "keeping up" means. An unscheduled emergency patch every few months is something a team absorbs; a monthly cadence with pre-announced severities is something a team has to build a process around. This page is that process.**

## Why the program exists

The team's own account of its security investment spans the whole lifecycle: static analysis and scanning while code is being authored, auditable package publication, and close collaboration with researchers who disclose vulnerabilities responsibly. They point at the React2Shell exploit disclosed the previous December as an example of that process working as intended, and say the program has continued to mature since.

The reason for changing the release model is a change in arrival rate. The volume of vulnerability research across the industry is rising fast, driven by LLM-assisted discovery — the example they give is Mozilla disclosing **271 issues in a single Firefox release**, all of them surfaced by Anthropic's Mythos Preview. Vercel runs the same class of tooling against Next.js itself, through `deepsec`, through its own researchers, and through an expanded bug bounty scope, with the stated goal of having more issues reach them before attackers find them.

The post is also honest about what the old model cost users. Historically the team published ad-hoc patches for security fixes; these were infrequent, but they arrived with no advance notice and caused disruption. The new arrangement is presented as an industry norm rather than an innovation — scheduled, pre-announced security releases have become standard practice for major open source projects, and the team judges it the right model for Next.js at its current scale.

## What the schedule actually promises

Roughly once a month, Vercel publishes advance notice of an upcoming security release on the Next.js blog. Each announcement carries two specific pieces of information: the expected release timeline, and the **highest anticipated severity** among the vulnerabilities that release will cover.

The lead time is described as serving two audiences at once. It lets you plan your upgrades, and it lets Vercel coordinate with hosting providers and other platform partners so they can deploy mitigations — firewall rules are the example given — that help protect applications which have not been patched yet.

Three commitments are embedded in that, and each has an operational implication:

| Commitment | What you do with it |
| --- | --- |
| Roughly monthly advance notice | A recurring calendar slot, not an interrupt |
| Expected timeline published ahead | Book the upgrade window before the patch exists |
| Highest anticipated severity published ahead | Decide *now* whether this one is a drop-everything |

And the carve-out for the cases a schedule cannot serve:

For urgent disclosures that cannot wait, and for vulnerabilities already being exploited in the wild, ad-hoc patches will still be published. The schedule is a default, not a ceiling on how fast a fix can ship.

## The schedule slips, and the slippage is itself information

Watch what actually happened across the two 2026 cycles.

**July.** Announced on 13 July for a 20 July release, described as including patch releases for Next.js 16.2 and 15.5 addressing multiple security issues — specifically fixes for **4 high and 5 medium** severity vulnerabilities. An update dated 20 July then moved the target: the release originally aimed at 20 July was now expected on 21 July 2026. It shipped on 21 July as 16.2.11 and 15.5.21.

**August.** Announced for 26 August, expected to address **one critical severity vulnerability**. Then, on 25 August, the forecast was revised.

The update stated that the release was now expected to address **two critical severity vulnerabilities** rather than one, that the newly identified issue had prompted them to move the release *forward*, and that both vulnerabilities would be addressed in the same release so that users only need to upgrade once.

The release moved **earlier**, not later, and the scope grew from one critical to two. That is the pattern to internalise: a pre-announcement is a forecast, and the forecast is revised. A team that reads the announcement, books the window, and never re-checks will discover on the 26th that the patch shipped on the 25th and the severity doubled.

That last clause is also a design decision worth respecting from the consuming side — both fixes ride in one release so that users only need to upgrade once. Batching is done deliberately to reduce your upgrade count. Upgrading eagerly to a canary to get one fix early defeats it.

## The LTS split is what makes patching cheap

Every 2026 security release shipped two versions:

| Release | Active LTS | Maintenance LTS |
| --- | --- | --- |
| July 2026 | 16.2.11 | 15.5.21 |
| August 2026 | 16.3.3 | 15.5.24 |

`16.3` is the current Active LTS; `15.5` is Maintenance LTS. The whole point of the split is that an application on the previous major does not have to take a major upgrade in order to take a security patch. `15.5.21` → `15.5.24` is a patch bump.

That reframes the version decision. A team pinned to `15.5.x` is not "behind"; it is on a supported line that receives the same fixes on the same day. A team pinned to `15.4.x`, or to `16.1.x`, **is** behind — those lines are neither Active nor Maintenance LTS, and the July and August advisories shipped no patch for them.

The July release also names a third channel:

The same fixes were also available in the latest Next.js 16.3 canary (`v16.3.0-canary.92`) and preview (`v16.3.0-preview.7`) releases, and were slated for inclusion in `v16.3.0` once that reached stable.

Canary and preview carry the fixes early. They are not a patching strategy — they carry everything else early too.

## Building the habit

Nothing here is exotic. The reason teams fail at it is that each individual step is trivial and nobody owns the sequence.

**1 · Subscribe to the source, not to a digest.** The pre-announcements are published on the Next.js blog. A dependency-scanning tool tells you after a CVE is public; the blog tells you a week before, with the severity.

**2 · Pin to an LTS line and know which one.** Record in your repository which line you are on and why. `16.3` (Active) or `15.5` (Maintenance) are the two supported answers today.

**3 · Make the upgrade a patch bump, not an archaeology project.** Applications that upgrade only under duress discover that `15.2 → 15.5.24` is not a patch bump. Take the routine patches so that the urgent one is trivial.

**4 · Re-read the announcement on the day.** Both 2026 cycles moved their date, and one doubled its severity scope. Re-check before your booked window, not after.

**5 · Know your dependency chain, not just your direct dependency.** The August AVIF critical arrived as `libheif` → `sharp` → Next.js. Your lockfile is the artefact that answers "do we ship that". Audit transitively.

**6 · Rehearse the rollback.** A security patch that disables a feature — as the AVIF patch did — changes behaviour. You want to have already decided whether you ship first and investigate the behaviour change second. For an unauthenticated RCE the answer is always ship first.

**7 · Have somewhere to send a report.** The blog names `security@vercel.com` as the address for any question or concern about the security program or about vulnerability management. And on the other side of the relationship, Vercel works with researchers to secure Next.js and other open source frameworks through its Open Source Bug Bounty, and encourages anyone interested in contributing to the security of eligible frameworks to take part there.

## The part nobody schedules: dependency review

The 2026 record makes one argument twice — in the AVIF critical, and in the SVG denial of service. The image pipeline is a native decoder reached from unauthenticated input. Nothing in a Next.js upgrade cadence covers `libheif`.

Concretely: `images.remotePatterns` is an input-validation boundary. Every host you allow is a host whose bytes reach a native image decoder in your process. Treat adding an entry with the same seriousness as adding a database user, and prefer exact hosts and paths over wildcards:

```js filename="next.config.js"
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.example.com',
        pathname: '/media/**',
      },
    ],
  },
}
```

A `hostname: '**'` entry, or a pattern matching a CMS whose media library accepts public uploads, converts every disclosed decoder bug into an unauthenticated remote attack on your servers.

## Gotchas

**★ Pinning to a version line that is neither Active nor Maintenance LTS.**
`16.3` and `15.5` receive security patches; `16.1` and `15.4` do not. A team on an unsupported line has to take a minor or major upgrade under time pressure during an incident, which is the worst possible moment to discover a breaking change. Record the line you are on and check it against the current LTS designations every quarter.

**★ Treating the pre-announced date as fixed.**
Both 2026 cycles moved. July slipped a day; August moved a day *earlier* and grew from one critical to two. Re-read the announcement immediately before your upgrade window rather than working from the version you read a week ago.

**★ Treating the pre-announced severity as fixed.**
The August announcement said one critical. The release contained two, because a second was identified in between. Severity forecasts are revised upward as often as timelines slip.

**★ Waiting for your scanner instead of reading the blog.**
Dependency scanners fire when an advisory becomes public — which is at release time or after. The pre-announcement gives roughly a week of lead time with a severity attached. That week is the entire value of the program, and a scanner cannot give it to you. Note also that the August AVIF critical was assigned **no CVE ID**, so a CVE-keyed alerting pipeline would not have fired on it at all.

**★ Upgrading to a canary to get one fix early.**
The fixes land in canary and preview first, but so does every other unreleased change. Taking a canary into production to get ahead of a scheduled patch trades a known, scoped risk for an unknown, unscoped one — and it defeats the batching the team does deliberately so that users only need to upgrade once.

**★ Auditing direct dependencies only.**
`libheif` is not in your `package.json`. It is inside `sharp`, which is a Next.js dependency for image optimization. The 2026 record's most severe entry lived two levels down. Your lockfile, not your manifest, is the artefact that answers whether you ship a vulnerable component.

**★ Leaving `images.remotePatterns` permissive because it was convenient during development.**
Every allowed host is a host whose bytes reach a native decoder in your process. A wildcard hostname turns any future decoder vulnerability into unauthenticated RCE. Narrow to exact hostnames and path prefixes, and review the list whenever an image-pipeline advisory lands.

**★ Deferring a patch because it changes behaviour.**
The AVIF patch disabled a feature. That is a real product change and it is still not a reason to defer an unauthenticated RCE fix. Decide the policy before an incident: ship the patch, then handle the behaviour change as follow-up work. A decision made under time pressure is where "we'll do it next sprint" comes from.

**★ Having no channel to report a suspected vulnerability.**
When someone on your team finds something, the window between "we noticed" and "someone else notices" is the risk. `security@vercel.com` is the documented contact, and Vercel's Open Source Bug Bounty on HackerOne is the structured route. Put both in your incident runbook before you need them.

**★ Assuming your hosting provider's mitigations cover you.**
The program notes that the lead time lets Vercel coordinate with hosting providers and other platform partners to deploy mitigations — firewall rules being the named example — that help protect applications which have not been patched yet. Those are stopgaps for the unpatched, offered where a platform can implement them — and the August Windows critical had *no known workaround* at all. A WAF rule is not a patch.

## Interview questions

**★ Why did Next.js move to a scheduled security release model in July 2026?**
Because the arrival rate of vulnerability reports changed. The announcement cites LLM-assisted discovery explicitly, including Mozilla disclosing 271 issues in a single Firefox release surfaced by an AI research tool, and states that the Next.js team runs the same class of tooling against itself through `deepsec`, its own researchers and an expanded bug bounty. The previous ad-hoc model was described as infrequent but disruptive, arriving with no advance notice at all.

**★ What exactly does a pre-announcement contain, and what should a team do with it?**
The expected release timeline and the highest anticipated severity among the vulnerabilities the release will cover. A team uses the timeline to book an upgrade window in advance rather than reacting to an interrupt, and uses the severity to decide immediately whether this is routine maintenance or a drop-everything. It is also the window in which hosting providers can deploy stopgap mitigations for applications that will not have patched yet.

**★ What is the Active/Maintenance LTS split for?**
So that taking a security patch never requires taking a major upgrade. Every 2026 security release shipped two versions — 16.2.11/15.5.21 in July, 16.3.3/15.5.24 in August. An application on `15.5` receives the same fixes on the same day as one on `16.3`, as a patch bump. The split is what makes "patch promptly" a realistic instruction rather than an aspiration.

**★ You are pinned to `16.1.x`. Are you covered by these releases?**
No. `16.3` is Active LTS and `15.5` is Maintenance LTS; `16.1` is neither, and no patch was published for it in either 2026 cycle. Being on an unsupported line means an urgent fix requires a minor or major upgrade under incident pressure — exactly the situation the LTS split exists to prevent.

**★ Why is "wait for the dependency scanner to alert us" an inadequate patching strategy for Next.js?**
Two reasons. Scanners fire when an advisory becomes public, which is at or after release time, so they cannot deliver the week of lead time the pre-announcement gives. And the most severe 2026 issue — the AVIF remote code execution, CVSS 9.5 — was published with **no CVE ID assigned**, so a pipeline keyed on CVE identifiers would not have alerted on it at all.

**★ Both 2026 releases changed after their announcement. In which directions, and what does that imply?**
July slipped by one day. August moved *earlier* by one day and grew from one critical vulnerability to two, because a second was identified during the window. So the announcement is a forecast revised in both directions, on both date and severity. The operational implication is to re-read the announcement immediately before acting, not to work from a week-old note.

**★ Why is auditing your `package.json` insufficient after the 2026 record?**
Because the highest-severity issue of the year was not in Next.js and not in anything you declared. It was in `libheif`, reached through `sharp`, reached through Next.js image optimization. Three levels. The lockfile is the artefact that records what you actually ship, and transitive auditing is the only way to answer whether a disclosed native-library flaw is in your process.

**★ How should the 2026 record change how you think about `images.remotePatterns`?**
As an input-validation boundary rather than a convenience list. Every allowed host supplies bytes to a native image decoder running in your server process, and 2026 produced two disclosures against that pipeline — an unauthenticated RCE via AVIF and a CPU-exhaustion DoS via SVG. Wildcards, and any host whose media library accepts public uploads, convert a decoder bug into an unauthenticated remote attack. Narrow to exact hostnames and path prefixes.

**★ What is the correct sequence when a critical patch also removes a feature?**
Ship the patch, then handle the behaviour change. The AVIF fix disabled AVIF optimization outright because the real fix had to land upstream, so upgrading changed what the image pipeline emitted. That is a genuine product change and still not a reason to run an unauthenticated RCE for another sprint. Decide the policy in advance, so the decision is not being made under pressure by whoever happens to be on call.

{/* FOOTER */}
