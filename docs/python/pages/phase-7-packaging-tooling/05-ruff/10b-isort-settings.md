---
title: "ruff's isort settings live in `[tool.ruff.lint.isort]`, spelled in kebab-case, and fall into two groups — the classification overrides (`known-first-party`, `known-third-party`, `known-local-folder`) that correct the filesystem lookup, and the layout switches, several of which fight the formatter; a `[tool.isort]` table is never read, so a migration that leaves it behind silently loses every setting in it"
sidebar_label: "10b · isort settings"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — settings reference for the `lint.isort` options
> ([docs.astral.sh](https://docs.astral.sh/ruff/settings/#lintisort)), doc comments in `crates/ruff_workspace/src/options.rs` at the `0.16.6` tag
> (names, defaults and the `known-first-party`, `required-imports`, `lines-after-imports` and `lines-between-types` descriptions);
> `#[serde(deny_unknown_fields, rename_all = "kebab-case")]` on the option structs in the same file; the *FAQ* on isort and first-party detection
> ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)); *The Ruff Formatter: Conflicting lint rules* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/#conflicting-lint-rules)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> The behaviour of the layout switches, and the `false` defaults of the four boolean ones, are described as isort defines the options ruff mirrors; for ruff itself only their names, and the defaults of `detect-same-package` and `split-on-trailing-comma`, were confirmed for this page.
> isort's own option names (`[tool.isort]`, `known_first_party`, `src_paths`, `profile`) are cited from isort's configuration, not re-read.
> Documentation-validated — **no sandbox run, no program output**.

**Most projects need zero isort settings: the default sections, the default `src` roots and the
Black-compatible layout are right for a flat or `src` layout. The settings exist for the two
situations where the defaults are wrong. Either ruff classifies a module into the wrong section —
fixed with one of the `known-*` lists, which override the filesystem lookup — or the team wants a
different layout inside the import block, which is where the formatter conflicts from
[08b](08b-isort-settings-and-the-fix-format-loop.md) come from. Everything lives in one table, in
kebab-case, and nothing in `[tool.isort]` is read.**

## Where they live

```toml
[tool.ruff.lint.isort]
known-first-party = ["billing"]
```

The table is `[tool.ruff.lint.isort]` (in `ruff.toml`: `[lint.isort]`). ruff's option structs are
declared with serde's `deny_unknown_fields` and `rename_all = "kebab-case"`, so an isort-style
underscore key — `known_first_party` — is not a typo ruff forgives: it is an unknown field, and
the configuration fails to parse ([02b](02b-config-overrides-and-inspection.md)). ruff also never
reads `[tool.isort]`; a table left there after a migration configures nothing.

## Classification overrides

