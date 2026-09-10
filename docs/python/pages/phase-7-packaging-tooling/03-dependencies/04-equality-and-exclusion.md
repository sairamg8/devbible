---
title: "There are eight operators and a comma that means `and` — and the equality family is where the surprises live: `==1.1` rejects `1.1.post1`, `.*` turns it into a prefix match, and `===` is not a version comparison at all"
sidebar_label: "04 · Equality and exclusion"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/))
> and **PEP 440** ([peps.python.org](https://peps.python.org/pep-0440/)); operator table
> cross-checked against pip's dependency-resolution documentation
> ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/dependency-resolution/)). Target:
> **Python 3.14.7**. Documentation-verified, **no sandbox run** — every match/no-match line
> below is quoted from the specification's own worked examples.

**There are exactly eight version-comparison operators and a comma that means `and`. This page
takes the equality family — `==`, the trailing `.*`, `!=`, and `===` — because that is where
the behaviour diverges most sharply from the symbol. `==1.1` does not match `1.1.post1`. Adding
`.*` converts strict equality into a prefix match wide enough to swallow pre-releases. And
`===` is a raw string comparison that ignores every rule on this page, including zero padding.
The ordered comparisons `<`, `<=`, `>`, `>=` have their own carve-outs and get
[05](05-ordered-comparisons.md).**

## The eight, and the comma

> *"`~=`: Compatible release clause · `==`: Version matching clause · `!=`: Version exclusion
> clause · `<=`, `>=`: Inclusive ordered comparison clause · `<`, `>`: Exclusive ordered
> comparison clause · `===`: Arbitrary equality clause."*

> *"The comma (“,”) is equivalent to a logical and operator: a candidate version must match all
> given version clauses in order to match the specifier as a whole."*

> *"Whitespace between a conditional operator and the following version identifier is optional, as
> is the whitespace around the commas."*

So `>=2.4.2,<3.0.0` is one specifier with two clauses, both of which must hold. There is **no
`or`** — you cannot write "1.x or 3.x but not 2.x" as a disjunction, only as bounds plus an
exclusion. And when several candidates qualify:

> *"When multiple candidate versions match a version specifier, the preferred version SHOULD be the
> latest version as determined by the consistent ordering defined by the standard Version scheme."*

That "SHOULD be the latest" is a default, not a law — uv's `--resolution lowest` deliberately
inverts it, which matters for libraries and is worked in
[15](15-the-diamond-that-cannot-resolve.md).

## `==` — exact, and stricter than people expect

> *"By default, the version matching operator is based on a strict equality comparison: the
> specified version must be exactly the same as the requested version. The only substitution
> performed is the zero padding of the release segment to ensure the release segments are compared
> with the same length."*

The specification's own table, against the candidate `1.1`:

```text
== 1.1        # Equal, so 1.1 matches clause
== 1.1.0      # Zero padding expands 1.1 to 1.1.0, so it matches clause
== 1.1.dev1   # Not equal (dev-release), so 1.1 does not match clause
== 1.1a1      # Not equal (pre-release), so 1.1 does not match clause
== 1.1.post1  # Not equal (post-release), so 1.1 does not match clause
== 1.1.*      # Same prefix, so 1.1 matches clause
```

`==1.1` therefore rejects `1.1.post1`, `1.1a1` and `1.1.1`, and accepts `1.1.0` — the padding rule
is the only leniency in the whole clause. It is exactly what you want in a deployment lock and
exactly wrong in a published library:

🔴 The specification's own words:

> *"The use of `==` (without at least the wildcard suffix) when defining dependencies for
> published distributions is strongly discouraged as it greatly complicates the deployment of
> security fixes. The strict version comparison operator is intended primarily for use when
> defining dependencies for repeatable deployments of applications while using a shared
> distribution index."*

That single sentence is the specification's own version of the topic's central argument, unpacked
in [13](13-applications-lock-libraries-range.md). Note what it does *not* say: it does not forbid
`==`. It names the one context where it belongs — a repeatable deployment against a shared index.

The spec also warns tools to police inappropriate use:

> *"Whether or not strict version matching is appropriate depends on the specific use case for the
> version specifier. Automated tools SHOULD at least issue warnings and MAY reject them entirely
> when strict version matches are used inappropriately."*

## The trailing `.*` — prefix matching

> *"Prefix matching may be requested instead of strict comparison, by appending a trailing `.*` to
> the version identifier in the version matching clause. This means that additional trailing
> segments will be ignored when determining whether or not a version identifier matches the clause.
> If the specified version includes only a release segment, than trailing components (or the lack
> thereof) in the release segment are also ignored."*

Against the candidate `1.1.post1`:

```text
== 1.1        # Not equal, so 1.1.post1 does not match clause
== 1.1.post1  # Equal, so 1.1.post1 matches clause
== 1.1.*      # Same prefix, so 1.1.post1 matches clause
```

Against `1.1a1`, with the rider about the implied dot:

