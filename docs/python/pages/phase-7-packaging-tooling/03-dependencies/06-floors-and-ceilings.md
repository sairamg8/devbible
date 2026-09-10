---
title: "A lower bound is a claim about code you have run and nothing tests it by default; an upper bound is a prediction about code that does not exist yet and it constrains every consumer you will ever have"
sidebar_label: "06 · Floors and ceilings"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Resolution** concepts
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/), **uv 0.12.12**), pip's
> **Dependency resolution** topic
> ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/dependency-resolution/)), the PyPA
> **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/))
> and the PyPA discussion **install_requires vs requirements files**
> ([packaging.python.org](https://packaging.python.org/en/latest/discussions/install-requires-vs-requirements/)).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run** — no resolution was
> executed and no timing is claimed.

**The two ends of a range are not symmetric, and treating them as if they were is the most
expensive habit in Python dependency management. A lower bound is a factual claim — "this
works with at least version X" — and by default *no test you run will ever check it*, because
resolvers prefer the newest candidate. An upper bound is a claim about software that has not
been written yet, and because bounds intersect across the entire dependency graph, your
speculation becomes every downstream consumer's constraint. This page is where the two go, how
to test the floor, and when a ceiling earns its place.**

## Where each belongs

```toml
# pyproject.toml — a library: ranges and exclusions, never a bare ==
[project]
name = "acme-reports"
requires-python = ">=3.12"
dependencies = [
  "httpx>=0.27",                    # lower bound: the oldest release you test
  "sqlalchemy>=2.0,!=2.0.26",       # 2.0.26 has a regression we hit
  "cryptography==43.0.*",           # a series, not a release — fixes still arrive
]
```

```text
# requirements.txt — an application deployment: exact, generated, never hand-written
httpx==0.27.2
sqlalchemy==2.0.31
cryptography==43.0.1
```

Same operators, opposite intent: the library declares what it *tolerates*, the deployment records
what was *chosen*. PyPA's own framing of that split is the abstract/concrete distinction —

> *"it's important to understand that `install_requires` is a listing of “Abstract” requirements, i.e
> just names and version restrictions that don't determine where the dependencies will be fulfilled
> from (i.e. from what index or source). The where (i.e. how they are to be made “Concrete”) is to be
> determined at install time using pip options."*

— and the full argument is [13](13-applications-lock-libraries-range.md).

The same page states the floor/ceiling advice directly:

> *"Additionally, it's best practice to indicate any known lower or upper bounds."*

with its worked progression from `['A', 'B']` to `['A>=1', 'B>=2']` to `['A>=1,<2', 'B>=2']`, the
last step justified by knowledge, not caution:

> *"It may also be known that project ‘A' introduced a change in its v2 that breaks the compatibility
> of your project with v2 of ‘A' and later, so it makes sense to not allow v2"*

Read the word *known* twice. The upper bound in that example is added because a specific
incompatibility was observed — not because a major bump is coming.

## A lower bound is a claim, and by default nothing tests it

The specification's default — prefer the latest matching candidate — means your declared floor is
never exercised. uv states the consequence plainly:

> *"By default, uv tries to use the latest version of each package. For example,
> `uv pip install flask>=2.0.0` will install the latest version of Flask, e.g., 3.0.0. If
> `flask>=2.0.0` is a dependency of the project, only flask 3.0.0 will be used. This is important,
> for example, because running tests will not check that the project is actually compatible with its
> stated lower bound of flask 2.0.0."*

and gives the remedy:

> *"With `--resolution lowest`, uv will install the lowest possible version for all dependencies,
> both direct and indirect (transitive). Alternatively, `--resolution lowest-direct` will use the
> lowest compatible versions for all direct dependencies, while using the latest compatible versions
> for all other dependencies. uv will always use the latest versions for build dependencies."*

> *"When publishing libraries, it is recommended to separately run tests with `--resolution lowest`
> or `--resolution lowest-direct` in continuous integration to ensure compatibility with the declared
> lower bounds."*

In a workflow file that is one extra job:

```yaml
# .github/workflows/ci.yml — prove the floor, not just the ceiling
jobs:
  test-latest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --locked
      - run: uv run pytest -q

  test-lowest-direct:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --resolution lowest-direct
      - run: uv run pytest -q
```

`lowest-direct` is the pragmatic choice: it tests *your* declared floors without dragging every
transitive dependency back to versions nobody has run in five years — whose own metadata is often
wrong, and whose failures tell you nothing about your code.

Note the two jobs use different lock discipline on purpose. The first asserts the committed lockfile
is current (`--locked`, [20](20-the-ci-flags-that-refuse-to-re-resolve.md)); the second deliberately
resolves outside the lock, because the whole point is to install versions the lock does not contain.

## An upper bound is a prediction, and pip says so

pip's own guidance, in the section on taming an over-deep resolution:

> *"Although upper bounds are generally discouraged because they can complicate dependency
> management, they may be necessary when certain versions are known to cause conflicts. Use them
> cautiously"*

and, on the other side, why a *floor* helps the resolver:

> *"By setting a higher lower bound for your dependencies, you narrow the search space. This excludes
> older versions that might trigger excessive backtracking."*

The asymmetry is the whole point. A lower bound is a statement about code you have run. An upper
bound is a statement about code that does not exist yet — you are asserting that the next major
release will break you. When it does not, your bound is the thing that breaks: it blocks consumers
from adopting the new release until you publish again, and if you have stopped maintaining the
project, permanently.

A defensible upper bound has a *reason* attached, in a comment, with an issue link:

```toml
dependencies = [
  # 3.0 removed `Session.execute(str)`; migration tracked in acme-reports#412
  "sqlalchemy>=2.0,<3",
  # no known incompatibility — floor only
  "httpx>=0.27",
]
```

An application is the one place the asymmetry inverts: its declaration can be as tight as it likes,
because nothing depends on it. It should still be a *range*, with exactness living in the lockfile —
[17](17-what-a-lockfile-guarantees.md) explains why keeping those two separate is what makes an
upgrade reviewable rather than a wall of diff.

## uv's `--bounds`, and what each setting commits you to

`uv add` writes a bound for you. The CLI reference:

> *"The kind of version specifier to use when adding dependencies. When adding a dependency to the
> project, if no constraint or URL is provided, a constraint is added based on the latest compatible
> version of the package. By default, a lower bound constraint is used, e.g., `>=1.2.3`."*

> *"`lower`: Only a lower bound, e.g., `>=1.2.3` · `major`: Allow the same major version, similar to
> the semver caret, e.g., `>=1.2.3, <2.0.0` · `minor`: Allow the same minor version, similar to the
> semver tilde, e.g., `>=1.2.3, <1.3.0` · `exact`: Pin the exact version, e.g., `==1.2.3`"*

> *"This option is in preview and may change in any future release."*

```bash
uv add httpx                      # >=X.Y.Z — the default, and the right default for a library
uv add --bounds major httpx       # >=X.Y.Z,<X+1.0.0 — a caret, spelled out
uv add --bounds exact httpx       # ==X.Y.Z — only defensible in an application, and even then
                                  #   the lockfile already does this job
```

`--bounds major` is how you get caret semantics without a caret operator; the important difference
from npm is that *you* wrote the ceiling, so *you* own retiring it.

## Gotchas

**★ Symptom: CI is green, and a user on the declared minimum version gets an `AttributeError`.**
Cause: nothing ever installed the minimum — *"running tests will not check that the project is
actually compatible with its stated lower bound"*. Fix: the second CI job above, or raise the floor
to a version you do test:

```bash
uv sync --resolution lowest-direct && uv run pytest -q
```

A lower bound you have never run is a guess published in a machine-readable field.

**★ Symptom: your library cannot be installed alongside a popular one, and the resolver blames your
`<3` on a shared dependency.** Cause: a speculative upper bound. Because upper bounds intersect
across the whole graph, yours constrains every consumer, not just you. Fix: replace the prediction
with a fact — an exclusion of the releases that actually broke:

```toml
- "sqlalchemy>=2.0,<3"
+ "sqlalchemy>=2.0,!=3.0.0,!=3.0.1"    # the two releases we verified are broken
```

and if the whole next major really is incompatible, keep `<3` *with the reason in a comment* so the
next maintainer can retire it deliberately.

**★ Symptom: a resolution takes minutes and downloads many versions of one package.** Cause: too wide
a search space, usually an absent floor letting the resolver walk back through years of releases,
each of which must be downloaded for its metadata. Fix: raise the lower bound to something real —
pip's own advice is that this *"excludes older versions that might trigger excessive backtracking"* —
and see [24](24-reading-a-resolution-failure.md) for the rest of the ladder.

**★ Symptom: `uv add` wrote `>=1.2.3` and a reviewer wanted a caret.** Cause: `lower` is the default
bound kind. Fix: ask for it, and put the choice in the repo rather than in a habit:

```bash
uv add --bounds major httpx
```

Treat `--bounds` as in preview — the CLI reference says it *"may change in any future release"* — so
do not build tooling that parses its output.

**★ Symptom: a library pins `==` and a consumer cannot upgrade a transitive dependency for a CVE.**
Cause: an exact pin in published metadata, which the version specifiers spec calls out — the
*"deployment of security fixes"* sentence quoted in [04](04-equality-and-exclusion.md). Fix: publish a
range and let the *consumer's* lockfile hold the exact version. If you need a lock for your own CI,
commit one; it is not part of your distribution ([17](17-what-a-lockfile-guarantees.md)).

**★ Symptom: a floor was raised to fix a resolution problem, and now users on an older platform
cannot install the library at all.** Cause: raising a dependency floor can implicitly raise the Python
floor, because newer releases of that dependency may declare a newer `requires-python`. Fix: check the
interaction explicitly — [16](16-requires-python-constrains-everything.md) — and if the floor really
does exclude a Python version you support, say so in `requires-python` rather than leaving users to
discover it as a resolution failure.

**★ Symptom: nobody can say why an upper bound exists, so nobody removes it.** Cause: a bound written
without a reason. This is the commonest form of dependency rot, and it compounds: three of these in one
`pyproject.toml` and your library becomes uninstallable with anything modern. Fix: a policy that costs
nothing — **every ceiling carries a comment naming the incompatibility and a tracking issue**, and a
ceiling with no comment is deleted at the next release.

**★ Symptom: `--resolution lowest` fails in a way that has nothing to do with your code.** Cause: it
pushes *transitive* dependencies to their floors too, and decade-old releases frequently have broken
metadata, no wheels for current Pythons, or build steps that no longer work. Fix: use
`--resolution lowest-direct` for routine CI and keep `lowest` for a deliberate audit before a major
release.

## Interview questions

**★ Should a library declare an upper bound on its dependencies?**
Only with evidence. pip's own words are *"upper bounds are generally discouraged because they can
complicate dependency management … Use them cautiously"*, and PyPA's advice is to bound what is
*known*. An upper bound is a claim about unreleased code, and because bounds intersect across the
whole graph, your speculation constrains every consumer of your library — that is how two libraries
become mutually uninstallable ([15](15-the-diamond-that-cannot-resolve.md)). Where a specific release
is known-broken, use `!=`, which self-retires when the fix ships. Where a whole major genuinely breaks
you, `<N` is correct, with a comment naming the incompatibility and an issue tracking its removal.

**★ Your library declares `flask>=2.0` and a user on Flask 2.0 reports a crash. What did CI miss, and
what do you change?**
CI resolved to the newest Flask, because resolvers prefer the latest matching candidate — the floor was
never installed. The change is a second CI job with `uv sync --resolution lowest-direct`, exactly as uv
recommends for published libraries. If that job is red and you do not intend to support Flask 2.0, the
honest fix is to raise the declared floor rather than leave a bound nobody tests.

**★ What is the difference between `--resolution lowest` and `--resolution lowest-direct`, and which
belongs in CI?**
`lowest` pushes *"the lowest possible version for all dependencies, both direct and indirect"*;
`lowest-direct` pins only your declared direct dependencies to their floors and takes the latest for
everything else. `lowest-direct` belongs in routine CI: it tests the claims *you* made, without
resurrecting transitive releases whose failures tell you nothing about your code. Reach for `lowest`
when auditing the whole declared surface, for example before a major release.

**★ Why does raising a lower bound speed up resolution, and what is the cost?**
Because the resolver must consider every candidate that satisfies the specifier, and for a source-only
release it may have to *download and build* the artifact just to read its dependencies. A higher floor
deletes that entire tail of the search space — pip's own phrasing is that it *"excludes older versions
that might trigger excessive backtracking."* The cost is reach: every user pinned below your new floor
must upgrade before they can adopt your release, so the floor is a compatibility decision, not a
performance knob, even when you raised it for performance.

**★ An application and a library both depend on `httpx`. Should their declarations differ?**
Yes, and in kind rather than degree. The library declares the widest range it has evidence for, because
its declaration is a constraint on everyone who installs it. The application declares whatever range is
convenient — often just a floor — and gets its reproducibility from a committed lockfile, not from the
specifier. Writing exact pins in an application's `pyproject.toml` is the classic mistake: it duplicates
what the lock already guarantees, and makes every routine upgrade a metadata edit plus a re-lock instead
of just a re-lock.

---

← [05 · Ordered comparisons](05-ordered-comparisons.md) · [Topic index](README.md) · Next → [07 · Compatible release and the missing caret](07-compatible-release-and-the-missing-caret.md)
