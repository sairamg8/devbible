---
title: "The same `requirements.in` can resolve differently under pip and `uv pip` and both answers are correct, and a source build that worked under pip can fail under uv because uv isolates the build — two deviations that change *what* gets installed"
sidebar_label: "06d · uv pip: resolver and builds"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *pip compatibility*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/compatibility/)), *Resolution*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/)) and *Locking an environment*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/compile/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**[06c](06c-uv-pip.md) covered the deviations that change *where* `uv pip` installs and *from which
index*. The other two change *what* it installs. uv's resolver is not pip's resolver with a faster
engine — it has different priorities, so when several version sets satisfy your constraints it may
choose a different one, and neither tool promises otherwise. And uv builds source distributions in
PEP 517 isolation by default, so a package that quietly relied on numpy or Cython already being in
your environment builds under pip and fails under uv. Neither is a bug. Both mean that "switch to
`uv pip`, it is a drop-in" is a dependency change, and deserves the review a dependency change gets.**

## Deviation 3 — the resolver is a different resolver

> *"Neither `pip` nor uv make any guarantees about the exact set of packages that will be installed"*
> … *"in some cases, `pip` and uv will yield different resolutions."*

> *"uv's resolver and pip's resolver have a different set of package priorities."*
> — both [pip compatibility](https://docs.astral.sh/uv/pip/compatibility/)

So "the same `requirements.txt` produced a different version" is expected behaviour, not a bug in
either tool. Neither promises otherwise. The practical consequence is that switching a project from pip
to `uv pip` is a change that can move versions — worth doing on a branch with the diff visible, not on
a Friday.

Pre-releases are handled by a documented, and stricter, default:

> *"By default (`if-necessary`), uv prefers stable versions over pre-releases, falling back to
> pre-releases only if every stable candidate that satisfies the active constraints is rejected during
> resolution."*
> — [pip compatibility](https://docs.astral.sh/uv/pip/compatibility/)

## Deviation 4 — build isolation is on, with an escape hatch

> *"uv uses PEP 517 build isolation by default"* … *"`uv pip install --no-build-isolation`."*
> — [pip compatibility](https://docs.astral.sh/uv/pip/compatibility/)

Build isolation means a source distribution is built in a fresh environment containing only its
declared build requirements — so a package that *assumes* numpy or Cython is already importable at
build time fails. That is the package's bug, and `--no-build-isolation` is the workaround: it lets the
build see your environment, which means you must install the build requirements yourself first.

```bash
uv pip install numpy Cython           # the build requirements the package forgot to declare
uv pip install --no-build-isolation the-broken-package
```

## Why two correct resolvers disagree

A set of requirements with ranges usually has *many* solutions — every combination of versions that
satisfies every constraint is valid. A resolver's job is to pick one, and the rule it uses to prefer one
valid answer over another is its priority order. uv states its order differs from pip's, and states
that neither tool guarantees the exact set. So a diff between pip's result and uv's result is not
evidence that either is wrong; it is evidence that your constraints left room, and that the room was
filled differently.

The practical consequence: if a particular version matters to you, **say so in the constraints** —
the only way to make two resolvers agree is to leave them nothing to disagree about. The review of a
switch looks like this:

```bash
pip-compile requirements.in -o /tmp/pip-resolved.txt          # what pip-tools chose (if that was your stack)
uv pip compile requirements.in -o /tmp/uv-resolved.txt              # same platform-specific mode as pip-tools
diff -u /tmp/pip-resolved.txt /tmp/uv-resolved.txt            # every changed line is a decision to make
```

A version that moved and matters goes back into `requirements.in` as a bound; a version that moved and
does not matter is accepted, on a branch, with the test suite as the judge.

## Build isolation, and why a build that worked under pip can fail under uv

A wheel installs by unpacking. A source distribution has to be *built* first, by the backend named in
its `[build-system]`, and the question isolation answers is: what can that build see? Isolated, it sees
a fresh environment containing only the package's declared build requirements. Not isolated, it sees
whatever happens to be installed where you are. Why the ecosystem moved to isolation — and the full
PEP 517 frontend/backend contract behind it — is in topic 01's
[frontend/backend split](../01-pyproject-toml/02-pep-517-the-frontend-backend-split.md); what matters
here is the operational consequence.

Isolation turns an undeclared build dependency from *invisible* into *fatal*. The package's metadata was
always wrong; your environment happened to paper over it. `--no-build-isolation` is the escape hatch,
and it carries an obligation that is easy to miss: with isolation off, **nothing** is provisioned for
the build — not the undeclared dependency, and not the declared backend either. Everything the build
imports must already be installed. ⚠️ Provenance: pip's documentation states that obligation for pip
in so many words (quoted in the topic 01 chunk linked above); uv's compatibility page names the flag
without restating it. The obligation follows from what isolation *is* rather than from a uv sentence,
so treat it as the mechanism, not as a quoted uv guarantee.

```bash
# the obligation, spelled out
uv pip install setuptools wheel            # what the package declares in [build-system]
uv pip install numpy Cython                # what it forgot to declare
uv pip install --no-build-isolation the-broken-package
```

The better fix, when you control the package, is to declare the build requirement so isolation works:

```toml
# the broken package's own pyproject.toml, fixed at the source
[build-system]
requires = ["setuptools>=77", "Cython>=3", "numpy>=2"]
build-backend = "setuptools.build_meta"
```

## What this page does not cover

How the pip interface's own verbs differ — `install` adds, `sync` converges, `compile` resolves for
one platform unless told otherwise — is [06e](06e-uv-pip-install-sync-and-compile.md).

## Gotchas

**★ Symptom: switching from pip to `uv pip` changed installed versions.**
Cause: documented and expected — *"uv's resolver and pip's resolver have a different set of package
priorities"*, and neither tool guarantees an exact set. Fix: do the switch on a branch and lock the
result so the change is reviewed once rather than discovered repeatedly.

```bash
uv pip compile --universal requirements.in -o requirements.txt
git diff requirements.txt
```

**★ Symptom: a source distribution fails to build with an import error for numpy or Cython.**
Cause: build isolation — *"uv uses PEP 517 build isolation by default"* — and the package assumes its
build dependencies are already importable. Fix: install them, then disable isolation for that one
install.

```bash
uv pip install numpy Cython
uv pip install --no-build-isolation the-broken-package
```

**★ Symptom: a pre-release you expected to be installed was not.**
Cause: uv's documented default is `if-necessary` — it *"prefers stable versions over pre-releases,
falling back to pre-releases only if every stable candidate that satisfies the active constraints is
rejected during resolution."* Fix: ask for it explicitly in the requirement, which also records the
intent.

```bash
uv pip install 'somepkg==2.0.0rc1'
```

**Symptom: `uv pip install --no-build-isolation` fails with a new error about a missing build backend.**
Cause: with isolation off, *nothing* is installed for the build — including the backend the package
declares in `[build-system]`. Fix: install the declared build requirements into the environment as
well as the undeclared ones.

```bash
uv pip install setuptools wheel numpy Cython
uv pip install --no-build-isolation the-broken-package
```

**Symptom: a C extension built with `--no-build-isolation` imports fine on one machine and crashes or refuses to import on another.**
Cause: without isolation the extension was compiled against whatever version of its build dependency
happened to be installed, and a different version is present where it runs. Fix: make the build
dependency's version part of what you install from, so the build and the runtime see the same one.

```text
# requirements.in
numpy==2.3.2            # pinned: the extension below is compiled against it
the-broken-package
```

```bash
uv pip compile --universal requirements.in -o requirements.txt
uv pip sync requirements.txt
uv pip install --no-build-isolation the-broken-package
```

**Symptom: a dependency set that resolved under pip fails to resolve under uv, or the other way round.**
Cause: different priorities explore the candidate space in a different order; where constraints are
tight, one resolver can land on a dead end the other avoided, and neither promises equivalence. Fix:
read the resolver's explanation and tighten the constraint it names, so there is less for either
resolver to search.

```bash
uv pip compile requirements.in -o requirements.txt     # read the conflict it reports
echo 'pydantic>=2.8' >> requirements.in               # constrain the package it names
uv pip compile requirements.in -o requirements.txt
```

## Interview questions

**★ What is build isolation, and when is `--no-build-isolation` the right call?**
Build isolation means a source distribution is built in a fresh environment containing only the build
requirements it declares in `[build-system]` — uv *"uses PEP 517 build isolation by default"*. It exists
so that a build cannot silently depend on whatever happens to be in your environment, which is what made
`setup.py` builds unreproducible. It fails for packages that assume a build dependency (classically
numpy or Cython) is importable without declaring it — and that is the package's bug. `--no-build-isolation`
is the right call when you have hit exactly that, and it comes with an obligation: you must install the
undeclared build requirements yourself first, because nothing else will. It is a workaround for someone
else's missing metadata, not a performance tweak.

**★ Someone proposes moving a large `requirements.txt` project to `uv pip` "with no risk because it is a drop-in". What do you say?**
That the commands are drop-in and the resolution is not guaranteed to be. uv is explicit: *"Neither
`pip` nor uv make any guarantees about the exact set of packages that will be installed"*, and *"in some
cases, `pip` and uv will yield different resolutions"*, because *"uv's resolver and pip's resolver have a
different set of package priorities."* So the move can change versions, and I would treat it as a
dependency change: do it on a branch, produce a compiled file with `uv pip compile --universal`, review
the diff, and run the test suite against it. I would also check the index configuration first, since uv
ignores `pip.conf` and `PIP_INDEX_URL`, because that is the failure that will otherwise dominate the
first hour.

**★ What does uv's default pre-release mode `if-necessary` actually do?**
It prefers stable releases and falls back to a pre-release only when there is no alternative:
*"uv prefers stable versions over pre-releases, falling back to pre-releases only if every stable
candidate that satisfies the active constraints is rejected during resolution."* So a pre-release is
never chosen merely because it is newer; it is chosen when your constraints leave no stable version
standing. The consequence people meet is the opposite of the one they fear — not an unexpected
pre-release, but an expected one that does not arrive. If you want a specific pre-release, the robust
move is to name it in the requirement itself (`somepkg==2.0.0rc1`), which both selects it and records
the intent where a reviewer will see it.

**★ pip and `uv pip` resolved the same `requirements.in` to different versions. Which one is wrong?**
Probably neither. A set of ranges usually admits many valid solutions, and a resolver's priority order
decides which one it returns; uv says plainly that *"uv's resolver and pip's resolver have a different
set of package priorities"* and that *"neither `pip` nor uv make any guarantees about the exact set of
packages that will be installed."* A difference is therefore a statement about your constraints — they
left room — not about either tool. The response is to decide, per changed line, whether the version
matters. If it does, tighten the requirement so both resolvers are forced to the same answer; if it
does not, accept the new resolution on a branch and let the test suite judge it. What you should not
do is conclude uv is buggy and pin everything exactly: that removes the room, and with it every future
upgrade.

**What obligation does `--no-build-isolation` carry that people forget?**
That it provisions nothing. With isolation on, the frontend creates a fresh environment and installs
the package's declared build requirements — including its backend — into it. With isolation off, the
build runs against your current environment as-is, so every build requirement, declared or not, must
already be installed there. People remember to install numpy or Cython, which prompted the flag, and
forget setuptools or whatever backend the package names, and then meet a second failure that looks
unrelated to the first. It also makes the build's result depend on the versions in your environment,
which is exactly the reproducibility property isolation was introduced to guarantee — so use it for the
one package that needs it, with its build dependencies pinned, and never as a default.

---

← Prev: [06c · uv pip vs pip](06c-uv-pip.md) · [Topic index](README.md) · Next → [06e · uv pip install, sync, compile](06e-uv-pip-install-sync-and-compile.md)
