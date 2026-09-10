---
title: "A hashed requirements file is only as good as the machine that generated it — hash every file for every platform from a universal resolution, keep your own project out of the hashed set, and install it with --no-deps so nothing slips around the check"
sidebar_label: "19b · Producing hashed files"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against pip's **Secure installs** topic
> ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/secure-installs/), pip docs v26.2.1), uv's **CLI
> reference** for `uv export` and `uv pip compile`
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/), **uv 0.12.12**), the **pip-tools**
> documentation ([pip-tools.readthedocs.io](https://pip-tools.readthedocs.io/en/stable/), 7.6.1) and
> **PEP 751** ([peps.python.org](https://peps.python.org/pep-0751/)). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run**.

**Hash-checking mode ([19](19-hashes-and-hash-checking-mode.md)) is strict about what the file contains;
everything that goes wrong in practice is about how the file was made. A hash list generated on one laptop
covers the wheels that laptop chose and nothing else. A file that includes the project itself cannot be
hashed at all, and the tempting fix — turn hashes off — throws the whole guarantee away. And a perfectly
hashed dependency set can still be bypassed by installing the project in a way that resolves its
dependencies again. The rule that avoids all three: generate hashes from a universal lock, in CI, without the
project line, and install the project last with `--no-deps`.**

## Producing a hashed file

```bash
uv export --locked --format requirements.txt -o requirements.txt      # hashes by default; --no-hashes omits them
uv pip compile requirements.in --generate-hashes -o requirements.txt  # "Include distribution hashes in the output file"
pip-compile --generate-hashes requirements.in                          # pip-tools
python -m pip hash dist/acme_core-1.4.0-py3-none-any.whl               # one file, for a hand-added line
```

PEP 751 makes hashes structural rather than optional: every recorded file's `hashes` table is *"Required?:
yes"* and *"MUST contain at least one entry"*, with *"at least one secure algorithm from
`hashlib.algorithms_guaranteed`"* recommended. Its comparison with requirements files is the whole case:
*"requirements files which can optionally include hashes, but it is an opt-in feature and can be bypassed."*

## Your own project, installed without undoing all of it

The project is a local directory, so it cannot be in the hashed file. Install the hashed closure first, then
the project with no dependency resolution at all — pip's own advice:

> *"Be careful not to nullify all your security work by installing your actual project by using setuptools'
> deprecated interfaces directly … These will happily go out and download, unchecked, anything you missed in
> your requirements file … To be safe, install your project using pip and --no-deps."*

```dockerfile
COPY requirements.txt .
RUN python -m pip install --require-hashes --only-binary :all: -r requirements.txt
COPY . .
RUN python -m pip install --no-deps .
```

with the requirements file exported *without* the project line:

```bash
uv export --locked --no-emit-project --format requirements.txt -o requirements.txt
```

## Gotchas

**★ Symptom: a hash-checked install fails on Linux with a missing hash for a package that installed fine on
the developer's Mac.** Cause: the file carries only the hash of the wheel that was downloaded where it was
generated; Linux selects a different wheel. pip: *"It fetches only the preferred archive for each package, so
you may still need to add hashes for alternatives archives"*. Fix: produce hashes for every file, from a
universal resolution:

```bash
uv pip compile requirements.in --universal --generate-hashes -o requirements.txt
```

**★ Symptom: the hashed install rejects `-e .` or a `git+https://…` line.** Cause: neither has a single file
to hash, and hash mode requires every requirement to be hashed and pinned. Fix: keep the project out of the
file and install it separately with `--no-deps`; for a VCS dependency, depend on a released artifact:

```bash
uv export --locked --no-emit-project --format requirements.txt -o requirements.txt
python -m pip install --require-hashes -r requirements.txt && python -m pip install --no-deps .
```

**Symptom: someone added `--no-hashes` to the export step "because pip complained".** Cause: the export
included the project's own path line, which cannot be hashed. Fix: remove the thing that cannot be hashed, not
the hashes:

```bash
- uv export --locked --no-hashes -o requirements.txt
+ uv export --locked --no-emit-project -o requirements.txt
```

**Symptom: every package is hash-checked and the build still pulls something unverified.** Cause: the project
was installed with a path that resolves its dependencies — `pip install .` without `--no-deps`, or a legacy
`setup.py install` that *"will happily go out and download, unchecked"*. Fix: `python -m pip install --no-deps .`
after the hashed install.

**Symptom: someone "fixes" a missing-hash error by pasting the hashes pip printed during a failed install, and
the next platform fails the same way.** Cause: running with `--require-hashes` against an unhashed file is a
bootstrap aid — pip *"shows the hashes of the packages it fetched"* — but *"It fetches only the preferred archive
for each package"*, so the pasted list covers one machine's wheels. Fix: generate, do not paste:

```bash
uv export --locked --no-emit-project --format requirements.txt -o requirements.txt
```

## Interview questions

**★ How do you hash-check a deployment that includes your own project, which is a local directory?**
Split the install. Export the locked dependencies *without* the project (`uv export --no-emit-project`),
install that file with `--require-hashes`, then install the project with `pip install --no-deps .`, so nothing
it declares is resolved or downloaded outside the hashed set. pip's docs recommend exactly this and warn that
setuptools' old interfaces *"will happily go out and download, unchecked, anything you missed"*. pip 26.2's
`--no-require-hashes` is an alternative, but it verifies only the lines that carry hashes, which is the partial
mode the same docs call *"of little use."*

**Why does one package sometimes need many hashes?**
Because a hash identifies a file, not a release, and a release is many files — one wheel per platform and
Python ABI, plus an sdist. pip: multiple hashes matter *"when a package offers binary distributions for a variety
of platforms or when it is important to allow both binary and source distributions."* A file generated on one
machine often carries only the hash of the wheel that machine chose, so a different platform picks a file with
no hash and the install fails. A universal export or `--universal --generate-hashes` records them all.

**Where should a hashed requirements file be generated, and by whom?**
By CI, from the lock, and never by hand. A developer machine hashes only the wheels it would install, and a
hand-edited file drifts from the lock on the first upgrade. The robust shape is `uv export --locked` (hashes by
default, *"Omit hashes in the generated output"* only if you ask) run in the same pipeline that builds the
image, followed by `git diff --exit-code` if the file is committed — so the hashed file is a deterministic
product of the reviewed lock rather than a second source of truth someone has to keep in sync.

---

← [19 · Hashes and hash-checking mode](19-hashes-and-hash-checking-mode.md) · [Topic index](README.md) · Next → [20 · The CI flags that refuse to re-resolve](20-the-ci-flags-that-refuse-to-re-resolve.md)
