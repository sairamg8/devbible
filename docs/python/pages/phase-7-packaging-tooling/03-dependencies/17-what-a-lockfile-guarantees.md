---
title: "A lockfile guarantees that no resolution happens at install time — it does not guarantee the artifacts are unchanged, that the versions are current, or that the environment matches the file, and each of those gaps has its own flag"
sidebar_label: "17 · What a lock guarantees"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **PEP 751**
> ([peps.python.org](https://peps.python.org/pep-0751/)), uv's **Locking and syncing**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/), **uv 0.12.12**), uv's
> **Project structure and files**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)) and pip's
> **Repeatable Installs**
> ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/repeatable-installs/)). Target:
> **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**A lockfile's one real guarantee is narrow and enormous: installing from it requires no resolver, so
the set of versions is a property of your repository rather than of the index at install time. Almost
everything else people believe a lock guarantees, it does not. It does not prove the *files* are the
ones you resolved — that is hashes. It does not become stale when upstream publishes — it never
expires. It does not prove the environment on this machine matches it. And a lock is not portable
between tools unless it is in the standardised format. Each of those four gaps is closed by a
different, specific mechanism, and knowing which is which is the difference between a reproducible
deployment and a superstition.**

This page takes the guarantee and the first gap — the files, and what "the same files" still fails to
promise. Time is [17b](17b-a-lock-never-expires.md); the environment and portability are
[17c](17c-the-lock-is-not-the-environment.md).

## The one guarantee

> *"This PEP proposes a new file format for specifying dependencies to enable reproducible installation
> in a Python environment. The format is designed to be human-readable and machine-generated. Installers
> consuming the file should be able to calculate what to install without the need for dependency
> resolution at install-time."*

> *"The file format is also designed to not require a resolver at install time. This greatly simplifies
> reasoning about what would be installed when consuming a lock file. It should also lead to faster
> installs which are much more frequent than creating a lock file."*

No resolution means no search, no backtracking, no candidate selection, and therefore no dependence on
what the index looks like today. That is the whole of it, and it is the property every other benefit
rests on. uv's version of the claim:

> *"Unlike the `pyproject.toml`, which is used to specify the broad requirements of your project, the
> lockfile contains the exact resolved versions that are installed in the project environment. This file
> should be checked into version control, allowing for consistent and reproducible installations across
> machines."*

> *"A lockfile ensures that developers working on the project are using a consistent set of package
> versions. Additionally, it ensures when deploying the project as an application that the exact set of
> used package versions is known."*

The motivation for standardising it at all was the absence of that record:

> *"Currently, no standard exists to create an immutable record, such as a lock file, which specifies what
> direct and indirect dependencies should be installed into a virtual environment."*

## Gap 1 — a version is not an artifact

A lock naming `httpx==0.27.2` says which *version* to install. Whether the file you receive is the file
that was there when you locked is a separate question, and the answer is hashes. pip's own escalation:

> *"This page walks through increasingly stricter definitions of what “repeatable” means."*

Pinning alone:

> *"This strategy is easy to implement and works across OSes and architectures. However, it trusts the
> locations you're fetching the packages from (like PyPI) and the certificate authority chain. It also
> relies on those locations not allowing packages to change without a version increase. (PyPI does protect
> against this.)"*

Hashes:

> *"This protects against a compromise of PyPI or the HTTPS certificate chain. It also guards against a
> package changing without its version number changing (on indexes that allow this). This approach is a
> good fit for automated server deployments."*

