---
title: "Docker base images: slim, alpine and the default, and why the smallest image is the one that compiles NumPy from source"
sidebar_label: "14 · Docker base images"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the
> [official `python` Docker image documentation](https://hub.docker.com/_/python)
> (source: [docker-library/docs](https://github.com/docker-library/docs/blob/master/python/README.md)),
> [PEP 656 – Platform Tag for Linux Distributions Using Musl](https://peps.python.org/pep-0656/)
> and [PEP 600 – Future 'manylinux' Platform Tags](https://peps.python.org/pep-0600/).
> Version spine: **Python 3.14.7**; the official image publishes
> `3.14.7-slim-trixie`, `3.14.7-alpine3.24` and related tags.

**Choosing a Python base image looks like an optimisation question and is
actually a compatibility question. The `alpine` variant is dramatically smaller,
and it uses musl instead of glibc — which means the entire manylinux wheel
ecosystem does not apply to it, and every package with a C extension either has a
`musllinux` wheel or gets compiled inside your build. That trade is the whole
decision, and it is why "use alpine, it's smaller" is advice that costs some
teams twenty minutes of build time per commit.**

## The tag families

The official image publishes several variants of each version. Reading a tag
like `3.14.7-slim-trixie`: version `3.14.7`, variant `slim`, Debian release
`trixie`.

**The default (`python:3.14.7`, `python:3.14-trixie`)** is built on
`buildpack-deps`:

> *"This tag is based off of buildpack-deps. buildpack-deps is designed for the
> average user of Docker who has many images on their system. It, by design, has
> a large number of extremely common Debian packages. This reduces the number of
> packages that images that derive from it need to install, thus reducing the
> overall size of all images on your system."*

**`python:<version>-slim`:**

> *"This image does not contain the common Debian packages contained in the
> default tag and only contains the minimal Debian packages needed to run python.
> Unless you are working in an environment where only the python image will be
> deployed and you have space constraints, we highly recommend using the default
> image of this repository."*

and the caveat that decides most builds:

> *"When using this image pip install will work if a suitable built distribution
> is available for the Python distribution package being installed. pip install
> may fail when installing a Python distribution package from a source
> distribution. This image does not contain the Debian packages required to
> compile extension modules written in other languages. Possible solutions if a
> pip install fails include: Use this image and install any required Debian
> packages before running pip install. Use the default image of this repository.
> The default image contains the most commonly required Debian packages. The
> majority of arbitrary pip installs should be successful without additional
> header/development Debian packages."*

**`python:<version>-alpine`:**

> *"This image is based on the popular Alpine Linux project, available in the
> alpine official image. Alpine Linux is much smaller than most distribution base
> images (~5MB), and thus leads to much slimmer images in general."*

> *"This variant is useful when final image size being as small as possible is
> your primary concern. The main caveat to note is that it does use musl libc
> instead of glibc and friends, so software will often run into issues depending
> on the depth of their libc requirements/assumptions."*

> *"To minimize image size, it's uncommon for additional related tools (such as
> git or bash) to be included in Alpine-based images."*

Note that the documentation's own recommendation is the *default* image, not
`slim` — and `slim` is nonetheless the right default for most services, because
"unless you have space constraints" describes almost nobody's production
registry.

## The musl wheel problem, properly

This is the part that turns an image-size decision into a build-time decision.

A wheel containing compiled code is tagged with the platform it was built for.
On Linux the tag families are:

- **`manylinux`** — built against glibc, per PEP 600's perennial scheme
  (`manylinux_2_17_x86_64` and similar). This is what the overwhelming majority
  of Linux wheels on PyPI are.
- **`musllinux`** — built against musl, introduced by PEP 656 precisely because
  the first family cannot serve Alpine:

  > *"This PEP proposes a new platform tag series musllinux for binary Python
  > package distributions for a Python installation that depends on musl on a
  > Linux distribution. The tag works similarly to the "perennial manylinux"
  > platform tags specified in PEP 600, but targeting platforms based on musl
  > instead."*

  and the motivation states the problem in one sentence:

  > *"With the wide use of containers, distributions such as Alpine Linux have
  > been gaining more popularity than ever. Many of them based on musl, a
  > different libc implementation from glibc, and therefore cannot use the
  > existing manylinux platform tags. This means that Python package projects
  > cannot deploy binary distributions on PyPI for them."*

So on an Alpine image, a package's `manylinux` wheels are simply not candidates.
If the project publishes `musllinux` wheels, you get a binary; if it does not,
pip downloads the source distribution and builds it — which requires a compiler
and the relevant headers, takes minutes rather than seconds for anything large,
and produces a much bigger intermediate layer than the wheel would have been.

`musllinux` is a real, standardised tag and a growing number of projects publish
it. But it is **per project and per version**, so the honest procedure is to
check the ones you actually depend on rather than to assume either way. On the
project's PyPI "Download files" page, look for `musllinux` in the filenames.

## Choosing

| Situation | Image |
|---|---|
| Pure-Python dependencies only, small image matters | `alpine` is genuinely fine |
| The usual web service with a few compiled dependencies | `-slim` |
| Heavy scientific or ML stack, or arbitrary `pip install` in the build | the default (`buildpack-deps`-based) tag |
| A multi-stage build where the builder compiles and the runtime does not | build in the default tag, run in `-slim` |
| You measured and image size is the binding constraint | `alpine`, having first confirmed `musllinux` wheels exist for every compiled dependency |

The multi-stage pattern deserves a name because it removes most of the tension:

```dockerfile
# builder: has the compilers and headers
FROM python:3.14.7 AS builder
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev

# runtime: does not
FROM python:3.14.7-slim
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY . .
ENV PATH="/app/.venv/bin:$PATH"
CMD ["python", "-m", "myapp"]
```

The compiled artefacts are produced where the toolchain exists and copied into an
image that does not carry it. Phase 7 takes this much further — lockfiles, cache
mounts, layer ordering, non-root users — but the base-image half of the decision
is settled here.

## Pinning

The tag list shows exactly how much you can pin:

- `3.14` — floats to the newest patch and the newest Debian release. Convenient,
  not reproducible.
- `3.14.7-slim` — pins the Python patch version; the Debian release still
  follows the default, which moves when a new Debian ships.
- `3.14.7-slim-trixie` — pins both. This is the form to use in anything you
  intend to rebuild identically.
- A digest (`python@sha256:...`) — pins the exact image. Maximum
  reproducibility, and it will not pick up base-image security rebuilds, so it
  needs an update mechanism.

Note also that the official image publishes pre-release tags —
`3.15.0rc1-slim`, `3.15-rc-alpine` — which is a convenient way to run a CI job
against the next Python during the beta window described in
[03 · The release model, chunk 3](../03-release-model/03-feature-freeze.md).

## What this hands to Phase 7

The base image decides three things that packaging then has to work with:

1. **Which wheels are available** — glibc or musl, and therefore whether your
   build compiles anything.
2. **Whether a compiler exists at build time**, which decides whether a source-only
   dependency is a minor inconvenience or a build failure.
3. **Where the environment lives in the image** — a `.venv` copied between stages,
   or packages installed into the image's own interpreter, which is the point at
   which [chunk 1](01-never-the-system-python.md)'s argument reappears in
   container form.

## Gotchas

**Symptom:** the Alpine build takes minutes and the Debian one takes seconds
**Cause:** no `musllinux` wheel for one of your compiled dependencies, so pip is building it from the source distribution
**Fix:** check the dependency's PyPI files for a `musllinux` tag. If it is missing, either switch to `-slim` or accept the build cost knowingly — and cache the wheel rather than rebuilding it every time

**Symptom:** `pip install` fails on `-slim` with an error about a missing header or compiler
**Cause:** the slim image deliberately omits the Debian packages needed to compile extension modules, and the package had no suitable wheel
**Fix:** the documentation's own options — install the required Debian packages first, or use the default image. A multi-stage build gets you both

**Symptom:** the image works locally on x86_64 and fails on an arm64 host
**Cause:** wheels are per architecture as well as per libc; a project may publish `manylinux_2_17_x86_64` and not `aarch64`
**Fix:** build and test on the target architecture. `docker buildx` cross-building hides this until deployment, which is exactly when you do not want to discover it

**Symptom:** `bash` or `git` is missing inside an Alpine-based image
**Cause:** documented — *"it's uncommon for additional related tools (such as git or bash) to be included in Alpine-based images"*
**Fix:** install what you need explicitly, and count those layers against the size saving you were trying to make

**Symptom:** `python:3.14` changed underneath a build that used to be reproducible
**Cause:** a floating tag follows both the newest patch release and the newest Debian base
**Fix:** pin the full form — `3.14.7-slim-trixie` — or a digest, and rebuild deliberately rather than accidentally

**Symptom:** an image pinned to a digest is failing a vulnerability scan
**Cause:** digest pinning also pins the OS layer, so base-image security rebuilds never reach it
**Fix:** pair digest pinning with an automated update mechanism. Reproducibility and patching pull in opposite directions and both need a process

**Symptom:** a package that works on Debian misbehaves subtly on Alpine
**Cause:** musl is not a drop-in replacement for glibc — the image docs warn that *"software will often run into issues depending on the depth of their libc requirements/assumptions"*. Differences in DNS resolution behaviour, thread stack sizes and locale handling are the usual suspects
**Fix:** if the difference is not explainable, move to a glibc image rather than debugging libc semantics. This is a category of problem with a very poor effort-to-value ratio

**Symptom:** the final image is enormous despite starting from `-slim`
**Cause:** build-time packages, pip's cache, and compiled intermediates are all baked into layers
**Fix:** multi-stage build, so the toolchain never reaches the runtime image; that is the structural fix, and it beats any amount of layer-squashing

**Symptom:** `pip install` inside the container hits `error: externally-managed-environment`
**Cause:** the base image kept the `EXTERNALLY-MANAGED` marker — PEP 668 recommends distributors of single-application container images keep it, *"preferably in a way that makes it not go away if a user of that image installs package updates inside their image"*
**Fix:** use a virtual environment inside the image. It is one line and it is the answer [chunk 2](02-responding-to-pep-668.md) gives everywhere else too

**Symptom:** two developers get different images from the same Dockerfile
**Cause:** floating tags, an unpinned `pip install` without a lockfile, or a different host architecture
**Fix:** pin the base image fully, install from a lockfile, and specify the platform explicitly when it matters

## Interview questions

**★ What is the actual trade-off between the `slim` and `alpine` Python images?**
`slim` is Debian with only the packages needed to run Python, so it keeps glibc
and therefore the whole `manylinux` wheel ecosystem — but it omits the
development packages needed to compile extension modules, so a dependency with no
wheel fails to build. `alpine` is far smaller (~5MB base) but uses musl instead
of glibc, which means `manylinux` wheels do not apply at all: a package needs a
`musllinux` wheel or it gets compiled in your build. So `slim` trades some size
for compatibility, and `alpine` trades a lot of compatibility for size.

**★ Why does the same `pip install` take minutes on Alpine and seconds on Debian?**
Because on Alpine the pre-built `manylinux` wheels are not candidates — they are
built against glibc — so unless the project publishes `musllinux` wheels (the
tag standardised by PEP 656 for exactly this reason), pip downloads the source
distribution and compiles it. That needs a toolchain, takes real time, and
produces a much larger intermediate layer than a wheel would have.

**★ How do you pin a Python base image so that a rebuild is reproducible?**
Pin all three parts of the tag — the patch version, the variant and the
distribution release, as in `python:3.14.7-slim-trixie` — or pin a digest for
exactness. `python:3.14` floats to both the newest patch and the newest Debian
base. The catch with digest pinning is that it also freezes the OS layer, so it
must be paired with a process for taking base-image security rebuilds; otherwise
reproducibility quietly becomes staleness.

**Why does a multi-stage build solve most of this?**
Because it separates "where the code is compiled" from "where the code runs". The
builder stage uses the full image, which has the compilers and headers, and
produces a virtual environment or a set of wheels. The runtime stage starts from
`-slim` and copies only the artefacts. You get the compatibility of the large
image at build time and the size of the small one at runtime, without choosing
between them.

**Does PEP 668 apply inside a container?**
Yes, if the base image kept the marker file — and PEP 668 recommends that
distributors of single-application container images do keep it, in a way that
survives an in-image package update. So `pip install` at the system level in such
an image raises `error: externally-managed-environment`. The answer is the same
as everywhere else: a virtual environment inside the image, which also makes the
multi-stage copy trivial.

**Someone proposes Alpine to cut the image size. What do you check before agreeing?**
Whether every compiled dependency publishes a `musllinux` wheel for the target
architecture — that is a per-project, per-version question answerable from each
project's PyPI files list. Then whether anything in the stack has deep libc
assumptions, since musl differs from glibc in DNS resolution, thread stack sizes
and locale handling. If the dependency set is pure Python, Alpine is genuinely
fine. If it includes a scientific stack, the saving is usually paid back in build
time within a week.

**Which official image variant do the maintainers themselves recommend?**
The default one. The documentation says that unless you are in an environment
where only the `python` image will be deployed and you have space constraints,
they highly recommend the default tag, because it carries the common Debian
packages that most `pip install`s need. In practice most teams still use `-slim`
for runtime images — which is defensible, provided the compiling happens in an
earlier stage that has the toolchain.

---

← Prev: [Confirming free-threading](13-confirming-free-threading.md) · Index: [Installing and versions](README.md) · Next → [Virtual environments](../05-virtual-environments/README.md)
