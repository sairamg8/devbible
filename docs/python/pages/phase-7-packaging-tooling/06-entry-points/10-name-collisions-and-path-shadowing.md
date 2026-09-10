---
title: "A command name is global twice over — two packages in one environment that ship it leave one file owned by whoever installed last, and two directories on PATH that hold it are resolved by order and a shell hash table — so choose names nobody else ships, and diagnose with type -a before blaming the package"
sidebar_label: "10 · Name collisions and PATH shadowing"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the PyPA *Entry points specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)), pip **26.2.1** [`operations/install/wheel.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/_internal/operations/install/wheel.py) and [`req_uninstall.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/_internal/req/req_uninstall.py), uv **0.12.12** *Tools* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/tools/)), [CLI reference](https://docs.astral.sh/uv/reference/cli/), [CHANGELOG](https://github.com/astral-sh/uv/blob/0.12.12/CHANGELOG.md) and [`wheel.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv-install-wheel/src/wheel.rs), pipx **1.17.2** *Configure paths* and *Expose apps* ([pipx.pypa.io](https://pipx.pypa.io/stable/)) and [`commands/common.py`](https://github.com/pypa/pipx/blob/1.17.2/src/pipx/commands/common.py), and the GNU Bash manual — [Command Search and Execution](https://www.gnu.org/software/bash/manual/html_node/Command-Search-and-Execution.html), [`type`](https://www.gnu.org/software/bash/manual/html_node/Bash-Builtins.html), [`hash`](https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html).
> Target: **Python 3.14.7** · **uv 0.12.12** · **pipx 1.17.2** · ruff 0.16.6 · pre-commit 4.6.2. Documentation- and source-validated — **no sandbox run, no program output**.

**The entry-point specification makes command names unique only *within* one distribution. Across distributions it hands the problem to whoever reads the names — *"If different distributions provide the same name, the consumer decides how to handle such conflicts"* — and for console scripts the consumer is the installer, which writes one file per name into one directory. So a collision inside an environment is resolved by install order, silently. A collision *across* directories is resolved by the shell: the first match on `PATH`, unless an alias, a function, a builtin or a remembered location gets there first. And the tool installers that share `~/.local/bin` refuse to overwrite each other's files, so the failure there is a refusal instead of a silent swap. None of this is visible from inside Python; all of it is visible from the shell, if you ask the right question.**

## One environment, two packages, one name

The specification's only rules about script names concern case and uniqueness within a distribution:

> *"As files are created from the names, and some filesystems are case-insensitive, packages should avoid using names in these groups which differ only in case. The behaviour of install tools when names differ only in case is undefined."*
> — [entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/)

What the installers do when two distributions ship the same name:

- **pip 26.2.1** sets `maker.clobber = True` with the comment *"Ensure old scripts are overwritten."* The second install replaces the first package's wrapper without a message.
- **uv 0.12.12** writes every wrapper with `write_atomic_sync`, which replaces an existing file; no warning for this case appears in the source read for this page, and the documentation does not describe the behaviour — treat it as last-writer-wins, unconfirmed as policy.

Then uninstall makes it worse. pip removes script files by the entry-point names in the *uninstalled* distribution's metadata (`req_uninstall.py`), so uninstalling either package deletes the one shared file — including when it currently holds the *other* package's wrapper. The package still installed has lost its command, and nothing reinstalls it.

Names that collide with the environment itself are refused. uv rejects `python`, `pythonw`, `python3`, versioned `python3.N` names and more (`wheel.rs`, lines 163–168), and since 0.12.0 their case variants — *"On case-insensitive filesystems, including common macOS and Windows setups, these entry points could overwrite the virtual environment's interpreter."* uv 0.11.15 and pip both refuse names that would land outside the scripts directory.

## Many directories, one name: how the shell decides

Bash's lookup order, from *Command Search and Execution*: a shell function by that name first; *"If the name does not match a function, the shell searches for it in the list of shell builtins"*; then, for a name with no slash, *"Bash searches each element of `$PATH` for a directory containing an executable file by that name."* Aliases are expanded before any of that. So a console script named like a builtin or like one of your aliases never runs when typed bare.

And the `PATH` search is cached:

> *"Bash uses a hash table to remember the full pathnames of executable files to avoid multiple `PATH` searches … Bash performs a full search of the directories in `$PATH` only if the command is not found in the hash table."*
> — [Command Search and Execution](https://www.gnu.org/software/bash/manual/html_node/Command-Search-and-Execution.html)

> *"The -r option causes the shell to forget all remembered locations. Assigning to the `PATH` variable also clears all hashed filenames."*
> — [Bash manual — `hash`](https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html)

Activating a virtual environment assigns `PATH`, so it clears the table. Installing a command into a directory *earlier* on `PATH` than the one bash remembered does not — the shell keeps running the old one until `hash -r`.

The diagnostic that shows all of it:

> *"If the -a option is used, `type` returns all of the places that contain a command named name. This includes aliases, reserved words, functions, and builtins"*
> — [Bash manual — `type`](https://www.gnu.org/software/bash/manual/html_node/Bash-Builtins.html)

```bash
type -a invoice        # every alias, function, builtin and file named invoice, in lookup order
hash -r                # forget remembered locations after installing into an earlier PATH entry
echo "$PATH" | tr ':' '\n'
```

### Where the usual copies live

| Directory | Put there by | Typical position on `PATH` |
|---|---|---|
| `.venv/bin` | activation, `uv run` | first — activation and `uv run` prepend it |
| `~/.local/bin` | `pip install --user`, `pipx`, `uv tool install` | wherever your profile or `ensurepath`/`update-shell` put it |
| `/usr/local/bin`, `/opt/homebrew/bin` | system package managers, `pipx --global` | usually before `/usr/bin` |
| `/usr/bin` | the OS | late |

pipx's default is to add its directory without overriding the system — the documentation offers the opposite as an option: *"Pass ``--prepend`` to ``pipx ensurepath`` to prepend the pipx bin directory to ``PATH`` instead of appending it, so pipx-installed binaries win over system binaries of the same name."* So with the default, a system `invoice` beats the pipx one.

## Tool installers sharing one directory

`~/.local/bin` is shared by three installers, and the two tool managers refuse to trample each other:

> *"Installation of tools will not overwrite executables in the executable directory that were not previously installed by uv. For example, if `pipx` has been used to install a tool, `uv tool install` will fail. The `--force` flag can be used to override this behavior."*
> — [uv Tools](https://docs.astral.sh/uv/concepts/tools/)

uv's `--force` is documented as *"Will recreate any existing environment for the tool and replace any existing entry points with the same name in the executable directory."* pipx, in `_symlink_package_resource`, leaves a foreign file alone with *"File exists at … and points to …, not …. Not modifying."* — and, when the name was already reachable elsewhere, notes *"… was already on your PATH at …"*. To make another command win without uninstalling, pipx has `unexpose`: *"Use ``unexpose`` when another command with the same name should win, but you want to keep the environment"*.

`pip install --user` has no such guard; it is the pip behaviour above, into the same directory.

## Choosing a name

The specification recommends a character set — *"For new entry points, it is recommended to use only letters, numbers, underscores, dots and dashes (regex `[\w.-]+`)"* — and nothing about uniqueness, because nothing can enforce it. What avoids collisions in practice:

- **Prefix with the project.** `invoice-sync`, `invoice-export` — not `sync`, `export`.
- **Never reuse a system or shell name** — `test`, `time`, `kill`, `http`, `python`, `pip`.
- **Never ship two names that differ only in case** — the specification calls the result undefined.
- **Quote dotted names in TOML.** pytest ships `scripts."py.test" = "_pytest.config:_console_main"` in its `pyproject.toml`; unquoted, the dot would make nested tables.

Nothing checks for collisions across the packages in your own environment, so a CI step can — every console-script name claimed by more than one installed distribution:

```python
# tools/check_script_collisions.py
from collections import defaultdict
from importlib.metadata import distributions


def main() -> int:
    owners: dict[str, set[str]] = defaultdict(set)
    for dist in distributions():
        for ep in dist.entry_points.select(group="console_scripts"):
            owners[ep.name].add(dist.name)
    clashes = {name: who for name, who in owners.items() if len(who) > 1}
    for name, who in sorted(clashes.items()):
        print(f"{name}: {', '.join(sorted(who))}")
    return 1 if clashes else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

```bash
uv run --locked python tools/check_script_collisions.py
```

## Gotchas

**★ Symptom: after installing an unrelated package, your `invoice` command runs someone else's program.** Cause: both distributions declare `invoice`; pip's `clobber = True` let the later install replace your wrapper in the same environment. Fix: find who owns the name, then rename yours.

```python
from importlib.metadata import entry_points

for ep in entry_points(group="console_scripts", name="invoice"):
    print(ep.value, ep.dist.name if ep.dist else "?")
```

```toml
[project.scripts]
invoice-service = "invoice_service.cli:main"
```

**★ Symptom: uninstalling package B removed package A's command.** Cause: they shared a script name, and the uninstaller deleted the file by that name. Fix: reinstall A to regenerate its wrapper, and stop shipping the shared name.

```bash
uv sync --reinstall-package invoice-service
```

**★ Symptom: `pipx install invoice-service` succeeded but `invoice` runs an old version.** Cause: another `invoice` sits earlier on `PATH` — a system package, or an old `pip install --user` — and pipx's default `ensurepath` appends its directory. Fix: see every candidate, then remove the stale one or prepend.

```bash
type -a invoice
pipx ensurepath --prepend
```

**★ Symptom: you installed a newer `invoice` into a directory earlier on `PATH`, and the shell still runs the old one.** Cause: bash remembered the old full path in its hash table. Fix:

```bash
hash -r
```

**★ Symptom: `uv tool install invoice-service` fails because the executable already exists.** Cause: the file in `~/.local/bin` was created by pipx or pip, and uv *"will not overwrite executables … that were not previously installed by uv"*. Fix: remove the other install, or replace it deliberately.

```bash
pipx uninstall invoice-service
uv tool install invoice-service
```

**Symptom: a command named `test` returns a status without ever running your code.** Cause: `test` is a shell builtin, and bash checks functions and builtins before searching `PATH`. Fix: rename the command; never ship a builtin's name.

```toml
[project.scripts]
invoice-test = "invoice_service.selftest:main"
```

**Symptom: on macOS `Invoice` and `invoice` are "the same command", and one of them is missing.** Cause: case-insensitive filesystems cannot hold both files, and the specification leaves installer behaviour *"undefined"* for names differing only in case. Fix: one spelling.

**Symptom: uv refuses a wheel because an entry point is called `Python`.** Cause: since 0.12.0 uv rejects case variants of reserved interpreter names, and *"You cannot opt out of these checks."* Fix: rename and rebuild.

```toml
[project.scripts]
invoice-shell = "invoice_service.shell:main"
```

**Symptom: an alias you defined years ago shadows a console script you just installed.** Cause: aliases are expanded before any command lookup. Fix: check with `type -a`, then remove or rename the alias.

```bash
type -a invoice
unalias invoice
```

## Interview questions

**★ Two installed distributions both declare the console script `invoice`. What happens?**
The specification leaves it to the consumer — here the installer — and gives no rule beyond discouraging names that differ only in case. pip overwrites the existing file (`clobber = True`), and uv's writer replaces it too, so the last install wins without a message. Uninstalling either distribution then deletes the file by name, taking the command away from the one that remains. The only real fix is unique names, prefixed with the project.

**★ How does a shell decide which `invoice` to run, and how do you see the candidates?**
In bash, aliases are expanded first, then shell functions and builtins are checked, then each `PATH` directory is searched in order — and the result of that search is remembered in a hash table, so later changes to a directory earlier on `PATH` are ignored until `hash -r` or a `PATH` assignment. `type -a invoice` lists every alias, function, builtin and file of that name in lookup order, which is almost always the fastest route to the answer.

**Why do `uv tool install` and pipx refuse to overwrite an existing command, when pip does not?**
Because the tool managers share `~/.local/bin` with each other and with `pip install --user`, and silently replacing a file another manager owns would change what a command means on the machine without telling anyone. uv documents the refusal and a `--force` override; pipx leaves the foreign file, logs that it did, and offers `unexpose` to let another command win. pip, inside one environment, treats the environment as its own and overwrites.

**Why does `pipx ensurepath` append rather than prepend by default, and when would you prepend?**
Appending means pipx-installed tools never shadow commands your system already provides — the safe default on a machine whose other software expects the system versions. Prepending, which pipx documents as making *"pipx-installed binaries win over system binaries of the same name"*, is for when you deliberately want your isolated tool to replace an older system copy. Either way, `type -a` shows which one a given shell resolves.

**What naming rules would you set for a team's console scripts?**
Prefix every command with the project name; avoid shell builtins, common system commands and anything a teammate might alias; stay inside the specification's recommended characters `[\w.-]+`; never ship two names that differ only in case; quote any dotted name in TOML. And run a CI check, like `tools/check_script_collisions.py` above, that no two installed distributions declare the same console script, since nothing else will catch it.

---

← Prev: [09 · Stale wrappers and editable installs](09-stale-wrappers-and-editable-installs.md) · [Topic index](README.md) · Next → [11 · The import-time cost of a CLI](11-import-time-cost.md)
