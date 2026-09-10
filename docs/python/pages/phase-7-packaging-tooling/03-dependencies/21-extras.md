---
title: "An extra is a promise that your package works without a dependency and works better with it — the declaration is one line, but keeping the promise means guarded imports, a CI job with every extra and one with none, and remembering that every extra is resolved into your lock whether you install it or not"
sidebar_label: "21 · Extras in practice"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Dependency specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/)),
> the PyPA guide **Writing your pyproject.toml**
> ([packaging.python.org](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)),
> **PEP 735** ([peps.python.org](https://peps.python.org/pep-0735/)), uv's **Managing dependencies** and
> **Locking and syncing** ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/),
> **uv 0.12.12**) and uv's **CLI reference** ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**The field — `[project.optional-dependencies]`, `Provides-Extra`, the `extra ==` marker — is covered in
[pyproject.toml · 07](../01-pyproject-toml/07-extras-and-dependency-groups.md). This page is what happens
after you declare one. An extra is a public promise with two halves: the base install must work *without*
the extra's dependencies, and the extra must actually work *with* them. Neither half is checked by any
tool. Your code must import the optional dependency lazily and fail with a message that names the extra;
your CI must install the package bare and fully, because uv does not sync extras by default; and your lock
contains every extra's dependencies regardless, so an extra's constraint can hold back a package the base
install uses. Extras are also global per package: whoever in the graph asks for `httpx[http2]` asks for
everyone.**

This page is the promise and how to keep it. How extras behave inside the dependency graph — resolved into
your lock whether installed or not, unioned across everyone who requests them, and the convenience extra that
rots — is [21b](21b-extras-in-the-lock-and-the-graph.md).

## When a dependency earns an extra

uv's docs state the purpose in one line, with the canonical example:

> *"It is common for projects that are published as libraries to make some features optional to reduce the
> default dependency tree. For example, Pandas has an `excel` extra and a `plot` extra to avoid installation
> of Excel parsers and matplotlib unless someone explicitly requires them."*

The test is whether a *user of the published package* would choose it. That gives four recurring shapes:

| Shape | Example | Why an extra |
|---|---|---|
| heavy optional feature | `plot = ["matplotlib>=3.6.3"]` | most users never draw a chart |
| alternative backend | `postgres`, `mysql` | a user wants exactly one |
| accelerator | `http2 = ["h2>=4"]` | works without it, faster with it |
| platform or licence boundary | a GPL codec, a Windows-only driver | not everyone can or may install it |

And what never earns one: your test runner, linter or docs toolchain. PEP 735's reasons are structural —
*"it is not possible to install an extra without installing the current package and its dependencies"*, and
*"Because they are user-installable, extras are part of the public interface for packages."* Those belong in
dependency groups ([22](22-dependency-groups.md)).

Adding one:

```bash
uv add reportlab --optional pdf       # writes [project.optional-dependencies] pdf = ["reportlab>=…"]
```

## Half one: the base install must work without it

Nothing stops you importing an optional dependency at module top level, and nothing warns you when you do.
The base install then fails at import time with an error about a package the user never heard of. The
pattern is a lazy import that converts the failure into an instruction:

```python
# src/invoice_service/pdf.py
import io


def render_pdf(invoice_number: str, total: str) -> bytes:
    try:
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise ImportError(
            "PDF output needs the 'pdf' extra: pip install 'invoice-service[pdf]'"
        ) from exc

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.drawString(72, 720, f"Invoice {invoice_number}")
    pdf.drawString(72, 700, f"Total: {total}")
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
```

and, where a feature should degrade rather than fail, a capability check at import time that never imports
the package itself:

```python
# src/invoice_service/transport.py
import importlib.util

HAS_HTTP2 = importlib.util.find_spec("h2") is not None
```

## Half two: the extra must work with it — and CI must prove both

uv's default leaves extras out of the environment:

> *"uv does not sync extras by default. Use the `--extra` option to include an extra."*

So a plain `uv sync --locked && uv run pytest` tests the bare install and never touches the PDF path — or,
if your tests import `reportlab` unconditionally, fails for a reason that is not a bug. Test both ends
explicitly, and let tests that need an extra skip when it is absent:

