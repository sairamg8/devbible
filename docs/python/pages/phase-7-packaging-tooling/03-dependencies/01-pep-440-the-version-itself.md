---
title: "A Python version is not a string and not semver — it is an ordered five-segment identifier with an epoch, and the zero-padding rule decides every comparison you will argue about"
sidebar_label: "01 · The version itself"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/))
> and **PEP 440** ([peps.python.org](https://peps.python.org/pep-0440/)). Target:
> **Python 3.14.7**. Documentation-verified, **no sandbox run** — every ordering below is
> quoted from the specification's own worked examples, not executed.

**Every dependency argument you will ever have starts with a misunderstanding of what a
version *is*. It is not a string, so lexicographic intuition about `1.10` and `1.9` does not
apply. It is not semver, so nothing in the format promises that a major bump is the only
breaking one. It is an ordered identifier of up to five segments — epoch, release,
pre-release, post-release, development release — and the comparison rules pad the release
segment with zeros before comparing. Once you can read `1!2.0.0rc1.post2.dev3` and say where
it sorts, the operators in [04](04-equality-and-exclusion.md) stop being folklore.**

## The canonical form

> *"The canonical public version identifiers MUST comply with the following scheme:
> `[N!]N(.N)*[{a|b|rc}N][.postN][.devN]`"*
> — [Version specifiers](https://packaging.python.org/en/latest/specifications/version-specifiers/)

Read left to right, that is five segments, four of them optional:

| Segment | Syntax | Example | Purpose |
|---|---|---|---|
| Epoch | `N!` | `1!` | Reset sort order after a numbering-scheme change |
| Release | `N(.N)*` | `3.14.7` | The version people mean when they say "version" |
| Pre-release | `{a\|b\|rc}N` | `rc1` | Alpha, beta, release candidate |
| Post-release | `.postN` | `.post2` | A re-release that changed no code |
| Development | `.devN` | `.dev3` | A snapshot ahead of the release it names |

> *"Public version identifiers are separated into up to five segments: Epoch segment: `N!` ·
> Release segment: `N(.N)*` · Pre-release segment: `{a|b|rc}N` · Post-release segment:
> `.postN` · Development release segment: `.devN`"*

Two rules do almost all the work:

> *"All numeric components MUST be interpreted and ordered according to their numeric value,
> not as text strings."*

> *"Comparison and ordering of release segments considers the numeric value of each component
> of the release segment in turn. When comparing release segments with different numbers of
> components, the shorter segment is padded out with additional zeros as necessary."*

So `0.9.11` sorts above `0.9.2` — numerically, not lexicographically — and:

> *"`X.Y` and `X.Y.0` are not considered distinct release numbers, as the release segment
> comparison rules implicit expand the two component form to `X.Y.0` when comparing it to any
> release segment that includes three components."*

That last sentence is why `==2.2` also matches `2.2.0`, and why `~=2.2` and `~=2.2.0` mean
different things — arithmetic worked in
[07](07-compatible-release-and-the-missing-caret.md).

The specification is explicit that the release segment's *length* is a style choice, not a
semantic one:

> *"While any number of additional components after the first are permitted under this scheme,
> the most common variants are to use two components (“major.minor”) or three components
> (“major.minor.micro”)."*

and date-based release segments are legal — *"Date based release segments are also permitted"* —
with `2012.4`, `2012.7`, `2013.1` as the spec's own example.

## What the format does not promise

Nothing in PEP 440 says a major bump is where breakage lives. There is no caret operator
because there is no such guarantee to lean on. The scheme defines *ordering* and *identity*;
compatibility policy is entirely the publisher's, communicated in prose in a changelog. The
only structural promise in the whole document is:

> *"Final releases within a project MUST be numbered in a consistently increasing fashion,
> otherwise automated tools will not be able to upgrade them correctly."*

That is the whole contract. Everything a specifier can express is built on ordering, which is
why *every* upper bound in the ecosystem is a guess about the future rather than a derivation
from the format.

## Where the suffixes sort — the part everybody gets backwards

The intuitive order is wrong in exactly one place: **`.dev` sorts before the pre-releases of
the same version**, and a post-release of a pre-release is a legal thing that exists.

> *"Developmental releases are ordered by their numerical component, immediately before the
> corresponding release (and before any pre-releases with the same release segment), and
> following any previous release (including any post-releases)."*

> *"Post-releases are ordered by their numerical component, immediately following the
> corresponding release, and ahead of any subsequent release."*

> *"Pre-releases for a given release are ordered first by phase (alpha, beta, release
> candidate) and then by the numerical component within that phase."*

Composed, one release series sorts like this — every step justified by a sentence above:

```text
1.0                # previous final release
1.0.post1          # post-release of it: after 1.0, before anything 1.1
1.1.dev0           # dev release: before every 1.1 pre-release
1.1.dev1
1.1a1              # alpha
1.1a2
1.1b1              # beta
1.1rc1             # release candidate
1.1rc1.post1       # post-release of an rc — permitted, "strongly discouraged"
1.1                # the final release
1.1.post1
1.1.1
1.2
```

The specification permits the odd shapes and then tells you not to use them:

> *"Creating post-releases of pre-releases is strongly discouraged, as it makes the version
> identifier difficult to parse for human readers."*

> *"The use of post-releases to publish maintenance releases containing actual bug fixes is
> strongly discouraged. In general, it is better to use a longer release number and increment
> the final component for each maintenance release."*

Practical reading: `.postN` means *"same code, fixed the metadata or re-uploaded the
artifact"*. If a security advisory names a post-release, treat it as a real change and read
the changelog — the version number is telling you the opposite of the truth.

## The epoch — the escape hatch for a scheme change

An epoch exists for exactly one situation: you changed how you number releases, and the normal
sort would now regress.

> *"If no explicit epoch is given, the implicit epoch is `0`."*

> *"Most version identifiers will not include an epoch, as an explicit epoch is only needed if a
> project changes the way it handles version numbering in a way that means the normal version
> ordering rules will give the wrong answer."*

The specification's own example — a project moving from date versions to semver — sorts wrong:

```text
1.0
1.1
2.0
2013.10
2014.04
```

and right, once the new scheme lives in epoch 1:

```text
2013.10
2014.04
1!1.0
1!1.1
1!2.0
```

Because *"all versions from a later epoch are sorted after versions from an earlier epoch"*,
`1!1.0` beats `2014.04`. This is rare and it is loud: an epoch in a version string is a
declaration that the project's numbering restarted.

## Gotchas

**★ `1.0` and `1.0.0` are the same version, so you cannot ship both.** Zero padding makes them
equal, and *"Public version identifiers MUST be unique within a given distribution."* A release
script that emits `f"{major}.{minor}"` for some builds and `f"{major}.{minor}.{patch}"` for
others will eventually collide with itself on the index. Normalize once, in one place:

```python
# release.py — one function, used by the tag check, the build and the changelog
from packaging.version import Version

def release_tag(major: int, minor: int, patch: int) -> str:
    """Always three components, so 1.0 can never be published beside 1.0.0."""
    return str(Version(f"{major}.{minor}.{patch}"))
```

**★ An epoch in a dependency's version means your `<` upper bound stopped working.** `<2` does
not exclude `1!1.0`: epoch ordering dominates, so every version in epoch 1 sorts above every
version in epoch 0. A project that adopts an epoch has, by design, escaped every upper bound its
consumers wrote. Rare; the only defence is reading release notes, plus a lockfile
([17](17-what-a-lockfile-guarantees.md)) so the jump cannot happen without a commit.

**★ A version's *shape* tells you nothing about the size of the change.** `2.0.0` may be a typo
fix and `1.4.18` may rewrite the query planner. PEP 440 requires only that final releases
increase consistently; it never defines what a component *means*. Read the changelog and, for a
library you depend on heavily, test against both the lower bound and the latest — uv's
`--resolution lowest-direct` exists exactly for that and appears in
[15](15-the-diamond-that-cannot-resolve.md).

**★ Post-releases sneak past an exact pin in one direction only.** `==1.1` does not match
`1.1.post1`, but `==1.1.*` does — *"`== 1.1` # Not equal, so `1.1.post1` does not match
clause"*, and *"`== 1.1.*` # Same prefix, so `1.1.post1` matches clause"*. A team that pins
exactly never receives a post-release re-upload, which is usually what they wanted and
occasionally the reason a fixed wheel never arrives.

**★ Sorting release tags in a shell script gives you the wrong "latest".** `sort -V` is close to
PEP 440 but does not implement it — it has no concept of `.dev` sorting *below* `a1`, no epoch,
and no local-label rules. Anything that picks a latest version should parse with `packaging`, as
[03](03-normalization-and-comparing-versions.md) shows.

**★ `1.1rc1.post1` exists, will parse, and will surprise your release automation.** A
post-release of a pre-release is legal and sorts between `1.1rc1` and `1.1`. If your publish
pipeline branches on "is this a pre-release?" by string-matching `rc`, that build takes the
pre-release branch; if it branches on "does it contain `.post`?", it takes the final-release
branch. Decide with `Version(v).is_prerelease` instead of substring tests.

## Interview questions

**★ Where does `1.1.dev1` sort relative to `1.1a1` and `1.0.post3`, and why does that order make
sense?**
`1.0.post3 < 1.1.dev1 < 1.1a1 < 1.1`. Dev releases sort *"immediately before the corresponding
release (and before any pre-releases with the same release segment), and following any previous
release (including any post-releases)."* It reads as a timeline: a `.dev` build is work towards
`1.1` that has not reached alpha, so it must land after everything belonging to `1.0` —
including `1.0`'s re-uploads — and before every `1.1` pre-release.

**★ Why is a post-release a bad way to ship a bug fix?**
Two reasons, one from the spec and one operational. The spec says outright that *"The use of
post-releases to publish maintenance releases containing actual bug fixes is strongly
discouraged."* Operationally, a post-release does not change the release segment, so consumers
whose specifier already matched `1.1` also match `1.1.post1` — while consumers who pinned
exactly `==1.1` do **not**, because `== 1.1` excludes post-releases. The result is a fix that is
mandatory for careless consumers and invisible to careful ones. Increment the release segment
instead.

**★ What is an epoch and when would you legitimately need one?**
A leading `N!` that overrides normal ordering, because *"all versions from a later epoch are
sorted after versions from an earlier epoch."* The legitimate need is a numbering-scheme change
that would otherwise regress: the spec's own case is a project moving from `2014.04`-style dates
to `1.0` semver, where the new release sorts *below* the old ones and no consumer would ever
upgrade. Bumping to `1!1.0` fixes the order. Reaching for an epoch for any other reason usually
means you are trying to un-publish a version, which an epoch does not do.

**★ Why does Python have no caret operator when npm and Cargo do?**
Because the caret encodes a *promise* — "breaking changes only ever bump the major" — and PEP
440 never made that promise. It standardises identity and ordering, and explicitly leaves the
meaning of each component to the publisher. The closest operator, `~=`, is purely mechanical: a
lower bound plus a prefix match whose width is however many segments you wrote. Treating `~=` as
a caret is the single most common version-specifier mistake and is worked through in
[07](07-compatible-release-and-the-missing-caret.md).

**★ You inherit a project whose versions are `2024.1`, `2024.2`, `2025.1`. Is that legal, and
what does it cost you?**
Legal — *"Date based release segments are also permitted"* — and it costs you every
compatibility-shaped specifier. `~=2024.1` expands to *"`>=2024.1, ==2024.*`"*, so it expires at
the new year rather than at a breaking change, and consumers cannot express "any 2024-series fix
but not the next feature drop", because the components carry no such meaning. Date versioning is
a fine choice for an application nothing depends on, and a poor one for a library.

**★ Two teams disagree about whether `2.0` is "newer" than `2.0.0.post1`. Settle it.**
`2.0 < 2.0.0.post1`. Zero padding makes `2.0` and `2.0.0` the same release, and a post-release
sorts *"immediately following the corresponding release"*. So the post-release wins. The useful
follow-up is *why anyone is asking*: usually because a deployment picked up a re-upload and
nobody could tell whether that was an upgrade. It was.

---

← [Topic index](README.md) · Next → [02 · Local versions and the `+` label](02-local-versions-and-the-plus-label.md)