> *"For purposes of prefix matching, the pre-release segment is considered to have an implied
> preceding `.`, so given the version `1.1a1`, the following clauses would match or not as shown:"*

```text
== 1.1        # Not equal, so 1.1a1 does not match clause
== 1.1a1      # Equal, so 1.1a1 matches clause
== 1.1.*      # Same prefix, so 1.1a1 matches clause if pre-releases are requested
```

🔴 Read the tail of that last line: *"if pre-releases are requested"*. Prefix matching **widens**
the set to include pre-releases, but does not switch pre-release handling on — that is a separate
rule, in [08](08-pre-releases-are-excluded.md). The combination is why `==1.1.*` behaves
differently on a machine where `--pre` was passed.

An exact match counts as a prefix match:

> *"An exact match is also considered a prefix match (this interpretation is implied by the usual
> zero padding rules for the release segment of version identifiers)."*

And two shapes are forbidden:

> *"It is invalid to have a prefix match containing a development or local release such as
> `1.0.dev1.*` or `1.0+foo1.*`. If present, the development release segment is always the final
> segment in the public version, and the local version is ignored for comparison purposes, so using
> either in a prefix match wouldn't make any sense."*

Finally, note that `==1.1.*` and `~=1.1.0` describe the *same set*, which the spec states outright:
*"`== 3.1.*`: any version that starts with 3.1. Equivalent to the `~=3.1.0` compatible release
clause."* Pick whichever reads better to your team and use it consistently —
[07](07-compatible-release-and-the-missing-caret.md) has the full arithmetic.

## `!=` — the inverse, wildcards included

> *"The allowed version identifiers and comparison semantics are the same as those of the Version
> matching operator, except that the sense of any match is inverted."*

Against `1.1.post1`:

```text
!= 1.1        # Not equal, so 1.1.post1 matches clause
!= 1.1.post1  # Equal, so 1.1.post1 does not match clause
!= 1.1.*      # Same prefix, so 1.1.post1 does not match clause
```

`!=` is the right tool for a *known-bad* release, and it composes with a range through the comma.
The spec's own example: *"`~=3.1.0, != 3.1.3`: version 3.1.0 or later, but not version 3.1.3 and
not version 3.2.0 or later."*

Prefer an exclusion over lowering an upper bound, because it survives the fix: when `3.1.4` lands,
`!=3.1.3` already allows it, whereas `<3.1.3` needs another commit.

## `===` — the escape hatch that is not a version comparison

> *"Arbitrary equality comparisons are simple string equality operations which do not take into
> account any of the semantic information such as zero padding or local versions. This operator also
> does not support prefix matching as the `==` operator does."*

> *"The primary use case for arbitrary equality is to allow for specifying a version which cannot
> otherwise be represented by this PEP. This operator is special and acts as an escape hatch to allow
> someone using a tool which implements this PEP to still install a legacy version which is otherwise
> incompatible with this PEP."*

> *"An example would be `===foobar` which would match a version of `foobar`."*

> *"Use of this operator is heavily discouraged and tooling MAY display a warning when it is used."*

Its one genuinely modern use is refusing a downstream rebuild: *"`===1.0` … would not match for a
version `1.0+downstream1`"* — see [02](02-local-versions-and-the-plus-label.md). For everything
else, hashes are the correct instrument ([19](19-hashes-and-hash-checking-mode.md)): a hash pins the
artifact, whereas `===` pins the *label on* the artifact.

## Gotchas

**★ Symptom: `==2.1` in `pyproject.toml`, and CVE fixes never arrive.** Cause: strict equality
excludes every `2.1.x` and every post-release, so `2.1.4` carrying the fix does not satisfy it. Fix:
widen to a series or a range, and keep exactness in the lock:

```toml
- dependencies = ["cryptography==43.0"]
+ dependencies = ["cryptography==43.0.*"]     # or ">=43.0,<44"
```

**★ Symptom: `!=1.4.3` does not exclude `1.4.3.post1`.** Cause: `1.4.3.post1` is a *different
version*, and plain `!=1.4.3` only excludes the exact one. Fix: exclude the prefix, which the spec
confirms inverts prefix matching — *"`!= 1.1.*` # Same prefix, so `1.1.post1` does not match
clause"*:

```text
mypkg>=1.4,!=1.4.3.*
```

**★ Symptom: you need "1.x or 3.x, never 2.x" and there is no way to write it.** Cause: the comma is
`and`; there is no `or` in the grammar. Fix: bounds plus a wildcard exclusion —

```text
mypkg>=1.0,!=2.*,<4
```

**★ Symptom: `==1.1.*` behaves differently on a developer's machine than in CI.** Cause: prefix
matching *permits* pre-releases (*"matches clause if pre-releases are requested"*) but does not
enable them; someone's local config has `PIP_PRE=1` or `[tool.uv] prerelease = "allow"`. Fix: never
enable pre-releases globally — scope it to the one package, as
[08](08-pre-releases-are-excluded.md) shows:

