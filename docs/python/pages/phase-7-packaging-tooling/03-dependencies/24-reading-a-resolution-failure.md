---
title: "A resolution failure is a proof, not a complaint — read uv's \"Because … we can conclude\" chain from its last line back to the two constraints that cannot both hold, classify the failure by its shape, and only then decide which constraint to change"
sidebar_label: "24 · Reading a resolution failure"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Resolution** concepts and **Managing dependencies**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/), **uv 0.12.12**), uv's **Resolver
> internals** reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/internals/resolver/)) and pip's
> **Dependency resolution** topic ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/dependency-resolution/),
> pip docs v26.2.1). Target: **Python 3.14.7**. Documentation-verified, **no sandbox run** — every error
> text on this page is quoted from those documents, which use their own example packages.

**When a resolver gives up, it has not failed to find an answer; it has proved there is none, and the message
is the proof. uv builds it from the incompatibilities its solver tracked, as a chain of "because … we can
conclude" steps that ends at your project. pip names the two requirers and their clashing constraints. Both
point at a small number of shapes — a version that does not exist, two constraints with an empty
intersection, your own extras disagreeing, a Python range too wide, a platform with no wheel — and each
shape has a different correct fix. The mistake to avoid is fixing the *message* — pinning or overriding the
last package named — instead of the constraint the proof identifies.**

## What produces the message

uv's resolver reference:

> *"uv uses pubgrub-rs, the Rust implementation of PubGrub, an incremental version solver."*

> *"From the incompatibilities tracked in PubGrub, an error message is constructed to enumerate the involved
> packages."*

So the message is a derivation: every line combines two facts into a conclusion, and the final conclusion is that
your project's requirements cannot all hold.

## Reading uv's chain

The smallest example in uv's documentation, from `uv add "httpx>9999"`:

```text
  × No solution found when resolving dependencies:
  ╰─▶ Because only httpx<=1.0.0b0 is available and your project depends on httpx>9999,
      we can conclude that your project's requirements are unsatisfiable.
```

