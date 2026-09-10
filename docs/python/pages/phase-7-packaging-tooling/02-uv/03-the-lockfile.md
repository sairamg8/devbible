---
title: "`uv.lock` is not a `pip freeze` with better formatting — it is the solution to a constraint problem over every platform at once, which is why it is committed, why nobody edits it, and why it can list one package twice"
sidebar_label: "03 · uv.lock"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Project structure and files*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)), *Resolution*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/)), *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), *Configuring projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/)), the release list
> ([github.com](https://github.com/astral-sh/uv/releases)) and *Installing packages using pip and
> virtual environments*
> ([packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**A `pip freeze` answers "what is installed in this environment, on this machine, right now".
`uv.lock` answers a completely different and much harder question: "for every operating system,
architecture and Python version this project claims to support, which distributions satisfy the
declared requirements". The first is a report; the second is a solution. That difference explains
every property of the file — it is committed to version control, it is generated and never edited
by hand, it can legitimately list the same package at two different versions, and it is
deliberately in a format no other tool can consume. It also explains the one thing people get
wrong: `requires-python` is not documentation, it is an input to the solver, and widening it can
make an otherwise fine dependency set unresolvable.**

## What the file is, in uv's words

> *"uv creates a `uv.lock` file next to the `pyproject.toml`."*

> *"`uv.lock` is a universal or cross-platform lockfile that captures the packages that would be
> installed across all possible Python markers such as operating system, architecture, and Python
> version."*

> *"This file should be checked into version control, allowing for consistent and reproducible
> installations across machines."*

> *"`uv.lock` is a human-readable TOML file but is managed by uv and should not be edited manually.
> The `uv.lock` format is specific to uv and not usable by other tools."*
> — all four [project structure and files](https://docs.astral.sh/uv/concepts/projects/layout/)

Four sentences, four rules. **Committed.** **Universal.** **Not hand-edited.** **Not portable to
other tools.** The last one is the price of the second: no interoperable format existed that could
express a cross-platform resolution when uv shipped this, so uv defined its own — and the way out to
other tools is `uv export` ([03c](03c-exporting-the-lockfile.md)).

## Universal resolution is a different operation, not a nicer output format

> *"uv's lockfile (`uv.lock`) is created with a universal resolution and is portable across
> platforms."*

Universal resolution ensures *"dependencies are locked for everyone working on the project,
regardless of operating system, architecture, and Python version."*

> *"By default, uv's pip interface, i.e., `uv pip compile`, produces a resolution that is
> platform-specific, like `pip-tools`."*
> — all [resolution](https://docs.astral.sh/uv/concepts/resolution/)

So the *same resolver* produces two different kinds of answer depending on the question asked.
`uv pip compile` asks "what should be installed *here*"; `uv lock` asks "what should be installed
*anywhere I claim to support*". The pip interface can be told to do the universal one with
`--universal`, which is worth knowing when you are stuck on `requirements.txt` for other reasons.

The platform set is itself version-dependent: uv **0.12.7** (2026-08-27) added *"Support Linux
`s390x`, `ppc64le`, and `loongarch64` targets for cross-platform dependency resolution"*
([releases](https://github.com/astral-sh/uv/releases)). A lockfile is a resolution produced by a
particular uv, over the platforms that uv knew about.

## 🔴 `requires-python` is an input to the solver

> *"all required packages must be compatible with the entire range of `requires-python` declared in
> the `pyproject.toml`"*
> — [resolution](https://docs.astral.sh/uv/concepts/resolution/)

> *"The Python version requirement determines the Python syntax that is allowed in the project and
> affects selection of dependency versions"*
> — [configuring projects](https://docs.astral.sh/uv/concepts/projects/config/)

Read the first quote as a hard constraint with a counter-intuitive direction: **a wider
`requires-python` is a stronger constraint on your dependencies, not a weaker one.** Declaring
`>=3.9` means every locked package must work on 3.9 *and* 3.14, so any dependency that has dropped
3.9 support is excluded — and you may be silently held at an old version of it.

```toml
[project]
requires-python = ">=3.14"     # narrow: dependencies only need to support 3.14+
# requires-python = ">=3.9"    # wide: every dependency must ALSO still support 3.9
```

The practical rule: `requires-python` should be as narrow as your actual support commitment, and no
narrower. A library widening it to be generous pays for that generosity in dependency versions.

## One package, two versions — that is forking, not corruption

During universal resolution *"a package may be listed multiple times with different versions"*
across Python versions, and `--fork-strategy` *"controls this tradeoff between consistency and
selecting latest versions per Python version"* ([resolution](https://docs.astral.sh/uv/concepts/resolution/)).

This is what a universal resolution *has* to do sometimes. If `numpy 2.4` requires Python ≥ 3.11
and your `requires-python` is `>=3.10`, there is no single version that works everywhere, so the
resolution splits: one branch for `python_version >= "3.11"`, another for below. Seeing the same
package name twice in `uv.lock` with different markers is the file working correctly.

The consequence for review: **a lockfile entry is not "the version we use"** — it is "a version
used under these markers". Reading a lockfile diff means reading the markers too.

## Reviewing a lockfile diff without reading 4,000 lines

`uv.lock` is TOML by design (*"a human-readable TOML file"*), so a diff is legible — but a `uv lock
--upgrade` diff can be enormous. What actually matters in review:

- **Did a *direct* dependency change version?** That is a decision someone made.
- **Did a package appear or disappear?** A new transitive dependency is a new supply-chain entry and
  a new licence.
- **Did the set of markers change?** A package that was conditional and is now unconditional means
  something widened.
- **Did anything change that the accompanying `pyproject.toml` diff does not explain?** That is the
  question a reviewer is uniquely able to answer, and the reason `--locked` in CI matters
  ([02d](02d-frozen-and-locked-in-ci.md)): it guarantees the lockfile in the diff is the one the
  tests ran against.

The lockfile is not something to skim past in a review. It is the only place a dependency change is
actually *stated*.

One question this file always raises — *does a **library** commit it?* — turns on what a lockfile
does and does not reach, and its tool-level answer is a resolution strategy, so it is argued in
[03b](03b-upgrading-the-lockfile.md) where that strategy lives.

## Gotchas

**★ Symptom: a merge conflict in `uv.lock`, thousands of lines long.**
Cause: two branches both re-locked. There is nothing to merge by hand — the file is a resolution,
and half of one resolution plus half of another is not a resolution. Fix: take either side, then
re-derive.

```bash
git checkout --theirs uv.lock     # or --ours; it does not matter which
uv lock
git add uv.lock
```

**★ Symptom: `uv.lock` is not in the repository and nobody noticed.**
Cause: a `.gitignore` copied from a template that ignores `*.lock` (a convention borrowed from other
ecosystems) or that lists `uv.lock` explicitly. Fix: find the rule and remove it.

```bash
git check-ignore -v uv.lock       # prints the exact rule hiding it
git add -f uv.lock
```

**★ Symptom: you edited `uv.lock` to bump one version, and the environment did not change — or changed back.**
Cause: the file *"is managed by uv and should not be edited manually"*; the next lock run rewrites
it. Fix: express the change where uv reads it.

```bash
uv lock --upgrade-package httpx          # move one package
uv add 'httpx>=0.29'                     # or change the declared requirement
```

**★ Symptom: the same package appears twice in `uv.lock` at different versions, and you assume the file is corrupt.**
Cause: forking. A universal resolution may need different versions for different Python versions —
*"a package may be listed multiple times with different versions."* Fix: nothing. If you want fewer
forks, narrow the range you are asking uv to satisfy.

```toml
[project]
requires-python = ">=3.13"     # fewer Python versions to satisfy, fewer forks
```

**★ Symptom: after widening `requires-python` to support older Pythons, several dependencies dropped to ancient versions.**
Cause: exactly the documented rule — *"all required packages must be compatible with the entire
range of `requires-python`"* — so the newest release of anything that dropped that old Python is now
ineligible. Fix: narrow the declared range to what you actually support.

```toml
[project]
requires-python = ">=3.12"
```

**★ Symptom: a colleague tries `pip install -r uv.lock` and it fails.**
Cause: *"The `uv.lock` format is specific to uv and not usable by other tools."* Fix: export a
format the other tool understands ([03c](03c-exporting-the-lockfile.md)).

```bash
uv export --format requirements.txt -o requirements.txt
```

**★ Symptom: every trivial `uv add` produces a large lockfile diff.**
Cause: adding one requirement can shift a whole transitive subtree, and that *is* the change — the
diff size is the information. Fix: nothing to fix; make it reviewable by keeping the dependency
change in its own commit, so the diff has one cause.

```bash
uv add httpx
git add pyproject.toml uv.lock
git commit -m "deps: add httpx"
```

**★ Symptom: your lockfile changes when a colleague on a different OS runs `uv lock`, even with no dependency change.**
Cause: this should *not* happen for platform reasons — the resolution is universal — so suspect a
different uv version instead. The set of platforms uv can resolve for changes between releases (uv
0.12.7 added three Linux targets). Fix: pin uv for everyone ([01c](01c-installing-and-pinning-uv.md)).

```bash
uv self version                  # compare across machines before theorising
```

**★ Symptom: CI passes on a lockfile that does not match `pyproject.toml`, and the mismatch lands.**
Cause: nothing forbade re-locking during the job. Fix: assert it, in the job that tests the commit.

```bash
uv lock --check
```

## Interview questions

**★ Why is a "universal" lockfile fundamentally harder to produce than a `pip freeze`, and what do you get for it?**
`pip freeze` is a report on an environment — the packaging guide describes it as useful for
recreating *"the exact versions of all packages installed in an environment"*. It requires no
solving: enumerate what is installed and print it. A universal lockfile is the output of a
constraint solve over *every* configuration the project claims to support, so it must reason about
environment markers, platform-conditional dependencies, and Python-version-conditional requirements
simultaneously — and where no single version satisfies the whole space, it must fork the resolution
into marker-guarded branches. uv states the goal directly: the lock *"captures the packages that
would be installed across all possible Python markers such as operating system, architecture, and
Python version."* What you get is that a lockfile produced on a developer's macOS laptop is
authoritative for the Linux container that ships — which a `pip freeze` from that laptop emphatically
is not.

**★ You see `numpy` listed twice in `uv.lock` at different versions. Bug or not?**
Not a bug — it is forking, and it is the correct behaviour for a universal resolution. uv's
resolution docs note that during universal resolution *"a package may be listed multiple times with
different versions"*, with `--fork-strategy` controlling the trade-off between consistency and
picking the newest version for each Python version. It happens when no single version satisfies the
entire `requires-python` range: a release that dropped an old Python cannot be used on that old
Python, so the resolution splits and each branch carries a marker. The important consequence is for
reading the file: an entry is not "the version this project uses", it is "the version used under
these markers", so any diff review has to read the markers alongside the versions.

**★ Widening `requires-python` feels generous. Why can it make your dependency situation worse?**
Because it is a constraint on your dependencies, not a statement about yours. uv is explicit: *"all
required packages must be compatible with the entire range of `requires-python` declared in the
`pyproject.toml`."* Declaring `>=3.9` means every locked package must work on 3.9 as well as on
3.14, so anything whose current release has dropped 3.9 is ineligible and the resolver falls back to
an older release of it — quietly, with no error. You end up on old dependencies to support a Python
version nobody is using, and you may also get more forks in the lockfile. The rule is that
`requires-python` should match your actual support commitment exactly; generosity here is paid for in
versions.

**★ Should a library commit `uv.lock`?**
uv's own guidance is unconditional — the file *"should be checked into version control"* — and the
practical reason is that CI becomes reproducible: a test failure is about your code, not about a
dependency released this morning. What must be understood alongside it is that the lockfile does not
reach your users at all: your published wheel carries the *ranges* from `[project.dependencies]`, and
each consumer's installer resolves independently. So committing it is right, and it creates a
specific blind spot — if CI only ever runs the locked versions, you have never tested the range you
published. The tool-level mitigation is a second CI job resolving with `--resolution lowest-direct`,
which exercises the floor of your declared ranges ([03b](03b-upgrading-the-lockfile.md)).

**★ Is it acceptable that `uv.lock` is a uv-specific format?**
It is a real cost, stated plainly by uv: *"The `uv.lock` format is specific to uv and not usable by
other tools."* The trade-off is that no interoperable format could express a cross-platform
resolution at the time — `requirements.txt` is a flat platform-specific list by construction — so
uv's options were to define a format or not to have universal locking. The mitigation is export:
`uv export` produces `requirements.txt`, `pylock.toml` (PEP 751) and CycloneDX SBOM output, so
downstream consumers are served without the lockfile pretending to be something it is not. And the
direction of travel matters: PEP 751 exists precisely to standardise this, and uv already emits it —
with 0.12.11 tightening its hash handling — so the lock-in is narrowing rather than widening.

**How do you review a 4,000-line lockfile diff usefully?**
By reading it as a set of decisions rather than a file. Four questions answer almost everything: did
any *direct* dependency's version change (that is a choice someone made); did any package appear or
disappear (a new transitive dependency is new code, a new maintainer and a new licence); did any
markers change (a package becoming unconditional means some constraint widened); and is there any
change the accompanying `pyproject.toml` diff does not explain? The last one is the reviewer's
unique contribution and the reason `uv lock --check` and `uv sync --locked` belong in CI: they
guarantee the lockfile you are reading is the one the tests actually ran against. Keeping dependency
changes in their own commits is what makes this tractable at all.

**Someone hands you a `requirements.txt` produced by `pip freeze` and asks whether it is a lockfile. What do you say?**
That it is a snapshot, not a lock, and the difference is operational rather than pedantic. It records
what was installed on one machine — including packages nobody declared, including whatever the
platform-conditional resolution happened to select there, and with no distinction between direct and
transitive requirements, so nobody can later tell which entries were *intended*. It contains no
markers, so it cannot describe a second platform; it contains no hashes by default, so it does not
pin content; and it is a fixed point rather than a solution, so it cannot be re-derived or upgraded
selectively. It is genuinely useful as an emergency reproduction of one environment, and it is not a
substitute for a resolution.

---

← Prev: [02f · A complete multi-stage Dockerfile](02f-a-complete-multi-stage-dockerfile.md) · [Topic index](README.md) · Next → [03b · Upgrading the lockfile](03b-upgrading-the-lockfile.md)
