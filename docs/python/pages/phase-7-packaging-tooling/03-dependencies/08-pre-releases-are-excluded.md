---
title: "Pre-releases are invisible to every specifier until they are the only thing that satisfies it — a default so quiet that the first time you meet it, a beta has already installed itself"
sidebar_label: "08 · Pre-releases"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/)),
> **PEP 440** ([peps.python.org](https://peps.python.org/pep-0440/)), uv's **Resolution**
> concepts ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/), **uv 0.12.12**)
> and pip's **requirements file format**
> ([pip.pypa.io](https://pip.pypa.io/en/stable/reference/requirements-file-format/)). Target:
> **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**Pre-release handling is a separate layer sitting on top of every operator on the previous four
pages, and it has one rule with three exceptions. The rule: pre-releases are excluded from *all*
specifiers. The exceptions: unless one is already installed, unless the user asked, or unless a
pre-release is the *only* thing that satisfies the specifier. That third exception is the one that
surprises people — a specifier you wrote to be conservative can install a beta, silently, because
no final release matches it. And the standard opt-in mechanisms are all-or-nothing by default,
which turns "I need one beta" into "the whole resolution now prefers betas".**

## The rule, quoted whole

> *"Pre-releases of any kind, including developmental releases, are implicitly excluded from all
> version specifiers, unless they are already present on the system, explicitly requested by the user,
> or if the only available version that satisfies the version specifier is a pre-release."*

Broken into its parts:

> *"By default, dependency resolution tools SHOULD: accept already installed pre-releases for all
> version specifiers · accept remotely available pre-releases for version specifiers where there is no
> final or post release that satisfies the version specifier · exclude all other pre-releases from
> consideration"*

> *"Dependency resolution tools MAY issue a warning if a pre-release is needed to satisfy a version
> specifier."*

And the alternatives a tool must offer:

> *"Dependency resolution tools SHOULD also allow users to request the following alternative
> behaviours: accepting pre-releases for all version specifiers · excluding pre-releases for all
> version specifiers (reporting an error or warning if a pre-release is already installed locally, or
> if a pre-release is the only way to satisfy a particular specifier)"*

> *"Dependency resolution tools MAY also allow the above behaviour to be controlled on a
> per-distribution basis."*

The final sentence of the section is the one people forget in the other direction:

> *"Post-releases and final releases receive no special treatment in version specifiers - they are
> always included unless explicitly excluded."*

So `.postN` is **not** a pre-release. `>=1.1` takes `1.1.post1` happily; only `a`, `b`, `rc` (and
their spellings) and `.devN` are affected by this whole section.

## What "the only available version" means in practice

Three situations produce it, and none of them look like "I asked for a beta":

1. **A brand-new project.** `httpx-plugin>=0` on a package whose only release is `0.1.0b1`. There is
   no final release at all, so the beta is the only candidate and it installs.
2. **A floor above the newest final release.** You wrote `mypkg>=2.0` the day `2.0rc1` was published
   and `1.9.3` was still the latest final. `1.9.3` fails the floor; `2.0rc1` is the only candidate.
3. **A narrow window.** `mypkg>=2.0,<2.1` where the only artifact in that window is `2.0.0rc2`.

In all three, the resolution succeeds and installs a pre-release. This is by design and it is the
right design — the alternative is a resolution failure with a confusing message — but it means
"we never install pre-releases" is a claim your specifiers do not enforce.

## Turning it on, and why "globally" is the wrong answer

uv's default, stated precisely:

> *"By default (`if-necessary`), uv prefers stable versions over pre-releases, falling back to
> pre-releases only if every stable candidate that satisfies the active constraints is rejected during
> resolution."*

The switches:

> *"Use `--prerelease allow` to consider pre-releases for every package without preferring stable
> candidates first, or `--prerelease disallow` to exclude them entirely."*

> *"Use `--prerelease-package foo=allow` to override the global pre-release strategy for a specific
> package."*

> *"The `explicit` mode considers pre-releases only for first-party requirements that contain a
> pre-release identifier (preferring stable versions and falling back to pre-releases only if
> necessary), while disallowing pre-releases for all other packages."*

The configuration form, from uv's own documentation:

```toml
[tool.uv]
prerelease = "disallow"
prerelease-package = { foo = "allow", bar = "if-necessary" }
```

🔴 That pairing — a `disallow` default with a per-package `allow` — is the setting you want in almost
every project. `--prerelease allow` applied globally changes the resolver's preference for *every*
package in the graph, including hundreds you have never heard of, and it does so without preferring
stable candidates first.

pip's equivalent is `--pre`, which is global and has no per-package form. It is also accepted inside
a requirements file, which is how it becomes permanent by accident: pip's requirements-file format
lists `--pre` among the *"Global options"* whose effect is on *"the entire pip install run"*.

```text
# requirements-dev.txt — this line changes the resolution of EVERY requirement in the file
--pre
some-beta-lib==3.0.0b4
```

If you need a pre-release under pip, name the pre-release version exactly instead of enabling `--pre`
— an exact pin on a pre-release is itself an explicit user request:

```text
# no --pre needed: naming the version is the request
some-beta-lib==3.0.0b4
```

## The interaction with `.*` and with `~=`

Prefix matching *permits* pre-releases without enabling them. From the specification's own table,
against candidate `1.1a1`:

```text
== 1.1.*      # Same prefix, so 1.1a1 matches clause if pre-releases are requested
```

That trailing clause is the whole subtlety: `==1.1.*` widens the set to *include* `1.1a1`, and the
pre-release rule then decides whether `1.1a1` is *considered*. Two machines with the same specifier
and different pre-release settings resolve differently — which is exactly the class of bug a
lockfile eliminates ([17](17-what-a-lockfile-guarantees.md)).

`~=` behaves the same way, with the extra wrinkle from
[07](07-compatible-release-and-the-missing-caret.md): naming a pre-release in a `~=` clause moves the
floor but not the prefix, so `~=1.4.5a4` expands to `>= 1.4.5a4, == 1.4.*` — a specifier whose floor
is a pre-release and whose ceiling is the next minor.

## Already-installed pre-releases are accepted

> *"accept already installed pre-releases for all version specifiers"*

This is the quietest of the three exceptions. Once a beta is in the environment, every subsequent
install accepts it, because the resolver treats the installed version as a candidate. A developer who
tried a beta in March is still running it in September, and CI — which builds a fresh environment —
is not. The two disagree, and nothing in either configuration says so.

uv makes the preference explicit for locked projects:

> *"If resolution output file exists, i.e., a uv lockfile (`uv.lock`) or a requirements output file
> (`requirements.txt`), uv will prefer the dependency versions listed there. Similarly, if installing a
> package into a virtual environment, uv will prefer the already installed version if present."*

Which is the same mechanism, now visible: preference for what is already there.

## Gotchas

**★ Symptom: a beta installed itself and nobody passed `--pre`.** Cause: a pre-release was *"the only
available version that satisfies the version specifier"*. Usually a floor written the week a release
candidate appeared. Fix: verify what resolved, then either lower the floor to the newest final release
or state the intent:

```bash
uv tree                          # shows the resolved version of every package
uv lock --check                  # confirms the lockfile matches the declaration
```

```toml
[tool.uv]
prerelease = "disallow"          # now the same situation is an error, not a silent beta
```

**★ Symptom: CI installs a stable version and a developer's machine keeps a beta.** Cause:
*"accept already installed pre-releases for all version specifiers"* — the developer's environment has
the beta and the resolver prefers it. Fix: recreate rather than upgrade, and let the lockfile decide:

```bash
rm -rf .venv && uv sync --locked     # exact sync from the lockfile, no preference for what was there
```

**★ Symptom: `--pre` was added to `requirements-dev.txt` to get one beta and now every package resolves
to pre-releases.** Cause: `--pre` is a *global* option in a requirements file, affecting *"the entire
pip install run"*. Fix: delete it and name the version instead — naming a pre-release version is itself
an explicit request:

```text
- --pre
- some-beta-lib
+ some-beta-lib==3.0.0b4
```

**★ Symptom: `uv add` refuses to add a package whose only release is a beta.** Cause: the default
`if-necessary` strategy will *use* a pre-release when nothing else satisfies the specifier, but adding
without a specifier resolves against stable candidates first. Fix: request it per-package rather than
flipping the global default:

```bash
uv add "some-beta-lib==3.0.0b4"
```

```toml
[tool.uv]
prerelease-package = { some-beta-lib = "allow" }
```

**★ Symptom: a `.dev` version from an internal index behaves like a pre-release and nobody expected
that.** Cause: it is one — *"Pre-releases of any kind, including developmental releases"*. A nightly
internal build published as `1.3.0.dev42` is excluded by default exactly like a beta. Fix: opt that one
package in, or publish nightlies under a version scheme you *want* selected. Do not enable pre-releases
globally to reach an internal build.

**★ Symptom: `1.1.post1` was skipped and the team blamed pre-release handling.** Cause: it is not a
pre-release — *"Post-releases and final releases receive no special treatment in version specifiers -
they are always included unless explicitly excluded."* The skip came from the operator: `==1.1` and
`>1.1` both exclude it ([04](04-equality-and-exclusion.md),
[05](05-ordered-comparisons.md)). Fix: look at the operator, not at the pre-release settings.

**★ Symptom: `--prerelease allow` fixed one dependency and destabilised five others.** Cause: `allow`
*"consider[s] pre-releases for every package without preferring stable candidates first"* — it does not
merely permit them, it stops preferring stable. Fix: `if-necessary` for the graph, `allow` for the one
package:

```toml
[tool.uv]
prerelease = "if-necessary"
prerelease-package = { the-one-package = "allow" }
```

**★ Symptom: a lockfile contains a pre-release that no current specifier would select.** Cause: it was
locked while a pre-release was the only candidate, and *"uv will not consider lockfiles outdated when
new versions of packages are released"* — so the final release that has since shipped does not displace
it. Fix: upgrade that package deliberately:

```bash
uv lock --upgrade-package some-beta-lib
```

**★ Symptom: a resolution that used to succeed now fails after setting `prerelease = "disallow"`.**
Cause: that is the documented behaviour of the strict mode — the spec says a tool should offer
*"excluding pre-releases for all version specifiers (reporting an error or warning if a pre-release is
already installed locally, or if a pre-release is the only way to satisfy a particular specifier)"*. The
failure is information: some specifier in your graph can only be satisfied by a pre-release. Fix: find
it and fix the specifier, rather than restoring the permissive default.

## Interview questions

**★ A team insists they never install pre-releases and a beta is in production. How?**
Because the specifier language does not enforce that policy. Pre-releases are excluded *"unless they
are already present on the system, explicitly requested by the user, or if the only available version
that satisfies the version specifier is a pre-release."* The third exception needs no flag: a floor
above the newest final release, or a package that has never had a final release, leaves a pre-release
as the only candidate and it installs quietly. Enforcing the policy takes an explicit
`prerelease = "disallow"` (or the equivalent), plus a lockfile so the decision is reviewed in a diff
rather than made at install time.

**★ Why is `--pre` the wrong way to get one beta, and what do you do instead?**
Because it is global. Under pip it applies to *"the entire pip install run"* and, placed in a
requirements file, permanently; under uv, `--prerelease allow` stops preferring stable candidates for
every package in the graph. The proportionate fix is to name the pre-release version exactly — which is
itself the "explicitly requested by the user" exception — or to use a per-package setting:
`prerelease-package = { foo = "allow" }`. Scope the exception to the package that needs it.

**★ Is `1.2.0.post1` a pre-release?**
No. Only `a`, `b`, `rc` (with their alternative spellings) and `.devN` are pre-releases; the spec is
explicit that *"Post-releases and final releases receive no special treatment in version specifiers -
they are always included unless explicitly excluded."* If a post-release is being skipped, the cause is
the operator — `==X.Y` and `>X.Y` both exclude post-releases of `X.Y` — not pre-release handling.

**★ Explain uv's four pre-release modes and when each is right.**
`if-necessary` (the default) *"prefers stable versions over pre-releases, falling back to pre-releases
only if every stable candidate that satisfies the active constraints is rejected"* — correct for almost
everything. `disallow` excludes them entirely and turns the silent-beta case into an error — correct for
a production application that wants the policy enforced. `allow` considers them everywhere *"without
preferring stable candidates first"* — correct only when you are deliberately testing against the
bleeding edge of the whole graph. `explicit` considers pre-releases *"only for first-party requirements
that contain a pre-release identifier"* — correct when your own declarations name betas and you want that
to be the only source of them.

**★ Why does `==1.1.*` match `1.1a1` "if pre-releases are requested" rather than always or never?**
Because the two rules are independent layers. Prefix matching is about *set membership*: `1.1a1` shares
the `1.1` prefix, so the specifier's set includes it. Pre-release handling is about *candidate
selection*: whether a pre-release in the set may be chosen. Keeping them separate is what lets one
specifier behave conservatively by default and permissively on request, without rewriting the specifier —
and it is also why the same `pyproject.toml` can resolve differently on two machines, which is the
argument for committing a lockfile.

---

← [07 · `~=` and the missing caret](07-compatible-release-and-the-missing-caret.md) · [Topic index](README.md) · Next → [09 · The requirement string](09-the-requirement-string.md)