One step: a fact about the index (*"only httpx&lt;=1.0.0b0 is available"*) and a fact about you (*"your project
depends on httpx>9999"*). The "only … is available" clause is the most useful phrase uv prints: it states what
the resolver could *see*, which is often less than what is on PyPI.

A two-step chain, from uv's section on conflicting extras (the doubled *"projects's"* is upstream's):

```text
  x No solution found when resolving dependencies:
  `-> Because myproject[extra2] depends on numpy==2.0.0 and myproject[extra1] depends on numpy==2.1.2, we can conclude that myproject[extra1] and
      myproject[extra2] are incompatible.
      And because your project requires myproject[extra1] and myproject[extra2], we can conclude that your projects's requirements are unsatisfiable.
```

Read it from the bottom. The last line says *which of your requirements* are jointly impossible —
`myproject[extra1]` and `myproject[extra2]`. The line above says *why*: two concrete constraints on one package,
`numpy==2.0.0` and `numpy==2.1.2`, with an empty intersection. Longer chains have more "And because" steps, each
carrying the conclusion one level closer to your project; the root cause is always the pair of concrete version
constraints the chain starts from.

## Reading pip's message

pip reports the two requirers and the two constraints directly (hypothetical packages are pip's own):

```text
ERROR: Cannot install package_coffee==0.44.1 and package_tea==4.3.0 because these package versions have conflicting dependencies.
The conflict is caused by:
    package_coffee 0.44.1 depends on package_water<3.0.0,>=2.4.2
    package_tea 4.3.0 depends on package_water==2.3.1
```

Everything needed is under *"The conflict is caused by:"* — the shared package and each requirer's specifier. pip
calls this a `ResolutionImpossible` error. Its other terminal state is running out of search depth:

> *"Sometimes pip's dependency resolver may exceed its search depth and terminate with a `ResolutionTooDeepError`
> exception. This typically occurs when the dependency graph is extremely complex or when there are too many
> package versions to evaluate."*

and before either, a long run of backtracking announced by its own line — `INFO: pip is looking at multiple
versions of this package to determine which version is compatible with other requirements. This could take a
while.` — which the docs say *"is not unexpected behaviour or a bug."*

## The shapes, and where each is fixed

| Shape | How it reads | Fix, and where it lives |
|---|---|---|
| no acceptable version exists | *"only X&lt;=… is available and your project depends on X>…"* | the specifier, or what is hiding versions (below) |
| a diamond | two requirers, two specifiers, one package | loosen the stricter side — [15](15-the-diamond-that-cannot-resolve.md) |
| your own extras or groups | `myproject[a]` and `myproject[b]` are incompatible | declare the conflict — [25b](25b-declared-conflicts.md) |
| Python range too wide | a dependency has no version for the bottom of `requires-python` | raise the floor — [16](16-requires-python-constrains-everything.md) |
| a platform with no wheel | fails only in the universal lock | `environments` / `required-environments` — [12](12-markers-special-fields-and-portability.md) |
| search too deep | pip backtracks for minutes, or `ResolutionTooDeepError` | better lower bounds and constraints |

⚠️ I could not find the exact wording uv or pip print for the `requires-python` shape in their documentation, so
this page does not reproduce one; the mechanism is in [16](16-requires-python-constrains-everything.md).

## Things that hide versions without saying so

Three configurations shrink what the resolver can see, and each makes a real version look nonexistent:

- **A cooldown.** *"messages for unsatisfiable resolutions will not mention that distributions were excluded due
  to the --exclude-newer flag — newer distributions will be treated as if they do not exist."*
- **The index strategy.** uv's default *"limit[s] resolutions to those present on that first index"* — a name that
  exists on a private index is looked up nowhere else ([23b](23b-auditing-and-where-packages-come-from.md)).
- **Pre-releases.** Excluded unless requested or the only option; *"By default (`if-necessary`), uv prefers
  stable versions over pre-releases"* ([08](08-pre-releases-are-excluded.md)).

When the "only … is available" clause contradicts what you see on PyPI, check these three before touching a
specifier.

## Tools for the investigation

```bash
uv lock --dry-run                            # resolve and report changes, write nothing
uv tree --package numpy --invert             # every package that requires numpy, and with what
uv lock -v                                   # verbose resolver logging
python -m pip install tea "cup >= 3.13"      # pip: narrow the package it is backtracking on
```

The last is pip's own advice: *"It is usually a good idea to add constraints the package(s) that pip is
backtracking on"*, with the caveat that *"There is a possibility that the addition constraint is incorrect. When
this happens, the reduced search space makes it easier for pip to more quickly determine what caused the
conflict."*

## Gotchas

**★ Symptom: `No solution found` for a version you can see on PyPI.** Cause: something is hiding it — a cooldown
(*"newer distributions will be treated as if they do not exist"*), a first-index lookup on a private index, or a
pre-release rule. Fix: check the configuration before the specifier:

```bash
grep -n 'exclude-newer\|index' pyproject.toml
uv lock --dry-run --exclude-newer false --prerelease allow    # does it resolve with the filters off?
```

**★ Symptom: the error names `myproject[...]` twice.** Cause: two of your own extras (or groups) are
incompatible — uv resolves them all together. Fix: if they are never installed together, declare the conflict:

```toml
[tool.uv]
conflicts = [[{ extra = "extra1" }, { extra = "extra2" }]]
```

**★ Symptom: the chain is twenty lines long and mentions packages you have never heard of.** Cause: the conflict is
deep in the transitive graph; each "And because" hop is a dependency edge. Fix: read the *last* line for which of
your requirements are involved, the *first* line for the two concrete constraints, then find who introduces them:

```bash
uv tree --package package-water --invert
```

**★ Symptom: pip prints the "looking at multiple versions" line over and over and never finishes.** Cause:
backtracking through many releases of one package; *"If pip starts backtracking during dependency resolution, it
does not know how many choices it will reconsider"*. Fix: bound the package it is backtracking on:

```bash
python -m pip install tea "cup >= 3.13"
```

**Symptom: pip terminates with `ResolutionTooDeepError`.** Cause: *"the dependency graph is extremely complex or …
there are too many package versions to evaluate."* Fix, from pip's list — *"Specify Reasonable Lower Bounds"* and
*"Utilize Constraint Files"*:

```bash
python -m pip install -r requirements.in -c constraints.txt
```

**★ Symptom: resolution "succeeds" by choosing a years-old version of a dependency, which then fails to build.**
Cause: no lower bound, so the resolver backtracked to the bottom — uv: *"If there are no lower bounds, the
resolver can (and often will) backtrack down to the oldest version of a package … the old version of the package
often fails to build"*. Fix: declare the floor you actually support; uv already *"will warn if direct dependencies
don't have lower bounds"*:

```toml
dependencies = ["httpx>=0.27"]
```

**Symptom: `uv lock` fails while `pip install` of the same requirements succeeds on your machine.** Cause: uv's
lock is universal — *"A universal resolution is often more constrained than a platform-specific resolution"* — so
it must also satisfy platforms and Python versions you are not running. Fix: find which environment has no
solution; narrow the supported set if you do not support it:

```toml
[tool.uv]
environments = ["sys_platform == 'linux'", "sys_platform == 'darwin'"]
```

**Symptom: the "fix" was an override, and a month later production breaks on the platform nobody tests.** Cause:
the proof named a real incompatibility and the override replaced it — overrides apply *"unconditionally … it does
not matter if the marker evaluates to true or false."* Fix: change the constraint the proof identified —
loosen your own, or get upstream to loosen theirs — and keep overrides for metadata you have *evidence* is wrong
([25](25-constraints-overrides-and-declared-conflicts.md)).

## Interview questions

**★ Walk through reading a uv "No solution found" message.**
It is a proof built from PubGrub's incompatibilities, so read it as one. The last line names which of your
requirements are jointly unsatisfiable. The first line names the concrete facts the chain starts from — typically
two specifiers on one package, or "only these versions are available". Each "And because" in between is one
dependency edge carrying that conflict up to your project. The fix belongs to the first line's constraints; the
packages in the middle are just the route. `uv tree --invert --package` then shows who introduces each constraint.

**★ A resolution fails for a version you can see on PyPI. What could be hiding it?**
Three things, all silent. A cooldown: *"newer distributions will be treated as if they do not exist"* and the error
will not mention it. The index strategy: uv stops at the first index that has the name, so a private index that
carries an old copy hides newer public releases. And pre-release rules, which exclude `a`/`b`/`rc` versions unless
requested or unavoidable. The "only … is available" clause in uv's message tells you what the resolver saw;
when it disagrees with PyPI, the configuration is the suspect, not the specifier.

**★ pip has been backtracking for twenty minutes. What do you do?**
Interrupt it, find the package whose versions it keeps downloading, and bound it: *"It is usually a good idea to
add constraints the package(s) that pip is backtracking on"*, e.g. `pip install tea "cup >= 3.13"`. If the bound is
wrong, the smaller search space makes the real conflict surface faster, which is progress either way. Longer term,
higher lower bounds on your direct dependencies and a constraints file for troublesome transitive ones shrink the
search, and a lockfile moves the whole cost out of deployment — pip's own framing is that *"the "work" is done once
during development process."*

**Why do missing lower bounds make resolution failures worse?**
Because a range with no floor lets the resolver backtrack to ancient releases when newer ones conflict. uv's docs
describe the result: the resolver *"can (and often will) backtrack down to the oldest version of a package"*,
which is slow, often *"fails to build"*, or finds a version *"old enough that it doesn't depend on the conflicting
package, but also doesn't work with your code"* — a successful resolution that is wrong. A floor you test with
`--resolution lowest-direct` keeps the search in versions you know work.

**Why can `uv lock` fail where `pip install` succeeds?**
They solve different problems. `pip install` resolves for the machine it runs on. `uv lock` resolves universally,
for every platform and every Python version in `requires-python`, and *"A universal resolution is often more
constrained than a platform-specific resolution."* A dependency with no wheel for Windows, or no release supporting
the bottom of your Python range, fails the universal resolution while being irrelevant on your laptop. The fix is
either to support that environment properly or to say you do not, with `environments` or a higher
`requires-python`.

---

← [23b · Auditing and where packages come from](23b-auditing-and-where-packages-come-from.md) · [Topic index](README.md) · Next → [25 · Constraints, overrides, exclusions](25-constraints-overrides-and-declared-conflicts.md)