PEP 751 makes the security default part of the format's design goal — *"The file format should promote
good security defaults"* — and requires a strong algorithm: *"At least one secure algorithm from
`hashlib.algorithms_guaranteed` SHOULD always be included (at time of writing, `sha256` specifically is
recommended."* The mechanics are [19](19-hashes-and-hash-checking-mode.md).

⚠️ Whether `uv.lock` itself stores hashes for every distribution is not something uv's documentation
states as a schema guarantee; it says the file *"is a human-readable TOML file but is managed by uv and
should not be edited manually."* What *is* documented is that its exports carry hashes by default, since
`uv export` offers `--no-hashes` to *"Omit hashes in the generated output"*. Do not claim more than that.

## Reproducible is not the same as safe

Hashes plus a lock make an install *faithful*: the bytes you get are the bytes you resolved. That is the
entire promise. If the version you resolved was itself malicious — uploaded through a compromised
maintainer account an hour before your `uv lock --upgrade` ran — the hashes reproduce it perfectly on every
machine, indefinitely. PEP 751 describes what its hashes are for, and the scope is exact: they *"help with
auditing and validating the files that were locked against"*. Nothing in the format judges whether those
files deserved to be locked.

Two mechanisms address that, and both act at *resolution* time rather than install time. A cooldown refuses
to resolve anything uploaded in the last N days, which uv describes as *"a good way to improve security
posture by delaying package updates until the community has had the opportunity to vet new versions of
packages"*. An audit checks the locked set against a vulnerability database. Both are
[23](23-keeping-a-lock-current.md).

## A locked sdist is still built on the install machine

A lock entry can name a source distribution rather than a wheel when no wheel exists for the target.
PEP 751's installation procedure is explicit about what follows — *"Validate the file size and hash. Build
the package. Install."* The hash covers the *source archive*. The wheel the build produces is made on the
install machine, by that package's build backend, with whatever compiler and system libraries are present
there, and the lock records nothing about the result.

Nor are the build's own requirements pinned by the standard format. PEP 751 tried and withdrew it:

> *"An earlier version of this PEP tried to lock the build requirements for sdists under a
> `packages.build-requires` key. Unfortunately, it confused enough people about how it was expected to
> operate and there were enough edge case issues to decide it wasn't worth trying to do in this PEP upfront.
> Instead, a future PEP could propose a solution."*

So "same lock" does not imply "same binary" for any package installed from source. The defensible position
for a deployment is to refuse builds, so that a missing wheel is a CI failure rather than a surprise compile
in production:

```bash
uv sync --locked --no-build        # uv: "Don't build source distributions."
python -m pip install --require-hashes --only-binary :all: -r requirements.txt
```

uv's `--no-build` makes *"operations that require building a source distribution … exit with an error"*
while exempting your own code — *"First-party packages, such as projects in the workspace, will still be
built."* pip's `--only-binary` carries the matching warning: *"Packages without binary distributions will
fail to install when this option is used on them."*

## The honest summary

| Belief about a lockfile | True? |
|---|---|
| Installing from it performs no resolution | **yes** — the format's stated design goal |
| Everyone gets the same *versions* | **yes**, if the tool is told to use it strictly |
| Everyone gets the same *files* | only with hashes |
| It warns you when a dependency has an advisory | **no** — it never expires |
| It proves the current environment matches | **no** — that is `uv sync --check` |
| It can be read by another tool | only via `pylock.toml` or an export |
| It is part of what your consumers install | **no** — it is not distribution metadata |

Row four is [17b](17b-a-lock-never-expires.md); rows five and six are
[17c](17c-the-lock-is-not-the-environment.md).

## Gotchas

**★ Symptom: a locked project installed a different file than CI did, with the same version number.**
Cause: no hashes. Pinning *"trusts the locations you're fetching the packages from (like PyPI) and the
certificate authority chain"*, whereas hashes *"guard against a package changing without its version number
changing."* Fix: export with hashes and install in hash-checking mode:

```bash
uv export --locked --format requirements.txt -o requirements.txt
python -m pip install --require-hashes -r requirements.txt
```

**★ Symptom: a supply-chain incident — a malicious release of a popular package — reaches production even
though every install was hash-verified.** Cause: the malicious version was *resolved* into the lock during a
routine upgrade; from then on the hashes faithfully reproduced it. Hashes validate *"the files that were
locked against"*, not their contents. Fix: stop resolving brand-new uploads in the first place, with a
cooldown recorded in the project:

```toml
[tool.uv]
exclude-newer = "1 week"     # ignore anything uploaded in the last seven days
```

**★ Symptom: the same lock produces a working container on CI's runner and a crashing one built on a
different base image.** Cause: one locked package has no wheel for that platform, so it was built from its
sdist on each machine — the lock pinned the source archive's hash, not the binary the build produced, and
PEP 751 deliberately does not lock build requirements. Fix: forbid builds in deployment so the gap is a loud
failure, then either choose a platform the package ships wheels for or build that wheel once and host it:

```bash
uv sync --locked --no-build
```

**Symptom: a reviewer asks for proof the lock is "complete" and nobody can say what that means.** Cause: the
guarantee is misremembered as "everything about the install is fixed". It is not: the versions are fixed; the
files are fixed only with hashes; the binaries are fixed only for wheels; the interpreter is fixed only if
something else pins it. Fix: write the policy down as the commands that enforce each part:

```bash
uv sync --locked --no-build                              # versions asserted, no source builds
uv export --locked --format pylock.toml -o pylock.toml   # hashes carried to other installers
uv python pin 3.14                                       # the interpreter, which the package lock does not fix
```

## Interview questions

**★ What is the one thing a lockfile actually guarantees?**
That installation requires no resolver: PEP 751's design goal is that *"Installers consuming the file should
be able to calculate what to install without the need for dependency resolution at install-time."* Everything
else follows from that or is a separate mechanism. No resolution means no candidate search and no dependence
on the index's current contents, so the version set becomes a property of your repository. It does *not*
follow that the files are unchanged, that the versions are current, or that this machine matches the file.

**★ A team says "we have a lockfile, so our builds are reproducible". What would you check?**
Four things, in order. Is any command *asserting* the lock — `uv sync --locked` rather than `uv sync`?
Do the artifacts get verified, i.e. are hashes in play, or does the build merely trust the index? Is there a
scheduled refresh, given that a lock *"needs to be explicitly updated"* and never expires? And does the
deployment path actually install from the lock, rather than from a hand-maintained `requirements.txt` that
happens to sit beside it? A lockfile that nothing asserts is a suggestion.

**★ Your lock has hashes for every file. Are you protected against a malicious release?**
No — only against the file *changing after you locked it*. Hashes prove the bytes match the ones resolved;
PEP 751 frames them as validating *"the files that were locked against"*. If the malicious version was the one
resolved, the lock and its hashes reproduce it perfectly. Protection against bad releases lives at resolution
time: a cooldown (`exclude-newer = "1 week"`) so brand-new uploads are not eligible, an audit of the locked set
against an advisory database, and review of the lock diff in the upgrade PR. Hashes are the integrity layer
beneath those, not a replacement for them.

**What does a lock that resolves to an sdist still leave to chance?**
The build. The lock records the source archive and its hash; PEP 751's install steps then say *"Build the
package. Install."* on the installing machine, so the resulting wheel depends on that machine's compiler,
system libraries and whatever build-backend version its isolated build environment resolved — and the standard
format deliberately does not lock build requirements, having withdrawn a `packages.build-requires` key as too
confusing. For a deployment you remove the chance rather than manage it: `uv sync --no-build` or pip's
`--only-binary :all:` turns a silent compile into a failure you can see.

---

← [16 · `requires-python`](16-requires-python-constrains-everything.md) · [Topic index](README.md) · Next → [17b · A lock never expires](17b-a-lock-never-expires.md)
