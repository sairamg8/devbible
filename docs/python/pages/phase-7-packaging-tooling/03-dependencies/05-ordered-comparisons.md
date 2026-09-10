---
title: "`<` and `>` are not `<` and `>` on the version ordering — they deliberately carve out the pre-releases, post-releases and local builds of the version you named, and that is exactly what a bound should do"
sidebar_label: "05 · Ordered comparisons"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/))
> and **PEP 440** ([peps.python.org](https://peps.python.org/pep-0440/)). Target:
> **Python 3.14.7**. Documentation-verified, **no sandbox run** — every match/no-match row is
> derived from a quoted rule, not from a run.

**Four operators are left: `<=`, `>=`, `<`, `>`. The inclusive pair is uneventful. The exclusive
pair is where an afternoon goes, because `<` and `>` are *not* "less than / greater than in the
version ordering" — the specification makes them exclude the pre-releases, post-releases and local
builds of the version you named. `>1.7` refuses `1.7.0.post1`. `<2.0` refuses `2.0rc1`. Both
refusals are what you actually wanted from a bound; neither is what the symbol suggests.**

## `<=` and `>=` — inclusive, padded, boring

> *"An inclusive ordered comparison clause includes a comparison operator and a version identifier,
> and will match any version where the comparison is correct based on the relative position of the
> candidate version and the specified version given the consistent ordering defined by the standard
> Version scheme."*

> *"The inclusive ordered comparison operators are `<=` and `>=`."*

> *"As with version matching, the release segment is zero padded as necessary to ensure the release
> segments are compared with the same length."*

> *"Local version identifiers are NOT permitted in this version specifier."*

So `>=2.4` matches `2.4`, `2.4.0` (padding), `2.4.1`, `2.5`, `3.0` — and, per
[02](02-local-versions-and-the-plus-label.md), also `2.4+acme1`, because a *candidate's* local label
is stripped before comparison even though a *specifier* may not carry one. Nothing else surprising
lives here, which is why `>=` is the correct default lower bound for a library.

The pre-release rule still applies on top: `>=1.1` does not admit `1.1a1` by default, because
pre-releases are excluded from *all* specifiers unless requested —
[08](08-pre-releases-are-excluded.md).

## 🔴 `<` and `>` — exclusive, and they exclude more than the endpoint

> *"The exclusive ordered comparisons `>` and `<` are similar to the inclusive ordered comparisons in
> that they rely on the relative position of the candidate version and the specified version given
> the consistent ordering defined by the standard Version scheme. However, they specifically exclude
> pre-releases, post-releases, and local versions of the specified version."*

Three consequences, each stated separately by the spec:

> *"The exclusive ordered comparison `>V` MUST NOT allow a post-release of the given version unless
> `V` itself is a post release. You may mandate that releases are later than a particular post
> release, including additional post releases, by using `>V.postN`. For example, `>1.7` will allow
> `1.7.1` but not `1.7.0.post1` and `>1.7.post2` will allow `1.7.1` and `1.7.0.post3` but not
> `1.7.0`."*

> *"The exclusive ordered comparison `>V` MUST NOT match a local version of the specified version."*

> *"The exclusive ordered comparison `<V` MUST NOT allow a pre-release of the specified version
> unless the specified version is itself a pre-release. Allowing pre-releases that are earlier than,
> but not equal to a specific pre-release may be accomplished by using `<V.rc1` or similar."*

Read them as intent rather than arithmetic:

- `>1.7` means *"after the 1.7 release"* — and a post-release of `1.7` is a re-publication of that
  same release, so it is not "after".
- `<2.0` means *"before the 2.0 line starts"* — and `2.0rc1` is part of the 2.0 line, so excluding
  the major you rejected must also exclude its release candidate.

Both are almost always what a bound wants. The failure mode is the reverse: someone writes `>1.7`
meaning "anything above 1.7 in the sort order", then files a bug when a corrected re-upload is
skipped.

## The full table, side by side

Every row is the consequence of a rule quoted on this page or in
[04](04-equality-and-exclusion.md); nothing here was produced by running a resolver.

| Specifier | Matches | Notably does **not** match |
|---|---|---|
| `==1.1` | `1.1`, `1.1.0` | `1.1.post1`, `1.1a1`, `1.1.dev1`, `1.1.1` |
| `==1.1.*` | `1.1`, `1.1.1`, `1.1.post1`, `1.1a1`¹ | `1.2`, `1.0.9` |
| `!=1.1.*` | `1.0`, `1.2` | `1.1`, `1.1.1`, `1.1.post1` |
| `>=1.1` | `1.1`, `1.1.0`, `1.1.post1`, `1.2` | `1.1a1`¹, `1.0` |
| `<=1.1` | `1.0`, `1.1`, `1.1.0` | `1.1.post1`, `1.2` |
| `>1.7` | `1.7.1`, `1.8` | `1.7`, `1.7.0.post1`, `1.7+local` |
| `>1.7.post2` | `1.7.1`, `1.7.0.post3` | `1.7.0`, `1.7.0.post2` |
| `<2.0` | `1.9`, `1.9.9` | `2.0`, `2.0rc1`, `2.0.dev1` |
| `<2.0rc1` | `1.9`, `2.0.dev1` | `2.0rc1`, `2.0` |
| `~=1.4.5` | `1.4.5`, `1.4.9` | `1.5.0`, `1.4.4` |
| `~=1.4` | `1.4`, `1.9`, `1.99` | `2.0`, `1.3` |
| `===1.0` | the literal string `1.0` | `1.0.0`, `1.0+downstream1` |

¹ subject to pre-release handling — [08](08-pre-releases-are-excluded.md).

## Checking a specifier instead of arguing about it

When two people read a bound differently, settle it with the reference implementation rather than
with the table:

```python
from packaging.specifiers import SpecifierSet
from packaging.version import Version

bound = SpecifierSet(">1.7")
for candidate in ("1.7", "1.7.0.post1", "1.7.1", "1.8", "2.0rc1"):
    print(candidate, candidate in bound)

# and with pre-releases explicitly allowed, which changes two of those answers
lenient = SpecifierSet(">1.7", prereleases=True)
print("2.0rc1", "2.0rc1" in lenient)
```

`SpecifierSet.__contains__` applies zero padding, the exclusive-comparison carve-outs and the
pre-release rule together — which is precisely the combination people get wrong by hand. The
`prereleases=True` keyword is the API-level equivalent of `pip --pre` / `uv --prerelease allow`.

## Gotchas

**★ Symptom: `>1.7` refuses to install `1.7.0.post1`, which is obviously newer.** Cause: exclusive
comparisons *"specifically exclude pre-releases, post-releases, and local versions of the specified
version"*. Fix: name the boundary you actually mean:

```text
# "after 1.7, including its re-uploads"
mypkg>1.7.post0
# or, usually clearer
mypkg>=1.7.1
```

**★ Symptom: an upper bound of `<2.0` lets `2.0rc1` through.** Cause: it should not — `<V`
*"MUST NOT allow a pre-release of the specified version unless the specified version is itself a
pre-release"*. If it happened, pre-releases were enabled globally (`pip --pre`, `PIP_PRE=1`,
`[tool.uv] prerelease = "allow"`), which overrides the default. Fix: scope the opt-in to one package
rather than the whole resolution:

```toml
[tool.uv]
prerelease = "disallow"
prerelease-package = { some-beta-lib = "allow" }
```

**★ Symptom: `>=2.4` "matched a version with a patch we did not ship".** Cause: candidate local
labels are stripped before comparison, so `2.4+acme1` satisfies `>=2.4`. Fix: see
[02](02-local-versions-and-the-plus-label.md) — assert on `Version(...).local` in a startup check, or
hash-pin the artifacts ([19](19-hashes-and-hash-checking-mode.md)).

**★ Symptom: `<=1.1` excludes `1.1.post1` and the team reads that as a bug.** Cause: `<=` includes
`1.1` itself, but a post-release sorts *after* `1.1`, so it is genuinely outside the range. Fix: if
re-uploads must be allowed, do not stretch the bound — say "the 1.1 series":

```text
- mypkg<=1.1
+ mypkg==1.1.*
```

**★ Symptom: `>0.0.0` is used as "any version" and a package with only pre-releases has no
candidate.** Cause: exclusive comparison plus the default pre-release exclusion. A project that has
only ever published `0.1.0b1` matches nothing. Fix: declare no bound at all (a bare name), or opt
that one package into pre-releases explicitly — both are honest, `>0.0.0` is not.

**★ Symptom: a bound written as `> = 1.7` is rejected by a hand-rolled validator.** Cause: the
validator. Whitespace between the operator and the version is allowed, but the operator itself is a
single token — `>=` cannot be split. `>= 1.7` is valid, `> = 1.7` is not. Fix: parse with
`SpecifierSet`, which gives you a precise `InvalidSpecifier` instead of a silent mismatch.

**★ Symptom: `<3` on a dependency blocks the release that fixes the bug you filed.** Cause: an upper
bound excludes everything above it, fix included. Fix: exclude the broken releases instead of
capping the future — the reasoning and the trade-off are in
[06](06-floors-and-ceilings.md).

**★ Symptom: two specifiers that "cannot both be true" are accepted without complaint.** Cause:
`>=2,<1` is a perfectly valid *specifier*; it simply matches nothing, and the failure surfaces later
as an unsatisfiable resolution rather than as a syntax error. Fix: sanity-check merged bounds in
whatever generates them:

```python
from packaging.specifiers import SpecifierSet
from packaging.version import Version

merged = SpecifierSet(">=2,<1")
assert any(Version(v) in merged for v in ("1.0", "2.0", "3.0")), "bound matches nothing"
```

## Interview questions

**★ Explain why `>1.7` does not match `1.7.0.post1`, and when it bites.**
Because exclusive ordered comparisons deliberately exclude post-releases of the named version:
*"The exclusive ordered comparison `>V` MUST NOT allow a post-release of the given version unless `V`
itself is a post release."* The rationale is that `>1.7` reads as "strictly after the 1.7 release",
and a post-release *is* that release, re-published. It bites when a project uses post-releases for
corrected uploads: a `>1.7` bound skips the corrected artifact and installs `1.7.1`, which may be an
unrelated change. Say what you mean with `>1.7.post0` or `>=1.7.1`.

**★ Why does `<2.0` exclude `2.0rc1` when `2.0rc1` sorts below `2.0`?**
Because a bound is about a *line*, not a point. The spec: `<V` *"MUST NOT allow a pre-release of the
specified version unless the specified version is itself a pre-release."* If you have declared 2.0
incompatible, receiving its release candidate is strictly worse than receiving 2.0 — the same
incompatibility with less testing behind it. If you genuinely want pre-2.0 pre-releases, the spec
tells you how: *"may be accomplished by using `<V.rc1` or similar"*.

**★ `>=1.7` and `>1.7.post0` — same set?**
No. `>=1.7` includes `1.7` itself and every post-release of it; `>1.7.post0` excludes `1.7` and
`1.7.post0` but includes `1.7.post1` upwards and `1.7.1`. They differ on exactly the releases people
argue about. The practical takeaway is that `>=` is the operator you want almost always: it has no
carve-outs, so its meaning does not depend on how the publisher uses post-releases.

**★ A dependency's bound is `<=1.1` and the maintainer re-uploads as `1.1.post1` to fix a broken
wheel. What happens to your build?**
Nothing changes — `1.1.post1` sorts after `1.1` and therefore falls outside `<=1.1`, so you keep the
broken artifact. This is the strongest argument for expressing "this series" as `==1.1.*` rather than
as an inequality: series membership survives re-uploads, an upper bound does not.

**★ Why does `packaging` expose `prereleases=True` on `SpecifierSet` rather than baking the answer
into the specifier?**
Because pre-release handling is a *resolution policy*, not a property of the specifier — the spec puts
it in its own section and says pre-releases are excluded *"unless they are already present on the
system, explicitly requested by the user, or if the only available version that satisfies the version
specifier is a pre-release."* The same specifier legitimately matches different sets on two machines
depending on what the user asked for, which is why the flag lives on the containment check.

---

← [04 · Equality and exclusion](04-equality-and-exclusion.md) · [Topic index](README.md) · Next → [06 · Floors and ceilings](06-floors-and-ceilings.md)