> *"A list of modules to consider first-party, regardless of whether they can be identified as such via introspection of the local filesystem."*
> — [settings: `lint.isort.known-first-party`](https://docs.astral.sh/ruff/settings/#lint_isort_known-first-party)

The `known-*` lists win over the `src` lookup from [10](10-import-sorting.md). Use them when the
lookup cannot give the right answer, and prefer fixing `src` when it can — `src` fixes every
module under a root at once, a `known-first-party` entry fixes one name.

| Setting | Use it when |
|---|---|
| `known-first-party` | your package is not under any `src` root (and moving the root is not an option) — installed from elsewhere, generated, or vendored. Supports globs. |
| `known-third-party` | a local directory shadows a third-party name — the FAQ's `wandb` case |
| `known-local-folder` | modules that should sort into the local-folder section though they are imported absolutely |
| `detect-same-package` (default `true`) | leave it on: imports from the importing file's own package (found through its `__init__.py` files) count as first-party even outside `src` |

```toml
[tool.ruff]
src = ["services/*"]

[tool.ruff.lint.isort]
known-first-party = ["billing_*"]      # glob: billing_api, billing_worker, billing_shared
known-third-party = ["wandb"]
```

## Section order

`section-order` defaults to `["future", "standard-library", "third-party", "first-party",
"local-folder"]`. It is rarely worth changing — every reader of Python expects that order — but
when a team insists on first-party imports above third-party ones, it is one line:

```toml
[tool.ruff.lint.isort]
section-order = ["future", "standard-library", "first-party", "third-party", "local-folder"]
```

## Required imports

> *"Add the specified import line to all files."*
> — [settings: `lint.isort.required-imports`](https://docs.astral.sh/ruff/settings/#lint_isort_required-imports)

```toml
[tool.ruff.lint.isort]
required-imports = ["from __future__ import annotations"]
```

The rule that enforces it is `I002` (`missing-required-import`) — not in the default set, so it
must be selected — and its fix inserts the line. For the `__future__` case specifically, ruff
0.13.0 added a narrower tool: with `lint.future-annotations` enabled, *"Several rules can now add
`from __future__ import annotations` automatically"* — the import arrives as part of the fix
that needs it, rather than in every file.

```toml
[tool.ruff.lint]
extend-select = ["I002"]
```

## Layout switches

| Setting | Default | What it changes | Formatter-safe? |
|---|---|---|---|
| `force-single-line` | `false` | one imported name per `from` line | on the formatter's list of settings to avoid ([08b](08b-isort-settings-and-the-fix-format-loop.md)) |
| `force-wrap-aliases` | `false` | a `from` import with an alias wraps one name per line | conflicts when `format.skip-magic-trailing-comma = true` |
| `combine-as-imports` | `false` | `as` imports combine onto the module's `from` line | yes |
| `force-sort-within-sections` | `false` | `import x` and `from x import y` sorted together by module, not plain imports first | yes |
| `split-on-trailing-comma` | `true` | a trailing comma keeps a parenthesised import exploded | conflicts when `format.skip-magic-trailing-comma = true` |
| `lines-after-imports` | — | blank lines after the import block | only `-1`, `1`, `2` |
| `lines-between-types` | — | blank lines between `import x` and `from x import` lines | only `0`, `1` |

The `false` defaults are the isort defaults ruff mirrors; `split-on-trailing-comma = true` is
confirmed from ruff's own reference; `—` marks a default not confirmed for this page. Check
`ruff check --show-settings` for the resolved values rather than trusting a number from memory.

## Translating a `[tool.isort]` table

| isort | ruff | Note |
|---|---|---|
| `profile = "black"` | *(nothing)* | ruff's output is designed to match it |
| `known_first_party = ["billing"]` | `[tool.ruff.lint.isort] known-first-party = ["billing"]` | kebab-case |
| `known_third_party` | `known-third-party` | kebab-case |
| `src_paths = ["src", "tests"]` | `[tool.ruff] src = ["src", "tests"]` | top-level, not in the isort table |
| `line_length` | `[tool.ruff] line-length` | top-level, shared with the formatter |
| `force_sort_within_sections` | `force-sort-within-sections` | kebab-case |
| `skip`, `extend_skip` | `[tool.ruff] extend-exclude` | globs; applies to all of ruff, not just sorting |

After translating, delete `[tool.isort]` and isort itself — its dependency entry and its
pre-commit hook. Two tools sorting the same imports with different notions of first-party is the
import-order version of running two formatters.

## Gotchas

**★ Symptom: after copying the `[tool.isort]` keys into `[tool.ruff.lint.isort]`, ruff exits
with a configuration parse error.** Cause: isort spells options with underscores; ruff's option
structs are kebab-case and reject unknown fields. Fix: rename every key.

```toml
[tool.ruff.lint.isort]
known-first-party = ["billing"]
force-sort-within-sections = true
```

**★ Symptom: after replacing isort with ruff, first-party imports moved into the third-party
section.** Cause: the old `[tool.isort]` table — with its `known_first_party` and `src_paths` —
is still there and is never read by ruff. Fix: translate it, then delete it.

```toml
[tool.ruff]
src = ["src", "tests"]

[tool.ruff.lint.isort]
known-first-party = ["billing"]
```

**★ Symptom: `required-imports` is configured, yet no file gained the import.** Cause:
`required-imports` only configures rule `I002`, which is not in the default set. Fix: select it
and run the fix.

```bash
uv run ruff check --select I002 --fix .
```

**Symptom: after `force-single-line = true`, `ruff format` and the import fix keep changing the
same import lines.** Cause: `force-single-line` is on the formatter page's list of isort settings
to avoid alongside the formatter. Fix: turn it off, or — if single-line imports are a hard
requirement — run the settledness check from [08b](08b-isort-settings-and-the-fix-format-loop.md)
before committing to it.

```toml
[tool.ruff.lint.isort]
force-single-line = false
```

**Symptom: a `known-first-party` list keeps growing by one entry every time a new service is
added to the monorepo.** Cause: the services live outside the default `src` roots, and each one
is being patched by name. Fix: make the roots known once, with a glob, and delete the list.

```toml
[tool.ruff]
src = ["services/*/src"]
```

**Symptom: turning `detect-same-package` off moved a package's own sibling imports into the
third-party section.** Cause: those modules were found only through the same-package heuristic,
not through `src`. Fix: turn it back on, or add the package root to `src`.

```toml
[tool.ruff.lint.isort]
detect-same-package = true
```

## Interview questions

**★ When should you use `known-first-party` rather than `src`?**
Prefer `src`: it tells ruff where your code lives, so every module under that root is classified
correctly, including ones added later. `known-first-party` is a per-name override for modules
the lookup cannot find — generated or vendored code, a package installed from elsewhere — and it
wins over the filesystem check. A `known-first-party` list that grows with every new package is a
sign the `src` roots are wrong.

**★ What happens to a `[tool.isort]` table when you switch to ruff?**
Nothing — ruff never reads it. Its settings must be translated into `[tool.ruff.lint.isort]`
(and `src_paths`/`line_length` into top-level `src`/`line-length`), with option names converted
to kebab-case because ruff rejects unknown keys. Leaving the old table in place silently loses
the settings and misleads the next reader, so it should be deleted along with isort's dependency
and hook.

**Which isort settings are risky with the formatter, and why?**
The ones that make `I001` produce a layout the formatter will not keep: `lines-after-imports`
outside `-1`/`1`/`2`, `lines-between-types` above `1`, `force-single-line`, and the trailing-comma
pair `force-wrap-aliases`/`split-on-trailing-comma` when the formatter ignores magic trailing
commas. With any of them, the fix and the formatter rewrite each other's output.

**How do you add `from __future__ import annotations` to every file with ruff?**
Configure `required-imports = ["from __future__ import annotations"]` and select `I002`, whose fix
inserts the line. If the goal is only to enable fixes that need postponed annotations, the
narrower `lint.future-annotations` setting (0.13.0) lets those rules add the import as part of
their fix, instead of adding it to every file.

---

← Prev: [10 · Import sorting](10-import-sorting.md) · [Topic index](README.md) · Next → [11 · ruff in CI](11-ruff-in-ci.md)
