---
title: "The five-year support window: two years of bugfixes, three years of source-only security patches, and the version you should actually start on"
sidebar_label: "2 · The support window"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the devguide
> [Status of Python versions](https://devguide.python.org/versions/) and
> [Development cycle](https://devguide.python.org/developer-workflow/development-cycle/),
> [PEP 602](https://peps.python.org/pep-0602/), and the per-version schedule PEPs
> [745](https://peps.python.org/pep-0745/) (3.14),
> [719](https://peps.python.org/pep-0719/) (3.13),
> [693](https://peps.python.org/pep-0693/) (3.12),
> [664](https://peps.python.org/pep-0664/) (3.11),
> [619](https://peps.python.org/pep-0619/) (3.10) and
> [790](https://peps.python.org/pep-0790/) (3.15).
> Version spine: **Python 3.14.7**; 3.13 in bugfix until its final binary
> release 3.13.16, scheduled 2026-10-06.

**Every Python minor version lives for exactly five years. The first two are
loud — binary installers every couple of months, every bug fixed. The last three
are silent — source-only releases, on no schedule, for exploitable defects only.
Then the branch is deleted. The single most useful thing you can do with this
model is look up where your production version sits today, because the answer is
routinely two phases further along than the team believes.**

## The two numbers

PEP 602 states the window directly:

> *"After the release of Python 3.X.0, the 3.X series is maintained for five
> years: During the first twenty four months (2 years) it receives bugfix
> updates and full releases (sources and installers for Windows and macOS) are
> made approximately every other month. For the next thirty six months (3 years)
> it receives security updates and source-only releases are made on an as-needed
> basis (no fixed cadence). The final source-only release is made five years
> after 3.X.0."*

And, crucially, a note that is easy to miss and changes every calculation for
older versions:

> *"Note: 2 years of full support start with Python 3.13. Python versions 3.9 -
> 3.12 operate on a calendar with 1½ year of full support, followed by 3½ more
> years of security fixes."*

So there are two support calendars alive at once:

| | Full support (bugfix) | Security-only | Total |
|---|---|---|---|
| 3.9 – 3.12 | 18 months | 3½ years | 5 years |
| 3.13 onwards | 24 months | 3 years | 5 years |

The total never changes. Only the split moved. Anyone who tells you "you get
eighteen months of real support" is quoting the old calendar; anyone who says
"two years" is quoting the new one. Both were correct at some point.

## Where every live version sits today

From the devguide's *Status of Python versions*, as of this page's verification
date:

| Branch | Schedule | Status today | First release | End of life |
|---|---|---|---|---|
| `main` | PEP 826 | feature (future 3.16) | 2027-10-06 | 2032-10 |
| 3.15 | PEP 790 | prerelease | 2026-10-01 | 2031-10 |
| 3.14 | PEP 745 | **bugfix** | 2025-10-07 | 2030-10 |
| 3.13 | PEP 719 | **bugfix** | 2024-10-07 | 2029-10 |
| 3.12 | PEP 693 | security | 2023-10-02 | 2028-10 |
| 3.11 | PEP 664 | security | 2022-10-24 | 2027-10 |
| 3.10 | PEP 619 | security | 2021-10-04 | 2026-10 |
| 3.9 | PEP 596 | **end of life** | 2020-10-05 | 2025-10-31 |

Four things in that table that people get wrong:

- **3.11 and 3.12 are already security-only.** They feel recent. They are not
  receiving bug fixes. If you hit a non-security bug on 3.12 today, the fix goes
  into 3.13 and 3.14 and you do not get it.
- **3.10 reaches end of life in October 2026** — within weeks of this page.
- **3.9 is already dead.** Its end-of-life date was 2025-10-31.
- **3.13 is at the end of its bugfix phase.** PEP 719 schedules 3.13.16 for
  2026-10-06 and annotates it *"(Final regular bugfix release with binary
  installers)"*. After that, 3.13 goes source-only until approximately October
  2029.

The transition rule the devguide gives is that the older branch goes into
security mode *"sometime following the final release (3.x.0) … usually after at
least one more bugfix release at the discretion of the release manager"* — so
these dates are approximate by design and the devguide page is the authority,
not your memory of it.

## What "security-only" actually costs you

It is a bigger step down than the name suggests, and it bites in four places.

**1 · No binaries.** The devguide is blunt: *"After two years (18 months for
versions before 3.13), only security fixes are accepted and no more binaries are
released."* No Windows installer, no macOS installer. Whoever supplies your
interpreter — your distro, `uv`, a Docker image maintainer — is now building it
themselves from the source tarball.

**2 · No schedule.** Releases are *"done only when actual security fixes have
been applied to the branch."* PEP 693 lists 3.12.12 on 2025-10-09 and 3.12.13 on
2026-03-03 — a five-month gap. Silence does not mean "nothing to fix"; it means
"nothing exploitable was fixed".

**3 · No ordinary bug fixes at all.** The devguide draws the line explicitly:

> *"The only changes made to a security branch are those fixing issues
> exploitable by attackers such as crashes, privilege escalation and,
> optionally, other issues such as denial of service attacks. Any other changes
> are not considered a security risk and thus not backported to a security
> branch."*

A wrong answer from a standard library function is not a security issue. On a
security branch it stays wrong.

**4 · The ecosystem leaves before CPython does.** This is the part the support
table does not tell you. Third-party projects set their own floors, and many use
"the versions still in bugfix" or "the last four minors" as their policy. Wheels
for a security-mode version keep working, but new releases of your dependencies
gradually stop being built for it — and the first symptom is usually a
resolver silently choosing a three-year-old version of a library rather than an
error.

## What end of life means concretely

> *"end-of-life: Five years after a release, support ends. The release cycle is
> frozen; no further changes are allowed."*

And, from the branch model: the branch is removed and *"the final state of the
end-of-lifed branch is recorded as a tag with the same name as the former
branch."*

Practically, on an EOL version:

- A newly disclosed CPython CVE will never be fixed upstream. Your options are a
  vendor backport (some enterprise distros do this for their own builds and
  their own dates), your own patched fork, or migrating.
- Docker base images stop being rebuilt, so the OS layer beneath your
  interpreter also stops receiving patches — usually the more urgent problem.
- Auditing tools will flag the interpreter itself, and "it still works" is not
  an answer you can give a security reviewer.

## Choosing the version for a new project

The decision procedure, in order, with the reasoning attached:

**1 · Default to the current stable release (today, 3.14).**
You get the full five-year window starting now, and the maximum time before you
are forced to move. The counter-argument people reach for — "the ecosystem
hasn't caught up" — is a claim to *check*, not to assume, and it is weakest for
pure-Python dependencies and strongest for large compiled ones.

**2 · Check your compiled dependencies before you commit.** A new minor version
means a new ABI tag (`cp314` for 3.14), so every package with a C extension
needs a rebuilt wheel. Verify on PyPI, per dependency, that a wheel exists for
your interpreter, your OS and your architecture — the "Download files" list on
the project's PyPI page shows the tags. If one does not exist, `pip` will try to
build from source, which either fails or silently makes your image build several
minutes slower.

**3 · If a critical dependency is not ready, take the previous release (3.13),
not something older.** One version back is still in bugfix support today and has
years of runway. Two versions back (3.12) is already security-only, which means
you are starting a new project on a version that will never receive another
non-security bug fix.

**4 · Never start on a version that is security-only or EOL.** You are spending
support window you have not used yet. Starting a project on 3.11 in 2026 means
choosing, on day one, an interpreter that reaches end of life in October 2027.

**5 · Set the floor explicitly in packaging metadata**, so the decision is
recorded and enforced rather than implied:

```toml
# pyproject.toml
[project]
requires-python = ">=3.13"
```

That single line makes installers refuse the package on older interpreters
instead of failing later with a `SyntaxError` on a match statement or a missing
module. Phase 7 covers what else lives in that file; this is the part that
belongs to the release model.

**6 · Pin the exact interpreter in your runtime image, and pin the minor version
in CI.** Reproducibility wants `3.14.7`; the CI matrix wants `3.14` so that you
notice a micro regression the week it ships rather than the quarter it ships.

**A note on "wait for `.1`".** The folk rule that you should never adopt `x.y.0`
is not supported by the process: the release candidate stage exists precisely to
find those bugs, and the devguide says the goal is *"to have no code changes
between an RC and a final release"*. The real reason teams wait a few weeks
after October is ecosystem wheel availability, not CPython stability — and that
is a dependency question you can answer directly instead of a superstition you
have to obey.

## Gotchas

**Symptom:** a bug in the standard library was fixed months ago but your 3.12 deployment still has it
**Cause:** 3.12 is in security-only mode. Non-security bug fixes are not backported to a security branch, no matter how small
**Fix:** confirm the branch status on the devguide page, then either upgrade the minor version or vendor the fix yourself. There is no third option that involves waiting

**Symptom:** "we are on a supported version" is true and useless
**Cause:** "supported" covers both bugfix and security modes, and those are very different products. Five years of support is really two years of maintenance plus three years of life support
**Fix:** in any capacity or risk conversation, name the *phase*, not the word "supported" — "3.11, security-only, end of life October 2027"

**Symptom:** your macOS or Windows build pipeline broke when a version went security-only
**Cause:** no more binary installers are produced after the bugfix phase ends. Anything that downloaded the official installer now 404s for new patch versions
**Fix:** move to a source-built or redistributor-built interpreter (`uv`'s standalone builds, your distro, a Docker image) or move the minor version forward. See [04 · Installing and managing versions](../04-installing-and-versions/README.md)

**Symptom:** a dependency upgrade silently stopped bringing new versions
**Cause:** the dependency dropped support for your interpreter, so the resolver is picking the newest release that still declares compatibility with it. This is correct behaviour and produces no error
**Fix:** check the resolved version against the project's latest release. A `requires-python` floor on your own project and a CI job on the newest interpreter both surface this early

**Symptom:** the team plans the upgrade for "when we get time" and the version reaches EOL first
**Cause:** the five-year window sounds enormous and is usually spent before anybody looks at it. A project started on a two-year-old version has three years, not five
**Fix:** record the EOL date of your interpreter as a dated item somewhere with teeth, and treat the annual October release as a scheduled prompt to move one version forward rather than an optional event

**Symptom:** an enterprise distro claims support for a Python version that upstream calls end-of-life
**Cause:** redistributors backport security fixes on their own calendars, which can extend well past upstream EOL. This support is real but is scoped to *their* build
**Fix:** know which you are relying on. If it is the vendor's, then their errata feed — not the devguide — is your source of truth, and their support ends when their OS release does

**Symptom:** starting a greenfield project on the same version as the legacy system "for consistency"
**Cause:** an understandable instinct, but it inherits an EOL date that was set years ago
**Fix:** make the new project's version a deliberate decision. Consistency across services is worth something; starting a five-year asset with two years already spent is worth less

## Interview questions

**★ How long is a Python version supported, and what changes halfway through?**
Five years from the `3.x.0` release. The first two years (eighteen months for
3.12 and earlier) are the bugfix phase: any bug can be fixed, and binary
installers ship roughly every two months. The remaining three years are
security-only: source-only releases, produced irregularly, containing fixes only
for issues exploitable by attackers. Five years after release the branch is
frozen and removed.

**★ We are running Python 3.11 in production. Is that a problem?**
It is not broken, but it is already security-only and reaches end of life in
October 2027. That means no non-security bug fixes at all, no new binary
installers, and a shrinking set of third-party releases that still target it.
The correct framing is not "is it supported" but "how many months of runway do
we have and what is the migration cost", and that conversation should start
well before the EOL date, because the dependency ecosystem leaves before CPython
does.

**★ What version would you start a new service on today, and why?**
The current stable release — 3.14 — because it maximises the remaining support
window and every subsequent upgrade gets cheaper the closer you stay to the
head. The one thing I would check first is that every compiled dependency
publishes a wheel for the new ABI tag on my target OS and architecture. If a
critical one does not, I would take 3.13, which is still in bugfix support, and
not 3.12, which is already security-only.

**Why do 3.12 and 3.13 have different amounts of full support?**
PEP 602 was amended so that two years of full support begins with 3.13; 3.9
through 3.12 run on the older calendar of eighteen months of bugfix support
followed by three and a half years of security fixes. The five-year total is
unchanged in both cases — only the boundary between the phases moved.

**What is the practical difference between a version in security mode and one at end of life?**
In security mode there is still a branch, a release manager, and a process that
produces source-only releases when an exploitable defect is found. At end of
life the branch no longer exists; it has been converted to a tag and no further
changes are permitted. So on a security-mode version an upstream fix is
possible; on an EOL version, your only options are a redistributor's backport or
your own fork.

**How do you express your supported Python versions to the outside world?**
With `requires-python` in `pyproject.toml`, which installers enforce before
download, plus a CI matrix that actually runs on each version in that range. The
metadata is the contract; the matrix is the evidence. Declaring `>=3.9` and
testing only on 3.14 is a claim you cannot support.

**Is it risky to adopt `3.x.0` on release day?**
Less risky than the folklore suggests, from CPython's side — the beta and
release-candidate phases exist to stabilise it, and the goal during RC is that
no code changes at all between the candidate and the final release. The real
adoption risk is the third-party ecosystem: a new minor version means a new ABI
tag and every compiled dependency needs a fresh wheel. That is a question you
can check per dependency rather than a reason to wait a fixed number of weeks.

---

← Prev: [The annual cadence](01-the-annual-cadence.md) · Index: [The release model](README.md) · Next → [Feature freeze and the free-threaded build](03-feature-freeze.md)
