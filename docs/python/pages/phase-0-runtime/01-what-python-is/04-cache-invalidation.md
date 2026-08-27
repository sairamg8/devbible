---
title: "Cache invalidation: mtime-and-size by default, hashes if you ask, and the day the timestamp lies to you"
sidebar_label: "4 · Cache invalidation"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14 Language Reference
> [5.4.6 Cached bytecode invalidation](https://docs.python.org/3.14/reference/import.html#cached-bytecode-invalidation),
> [PEP 552 – Deterministic pycs](https://peps.python.org/pep-0552/),
> [`compileall`](https://docs.python.org/3.14/library/compileall.html),
> and [1. Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`--check-hash-based-pycs`).
> Version spine: **Python 3.14.7**.

**Every cached `.pyc` carries a claim about the source it was built from, and
Python checks that claim before trusting it. By default the claim is "the
source had this modification time and this size" — a heuristic that is right
almost always and catastrophic the one time it is wrong, because the symptom is
code that does not run and gives no indication why. Since 3.7 you can instead
have the claim be a hash of the source contents, which is both correct under a
lying clock and reproducible byte-for-byte. Knowing which mode you are in, and
how to switch, is the difference between a five-minute fix and an afternoon.**

## The default: timestamp and size

> *"Before Python loads cached bytecode from a `.pyc` file, it checks whether
> the cache is up-to-date with the source `.py` file. By default, Python does
> this by storing the source's last-modified timestamp and size in the cache
> file when writing it. At runtime, the import system then validates the cache
> file by checking the stored metadata in the cache file against the source's
> metadata."*

Timestamp **and** size — both, which is worth noticing, because it rules out
the naive failure of "I edited the file within the same second". What it does
*not* rule out is a source file whose mtime went **backwards** while its
contents changed and its length stayed the same. That is not exotic:

- `rsync -a` and `cp -p` and `tar -x` all preserve original timestamps by
  default.
- Restoring a directory from a backup restores its timestamps.
- A CI runner whose clock is ahead writes a `.pyc` with a future timestamp;
  the next checkout on a correct clock produces source that looks *older* than
  the cache.
- Docker layer caching plus a `COPY` of files whose mtimes came from an archive.

In every one of those, the cache header can describe a file that is no longer
on disk, and Python has no way to know.

## The alternative: hash the source

**PEP 552** added hash-based pycs, and its motivation was reproducibility
rather than correctness:

> *"The presence of a source timestamp means that a pyc is not a deterministic
> function of the input file's contents—it also depends on volatile metadata,
> the mtime of the source. Thus, pycs are a barrier to proper
> reproducibility."*

The correctness benefit came along for free. There are two flavours:

> *"For checked hash-based `.pyc` files, Python validates the cache file by
> hashing the source file and comparing the resulting hash with the hash in the
> cache file. If a checked hash-based cache file is found to be invalid, Python
> regenerates it and writes a new checked hash-based cache file. For unchecked
> hash-based `.pyc` files, Python simply assumes the cache file is valid if it
> exists."*

| Mode | Validation cost per import | Survives a lying clock? | Reproducible bytes? | Where it belongs |
|---|---|---|---|---|
| **Timestamp** (default) | one `stat` | No | No | Developer machines, ordinary installs |
| **Checked hash** | read + hash the whole source | Yes | Yes | CI, `rsync` deploys, restored trees |
| **Unchecked hash** | none — trusted if present | Never checks at all | Yes | Immutable container images only |

Timestamp stays the default deliberately. PEP 552 notes hashing *"can impose
the cost of reading and hashing every source file, which is more expensive than
simply checking timestamps"*, and expects hash-based pycs to be used *"mainly
by distributors and power use cases"*.

**Unchecked** deserves a warning label. In an immutable image it is exactly
right: imports skip validation entirely, so there is no `stat`, no read, no
clock dependence. On a machine where anyone edits source, it means edits do
*nothing* — silently, with no error — until something regenerates the cache.
Never enable it in a development environment.

The hash itself is SipHash of the file contents, chosen because CPython already
had an implementation. PEP 552 is explicit that this is not a security
mechanism: *"Security of the hash is not a concern"* — it is a change detector,
not a signature.

## Producing them: `compileall`

```bash
python -m compileall -q .                                       # timestamp (default)
python -m compileall --invalidation-mode checked-hash   src/
python -m compileall --invalidation-mode unchecked-hash src/    # immutable images
python -m compileall -o 0 -o 1 src/                             # both opt levels at once
```

One detail worth banking, because it changes behaviour without anyone asking
for it. From the `compileall` documentation:

> *"The default is `timestamp` if the `SOURCE_DATE_EPOCH` environment variable
> is not set, and `checked-hash` if the `SOURCE_DATE_EPOCH` environment
> variable is set."*

`SOURCE_DATE_EPOCH` is the cross-ecosystem reproducible-builds convention, and
plenty of build systems set it for you. If yours does, you are already getting
hash-based pycs — which is the right outcome, but it explains why two
apparently identical pipelines can behave differently under a clock skew.

## Overriding at run time

`--check-hash-based-pycs` overrides what each file asked for:

> *"When set to `default`, checked and unchecked hash-based bytecode cache
> files are validated according to their default semantics. When set to
> `always`, all hash-based `.pyc` files, whether checked or unchecked, are
> validated against their corresponding source file. When set to `never`,
> hash-based `.pyc` files are not validated against their corresponding source
> files. **The semantics of timestamp-based `.pyc` files are unaffected by this
> option.**"*

That final sentence is the one people miss, and it is the reason the flag
disappoints in practice. On a default installation every cache is
timestamp-based, so `--check-hash-based-pycs always` changes nothing at all.
It is a policy switch for deployments that already committed to hash mode:
`always` in a staging environment where you want unchecked pycs re-verified,
`never` in production where you have decided to trust them.

## Choosing a mode, in one page

- **Developer laptop** — leave it alone. Timestamps, default, and delete
  `__pycache__` on the rare occasion something looks stuck.
- **CI, and anything that restores or syncs a tree** — `checked-hash`. The cost
  is one full read per source file per import, which is invisible next to
  everything else CI does, and it removes an entire class of "works on my
  machine" failures.
- **Immutable container image** — `unchecked-hash` at build time,
  `PYTHONDONTWRITEBYTECODE=1` at run time. Zero compilation and zero
  validation on start-up, and nothing written to disk.
- **A wheel or distro package you publish** — `checked-hash`, so the pycs you
  ship are reproducible and remain correct regardless of what timestamps the
  installer produces on the target machine.

## The container recipe, concretely

```dockerfile
# build stage — same interpreter, same paths as the runtime stage
RUN python -m compileall --invalidation-mode unchecked-hash -q /app

# runtime
ENV PYTHONDONTWRITEBYTECODE=1
```

Two conditions make or break this:

1. **The same interpreter must compile and run.** A different Python build or
   a different install prefix changes the cache tag, and the caches are then
   silently ignored — no error, just the compile happening again on every cold
   start.
2. **The paths must match.** Code objects embed `co_filename`. If the build
   stage compiles `/build/app/...` and the runtime serves `/app/...`, the
   caches still load (the filename is not part of validation) but every
   traceback points at a path that does not exist in the running image. Compile
   at the final path.

## Gotchas

**Symptom:** edited a module, reran, and the old behaviour persists — but only on one machine, or only in CI
**Cause:** timestamp invalidation compares mtime and size. A restored backup, an `rsync -a` that preserved times, a checkout on a machine with a skewed clock, or a tarball extracted with original timestamps can present an old mtime for new content; if the size also matches, the cache looks valid
**Fix:** delete `__pycache__` to confirm the diagnosis, then switch the pipeline to `python -m compileall --invalidation-mode checked-hash` so content, not the clock, decides

**Symptom:** `--check-hash-based-pycs always` does not fix a stale cache
**Cause:** the caches are timestamp-based, and the documentation says in as many words that the flag does not affect them
**Fix:** delete the caches, or regenerate the tree as hash-based. The flag only governs files already written in hash mode

**Symptom:** two builds of byte-identical source produce different container image layers
**Cause:** timestamp-based `.pyc` files embed the source mtime, so the bytes are a function of when the checkout happened, not what is in it
**Fix:** hash-based pycs — either explicitly via `--invalidation-mode checked-hash`, or implicitly by setting `SOURCE_DATE_EPOCH`, which flips `compileall`'s default. This is precisely the problem PEP 552 was written to solve

**Symptom:** after switching a dev environment to `unchecked-hash`, source edits have no effect whatsoever and no error appears
**Cause:** unchecked pycs are trusted if they exist, full stop. Python never looks at the source again
**Fix:** `unchecked-hash` belongs only in immutable images. Regenerate with `--invalidation-mode timestamp` (or delete `__pycache__`) and never use unchecked mode anywhere a human edits files

**Symptom:** `python -m compileall` in a Dockerfile appears to do nothing for startup time
**Cause:** the caches were written by a different interpreter than the one that runs — a different base image stage, a venv vs system Python, a different patch build — so the cache tag does not match and every candidate is rejected
**Fix:** run `compileall` in the same stage with the same interpreter, over the same absolute paths the runtime will use

**Symptom:** tracebacks in production name source paths that do not exist in the image
**Cause:** the code objects were compiled at a build path and `co_filename` was baked in; cache validation ignores the filename so they still load
**Fix:** compile at the final runtime path. This is not a cache *correctness* bug — the code is right — but it destroys the usefulness of every stack trace

**Symptom:** a CI pipeline started producing hash-based pycs and nobody changed a flag
**Cause:** something in the pipeline began exporting `SOURCE_DATE_EPOCH`, which flips `compileall`'s default from `timestamp` to `checked-hash`
**Fix:** nothing is wrong — this is the documented behaviour and the better mode. Know that it happened so the change in import cost is not a mystery

**Symptom:** someone proposes hash-based pycs "for security, so nobody can swap the bytecode"
**Cause:** a misreading of what the hash is for. PEP 552 states outright that *"Security of the hash is not a concern"* — it is SipHash of the contents as a change detector
**Fix:** it is an integrity heuristic against accidents, not a signature against attackers. Anyone who can write your `.pyc` can also write a matching `.py`. Use filesystem permissions and image signing for that threat

**Symptom:** import time measurably increased after moving to `checked-hash`
**Cause:** every import now reads and hashes the entire source file rather than doing a single `stat`
**Fix:** this is the documented trade and usually worth it. If import time is critical *and* the tree is immutable, `unchecked-hash` gives you both correctness-by-construction and no validation cost

## Interview questions

**★ How does Python decide a `.pyc` is stale?**
By default it stores the source's last-modified timestamp and size in the cache
header and compares both at import time. Since 3.7 there is also hash-based
invalidation (PEP 552): the header stores a SipHash of the source contents
instead. Checked hash-based pycs re-hash the source on every import and
regenerate the cache when it differs; unchecked ones are trusted
unconditionally if the file exists. Timestamps remain the default because
hashing costs a full read of every source file on every import, which the PEP
explicitly weighs against a single `stat`.

**★ When would you use hash-based `.pyc` files, and which flavour?**
**Checked** when correctness under untrustworthy timestamps matters — CI
caches, `rsync`-based deploys, restored backups, container builds that `COPY`
files whose mtimes came from an archive. **Unchecked** only in a genuinely
immutable image, where the source cannot change and you want imports to skip
validation entirely. Both produce reproducible bytes, which is what
content-addressed build systems and byte-for-byte image comparison need. You
would never use unchecked mode anywhere a human edits files, because edits then
do nothing at all with no error.

**★ Someone edited a file and the change had no effect. Walk me through the debugging.**
First confirm which file is actually being imported — print `module.__file__` —
because a shadowing module elsewhere on `sys.path` is the other common cause,
and it is more common than a stale cache. Then delete `__pycache__` and rerun:
if the change appears, it was invalidation, and the mtime was misleading. Check
for a `.pyc` in the legacy location beside the source with the `.py` missing,
which imports with no validation at all. Then fix the root cause — hash-based
invalidation in the build, or a deploy step that stops preserving timestamps
from a previous checkout.

**Why is the default still timestamps if hashing is more correct?**
Cost and history. Validating a timestamp is one `stat` call; validating a hash
means reading and hashing the whole source file, on every import, of every
module. For a program that imports several hundred modules at startup that is a
real difference, and for the overwhelmingly common case — a developer editing
files on a machine with a sane clock — the timestamp is correct. PEP 552 itself
frames hash-based pycs as being for distributors and power use cases rather
than as a replacement.

**What is `SOURCE_DATE_EPOCH` and what does it do to `compileall`?**
It is the cross-ecosystem convention for reproducible builds: a fixed
timestamp that build tools use in place of "now". `compileall` honours it by
switching its default invalidation mode from `timestamp` to `checked-hash`,
because embedding a timestamp would defeat the reproducibility the variable
exists to provide. The practical consequence is that a pipeline can start
producing hash-based pycs with no explicit flag change.

**Is a hash-based `.pyc` a security feature?**
No, and PEP 552 says so directly — security of the hash is not a concern; it is
SipHash over the contents used as a change detector. Anyone able to overwrite
your `.pyc` can overwrite the `.py` next to it and recompute the hash. Integrity
against an attacker needs filesystem permissions, signed artefacts and image
verification, not the cache header.

**What does `--check-hash-based-pycs never` buy you?**
It skips validation even for pycs written in checked mode, which is a way to
get unchecked-mode startup behaviour from an already-built tree without
recompiling it. It is a production-only setting for an immutable deployment.
And the corollary interviewers like: it does nothing whatsoever on a default
installation, because the docs are explicit that timestamp-based pycs are
unaffected by the option.

---

← Prev: [`__pycache__`](03-pycache.md) · Index: [What Python is](README.md) · Next → [The interpreter loop](05-the-interpreter-loop.md)
