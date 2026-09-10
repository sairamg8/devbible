---
title: "The editor runs its own ruff with its own settings unless you stop it — the VS Code extension silently falls back to a bundled binary when it finds none in the environment, editor-level settings override `pyproject.toml` by default, and one leftover `ruff.lint.args` quietly swaps in the deprecated server; point it at the project's ruff and the project's configuration and it becomes the same check CI runs"
sidebar_label: "13 · Editor integration"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Editor Integrations*, *Setup*, *Settings* and *Features* (raw Markdown at the `0.16.6` tag:
> [docs.astral.sh](https://docs.astral.sh/ruff/editors/), [setup](https://docs.astral.sh/ruff/editors/setup/),
> [settings](https://docs.astral.sh/ruff/editors/settings/), [features](https://docs.astral.sh/ruff/editors/features/));
> the `astral-sh/ruff-vscode` README and `pyproject.toml` at **2026.78.0** ([github.com](https://github.com/astral-sh/ruff-vscode/tree/2026.78.0));
> *Versioning: Visual Studio Code Extension* ([docs.astral.sh](https://docs.astral.sh/ruff/versioning/)).
> Extension release checked on its releases page on **2026-09-10**: `charliermarsh.ruff` **2026.78.0** (2026-09-03, bundles `ruff==0.16.6`).
> Version spine: **ruff 0.16.6** (2026-09-03) · uv 0.12.12 · Python 3.14.7 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**CI and pre-commit run ruff when asked; the editor runs it on every keystroke, which makes it
the consumer developers trust most and the one least likely to be running the project's ruff with
the project's configuration. Two independent choices decide what the editor shows. Which
*binary*: the VS Code extension looks for ruff in the selected environment and, finding none,
falls back without comment to the copy it bundles — the newest ruff release, not the locked one.
Which *configuration*: editor-level settings such as `ruff.lineLength` outrank `pyproject.toml`
by default, so a user setting made for one project reformats every other. Get both right and the
editor is a faster copy of CI; get either wrong and it is a second, disagreeing linter. This page
is those two choices; [13b](13b-on-save-in-vs-code.md) is what runs on save, and
[13c](13c-pyright-and-other-editors.md) living alongside Pyright and editors other than VS Code.**

## One language server, many editors

> *"The editor integration is mainly powered by the Ruff Language Server which implements the Language Server Protocol. The server is written in Rust and is available as part of the `ruff` CLI via `ruff server`. It is a single, common backend built directly into Ruff, and a direct replacement for `ruff-lsp`, our previous language server."*
> — [Editor Integrations](https://docs.astral.sh/ruff/editors/)

`ruff server` was *"available first in Ruff v0.4.5 in beta and stabilized in Ruff v0.5.3"*. It
provides diagnostics, code actions (fix, fix all, organise imports, add a `# noqa`), formatting
and hover documentation for `noqa` codes — and nothing else: *"Currently, the server is intended to
be used alongside another Python Language Server in order to support features like navigation and
autocompletion."* ruff is the linter and formatter in the editor; Pyright, Pylance or another
server remains the one that knows types.

Because the server *is* the `ruff` binary, the version question from [12](12-pinning-ruff.md)
applies directly: the diagnostics you see are those of whichever `ruff` the editor started.

## Which binary VS Code runs

| Setting | Default | What it decides |
|---|---|---|
| `ruff.importStrategy` | `"fromEnvironment"` | *"`fromEnvironment` finds Ruff in the environment, falling back to the bundled version"* · *"`useBundled` uses the version bundled with the extension"* |
| `ruff.path` | `[]` | *"A list of path to `ruff` executables. The first executable in the list which is exists is used. This setting takes precedence over the `ruff.importStrategy` setting."* |
| `ruff.interpreter` | `[]` | with the native server, the interpreter *"used to find the `ruff` executable when `ruff.importStrategy` is set to `fromEnvironment`"*; *"only the first interpreter is used"* |
| `ruff.nativeServer` | `"auto"` | native server vs the deprecated `ruff-lsp` — see below |

How "the environment" is found is in the extension's README:

> *"When either of these is available, the Ruff extension uses it to locate the Ruff binary in the active environment. If no binary is found there, or both extensions are unavailable, Ruff falls back to the Ruff binary found on the `PATH` or bundled with the extension."*
> — [ruff-vscode README](https://github.com/astral-sh/ruff-vscode/blob/2026.78.0/README.md)

"Either of these" is the Python Environments extension or the Python extension. So the default
chain is: the selected interpreter's environment, then `PATH`, then the bundled binary. The last
step is silent, and the bundled binary is not a fixed old version — the extension's release
automation *"intentionally tracks the latest Ruff"*, and 2026.78.0 shipped with `ruff==0.16.6` on
the day ruff 0.16.6 was released. On a machine where nobody ran `uv sync`, the editor is running
ruff's newest release against a configuration written for the locked one.

The fix is not a setting; it is an environment the extension can find:

```bash
uv sync                  # creates .venv with the locked ruff in it
```

then select `.venv`'s interpreter in VS Code (*Python: Select Interpreter*). With
`required-version = "==0.16.6"` in the configuration, a fallback to a different bundled ruff stops
being silent: it fails to load the configuration instead
([12b](12b-required-version-and-keeping-pins-in-step.md)).

### Untrusted workspaces use the bundled binary, always

> *"When the workspace is untrusted, the extension will always use the Rust-based language server even if the `nativeServer` setting is set to `off`. … This also means that the extension will always use the bundled executable of the `ruff` binary regardless of any other settings."*

`ruff.configuration`, `ruff.importStrategy`, `ruff.interpreter` and `ruff.path` are listed as not
supported there. A repository opened in restricted mode is linted by the extension's ruff, whatever
the project pins.

### `nativeServer` and the deprecated `ruff-lsp`

`"auto"` picks the native server *"If the Ruff version is >= `0.5.3` … unless any deprecated
settings are detected. In that case, show a warning and use `ruff-lsp` instead."* The deprecated
settings are the ones the settings page marks *"This setting is not used by the native language
server"* — `ruff.lint.args`, `ruff.format.args`, `ruff.lint.run` and `ruff.ignoreStandardLibrary`. One
`"ruff.lint.args": ["--extend-select=UP"]` left in a user's settings from an old guide moves that
user to the Python-based server that the README says *"is deprecated and will be removed in a
future release"*. The native server's equivalents are the structured settings below, or better,
the project's own configuration.

## Which configuration VS Code uses

> *"In an editor, Ruff supports three sources of configuration, prioritized as follows (from highest to lowest): 1. **Specific settings:** Individual settings like `lineLength` or `lint.select` defined in the editor 2. **`ruff.configuration`**: Settings provided via the `configuration` field (either a path to a configuration file or an inline configuration object) 3. **Configuration file:** Settings defined in a `ruff.toml` or `pyproject.toml` file in the project's directory (if present)"*
> — [Settings: resolution order](https://docs.astral.sh/ruff/editors/settings/#configuration_resolution_order)

That order is governed by `ruff.configurationPreference`:

| Value | Meaning |
|---|---|
| `"editorFirst"` (default) | *"Editor settings take priority over configuration files present in the workspace."* |
| `"filesystemFirst"` | *"Configuration files present in the workspace takes priority over editor settings."* |
| `"editorOnly"` | *"Ignore configuration files entirely i.e., only use editor settings."* |

With the default, a `"ruff.lineLength": 100` put in *user* settings for one project applies to
every project that user opens, over each project's own `line-length`. The extension's README states
the intended arrangement:

> *"In general, we recommend configuring Ruff via `pyproject.toml` or `ruff.toml` so that your configuration is shared between the VS Code extension and the command-line tool, and between all contributors to the project."*

When `ruff.configuration` is unset the server does what the CLI does — *"load the settings from the
project's configuration (a `ruff.toml` or `pyproject.toml` in the project's directory), consistent
with when running Ruff on the command-line"* — including the user-level fallback file when a project
has none ([02](02-configuration-discovery.md)). `ruff.configuration` (a path, or since 0.9.8 an inline
JSON object) exists for projects without a configuration of their own; with `editorFirst` it would
override one that has.

### A workspace that pins the editor to the project

```json
// .vscode/settings.json — committed
{
  "ruff.importStrategy": "fromEnvironment",
  "ruff.configurationPreference": "filesystemFirst"
}
```

```json
// .vscode/extensions.json — committed
{
  "recommendations": ["charliermarsh.ruff"]
}
```

`filesystemFirst` does not remove anyone's editor settings; it makes the repository's configuration
win where both exist. `importStrategy` is already the default — stating it in the workspace file
overrides a user-level `useBundled`, since VS Code's workspace settings outrank user settings. What runs on save is [13b](13b-on-save-in-vs-code.md).

### Configuration changes need file watching

> *"The server relies on the file watching capabilities of the editor to detect changes to these files. If an editor does not support file watching, the server will not be able to detect changes to the configuration file and thus will not refresh the diagnostics."*
> — [Features: Dynamic Configuration](https://docs.astral.sh/ruff/editors/features/)

VS Code watches; some editors or remote setups may not. When diagnostics ignore an edit to
`pyproject.toml`, restart the server — in VS Code, *Ruff: Restart Server*. *Ruff: Print debug
information* (native server only) and the "Ruff Language Server" output channel are where the
README sends you to see what the server is doing.

## Gotchas

**★ Symptom: the editor underlines code that `uv run ruff check` and CI accept — or misses what
they flag.** Cause: no ruff in the selected environment, so the extension fell back to its bundled
binary, which tracks the newest release. Fix: create the environment and select its interpreter.

```bash
uv sync
```

**★ Symptom: format-on-save wraps lines at 100 columns, and CI's `ruff format --check` rejects the
file at 88.** Cause: `"ruff.lineLength": 100` in user settings, and `configurationPreference`
defaults to `editorFirst`, so the editor setting beats the project's `line-length`. Fix: delete
the editor-level setting, and make the repository's configuration win for everyone.

```json
{
  "ruff.configurationPreference": "filesystemFirst"
}
```

**★ Symptom: the extension warns about deprecated settings, and the editor is no longer running
`ruff server`.** Cause: a `ruff.lint.args` or `ruff.format.args` setting made `nativeServer:
"auto"` choose `ruff-lsp`. Fix: remove the deprecated settings and express the intent in the
project configuration.

```toml
[tool.ruff.lint]
extend-select = ["UP"]
```

**Symptom: in a freshly cloned repository the editor ignores `.vscode/settings.json` and the
`.venv` ruff.** Cause: the workspace is untrusted, and in an untrusted workspace the extension uses
its bundled binary and does not support `ruff.configuration`, `ruff.importStrategy`,
`ruff.interpreter` or `ruff.path`. Fix: trust the workspace (*Workspaces: Manage Workspace Trust*)
once you have decided to.

**Symptom: after editing `select` in `pyproject.toml`, the editor keeps showing the old
diagnostics.** Cause: the server refreshes on configuration changes only through the editor's file
watching, which this setup does not deliver. Fix: restart the server — *Ruff: Restart Server* in
VS Code — and prefer an editor setup that watches files.

**Symptom: every project on one developer's machine is linted with the same unusual rule set,
including projects that have their own configuration.** Cause: `ruff.configuration` points at a
personal `ruff.toml`, and under `editorFirst` it outranks each project's file. Fix: remove it, or
switch the preference so project files win.

```json
{
  "ruff.configurationPreference": "filesystemFirst"
}
```

## Interview questions

**★ Why can the editor and CI disagree about the same file, and what makes them agree?**
Two things can differ: the binary and the configuration. The VS Code extension runs the ruff it
finds in the selected environment, else one on `PATH`, else the bundled one, which tracks the latest
release; and editor-level settings outrank the project's configuration by default. Agreement
comes from a synced environment with the locked ruff selected as the interpreter, no editor-level
ruff settings (or `filesystemFirst`), and `required-version` so that a wrong binary fails instead
of disagreeing quietly.

**★ What does `configurationPreference` control, and why does its default matter for a team?**
It decides whether editor settings or the project's configuration files win when both define an
option. The default, `editorFirst`, lets a setting in one person's editor — a line length, a rule
selection — override the repository's configuration for every project they open, so their
format-on-save produces what CI rejects. `filesystemFirst` in a committed workspace settings file
makes the repository's configuration authoritative while still allowing editor settings where the
project is silent.

**What is `ruff server`, and why do you still need another language server?**
It is ruff's built-in Language Server Protocol implementation, part of the same `ruff` binary, and
the replacement for the Python-based `ruff-lsp`. It supplies ruff's diagnostics, fixes, import
organisation and formatting — ruff's job — and deliberately not navigation, completion or type
information. The documentation says it is meant to run alongside another Python language server,
such as Pyright or Pylance, which provides those.

**What changes when a repository is opened as an untrusted workspace in VS Code?**
The extension always uses the native server with its bundled ruff binary, and ignores the settings
that would point it elsewhere — `ruff.configuration`, `ruff.importStrategy`, `ruff.interpreter`,
`ruff.path`. The diagnostics are therefore those of the extension's ruff version, not the project's,
until the workspace is trusted.

---

← Prev: [12b · required-version and keeping pins in step](12b-required-version-and-keeping-pins-in-step.md) · [Topic index](README.md) · Next → [13b · On save in VS Code](13b-on-save-in-vs-code.md)
