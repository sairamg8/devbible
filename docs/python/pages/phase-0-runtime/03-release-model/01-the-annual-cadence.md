---
title: "The annual cadence: a feature release every October, built over seventeen months, and a micro release that is contractually forbidden from breaking you"
sidebar_label: "1 · The annual cadence"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 602 – Annual Release Cycle for Python](https://peps.python.org/pep-0602/),
> the devguide [Development cycle](https://devguide.python.org/developer-workflow/development-cycle/)
> and [Status of Python versions](https://devguide.python.org/versions/),
> [PEP 745](https://peps.python.org/pep-0745/) (3.14 schedule) and
> [PEP 719](https://peps.python.org/pep-0719/) (3.13 schedule).
> Version spine: **Python 3.14.7** (2026-08-05).

**Since Python 3.9, feature releases have shipped on a fixed twelve-month
cadence, in October, every year. Each one takes seventeen months to build, which
means the schedules overlap and two versions are always in flight at once. Once
a version is out, the only thing that changes about it is the third number, and
the rules governing what a change to the third number may contain are strict
enough that "upgrade 3.14.4 to 3.14.7" is a fundamentally different kind of
decision from "upgrade 3.13 to 3.14". Knowing which of those two you are looking
at is most of the practical value of this topic.**

## Twelve months apart, seventeen months long

PEP 602 replaced an irregular eighteen-month cycle with a calendar:

> *"This change accelerates the release cadence such that feature versions are
> released predictably every twelve months, in October every year."*

The development window for a single version is longer than the gap between
versions:

> *"The first five months overlap with Python 3.(X-1).0's beta and release
> candidate stages and are thus unversioned. The next seven months are spent on
> versioned alpha releases where both new features are incrementally added and
> bug fixes are included. The following three months are spent on four versioned
> beta releases where no new features can be added but bug fixes are still
> included. The final two months are spent on two release candidates (or more,
> if necessary) and conclude with the release of the final release of Python
> 3.X.0."*

Five plus seven plus three plus two is seventeen. The overlap is deliberate and
is stated as the mechanism, not a side effect:

> *"Feature development of Python 3.(X+1).0 starts as soon as Python 3.X.0
> Beta 1 is released. This creates a twelve-month delta between Python feature
> versions."*

The concrete instance, from PEP 745 and PEP 790: 3.14 development began
2024-05-08, its first alpha was 2024-10-15, beta 1 was 2025-05-07, and 3.14.0
final shipped 2025-10-07. 3.15 development began 2025-05-07 — the same day 3.14
hit beta 1 — and 3.15.0 final is scheduled for 2026-10-01. The next branch,
`main`, is already the future 3.16, with a first release scheduled for
2027-10-06.

That overlap is why the devguide can say, on any given day, that `main` accepts
new features while a maintenance branch is stabilising a release that has not
happened yet. Today (August 2026) 3.15 is in release-candidate stage, 3.16 is
taking features on `main`, and 3.14 and 3.13 are both taking bug fixes.

## The version number, and which digit you are changing

The devguide's definition:

> *"new major versions are exceptional; they only come when strongly
> incompatible changes are deemed necessary, and are planned very long in
> advance; new minor versions are feature releases; they get released annually,
> from the current in-development branch; new micro versions are bugfix
> releases; they get released roughly every 2 months; they are prepared in
> maintenance branches."*

So in `3.14.7`: major `3`, minor `14`, micro `7`. Python's minor number is what
most ecosystems would call a major — it is the number that can break you. The
micro is a patch level in the ordinary sense.

Pre-final releases carry a qualifier, and the tag format tells you exactly what
you are holding:

> *"Each release of Python is tagged in the source repo with a tag of the form
> `vX.Y.ZTN`, where X is the major version, Y is the minor version, Z is the
> micro version, T is the release level (`a` for alpha releases, `b` for beta,
> `rc` release candidate, and null for final releases), and N is the release
> serial number."*

Those same four levels appear at runtime in `sys.version_info.releaselevel`,
which is `'alpha'`, `'beta'`, `'candidate'` or `'final'` — the one reliable way
for a program to know it is running on a pre-release.

## What a `.z` bugfix release is allowed to change

This is the rule that decides whether a patch upgrade is routine or an event.
The devguide states it twice, and the second statement is the load-bearing one:

> *"Changes backported to a maintenance branch fall into two groups. Low-risk
> changes (bug fixes, test improvements, and documentation edits) may be
> backported without debate. Higher-risk changes (new features, semantic
> changes, and performance improvements) can introduce regressions, so they are
> not backported as a matter of course."*

> *"Also, a general rule for maintenance branches is that compatibility must not
> be broken at any point between sibling micro releases (3.12.1, 3.12.2, etc.).
> For both rules, only rare exceptions are accepted, and each requires a strong
> case agreed upon in discussion beforehand."*

Read that carefully, because it says three separate things:

1. **Bug fixes flow freely.** If your code depends on a documented behaviour
   that was buggy, a micro release can and will change it — the fix is the
   backport that "may be backported without debate".
2. **New features and performance work do not flow as a matter of course.** You
   should not expect 3.14.7 to be faster than 3.14.0, and you should be
   suspicious of any claim that a micro release added an API.
3. **Compatibility must not break between siblings.** No removed functions, no
   changed signatures, no bytecode-format changes within a minor version. The C
   ABI is stable across micro releases too, which is why a wheel tagged `cp314`
   installs on every 3.14.x.

The practical translation: **a micro upgrade is a security and correctness
upgrade, not a feature upgrade, and you should be taking them.** Skipping micro
releases buys you nothing and accumulates unfixed CVEs.

## Micro releases have their own release candidates — and get re-cut

Two details from the actual 3.14 and 3.13 schedules that surprise people:

- Bugfix releases can themselves have a release candidate. PEP 745 lists
  `3.14.5 candidate 1` on 2026-05-04 followed by `3.14.5` on 2026-05-10.
- A micro release can be followed within days by another one. PEP 745 lists
  `3.14.1` on 2025-12-02 and `3.14.2` on 2025-12-05; PEP 719 lists `3.13.4` on
  2025-06-03 and `3.13.5` on 2025-06-11 with the explicit annotation
  *(hotfix)*.

If you pin an exact patch version in a Dockerfile — which you should — this is
the reason to also have a mechanism for moving the pin quickly. A three-day gap
between micro releases means something was wrong with the first one.

## The five statuses, verbatim

The devguide's status key is the vocabulary everyone uses, and each term has a
precise meaning:

> *"**feature**: Before the first beta, the next full release can accept new
> features, bug fixes, and security fixes."*

> *"**prerelease**: After the first beta, no new features can go in, but feature
> fixes (including significant changes to new features), bug fixes, and security
> fixes are accepted for the upcoming feature release."*

> *"**bugfix**: Once a version has been fully released, bug fixes and security
> fixes are accepted. New binaries are built and released roughly every two
> months. This phase is also called maintenance mode or stable release."*

> *"**security**: After two years (18 months for versions before 3.13), only
> security fixes are accepted and no more binaries are released. New source-only
> versions can be released as needed."*

> *"**end-of-life**: Five years after a release, support ends. The release cycle
> is frozen; no further changes are allowed."*

Note the parenthetical in the *security* entry — the two-year full-support
window is new with 3.13. Everything from 3.9 to 3.12 got eighteen months of
bugfix support and three and a half years of security. [The next
chunk](02-the-support-window.md) works through what that means for the versions
that are live today.

## The branch model, because it explains the timing

- **`main`** is always the next feature release and is the only branch that
  accepts new features. Right now it is 3.16.
- **A maintenance branch is cut at beta 1**, not at final release:

  > *"We create the release maintenance branch (3.14) at the time we enter beta
  > (3.14.0 beta 1). This allows feature development for the release 3.n+1 to
  > occur within the main branch alongside the beta and release candidate
  > stabilization periods for release 3.n."*

- **A security branch** is one under five years old but past its bugfix phase:

  > *"The only changes made to a security branch are those fixing issues
  > exploitable by attackers such as crashes, privilege escalation and,
  > optionally, other issues such as denial of service attacks. Any other
  > changes are not considered a security risk and thus not backported to a
  > security branch."*

  and

  > *"Any release made from a security branch is source-only and done only when
  > actual security fixes have been applied to the branch."*

- **An end-of-life branch stops existing.** It is converted to a tag with the
  same name. There is nothing left to backport a fix to.

This is why "we will just backport the fix ourselves" is a much bigger
commitment on an EOL version than on a security-mode one: on a security branch
there is still a branch, a release manager and a build process; on an EOL
version there is a git tag and your own fork.

## Gotchas

**Symptom:** a routine 3.14.4 → 3.14.7 upgrade changed application behaviour
**Cause:** micro releases carry bug fixes, and a bug fix is a behaviour change if you were depending on the bug. The compatibility guarantee is about APIs and ABIs, not about every observable output
**Fix:** treat micro upgrades as low-risk but not zero-risk — run the test suite, read the changelog for the modules you actually use, and deploy them promptly rather than batching six of them into one terrifying jump

**Symptom:** someone claims 3.14.6 "added" a feature and you cannot find it in the What's New page
**Cause:** almost certainly a misread. Higher-risk changes including new features are explicitly *not* backported as a matter of course; What's New pages are written per minor version, not per micro
**Fix:** check the changelog for that specific micro release. If a new API really did appear in a micro release it will be an announced exception, and the docs will carry an "Added in version 3.14.6"-style directive rather than "Added in version 3.14"

**Symptom:** you pinned `python:3.14` in a Dockerfile and the image changed under you
**Cause:** `3.14` is a floating tag that follows the latest micro release. That is usually what you want, but it means your image is not reproducible
**Fix:** pin the full version (`python:3.14.7-slim`) for reproducibility and rebuild deliberately, or accept the floating tag and know that you did

**Symptom:** two micro releases three days apart and you do not know which to take
**Cause:** the first one had a defect serious enough to re-cut. PEP 745 and PEP 719 record several of these
**Fix:** take the later one. A gap that short is a hotfix, and the changelog will say what it fixed

**Symptom:** your team schedules the Python upgrade for "when 3.15 comes out" and is repeatedly surprised in September
**Cause:** the release date is fixed (October) but the *usable* date is not — third-party wheels for the new ABI tag appear over the following weeks
**Fix:** treat beta 1 in May as the date your CI starts testing against the next version, and October as the date you decide, not the date you start

**Symptom:** a release candidate got installed in production because someone requested "the latest Python"
**Cause:** some tooling will select a pre-release if you ask loosely enough; the devguide is explicit that alphas, betas and RCs "are aimed at testing by advanced users, not production use"
**Fix:** pin the minor version, and check `sys.version_info.releaselevel == 'final'` in a startup assertion if you have been bitten once

## Interview questions

**★ Python releases a new version every year. What actually changes in `3.14.7` versus `3.14.0`?**
Bug fixes and security fixes, and essentially nothing else. Micro releases come
out of a maintenance branch, where low-risk changes (bug fixes, tests, docs) are
backported freely and higher-risk ones (new features, semantic changes,
performance work) are not backported as a matter of course. The devguide adds a
hard rule that compatibility must not be broken between sibling micro releases,
which is why a `cp314` wheel installs on any 3.14.x and why upgrading the micro
version is a routine operation rather than a project.

**★ Why are there always two Python versions in development at the same time?**
Because the development window is seventeen months but the release cadence is
twelve. PEP 602 starts feature development for 3.(X+1) on the day 3.X reaches
beta 1, which is five months before 3.X ships. During those five months `main`
is accumulating features for next October while the maintenance branch cut at
beta 1 is being stabilised for this October.

**What do the four release levels mean, and how do you detect one at runtime?**
`alpha` means features are still landing; `beta` means the feature set is frozen
and only fixes go in; `candidate` means only reviewed, severe fixes go in and the
goal is zero code change before final; `final` is the release. At runtime,
`sys.version_info.releaselevel` returns exactly one of the strings `'alpha'`,
`'beta'`, `'candidate'` or `'final'`, so a startup check can refuse to run on a
pre-release build.

**When is the maintenance branch for a release created?**
At its first beta, not at its final release. The devguide says the 3.14 branch
was created when 3.14.0 beta 1 was cut, precisely so that `main` could keep
accepting 3.15 features during 3.14's beta and RC stabilisation.

**What is the difference between a "security" version and an "end-of-life" version?**
A security version still has a branch, a release manager and a build process,
but only accepts fixes for issues exploitable by attackers, and any release from
it is source-only and irregular. An end-of-life version has no branch at all —
the final state is recorded as a tag and no further changes are allowed. The
practical difference is that on a security version somebody else may still fix
your CVE; on an EOL version, nobody will.

**Why does Python's minor version behave like other ecosystems' major version?**
Because Python's major version is reserved for "strongly incompatible changes
deemed necessary and planned very long in advance" — the 2-to-3 kind of event.
Everything that a semver project would call a breaking change, subject to the
deprecation policy in PEP 387, lands in a minor release. So `3.13 → 3.14` is the
upgrade that can break you, and `3.14.6 → 3.14.7` is the one that cannot.

**A colleague wants to skip four micro releases and take them all at once next quarter. What do you tell them?**
That batching them makes the upgrade riskier, not safer. Each micro release is
individually low-risk by policy; taking four at once concentrates four separate
sets of behaviour changes into one deployment, and it leaves you running known
security defects in the meantime, since security fixes ship in the ordinary
bugfix stream during the two-year full-support window.

---

← Index: [The release model](README.md) · Next → [The five-year support window](02-the-support-window.md)
