---
title: "description is one line and readme is the whole PyPI page, and the reason a project page renders as a wall of unparsed markup is almost always a content-type the spec made you state explicitly"
sidebar_label: "05 · description and readme"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), *Core metadata specifications* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)), setuptools' *Configuring setuptools using pyproject.toml* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/pyproject_config.html)), and flit's *pyproject.toml* reference ([flit.pypa.io](https://flit.pypa.io/en/stable/pyproject_toml.html)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**These two keys are the entire public face of your package and they are the only two that are graded by a human. `description` becomes the one-line `Summary` that appears in search results and in `pip show`; `readme` becomes the `Description` that PyPI renders as your project page. The spec makes exactly one demand that people get wrong, and it costs them a broken project page: if you use the table form of `readme`, `content-type` is not optional — a tool MUST error without it — and if you use the string form, the content type is inferred from the file suffix and nothing else. A `.txt` readme full of Markdown renders as plain text, forever, because published metadata is immutable.**

## `description` is a summary, and it is one line

> *"The summary description of the project in one line. Tools MAY error if this includes multiple lines."*

Note "MAY". A multi-line `description` is not guaranteed to fail — which is worse than a guaranteed failure, because one backend accepts it, mangles it into the `Summary` field, and PyPI shows you the result.

```toml
[project]
description = "Issues, stores and reconciles customer invoices."
```

TOML makes it easy to write a multi-line string by accident:

```toml
[project]
# 🔴 valid TOML, invalid intent — this is one string containing a newline
description = """
Issues, stores and reconciles customer invoices.
Supports Stripe and GoCardless.
"""
```

The second sentence belongs in the readme. `Summary` is a single line of plain text with no markup: it is what appears next to your name in a search result, in `pip show`, and in a dependency tree. Write it as a sentence, keep it under about 100 characters so it is not truncated by whatever renders it, and do not repeat the project name inside it.

⚠️ Flit can supply it for you from the module docstring, which is a genuinely nice arrangement if you keep your docstring short:

> *"If you want Flit to get this from the module docstring, leave it out of the TOML config and include "description" in the `dynamic` field."*

## `readme` — two forms, and the one that errors

### String form: the suffix is the content type

> *"If it is a string then it is a path relative to `pyproject.toml` to a text file containing the full description."*

> *"If the file path ends in a case-insensitive `.md` suffix, then tools MUST assume the content-type is `text/markdown`."*

> *"If the file path ends in a case-insensitive `.rst`, then tools MUST assume the content-type is `text/x-rst`."*

```toml
[project]
readme = "README.md"        # → text/markdown, guaranteed by the spec
```

Two suffixes have a MUST-level mapping. Everything else — `.txt`, `README` with no suffix, `.markdown` — has none, so what you get is up to the backend, and the safe assumption is plain text.

### Table form: `content-type` is mandatory

> *"A table specified in the `readme` key also has a `content-type` key which takes a string specifying the content-type of the full description. A tool MUST raise an error if the metadata does not specify this key in the table. If the metadata does not specify the `charset` parameter, then it is assumed to be UTF-8."*

```toml
[project]
readme = { file = "README.markdown", content-type = "text/markdown" }
```

```toml
[project]
readme = { text = "A short inline description.\n\nSecond paragraph.", content-type = "text/markdown" }
```

And the two subkeys cannot coexist:

> *"These keys are mutually-exclusive, thus tools MUST raise an error if the metadata specifies both keys."*

```toml
[project]
# 🔴 MUST be an error: file and text together
readme = { file = "README.md", text = "fallback", content-type = "text/markdown" }
```

The `charset` parameter goes inside the content-type string, MIME-style, and defaults to UTF-8:

```toml
[project]
readme = { file = "README.rst", content-type = "text/x-rst; charset=UTF-8" }
```

### The three content types PyPI renders

`text/markdown`, `text/x-rst` and `text/plain`. Anything else, or an unparseable body, and PyPI falls back to showing your markup as text. Because you cannot re-upload a version, **the fix is always "release again"**, which is why this is worth getting right the first time.

## How the two map into metadata

| `[project]` key | Core metadata field | Where a user sees it |
|---|---|---|
| `description` | `Summary` | PyPI search results, `pip show`, dependency listings |
| `readme` (body) | `Description` | the PyPI project page |
| `readme` (content-type) | `Description-Content-Type` | how PyPI decides to render the above |

The names are inverted relative to intuition — `description` becomes `Summary`, `readme` becomes `Description` — which is a leftover from the distutils keyword arguments (`description` and `long_description`). It is the single most common source of "which field am I editing" confusion, and there is no way around it but to remember it.

## Making the readme without duplicating it

Backends can assemble the body from more than one file, which is how projects put the changelog on the project page:

```toml
[project]
name = "invoice-service"
version = "0.4.2"
dynamic = ["readme"]

[tool.setuptools.dynamic]
readme = { file = ["README.md", "CHANGELOG.md"], content-type = "text/markdown" }
```

That is the setuptools spelling from its own documentation:

> *"When these fields are expected to be provided by `setuptools` a corresponding entry is required in the `tool.setuptools.dynamic` table. For example: version = {attr = "my_package.__version__"} [and] readme = {file = ["README.rst", "USAGE.rst"]}"*

Two constraints come with it. First, `readme` must be listed in `dynamic` and absent from `[project]`, or the backend is being asked to fill a key you already filled — see **[13 · Dynamic metadata](13-dynamic-metadata.md)**. Second, concatenation is textual: two Markdown files each starting with an `# H1` produce a page with two top-level headings, and relative links in the second file are still relative to the second file's original location, which is not where PyPI is rendering them from.

## Relative links and images break on PyPI, always

Your readme is rendered on `pypi.org`, not in your repository. Every relative reference resolves against PyPI's URL space, where nothing of yours exists:

```markdown
<!-- in the repository: fine. On PyPI: broken image, broken link. -->
![coverage](docs/img/coverage.svg)
See [the contributing guide](CONTRIBUTING.md).
```

```markdown
<!-- absolute, so it works in both places -->
![coverage](https://raw.githubusercontent.com/example/invoice-service/main/docs/img/coverage.svg)
See [the contributing guide](https://github.com/example/invoice-service/blob/main/CONTRIBUTING.md).
```

GitHub rewrites relative links for you inside a repository view, which is exactly why this defect is invisible until the package is published. There is no metadata setting that fixes it; the readme has to be written with absolute URLs.

## Gotchas

**★ Symptom: your PyPI project page shows raw Markdown — hashes, asterisks, unrendered links.** Cause: `Description-Content-Type` is missing or not one of the types PyPI renders, usually because the readme's suffix is not `.md` or `.rst` and the string form gave the backend nothing to infer from. Fix: state it explicitly with the table form, then cut a new release — the published version cannot be re-rendered.

```toml
[project]
readme = { file = "README.txt", content-type = "text/markdown" }
```

**★ Symptom: `pip install .` fails with an error about the readme table.** Cause: the table form without `content-type`, which is a MUST-level error — *"A tool MUST raise an error if the metadata does not specify this key in the table."* Fix: add the key, or switch to the string form and let the `.md` suffix carry it.

```toml
[project]
readme = { file = "README.md", content-type = "text/markdown" }
```

**★ Symptom: build fails complaining about mutually exclusive readme keys.** Cause: `file` and `text` in the same table. Fix: choose one. `text` is for a readme short enough to inline; `file` for everything else.

**★ Symptom: your `Summary` on PyPI is truncated mid-sentence or contains a stray newline.** Cause: a multi-line `description`. The spec only says tools *MAY* error, so a backend is free to accept it and pass a string with an embedded newline into a single-line metadata field. Fix: one line, and move the rest into the readme.

```toml
[project]
description = "Issues, stores and reconciles customer invoices."
```

**★ Symptom: every image on your PyPI page is a broken-image icon.** Cause: relative paths in the readme, resolved against pypi.org. Fix: absolute `raw.githubusercontent.com` URLs (or any CDN), not repository-relative ones.

**★ Symptom: your sdist builds but the wheel has no readme, or the build fails saying `README.md` is missing.** Cause: the readme is referenced by a path relative to `pyproject.toml`, and the file was not included in the sdist — so a build *from the sdist* has nothing to read. Fix: make sure the backend includes it. For setuptools that is usually a `MANIFEST.in` entry or `[tool.setuptools]` config; for hatchling it is the `force-include`/`include` config. Verify by building an sdist and listing its contents before you publish, not after.

**★ Symptom: PyPI rejects the upload with a description-rendering error.** Cause: the body is not valid for the declared content type — the commonest case is `text/x-rst` with a Markdown body, because reStructuredText fails hard on constructs Markdown treats as ordinary text. Fix: match the declared type to the actual syntax. If you have a `.rst` file that started life as Markdown, convert it rather than relabelling it.

**★ Symptom: the readme renders, but a `<details>` block or an HTML table is stripped.** Cause: PyPI sanitises HTML in rendered descriptions, so raw HTML that GitHub renders may be removed. Fix: prefer pure Markdown constructs for anything load-bearing, and check the rendered page after the first release rather than assuming parity with GitHub.

**★ Symptom: `description` and the module docstring have drifted apart.** Cause: two hand-maintained copies of the same sentence. Fix: if your backend supports it, derive one from the other — flit reads the docstring when `description` is listed in `dynamic` — otherwise accept one as authoritative and delete the other.

## Interview questions

**★ Why is `description` the short one and `readme` the long one, when the metadata field for the readme is called `Description`?**
It is historical. distutils' `setup()` took `description` for the one-liner and `long_description` for the body, and those mapped to the core metadata fields `Summary` and `Description`. PEP 621 kept the *keyword* names for continuity — `description` still means the summary — while renaming `long_description` to the more obvious `readme`. So the `[project]` key `description` becomes `Summary`, and the `[project]` key `readme` becomes `Description` plus `Description-Content-Type`. Nothing about it is logical; it just has to be known, because the mismatch is exactly where people edit the wrong key.

**★ When would you use the table form of `readme` rather than a plain string?**
Whenever the string form cannot express what you need: a readme whose suffix is not `.md` or `.rst` (the only two suffixes with a MUST-level content-type mapping), a non-UTF-8 file needing an explicit `charset`, or an inline description with no file at all via the `text` subkey. The cost of the table form is that `content-type` becomes mandatory — a tool MUST error without it — which is a feature: it makes the rendering decision explicit rather than inferred from a filename.

**★ A project's PyPI page shows unrendered Markdown. Diagnose it.**
The `Description-Content-Type` in the published metadata is not `text/markdown`. Three likely causes: the `readme` key names a file whose suffix is neither `.md` nor `.rst`, so no content type was inferred; the table form was used with a wrong or misspelled content type; or the project is still publishing from a `setup.py` that sets `long_description` without `long_description_content_type`. The important part of the answer is what happens next — metadata on PyPI is immutable per release, so the only fix is a new version. You cannot re-render an existing one.

**★ Why do images in a readme work on GitHub and break on PyPI?**
Because GitHub rewrites repository-relative paths against the repository's own raw content host when it renders a readme in situ, and PyPI has no repository to rewrite against — the same relative path resolves against `pypi.org`, where the file does not exist. There is no packaging-level fix, because the readme is shipped as a blob of Markdown with no base URL attached. Absolute URLs are the only portable answer.

**★ Is it safe to concatenate README and CHANGELOG into the description?**
Mechanically yes — setuptools documents `readme = {file = ["README.rst", "USAGE.rst"]}` — but it is textual concatenation, so you inherit two problems. Both files' heading levels land in one document, giving you two `H1`s and a project page that outlines badly; and any relative link in the appended file is now even further from anything that resolves. It is worth doing when the changelog is genuinely what visitors want first, and worth skipping otherwise, since a `Changelog` entry in `[project.urls]` achieves the same discovery with none of the breakage.

**★ Where does the readme file have to live for a build from an sdist to work?**
At the path given, relative to `pyproject.toml` — which means the file must actually be *inside the sdist*, not merely inside your working tree. This is the failure mode that only appears in a release pipeline: `pip install .` works from a checkout because the file is there, and the same build from the uploaded sdist fails because the backend's default file selection did not include it. Building the sdist and inspecting it is the only way to catch it before a user does.

---

← Prev: [04 · version and requires-python](04-version-and-requires-python.md) · [Topic index](README.md) · Next → [06 · dependencies and markers](06-dependencies-and-markers.md)
