---
title: "A hash pins the file where a version pins only the name — pip's hash-checking mode is all-or-nothing, demands exact pins and every transitive dependency, and refuses the index's own hashes, and each of those rules exists to close a specific hole"
sidebar_label: "19 · Hashes and hash-checking"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against pip's **Secure installs** topic
> ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/secure-installs/), pip docs v26.2.1), pip's
> **Repeatable Installs** and **pip install** reference
> ([pip.pypa.io](https://pip.pypa.io/en/stable/cli/pip_install/)), uv's **CLI reference** for
> `uv export`, `uv pip compile` and `uv pip install`
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/), **uv 0.12.12**), the uv changelog for
> 0.12.0 ([github.com](https://github.com/astral-sh/uv/blob/main/CHANGELOG.md)) and **PEP 751**
> ([peps.python.org](https://peps.python.org/pep-0751/)). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run**.

**`httpx==0.27.2` names a release; it does not name a file. Between your lock and your deploy sit an index,
a CDN, a proxy cache, a certificate chain and possibly a private mirror that lets uploads be replaced, and
any of them can hand you different bytes under the same name. A hash names the bytes. pip's hash-checking
mode turns that into an install-time contract, and its rules look fussy until you see that each one closes
a way to smuggle an unverified file in: a single hash turns the mode on for everything, every transitive
dependency must be listed, every requirement must be exact, and the hash the index itself serves does not
count. The mechanics are simple; the gotchas are all in the edges — your own project, VCS dependencies,
platform-specific wheels and the difference between pip's defaults and uv's.**

This page is the mechanism. Generating a hashed file for every platform, and fitting your own project and its
unhashable neighbours into it, is [19b](19b-producing-hashed-files-and-your-own-project.md).

## What the hash buys, in pip's own escalation

Pinning alone:

> *"However, it trusts the locations you're fetching the packages from (like PyPI) and the certificate
> authority chain. It also relies on those locations not allowing packages to change without a version
> increase. (PyPI does protect against this.)"*

Adding hashes:

> *"This protects against a compromise of PyPI or the HTTPS certificate chain. It also guards against a
> package changing without its version number changing (on indexes that allow this). This approach is a
> good fit for automated server deployments."*

and the operational framing, which is the argument for doing it at all:

> *"Hash-checking mode is a labour-saving alternative to running a private index server containing approved
> packages: it removes the need to upload packages, maintain ACLs, and keep an audit trail (which a VCS gives
> you on the requirements file for free)."*

pip's secure-install recipe is two switches, and the second matters as much as the first:

> *"By default, pip does not perform any checks to protect against remote tampering and involves running
> arbitrary code from distributions."* → *"Enable Hash-checking Mode, by passing --require-hashes · Disallow
> source distributions, by passing --only-binary :all:"*

```bash
python -m pip install --require-hashes --only-binary :all: -r requirements.txt
```

## The format

Its own example, continuations and all:

```text
FooProject == 1.2 \
  --hash=sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 \
  --hash=sha256:486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7
```

Two hashes on one requirement is normal, not redundant:

> *"It is possible to use multiple hashes for each package. This is important when a package offers binary
> distributions for a variety of platforms or when it is important to allow both binary and source
> distributions."*

Each hash accepts one *file*; a package with twenty platform wheels needs twenty hashes if the list is to
install everywhere.

## The rules, and the hole each one closes

🔴 **All or nothing.** *"Note that hash-checking is an all-or-nothing proposition. Specifying `--hash`
against any requirement will activate this mode globally."* One hashed line makes every line mandatory.

**Every requirement hashed** — *"a partially-hashed requirements file is of little use and thus likely an
error: a malicious actor could slip bad code into the installation via one of the unhashed requirements."*

**Every dependency listed** — *"If there is a dependency that is not spelled out and hashed in the
requirements file, it will result in an error."* The file must be the full transitive closure, which is
exactly what a compiler or an export produces and what a hand-written file never is.

**Every requirement exact** — *"Requirements must be pinned (either to a URL, filesystem path or using
`==`). This prevents a surprising hash mismatch upon the release of a new version that matches the
requirement specifier."*

**Only local hashes count** — the index serves a hash in each download URL's fragment, but *"Since this hash
originates remotely, it is not a useful guard against tampering and thus does not satisfy the
`--require-hashes` demand that every package have a local hash."* A hash from the same server as the file
proves only that the download was not corrupted.

**Only strong algorithms** — *"The recommended hash algorithm at the moment is `sha256`, but stronger ones are
allowed, including all those supported by `hashlib`. However, weaker ones such as `md5`, `sha1`, and `sha224`
are excluded to avoid giving a false sense of security."* pip keeps one legacy exception — *"hashes embedded
in URL-style requirements via the #md5=... syntax suffice to satisfy this rule (regardless of hash strength,
for legacy reasons)"* — and uv closed its equivalent in 0.12.0: *"Reject MD5-only hashes in hash-checking
mode."*

**Forcing it** — `--require-hashes` turns the mode on even when the file carries no hashes, which is the point:
*"This can be useful in deploy scripts, to ensure that the author of the requirements file provided hashes."*
The pip reference adds that the option *"is implied when any package in a requirements file has a `--hash`
option."*

## The escape valve added in pip 26.2

All-or-nothing collides with two things a real project contains — local directories and VCS URLs, neither of
which has a stable file to hash. pip's documentation, marked *"Added in version 26.2"*:

> *"By default, when at least one requirement has hashes, hashes become required for all requirements. This
> behaviour notably prevents the combination of hashed requirements with local directories or VCS URLs. To
> help with such use cases, a `--no-require-hashes` flag is available to disable this mechanism. Hashes are
> then verified only for requirements where they are provided."*

⚠️ That is a deliberate weakening: you are back to *"a partially-hashed requirements file"*, which the same
page calls *"of little use"* for security. Prefer keeping your own project out of the hashed file entirely
([19b](19b-producing-hashed-files-and-your-own-project.md)); reach for `--no-require-hashes` only when an unhashable dependency is genuinely unavoidable.

## uv's defaults are not pip's

uv's pip interface verifies hashes that are present but does not, by default, *require* them:

> *"By default, uv will verify any available hashes in the requirements file, but will not require that all
> requirements have an associated hash. When --require-hashes is enabled, all requirements must include a hash
> or set of hashes, and all requirements must either be pinned to exact versions (e.g., ==1.0.0), or be
> specified via direct URL."*

and states its hash-mode restrictions plainly:

> *"Git dependencies are not supported. - Editable installations are not supported. - Local dependencies are
> not supported, unless they point to a specific wheel (.whl) or source archive (.zip, .tar.gz), as opposed to
> a directory."*

🔴 So the same partially-hashed file that pip rejects, uv installs — verifying only the lines that carry
hashes. If you deploy with `uv pip`, pass `--require-hashes` explicitly.

## Gotchas

**★ Symptom: adding one `--hash` to one line makes the whole install fail with complaints about unrelated
packages.** Cause: *"Specifying `--hash` against any requirement will activate this mode globally"*, and in
that mode *"Hashes are required for all requirements"* and *"for all dependencies."* Fix: never hash by hand;
regenerate the whole closure with hashes:

```bash
uv export --locked --format requirements.txt -o requirements.txt
```

**★ Symptom: a file that pip refuses as partially hashed installs cleanly with `uv pip install`.** Cause: uv
*"will verify any available hashes … but will not require that all requirements have an associated hash."*
Fix: make the requirement explicit in the deploy command:

```bash
uv pip install --require-hashes -r requirements.txt
```

**Symptom: a range like `httpx>=0.27` in a hashed file is rejected.** Cause: *"Requirements must be pinned
(either to a URL, filesystem path or using ==)"* — otherwise a new release would match the range and fail the
hash. Fix: hash files are generated output; pin by generating:

```bash
uv pip compile requirements.in --generate-hashes -o requirements.txt
```

**Symptom: an old requirements file with `--hash=md5:…` entries stops installing after a tooling upgrade.**
Cause: pip excludes *"md5, sha1, and sha224 … to avoid giving a false sense of security"*; uv 0.12.0 began to
*"Reject MD5-only hashes in hash-checking mode."* Fix: regenerate with sha256, the default of every generator
above.

**Symptom: a deploy fails with a hash mismatch for a version that has not changed.** Cause: working as
intended — the bytes behind that name changed, typically a private index that permits re-uploading a version,
or a proxy serving a different artifact. Fix: investigate before regenerating; regenerating blindly accepts the
new bytes, which is the one thing the mode exists to prevent:

```bash
python -m pip download --no-deps "acme-core==1.4.0" -d /tmp/check && python -m pip hash /tmp/check/*
```

## Interview questions

**★ Why is pip's hash-checking mode all-or-nothing?**
Because a partial check is not a check. The docs' reasoning is direct: *"a partially-hashed requirements file is
of little use and thus likely an error: a malicious actor could slip bad code into the installation via one of
the unhashed requirements."* An attacker does not need to tamper with the packages you hashed; any unhashed
dependency, including a transitive one you never wrote down, is a way in. So one hash turns the mode on for
everything, every dependency must be spelled out, and every requirement must be pinned so a new release cannot
match and trigger a mismatch.

**★ PyPI already puts a sha256 in every download URL. Why is that not enough for `--require-hashes`?**
Because it comes from the same place as the file. pip checks it as *"a protection against download corruption"*,
but *"Since this hash originates remotely, it is not a useful guard against tampering"*. If the server or the
channel is compromised, the attacker controls both the file and the hash advertised next to it. A hash in your
repository was recorded when you locked, reviewed in version control, and cannot be changed by the index — that
separation is the entire security property.

**What is the practical difference between pip's and uv's hash handling?**
The default. pip turns hash checking on for the whole file the moment any line has a hash. uv's pip interface
*"will verify any available hashes in the requirements file, but will not require that all requirements have an
associated hash"* unless you pass `--require-hashes`. Both reject weak algorithms, and uv's hash mode states its
limits outright — no Git dependencies, no editables, no local directories. The operational rule is to put
`--require-hashes` in the deploy command regardless of tool, so the guarantee does not depend on which installer
happens to run.

**Why pair `--require-hashes` with `--only-binary :all:`?**
Because they close different holes. Hashes prove you received the file you locked; they say nothing about what
happens next, and an sdist *builds* — pip notes that by default it *"involves running arbitrary code from
distributions."* A hashed sdist still runs its build backend on your deploy machine and produces a binary nobody
recorded ([17](17-what-a-lockfile-guarantees.md)). Refusing source distributions makes the install consist only
of verified, pre-built wheels, and turns a missing wheel into a visible failure.

---

← [18 · `uv.lock` vs `pip freeze` vs `pip-compile`](18-uv-lock-vs-pip-freeze-vs-pip-compile.md) · [Topic index](README.md) · Next → [19b · Producing hashed files](19b-producing-hashed-files-and-your-own-project.md)
