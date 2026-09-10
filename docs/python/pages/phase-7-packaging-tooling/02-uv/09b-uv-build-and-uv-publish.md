---
title: "`uv build` drives your declared backend and `uv publish` uploads what it made — and the flag that matters most before either is `--no-sources`, because everything under `[tool.uv.sources]` vanishes the moment anyone else builds your package"
sidebar_label: "09b · uv build and uv publish"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Building and publishing a package*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/package/)), *Configuring projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/)), *Managing dependencies*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/)) and the CLI reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**uv is a build *frontend*, not a build backend: `uv build` reads `[build-system]`, installs the
backend it names into an isolated environment, and asks it for a source distribution and a wheel;
`uv publish` uploads the results to an index. This page covers only what uv adds to that pipeline — what
a wheel and an sdist *are* is topic **07 · Wheels vs sdists** *(not written yet)*, and the release
process around an upload is topic **12 · Publishing to PyPI** *(not written yet)*. What uv adds is one
serious trap. Inside your repository, `[tool.uv.sources]` quietly redirects dependencies to git
checkouts, local paths and workspace members; outside it — for pip, for another backend, for the person
installing your sdist — none of that exists. A package that builds and tests perfectly with uv can be
unbuildable anywhere else. uv's own guide names the flag that shows you that before your users do.**

## `uv build`

