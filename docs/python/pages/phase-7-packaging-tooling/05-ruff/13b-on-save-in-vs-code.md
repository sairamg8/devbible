---
title: "On save, VS Code should run exactly the pipeline CI checks — ruff's safe fixes, import sorting, then the formatter — which takes ruff named as the only Python formatter, the `.ruff`-scoped code actions so no other extension joins in, and separate keys for Markdown and notebooks, which `[python]` does not reach"
sidebar_label: "13b · On save in VS Code"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Editors: Features* (raw Markdown at the `0.16.6` tag, [docs.astral.sh](https://docs.astral.sh/ruff/editors/features/)),
> the *FAQ* on notebooks ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)); the `astral-sh/ruff-vscode` README at **2026.78.0**
> ([github.com](https://github.com/astral-sh/ruff-vscode/blob/2026.78.0/README.md)).
> Version spine: **ruff 0.16.6** (2026-09-03) · uv 0.12.12 · Python 3.14.7 · pre-commit 4.6.2 · `charliermarsh.ruff` 2026.78.0.
> Documentation-validated — **no sandbox run, no program output**.

**[13](13-editor-integration.md) made the editor run the project's ruff with the project's
configuration. What it runs *on save* is a separate decision, and the one that decides whether a
developer's saved file passes CI. CI checks two things — no remaining violations, no formatting
change ([11](11-ruff-in-ci.md)) — so save should produce both: apply the safe fixes, sort the
imports, format. In VS Code that is three settings, and each has a way to go wrong: another
formatter registered for Python, a generic `source.fixAll` that invites every extension's fixer,
and notebooks and Markdown that need keys of their own.**

## Save in VS Code: fix, sort, format

```json
{
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.ruff": "explicit",
      "source.organizeImports.ruff": "explicit"
    }
  }
}
```

- **`editor.defaultFormatter`** makes ruff the formatter for Python files. Without it, VS Code
  picks among every installed extension that registers a Python formatter — Black's extension,
  autopep8's — and CI's `ruff format --check` disagrees with whichever it picked.
- **`source.fixAll.ruff`**, not `source.fixAll`. The README: *"If you'd like to run Ruff on-save,
  but avoid allowing other extensions to run on-save, you can use Ruff's scoped `source.fixAll`
  and `source.organizeImports` actions"*. The unscoped name asks *every* provider of a fix-all action
  to run.
- **Fix all applies safe fixes only.** *"By default, the "Fix all" action will not apply unsafe
  fixes. However, unsafe fixes can be applied manually with the "Quick fix" action."* Setting
  `unsafe-fixes = true` in the configuration changes that — for the CLI as well
  ([05](05-fixes-and-fix-safety.md)).
- **Organize imports is the `I001` fix** ([10](10-import-sorting.md)). The README notes that
  anyone who sorts imports in the editor *"and also expect[s] to run Ruff from the command line"*
  should have `I` enabled; since 0.16.0 `I001` is in the default rule set, so a configuration
  without a `select` already agrees — one that sets `select` must include `I`.

### Keeping another formatter or sorter on purpose

The README shows both arrangements. Ruff fixes, Black formats:

```json
{
  "[python]": {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll": "explicit"
    },
    "editor.defaultFormatter": "ms-python.black-formatter"
  }
}
```

Ruff lints, the isort extension sorts — ruff's import organiser switched off:

```json
{
  "[python]": {
    "editor.codeActionsOnSave": {
      "source.fixAll": "explicit",
      "source.organizeImports": "explicit"
    }
  },
  "ruff.organizeImports": false
}
```

Either one is only coherent if CI checks with the same tool; a project that migrated to
`ruff format` ([07b](07b-migrating-from-black.md)) should not keep the first. And to keep ruff's
diagnostics but have no formatting on save at all: *"be sure to unset the
`editor.defaultFormatter`"* — `"editor.defaultFormatter": null`.

### Markdown and notebooks need their own keys

Markdown code blocks are formatted by the same formatter since 0.16.0 ([07g](07g-docstring-and-markdown-code.md)),
but VS Code applies `[python]` settings only to Python files:

```json
{
  "[markdown]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.formatOnSaveMode": "file"
  }
}
```

`formatOnSaveMode: "file"` because *"Ruff does not support range formatting for Markdown files"*;
ruff touches only the fenced Python blocks, and any other Markdown formatter has to be run
separately.

Notebooks do not take the `source.*` actions at all — the FAQ: *"Ruff does not support
`source.organizeImports` and `source.fixAll` code actions in Jupyter Notebooks"* — and use the
`notebook.source.*` names instead:

```json
{
  "notebook.formatOnSave.enabled": true,
  "notebook.codeActionsOnSave": {
    "notebook.source.fixAll": "explicit",
    "notebook.source.organizeImports": "explicit"
  },
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff"
  }
}
```

The README notes these *"will run the action for each cell individually"*; the *Ruff: Fix all
auto-fixable problems* and *Ruff: Format Imports* commands act on the whole notebook.

## Gotchas

**★ Symptom: every save produces a formatting diff that CI's `ruff format --check` then rejects —
or accepts only after a second save.** Cause: another extension is the Python formatter (Black's,
or VS Code chose one because none was named). Fix: name ruff.

```json
{
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff"
  }
}
```

**★ Symptom: saving triggers fixes from an extension nobody configured — another linter's
autofixes land alongside ruff's.** Cause: `"source.fixAll": "explicit"` runs every provider's
fix-all action. Fix: use ruff's scoped actions.

```json
{
  "[python]": {
    "editor.codeActionsOnSave": {
      "source.fixAll.ruff": "explicit",
      "source.organizeImports.ruff": "explicit"
    }
  }
}
```

**Symptom: fix-on-save leaves a violation that `ruff check --fix --unsafe-fixes` would fix.**
Cause: *"By default, the "Fix all" action will not apply unsafe fixes."* Fix: apply that one with
*Quick fix*, or — as a project decision that also changes the CLI — enable unsafe fixes in the
configuration.

```toml
[tool.ruff]
unsafe-fixes = true
```

**Symptom: fix-on-save works in `.py` files and does nothing in notebooks.** Cause: notebooks do
not support the `source.fixAll`/`source.organizeImports` actions. Fix: the notebook keys.

```json
{
  "notebook.codeActionsOnSave": {
    "notebook.source.fixAll": "explicit",
    "notebook.source.organizeImports": "explicit"
  }
}
```

**Symptom: Python blocks in a README are formatted when the command is run by hand, never on
save.** Cause: the `[python]` block does not apply to Markdown, and range formatting — which a
modifications-only save mode asks for — is unsupported for Markdown. Fix: a `[markdown]` block with
`formatOnSaveMode: "file"`.

```json
{
  "[markdown]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.formatOnSaveMode": "file"
  }
}
```

## Interview questions

**★ How should format- and fix-on-save be configured so a saved file passes CI?**
Make ruff the only Python formatter (`editor.defaultFormatter: "charliermarsh.ruff"`), turn on
`formatOnSave`, and run `source.fixAll.ruff` and `source.organizeImports.ruff` as save actions.
That reproduces CI's two checks — no fixable violations left, formatting stable — with the same
binary and configuration as CI, provided [13](13-editor-integration.md)'s environment and
preference settings are in place. Violations without a safe fix still remain, and CI will still
report them.

**★ Why use `source.fixAll.ruff` rather than `source.fixAll`?**
The unscoped action is a request to every extension that provides a fix-all action, so installing
any other linter extension silently adds its fixes to every save. The `.ruff`-scoped actions run
only ruff's, which keeps the save pipeline equal to what CI checks.

**Why do notebooks and Markdown need separate editor settings?**
VS Code scopes settings by language, and `[python]` does not cover Markdown; notebooks, for their
part, do not support the `source.fixAll` and `source.organizeImports` actions and use
`notebook.source.*` equivalents, applied cell by cell. Markdown also cannot be range-formatted by
ruff, so format-on-save must format the whole file.

---

← Prev: [13 · Editor integration](13-editor-integration.md) · [Topic index](README.md) · Next → [13c · Pyright and other editors](13c-pyright-and-other-editors.md)