```toml
[tool.uv]
prerelease = "disallow"
prerelease-package = { some-beta-lib = "allow" }
```

**★ Symptom: `===1.0` fails to match a package published as `1.0.0`.** Cause: arbitrary equality is
a string comparison and *"do[es] not take into account any of the semantic information such as zero
padding"*. `1.0` and `1.0.0` are the same version and different strings. Fix: use `==1.0` unless
byte-identical version *strings* are genuinely the requirement — and if artifact identity is what you
need, use hashes instead.

**★ Symptom: a specifier with spaces around the comma is rejected by an internal validator.** Cause:
the validator, not the specifier — whitespace *"is optional, as is the whitespace around the
commas"*, so `>= 2.8.1, == 2.8.*` is valid. Fix: parse with the library, never with `split(",")`:

```python
from packaging.specifiers import SpecifierSet
SpecifierSet(">= 2.8.1, == 2.8.*")     # valid; equality of clauses handled for you
```

**★ Symptom: legacy metadata contains `mypkg (>=1.0)` and a home-grown parser chokes on the
parentheses.** Cause: PEP 345 required brackets and the current spec still tolerates them —
*"The optional brackets around a version are present for compatibility with PEP 345 but should not be
generated, only accepted."* Fix: accept on read, never emit; strip them while migrating a legacy
`setup.py`.

**★ Symptom: an internal tool "supports `^`" and half the team writes carets.** Cause: `^` is Poetry's
`[tool.poetry.dependencies]` syntax, not one of the eight; a build backend reading standard metadata
rejects it. Fix: translate — a caret is `>=X.Y.Z,<X+1.0.0` — or let uv write it:
`uv add --bounds major httpx`, which the CLI reference describes as *"`major`: Allow the same major
version, similar to the semver caret, e.g., `>=1.2.3, <2.0.0`"*.

**★ Symptom: a pinned application dependency stops receiving a *yanked*-release replacement.** Cause:
`==` names one release, and if that release is later yanked your lock still points at it; nothing in
the specifier can move. Fix: this is a lockfile-refresh problem, not a specifier problem — schedule
`uv lock --upgrade-package <name>` ([20](20-the-ci-flags-that-refuse-to-re-resolve.md)) rather than
loosening the pin.

## Interview questions

**★ What exactly does `==1.1` match, and what does adding `.*` change?**
`==1.1` matches `1.1` and `1.1.0` — the only substitution is zero padding of the release segment —
and rejects `1.1.1`, `1.1a1`, `1.1.dev1` and `1.1.post1`. Adding `.*` makes it a prefix match, so
*"additional trailing segments will be ignored"*: `1.1.1`, `1.1.post1` and (if pre-releases are
enabled) `1.1a1` all match, while `1.2` does not. In one sentence: `==` is a release, `==X.Y.*` is a
release *series*.

**★ Why does the specification single out `==` as "strongly discouraged" for published
distributions?**
Because *"it greatly complicates the deployment of security fixes"*. A published library that pins
exactly forces every consumer's resolver into a single acceptable version, so a patched release
cannot be adopted without the library publishing again, and two libraries that pin different exact
versions of the same dependency become mutually uninstallable. The spec then names the legitimate
context: *"defining dependencies for repeatable deployments of applications while using a shared
distribution index"* — an application's lock, not a library's metadata.

**★ You need to block one bad release of a transitive dependency in a running application. `<` or
`!=`?**
`!=`, with a wildcard if the badness spans a series. `<2.0.26` blocks the bad release *and every
later one*, including its fix; `!=2.0.26` blocks precisely the bad release and accepts `2.0.27`
automatically. Because the package is transitive rather than declared, the right vehicle is a
**constraint file** — a constraint narrows a package only if something else already pulled it in —
which is [25](25-constraints-overrides-and-declared-conflicts.md).

**★ Why is `===` "heavily discouraged" when it is the most precise operator available?**
Because it is precise about the *string*, not the artifact. `===1.0` does not match `1.0.0`, so its
behaviour depends on how the publisher happened to type the version; it also drops zero padding and
prefix matching, which is surprising in every direction. Its stated purpose is narrow: installing a
legacy version *"which cannot otherwise be represented by this PEP"*, and refusing a local rebuild.
If you want artifact-level certainty, hash the file.

**★ A specifier says `>=1.0` and the resolver installs `3.4.1`. Bug?**
No. A lower bound is a floor, not a request, and *"the preferred version SHOULD be the latest
version"*. The interesting consequence is for testing: if `>=1.0` is all you declare, your test suite
only ever exercises the newest release, so the lower bound is an untested claim. uv's
`--resolution lowest-direct` exists to test it, which is the point made in
[15](15-the-diamond-that-cannot-resolve.md).

---

← [03 · Normalization](03-normalization-and-comparing-versions.md) · [Topic index](README.md) · Next → [05 · Ordered comparisons](05-ordered-comparisons.md)
