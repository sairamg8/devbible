---
title: "Beside Pyright, ruff should own linting, import sorting and formatting and nothing else — and the documented way to silence Pyright's linting also silences its type checking; outside VS Code every editor starts `ruff server` by name, so the ruff it runs is whatever is first on `PATH` unless the server is started through the project"
sidebar_label: "13c · Pyright and other editors"
sidebar_position: 37
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Editors: Setup* (raw Markdown at the `0.16.6` tag, [docs.astral.sh](https://docs.astral.sh/ruff/editors/setup/))
> and *Settings* ([docs.astral.sh](https://docs.astral.sh/ruff/editors/settings/)); Pyright's configuration reference for `ignore`
> ([github.com](https://github.com/microsoft/pyright/blob/main/docs/configuration.md)).
> Version spine: **ruff 0.16.6** (2026-09-03) · **uv 0.12.12** · Python 3.14.7 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**ruff's language server deliberately does less than a Python language server: diagnostics, fixes,
import organisation, formatting. Everything else — types, navigation, completion — belongs to
Pyright, Pylance or another server running beside it, and the two overlap exactly where both can
report problems and both can organise imports. The ruff documentation's recipe for dividing the
work contains one setting that does far more than its comment says. Beyond VS Code, the server is
wired up by hand in each editor, and every recipe starts it with the bare command `ruff server` —
so which ruff answers depends on the editor's `PATH`, not on the project's lock.**

## Ruff beside Pyright or Pylance

Both servers report diagnostics, and both can organise imports. The setup page's Neovim example
hands each job to one of them: ruff's hover is turned off in favour of Pyright, and Pyright is
told to leave imports and linting to ruff:

```lua
vim.lsp.config('pyright', {
  settings = {
    pyright = {
      -- Using Ruff's import organizer
      disableOrganizeImports = true,
    },
    python = {
      analysis = {
        -- Ignore all files for analysis to exclusively use Ruff for linting
        ignore = { '*' },
      },
    },
  },
})
```

⚠️ Read the second setting before copying it. Pyright's `ignore` is *"Paths of directories or
files whose diagnostic output (errors and warnings) should be suppressed"* — **all** of Pyright's
diagnostics, type errors included. With `{ '*' }`, Pyright keeps navigation, completion and hover,
and stops type checking in the editor. That is a deliberate choice for a team that type-checks
only in CI; for everyone else, keep `disableOrganizeImports` and drop `ignore`.

## Other editors

Every editor below runs the same `ruff server`; what differs is where settings go and which binary
starts.

| Editor | Setup (from the setup page) | Settings go in |
|---|---|---|
| Neovim 0.11+ | `nvim/lsp/ruff.lua` returning `cmd = { 'ruff', 'server' }`, then `vim.lsp.enable('ruff')` | `init_options.settings` |
| Helix | `[language-server.ruff] command = "ruff"`, `args = ["server"]`; add `"ruff"` to the Python `language-servers` | `[language-server.ruff.config.settings]` |
| Zed | built in — *"By default, Zed uses Ruff for formatting and linting."* | `lsp.ruff.initialization_options.settings` |
| PyCharm 2025.3+ | *Python \| Tools \| Ruff* → Enable; execution mode **Interpreter** or **Path** | the dialog |
| Emacs | Eglot with `("ruff" "server")` | server init options |
| Kate | LSP Client *User Server Settings* | the JSON block — but *"Kate's LSP Client plugin does not support multiple servers for the same language"* |
| Sublime Text | the LSP and LSP-ruff packages | LSP-ruff's settings |

The Neovim configuration in full, from the setup page:

```lua
-- nvim/lsp/ruff.lua
---@type vim.lsp.Config
return {
  cmd = { 'ruff', 'server' },
  filetypes = { 'python' },
  root_markers = { 'pyproject.toml', 'ruff.toml', '.ruff.toml', '.git' },
  init_options = {
    settings = {
      -- Ruff language server settings go here
    }
  }
}
```

```lua
-- init.lua
vim.lsp.enable('ruff')
```

### `cmd = { 'ruff', 'server' }` runs the `ruff` on `PATH`

None of these editors has VS Code's environment lookup. The command is resolved like any other, so
the ruff that serves diagnostics is the first `ruff` on the editor's `PATH` — the project's `.venv`
one only if the editor was started from a shell with that environment activated, otherwise a
global install or nothing. Two ways to make it the project's:

```bash
source .venv/bin/activate && nvim .     # the environment's bin directory comes first on PATH
```

```lua
-- nvim/lsp/ruff.lua — let uv find the project from the working directory and run its locked ruff
return {
  cmd = { 'uv', 'run', '--no-sync', 'ruff', 'server' },
  filetypes = { 'python' },
  root_markers = { 'pyproject.toml', 'ruff.toml', '.ruff.toml', '.git' },
}
```

The second relies on `uv run` discovering the project from the directory the server is started
in ([`uv run`](../02-uv/04c-uv-run.md)); an editor launched outside the project will not find it.
In PyCharm the same choice is the execution mode: **Interpreter** uses the project interpreter's
ruff, **Path** uses `$PATH`.

## Gotchas

**★ Symptom: after copying the Neovim Pyright snippet, type errors no longer appear in the editor.**
Cause: `python.analysis.ignore = { '*' }` suppresses all of Pyright's diagnostics for every file.
Fix: keep Pyright's diagnostics; hand only import organising to ruff.

```lua
vim.lsp.config('pyright', {
  settings = {
    pyright = { disableOrganizeImports = true },
  },
})
```

**Symptom: in Neovim or Helix, ruff reports rules the project does not enable — or an error about
the required version.** Cause: `cmd = { 'ruff', 'server' }` started a global ruff, because the
editor was not launched with the project environment on `PATH`. Fix: start the server through the
project.

```lua
cmd = { 'uv', 'run', '--no-sync', 'ruff', 'server' },
```

**Symptom: opening and saving an old file in Zed reformats all of it.** Cause: in Zed ruff is the
default formatter and *"`format_on_save` is enabled by default"*. Fix: land the reformat as its
own commit ([07b](07b-migrating-from-black.md)), or turn it off for Python until then.

```json
{
  "languages": {
    "Python": {
      "format_on_save": "off"
    }
  }
}
```

**Symptom: in Kate, adding ruff removed Pyright's completions.** Cause: Kate's LSP client runs one
server per language. Fix: the setup page's workaround — `python-lsp-server` with the
`python-lsp-ruff` plugin — which uses the `ruff` executable rather than `ruff server`, so the
server settings on these pages do not apply to it.

## Interview questions

**How do you run ruff and Pyright together without duplicated work, and what is the trap?**
Split responsibilities: ruff lints, organises imports and formats; Pyright type-checks and provides
navigation, completion and hover. The ruff documentation's example disables Pyright's import
organiser and ruff's hover. Its further suggestion — `python.analysis.ignore = ['*']` — suppresses
every Pyright diagnostic, type errors included, so it should be copied only by a team that wants no
type checking in the editor.

**Why does a Neovim or Helix setup sometimes run a different ruff from the project's?**
Their configuration starts the server with the command `ruff server`, resolved on the editor's
`PATH`. Unless the editor was launched with the project's environment activated, that is a global
ruff or none at all. Starting the server through `uv run ruff server`, or launching the editor from
an activated environment, makes it the locked ruff; PyCharm expresses the same choice as its
*Interpreter* versus *Path* execution mode.

**★ How do you set up `ruff server` in an editor other than VS Code, and where do its settings
go?**
Register a language server whose command is `ruff server` for Python files — `vim.lsp.config` plus
`vim.lsp.enable('ruff')` in Neovim 0.11+, a `[language-server.ruff]` entry in Helix's
`languages.toml`, Eglot's server list in Emacs; Zed has it built in and PyCharm 2025.3+ has a
settings page. Server settings — line length, rule selection, log level — are passed as
initialisation options (`init_options.settings`, `config.settings`, `initialization_options.settings`),
using the same names as VS Code's `ruff.*` settings. The project's own configuration file still
applies; the editor settings follow the same resolution order and `configurationPreference` as in
VS Code.

---

← Prev: [13b · On save in VS Code](13b-on-save-in-vs-code.md) · [Topic index](README.md) · Next → [14 · Upgrading ruff safely](14-upgrading-ruff.md)