```python
# tests/test_pdf.py
import pytest

canvas = pytest.importorskip("reportlab.pdfgen.canvas")

from invoice_service.pdf import render_pdf


def test_render_pdf_produces_a_pdf() -> None:
    assert render_pdf("INV-1042", "118.00").startswith(b"%PDF")
```

```yaml
# .github/workflows/ci.yml — the bare install and the full install, every run
jobs:
  test:
    strategy:
      matrix:
        extras: ["", "--extra pdf", "--all-extras"]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --locked ${{ matrix.extras }}
      - run: uv run --locked pytest -q
```

The empty entry is the one that catches a top-level import of an optional package.

## Gotchas

**★ Symptom: `import invoice_service` fails for users who installed without extras, naming a package they
never heard of.** Cause: a module imports an optional dependency at top level; nothing checks the bare
install. Fix: import inside the function that needs it and raise an error that names the extra (the
`render_pdf` pattern above), and add the bare install to the CI matrix:

```yaml
extras: ["", "--all-extras"]
```

**★ Symptom: the PDF feature shipped broken and every CI run was green.** Cause: *"uv does not sync extras by
default"*, so no job ever installed `reportlab`, and the tests that needed it were skipped. Fix: a job per extra,
or at least one with all of them:

```bash
uv sync --locked --all-extras && uv run --locked pytest -q
```

**★ Symptom: `pip install invoice-service[pdf]` fails in zsh with `no matches found`.** Cause: the shell, not
pip — zsh treats `[...]` as a glob pattern and aborts when nothing matches. Fix: quote the requirement, in docs
and in scripts:

```bash
pip install "invoice-service[pdf]"
```

**Symptom: an application's `pyproject.toml` grows `[project.optional-dependencies]` for its own dev tools,
and `uv sync --all-extras` in production installs them.** Cause: an application has no users who request
extras; the table is being used as a grouping mechanism, and it installs what it groups. Fix: dependency groups,
which production excludes with one flag:

```toml
[dependency-groups]
dev = ["pytest>=8.3", "ruff>=0.16"]
```

```bash
uv sync --locked --no-dev
```

**Symptom: a Docker image built with `uv export` lacks the extra the service needs.** Cause: exports follow the
same default as sync — extras are selected, not implied. Fix: name it:

```bash
uv export --locked --extra postgres --no-emit-project -o requirements.txt
```

## Interview questions

**★ When should a dependency be an extra rather than a required dependency?**
When a user of your *published* package would reasonably choose to go without it: a heavy optional feature
(Pandas' `plot` and `excel`), one of several alternative backends, an accelerator the code works without, or
something with a platform or licence boundary. The deciding question is the user's choice, not your
convenience. Your development tools fail that test — PEP 735 notes an extra cannot be installed *"without
installing the current package and its dependencies"* and is *"part of the public interface"* — so they belong
in dependency groups. An application usually has no extras at all, because nobody requests features of an
application.

**★ How do you make the absence of an extra fail helpfully?**
Import the optional dependency lazily — inside the function that needs it — and convert the `ImportError` into
one that names the extra and the install command, chained with `from exc` so the original cause survives. For
optional *enhancements*, check capability with `importlib.util.find_spec` without importing. Then keep a CI job
that installs with no extras at all, because that is the only place a stray top-level import shows up; nothing
in packaging metadata checks it.

**How would you test a library with three extras?**
At minimum two jobs: one with no extras, to prove the base install imports and works, and one with
`--all-extras`, to prove every optional path works together. If the extras are independent and each is
substantial, add a job per extra, because combinations can hide a missing dependency that another extra
happens to provide. Tests that need an optional package use `pytest.importorskip` so the bare job skips them
cleanly, and every job syncs with `--locked` so the matrix tests the committed resolution.

**Is removing an extra a breaking change?**
Yes, in the only sense that matters to consumers: `your-package[pdf]` in their requirements stops pulling the
PDF dependencies, and depending on the installer that may be a warning rather than an error, so their install
succeeds with less than they asked for. Adding a dependency to an existing extra is a softer change of the same
public interface. Treat extras like any published API — deprecate with an alias that points to the new name for
a release, as the field-level page shows, and note it in the changelog.

---

← [20 · The CI flags that refuse to re-resolve](20-the-ci-flags-that-refuse-to-re-resolve.md) · [Topic index](README.md) · Next → [21b · Extras in the lock and the graph](21b-extras-in-the-lock-and-the-graph.md)