> `uv build` — *"Build Python packages into source distributions and wheels"*
> — [CLI reference](https://docs.astral.sh/uv/reference/cli/)

> *"By default, `uv build` will build the project in the current directory, and place the built
> artifacts in a `dist/` subdirectory."*
> — [building and publishing a package](https://docs.astral.sh/uv/guides/package/)

It needs a backend to drive, and the backend comes from `[build-system]`. Two rules meet here and
should not be confused. For *syncing*, uv's rule is that *"If a build system is not defined, uv will not
attempt to build or install the project itself"* ([configuring projects](https://docs.astral.sh/uv/concepts/projects/config/),
[01b](01b-the-project-uv-sees.md)). For *building*, the packaging standards define a legacy fallback
when the table is missing — the setuptools route, and only if there is a `setup.py` — which topic 01's
[build-system and backends](../01-pyproject-toml/11-build-system-and-choosing-a-backend.md) quotes in
full. ⚠️ The uv pages verified for this topic do not say how `uv build` behaves in a project with no
`[build-system]`; declare one and the question never arises.

```bash
uv build                    # sdist and wheel into dist/
```

## 🔴 `--no-sources`: build as the rest of the world will

> *"When publishing a package, we recommend running `uv build --no-sources` to ensure that the package
> builds correctly when `tool.uv.sources` is disabled, as is the case when using other build tools."*
> — [building and publishing a package](https://docs.astral.sh/uv/guides/package/)

> `--no-sources` — *"Ignore the `tool.uv.sources` table when building"*
> — [CLI reference](https://docs.astral.sh/uv/reference/cli/)

The mechanism is [04b](04b-tool-uv-sources.md)'s: `[tool.uv.sources]` is a uv routing table under the
`[tool]` namespace, and the packaging specification gives no other tool a reason to read it. So a
dependency that is satisfied, in your checkout, by a sibling directory or a git branch is — for pip and
for anyone installing your sdist — a plain requirement that must be found on an index. If it is not
there, or not at a compatible version, your package does not install. `--no-sources` rehearses that
world on your machine:

```bash
uv build --no-sources        # fails here, now, if the package depends on a routing only uv knows
```

Make it the build in CI, not an occasional check: the builds that reach users are, by construction,
builds without your sources.

## Checking the artefact, not the checkout

The guide's test for a package runs it outside the project:

> `uv run --with <PACKAGE> --no-project -- python -c "import <PACKAGE>"` — *"`--no-project` flag is used
> to avoid installing the package from your local project directory."*
> — [building and publishing a package](https://docs.astral.sh/uv/guides/package/)

As the guide shows it, `<PACKAGE>` is a package *name*, resolved from an index — a check of what was
published. To check a wheel *before* it is uploaded, install the file into a throwaway environment and
import it from outside the source tree:

```bash
uv build --no-sources
uv venv /tmp/wheel-check
VIRTUAL_ENV=/tmp/wheel-check uv pip install dist/invoice_service-0.4.2-py3-none-any.whl
(cd /tmp && /tmp/wheel-check/bin/python -c "import invoice_service")
```

The `cd` matters as much as the fresh environment. `python -c` puts the current directory on
`sys.path`, so in a flat-layout project the import can be answered by the source directory sitting next
to you rather than by the wheel — the import-the-wrong-copy bug topic **04 · Project layout** *(not
written yet)* is built around. Inside the project, the editable install answers it regardless.

## `uv publish`

> `uv publish` — *"Upload distributions to an index"*
> — [CLI reference](https://docs.astral.sh/uv/reference/cli/)

> *"Set a PyPI token with `--token` or `UV_PUBLISH_TOKEN`, or set a username with `--username` or
> `UV_PUBLISH_USERNAME` and password with `--password` or `UV_PUBLISH_PASSWORD`."*

> *"For publishing to PyPI from GitHub Actions or another Trusted Publisher, you don't need to set any
> credentials."*
> — both [building and publishing a package](https://docs.astral.sh/uv/guides/package/)

```bash
rm -rf dist/
uv build --no-sources
UV_PUBLISH_TOKEN="$PYPI_TOKEN" uv publish
```

Trusted publishing — the CI identity exchanged for a short-lived upload credential, with no long-lived
token stored anywhere — is the configuration topic 12 covers; what matters for uv is that it needs no
flag at all. The guard against uploading a package that must never leave the company is a classifier,
not a uv setting (topic 01's [authors, classifiers and urls](../01-pyproject-toml/09-authors-classifiers-and-urls.md)
covers `Private :: Do Not Upload`).

## Gotchas

**★ Symptom: the package builds and tests with uv, and `pip install` of the published sdist fails to find a dependency.**
Cause: the dependency was satisfied through `[tool.uv.sources]` — a path, git or workspace routing —
which no other tool reads. Fix: build the way everyone else will, and publish the dependency (or depend
on a published version).

```bash
uv build --no-sources
```

**★ Symptom: `import yourpackage` passes in the release check, and the published wheel turns out to be missing modules.**
Cause: the check ran inside the project, where the editable install answers the import. Fix: test the
artefact outside the project, as the guide does.

```bash
uv venv /tmp/wheel-check
VIRTUAL_ENV=/tmp/wheel-check uv pip install dist/invoice_service-0.4.2-py3-none-any.whl
(cd /tmp && /tmp/wheel-check/bin/python -c "import invoice_service")
```

**★ Symptom: `uv sync` never installs the project, and whether `uv build` works depends on whether a stray `setup.py` exists.**
Cause: no `[build-system]`. uv does not install the project on sync, and building falls to the
standards' legacy path, which exists only for a tree with a `setup.py`
([topic 01, chunk 11](../01-pyproject-toml/11-build-system-and-choosing-a-backend.md)). Fix: declare the
backend, so both commands have one answer ([01b](01b-the-project-uv-sees.md)).

```toml
[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

**Symptom: an upload includes last month's artefacts alongside today's.**
Cause: `dist/` accumulates builds, and the guide's flow runs `uv publish` straight after `uv build`
without saying which files it selects. Fix: start every release from an empty `dist/`.

```bash
rm -rf dist/ && uv build --no-sources && uv publish
```

**Symptom: a long-lived PyPI token leaks from CI logs or a fork's pipeline.**
Cause: a static credential existed to be leaked. Fix: use trusted publishing, where *"you don't need to
set any credentials"*; if a token is unavoidable, pass it through the environment from a secret store,
never on the command line.

```yaml
permissions:
  id-token: write          # trusted publishing: no stored token
steps:
  - run: uv build --no-sources
  - run: uv publish
```

## Interview questions

**★ Why does uv recommend `uv build --no-sources` before publishing?**
Because `[tool.uv.sources]` is invisible to every tool except uv, and the people installing your
package are using those tools — or using uv against your sdist, where your repository's routing does not
exist either. The guide says it directly: build with `--no-sources` *"to ensure that the package builds
correctly when `tool.uv.sources` is disabled, as is the case when using other build tools."* Without it, a
dependency satisfied locally by a sibling path or a git branch looks fine in every test you run and
fails for the first real user. With it, the failure happens on your machine or in your CI, which is the
only place it is cheap.

**★ Is uv a build backend?**
No — it is a frontend that drives one. `uv build` reads `[build-system]`, installs the backend it names
into an isolated build environment, and calls it; the backend produces the wheel and the sdist. uv does
ship a backend of its own, `uv_build`, which `uv init` declares by default, but that is a separate
package named in `[build-system]` like hatchling or setuptools, and a project can use `uv build` with
any of them. Keeping the two roles apart is what makes a uv-built package buildable by pip: the backend
contract is the PEP 517 interface, not anything specific to uv.

**Why must a release check run outside the project directory?**
Because inside it the import is answered by something other than the artefact. The project environment
has your package installed editable, pointing at the source tree, so a wheel missing half its modules
still imports; and `python -c` puts the current directory on `sys.path`, so in a flat layout even a
fresh environment can import the source folder beside you. The guide's post-publish check uses
`--no-project`, which it explains as *"used to avoid installing the package from your local project
directory."* For a pre-upload check the same principle means a throwaway environment containing only the
wheel, and a working directory that contains no copy of the code. The import then succeeds only if the
wheel is actually complete.

---

← Prev: [09 · uv init, uv version, uv tree](09-uv-init-version-and-tree.md) · [Topic index](README.md) · Next → [10 · Workspaces](10-workspaces.md)
