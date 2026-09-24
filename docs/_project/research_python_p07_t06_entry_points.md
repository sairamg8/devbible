---
name: research-python-p07-t06-entry-points
description: Banked primary-source research for devbible Python Phase 7 topic 06 (entry points) — the installed console-script wrapper (pip 26.2.1 / installer 1.0.1 / uv 0.12.12 templates, shebangs, Windows launchers), the entry points spec, pyproject spec, importlib.metadata 3.14, __main__ / -m, sys.exit, SIGPIPE, argparse, runpy, uv run / uv tool / uvx, pipx 1.17.2, pytest 9.1.1 and flake8 7.3.0 plugin hosts, PEP 810. DO NOT RE-DERIVE.
metadata:
  type: reference
  track: python
  topic: phase-7/06-entry-points
  fetched: 2026-09-10
---

# 🔴 DO NOT RE-DERIVE — banked 2026-09-10

Version spine (given by the dispatch, not re-derived): **Python 3.14.7 · uv 0.12.12 · ruff 0.16.6 · pre-commit 4.6.2**.
Source tags probed 2026-09-10 (GitHub releases API / `git ls-remote`): pip **26.2.1** (vendors distlib **0.4.2**),
pypa/installer **1.0.1** (2026-05-11), uv **0.12.12** (2026-09-09), pipx **1.17.2** (2026-09-01), pytest **9.1.1**
(2026-06-19), flake8 **7.3.0**, CPython tag **v3.14.7**, setuptools **84.0.0** (PyPI), astral-sh/setup-uv **v10.0.1**
(2026-08-14, no floating major), actions/checkout **v7** (v7.0.1).

All quotes below were read from the raw source (curl of the page or file), not paraphrased by a model.

---

## 1 · Entry points specification — https://packaging.python.org/en/latest/specifications/entry-points/

- *"Entry points are a mechanism for an installed distribution to advertise components it provides to be discovered and used by other code."*
- *"Distributions can specify `console_scripts` entry points, each referring to a function. When pip (or another console_scripts aware installer) installs the distribution, it will create a command-line wrapper for each entry point."*
- Group: *"The group that an entry point belongs to indicates what sort of object it provides. … The consumer typically defines the expected interface. To avoid clashes, consumers defining a new group should use names starting with a PyPI name owned by the consumer project, followed by `.`. Group names must be one or more groups of letters, numbers and underscores, separated by dots (regex `^\w+(\.\w+)*$`)."* → **no hyphens in group names.**
- Name: *"The name identifies this entry point within its group. The precise meaning of this is up to the consumer. For console scripts, the name of the entry point is the command that will be used to launch it. Within a distribution, entry point names should be unique. If different distributions provide the same name, the consumer decides how to handle such conflicts. The name may contain any characters except `=`, but it cannot start or end with any whitespace character, or start with `[`. For new entry points, it is recommended to use only letters, numbers, underscores, dots and dashes (regex `[\w.-]+`)."*
- Object reference: *"The object reference points to a Python object. It is either in the form `importable.module`, or `importable.module:object.attr`. Each of the parts delimited by dots and the colon is a valid Python identifier. It is intended to be looked up like this:"*
  ```python
  import importlib
  modname, qualname_separator, qualname = object_ref.partition(':')
  obj = importlib.import_module(modname)
  if qualname_separator:
      for attr in qualname.split('.'):
          obj = getattr(obj, attr)
  ```
- Extras: *"Using extras for an entry point is no longer recommended. Consumers should support parsing them from existing distributions, but may then ignore them. New publishing tools need not support specifying extras."*
- File: *"Entry points are defined in a file called `entry_points.txt` in the `*.dist-info` directory of the distribution."* · *"The file contents are in INI format, as read by Python's `configparser` module. However, configparser treats names as case-insensitive by default, whereas entry point names are case sensitive."* · *"The entry points file must always use `=` to delimit names from values (whereas configparser also allows using `:`)."*
- Spec example file:
  ```ini
  [console_scripts]
  foo = foomod:main
  # One which depends on extras:
  foobar = foomod:main_bar [bar,baz]

  # pytest plugins refer to a module, so there is no ':obj'
  [pytest11]
  nbval = nbval.plugin
  ```
- **Use for scripts:** *"Two groups of entry points have special significance in packaging: `console_scripts` and `gui_scripts`. In both groups, the name of the entry point should be usable as a command in a system shell after the package is installed. The object reference points to a function which will be called with no arguments when this command is run. The function may return an integer to be used as a process exit code, and returning `None` is equivalent to returning `0`."*
- Spec's own wrapper: *"For instance, the entry point `mycmd = mymod:main` would create a command `mycmd` launching a script like this:"* `import sys` / `from mymod import main` / `sys.exit(main())`
- *"The difference between `console_scripts` and `gui_scripts` only affects Windows systems. `console_scripts` are wrapped in a console executable, so they are attached to a console and can use `sys.stdin`, `sys.stdout` and `sys.stderr` for input and output. `gui_scripts` are wrapped in a GUI executable, so they can be started without a console, but cannot use standard streams unless application code redirects them. Other platforms do not have the same distinction."*
- *"Install tools are expected to set up wrappers for both `console_scripts` and `gui_scripts` in the scripts directory of the install scheme. They are not responsible for putting this directory in the `PATH` environment variable which defines where command-line tools are found."*
- *"As files are created from the names, and some filesystems are case-insensitive, packages should avoid using names in these groups which differ only in case. The behaviour of install tools when names differ only in case is undefined."*
- History: October 2017 written to formalise setuptools' feature; January 2026 references updated.

## 2 · pyproject.toml specification — https://packaging.python.org/en/latest/specifications/pyproject-toml/ (Entry points)

- *"There are three tables related to entry points. The `[project.scripts]` table corresponds to the `console_scripts` group in the entry points specification. The key of the table is the name of the entry point and the value is the object reference."*
- *"The `[project.gui-scripts]` table corresponds to the `gui_scripts` group in the entry points specification. Its format is the same as `[project.scripts]`."*
- *"The `[project.entry-points]` table is a collection of tables. Each sub-table's name is an entry point group. The key and value semantics are the same as `[project.scripts]`. Users MUST NOT create nested sub-tables but instead keep the entry point groups to only one level deep."*
- *"Build back-ends MUST raise an error if the metadata defines a `[project.entry-points.console_scripts]` or `[project.entry-points.gui_scripts]` table, as they would be ambiguous in the face of `[project.scripts]` and `[project.gui-scripts]`, respectively."*

## 3 · PyPUG guides

**Writing your pyproject.toml → Creating executable scripts** — https://packaging.python.org/en/latest/guides/writing-pyproject-toml/
- *"Executing this command will do the equivalent of `import sys; from spam import main_cli; sys.exit(main_cli())`."*
- *"On Windows, scripts packaged this way need a terminal, so if you launch them from within a graphical application, they will make a terminal pop up. To prevent this from happening, use the `[project.gui-scripts]` table instead of `[project.scripts]`."*
- *"In that case, launching your script from the command line will give back control immediately, leaving the script to run in the background."* 🔴 (gui script on Windows: shell does not wait)
- *"The difference between `[project.scripts]` and `[project.gui-scripts]` is only relevant on Windows."*

**Creating and packaging command-line tools** — https://packaging.python.org/en/latest/guides/creating-command-line-tools/
- src layout tree with `cli.py`, `greet.py`, `__init__.py`, `__main__.py`; typer app; `[project.scripts] greet = "greetings.cli:app"` (the target is a Typer *object*, callable).
- *"The file `__main__.py` marks the main entry point for the application when running it via `runpy` (i.e. `python -m greetings`, which works immediately with flat layout, but requires installation of the package with src layout), so initialize the command-line interface here:"* → `if __name__ == "__main__":` / `from greetings.cli import app` / `app()`
- pipx: *"This will expose the executable script we defined as an entry point and make the command `greet` available."* · `pipx run --spec . greet --doctor` · *"as the name of the entry point we defined above does not match the package name, we need to state explicitly which executable script to run"* · `[project.entry-points."pipx.run"] greetings = "greetings.cli:app"` · *"Thanks to this entry point (which must match the package name), `pipx` will pick up the executable script as the default one and run it"*

**Creating and discovering plugins** — https://packaging.python.org/en/latest/guides/creating-and-discovering-plugins/
- *"There are three major approaches to doing automatic plugin discovery: Using naming convention. Using namespace packages. Using package metadata."*
- naming convention: `pkgutil.iter_modules()` + `name.startswith('flask_')`; *"Flask uses the naming convention `flask_{plugin_name}`."*
- namespace: *"it's not recommended to make your project's main top-level package (`myapp` in this case) a namespace package for the purpose of plugins, as one bad plugin could cause the entire namespace to break which would in turn make your project unimportable."*
- metadata: `[project.entry-points.'myapp.plugins']` `a = 'myapp_plugin_a'`; `discovered_plugins = entry_points(group='myapp.plugins')`; *"Now the module of your choice can be imported by executing `discovered_plugins['a'].load()`."* Backport: *"(or the backport `importlib_metadata >= 3.6` for Python 3.6-3.9)"*

**Installing stand alone command line tools** — https://packaging.python.org/en/latest/guides/installing-stand-alone-command-line-tools/
- *"installing packages and their dependencies to the same global environment can cause version conflicts and break dependencies the operating system has on Python packages."* · *"pipx solves this by creating a virtual environment for each package, while also ensuring that its applications are accessible through a directory that is on your `$PATH`."* · *"`ensurepath` ensures that the application directory is on your `$PATH`. You may need to restart your terminal for this update to take effect."*

## 4 · The wrapper templates, verbatim from source

**installer 1.0.1** `src/installer/scripts.py` — https://github.com/pypa/installer/blob/1.0.1/src/installer/scripts.py
- L24–33 `_ALLOWED_LAUNCHERS`: console → `t32.exe` / `t64.exe` / `t_arm.exe` / `t64-arm.exe`; gui → `w32.exe` / `w64.exe` / `w_arm.exe` / `w64-arm.exe`.
- L35–43:
  ```python
  _SCRIPT_TEMPLATE = """\
  # -*- coding: utf-8 -*-
  import re
  import sys
  from {module} import {import_name}
  if __name__ == "__main__":
      sys.argv[0] = re.sub(r"(-script\\.pyw|\\.exe)?$", "", sys.argv[0])
      sys.exit({func_path}())
  """
  ```
- `import_name=self.attr.split(".")[0]`, `func_path=self.attr` → `a:B.c` becomes `from a import B` … `sys.exit(B.c())`.
- L83–88: gui on Windows → `fn.replace("python", "pythonw")` (*"On Windows, when the script section is gui-script, pythonw.exe should be used."*).
- Windows: `launcher + shebang + b"\n" + zip(__main__.py = code)`, file named `f"{self.name}.exe"`.
- L125–130 `_is_executable_simple`: no space and shebang length ≤ 127 (*"According to distlib, Darwin can handle up to 512 characters. But I want to avoid platform sniffing"*); else L154 `#!/bin/sh\n'''exec' <quoted> "$0" "$@"\n' '''`.
- `utils.py` `_ENTRYPOINT_REGEX` requires `(:\s*(?P<attrs>[\w.]+))` for scripts; `parse_entrypoints` only reads `console_scripts`/`gui_scripts`; `assert attrs is not None` (*"TODO: make this a proper error"*).

**pip 26.2.1** `src/pip/_internal/operations/install/wheel.py` — https://github.com/pypa/pip/blob/26.2.1/src/pip/_internal/operations/install/wheel.py
- L417–425 (template overrides distlib's):
  ```python
  class PipScriptMaker(ScriptMaker):
      # Override distlib's default script template with one that
      # doesn't import `re` module, allowing scripts to load faster.
      script_template = textwrap.dedent("""\
          import sys
          from %(module)s import %(import_name)s
          if __name__ == '__main__':
              sys.argv[0] = sys.argv[0].removesuffix('.exe')
              sys.exit(%(func)s())
  """)
  ```
- L387–394 `MissingCallableSuffix`: *"Invalid script entry point: {entry_point} - A callable suffix is required. See https://packaging.python.org/specifications/entry-points/#use-for-scripts for more information."* → **pip rejects a colon-less script at install time.**
- L397–414: path-escape check — *"Invalid script entry point name {entry.name!r}: the script would be installed outside the scripts directory ({scripts_dir})."*
- L120–168 `message_about_scripts_not_on_PATH`: *"The {start_text} installed in '{parent_dir}' which is not on PATH."* + *"Consider adding {} to PATH or, if you prefer to suppress this warning, use --no-warn-script-location."*; no warning for dirs on PATH or the dir of `sys.executable` (*"This covers the case of venv invocations without activating the venv."*).
- L645–649: *"Embed the target environment's interpreter in console-script launchers rather than the one running pip"*.
- L651–653: `maker.clobber = True` — *"Ensure old scripts are overwritten."* (pip issue 1800). → a same-named script from another dist in the same env is silently replaced.
- L658 `maker.variants = {""}`; L663 `maker.set_mode = True` (*"otherwise distlib creates scripts that are not executable"*).
- L262–333 `get_console_script_specs`: special-cases `pip` and `easy_install` versioned wrappers (`pipX`, `pipX.Y`), `ENSUREPIP_OPTIONS`.
- vendored distlib 0.4.2 `scripts.py` L44–50 original template imports `re` and does the import *inside* `if __name__ == '__main__':`; L149–183 `_build_shebang`: *"use /bin/sh as the executable, with a contrived shebang which allows the script to run either under Python or sh"*; max 512 on darwin, 127 elsewhere; `simple_shebang = True` when `os.name != 'posix'`. L262–280: Windows `script_bytes = launcher + shebang + zip_data`; launchers *"from https://bitbucket.org/vinay.sajip/simple_launcher/"*.
- `src/pip/_internal/req/req_uninstall.py` L24–39 `_script_names`: on Windows removes `name`, `name.exe`, `name.exe.manifest`, `name-script.py` / `name-script.pyw`; L572–582 removes scripts **by entry-point name** from the installed dist's metadata.
- `src/pip/_internal/utils/misc.py` L603–626 `protect_pip_from_modification_on_windows`: *"On Windows, any operation modifying pip should be run as: python -m pip ..."*; raises *"To modify pip, please run the following command:\n{}"*.
- `src/pip/__main__.py`: *"Remove '' and current working directory from the first entry of sys.path, if present to avoid using current directory in pip commands check, freeze, install, list and show, when invoked as python -m pip <command>"* → `if sys.path[0] in ("", os.getcwd()): sys.path.pop(0)`.
- pip's own `[project.scripts]`: `pip = "pip._internal.cli.main:main"`, `pip3 = …`.

**uv 0.12.12** `crates/uv-install-wheel/src/wheel.rs` — https://github.com/astral-sh/uv/blob/0.12.12/crates/uv-install-wheel/src/wheel.rs
- L28–53 `get_script_launcher` doc: *"Script template slightly modified: removed `import re`, allowing scripts that never import `re` to load faster."* Template:
  ```python
  {shebang}
  # -*- coding: utf-8 -*-
  import sys
  from {module} import {import_name}
  if __name__ == "__main__":
      if sys.argv[0].endswith("-script.pyw"):
          sys.argv[0] = sys.argv[0][:-11]
      elif sys.argv[0].endswith(".exe"):
          sys.argv[0] = sys.argv[0][:-4]
      sys.exit({function}())
  ```
- L109–140 `format_shebang`: *"Like pip, if a shebang is non-simple (too long or contains spaces), we use `/bin/sh` as the executable."*; `shebang_length > 127 || executable.contains(' ') || relocatable`; relocatable prefix `"$(dirname -- "$(realpath -- "$0")")"/`; *"the Windows trampoline binaries natively support relative paths to executable"*.
- L145–161 gui on Windows → `pythonw` if it exists.
- L163–168 reserved names: error `python`, `pythonw`, `python3`, `graalpy`, `pypy`, `pypy2`, `pypy3`, `python3.N`, `python3.Nt`/`pythonw3.Nt`; warn `activate`, `activate_this.py`.
- L333–378 `write_script_entrypoints`: Windows → `windows_script_launcher(...)` (uv-trampoline); Unix → write + chmod +x; all via `write_file_recorded` (L848–869: `write_atomic_sync` = overwrite, then add RECORD entry with sha256).
- `script.rs` L34–37 regex `^(?P<module>[\w\d_\-.]+)\s*:\s*(?P<function>[\w\d_\-.]+)(?:\s*\[…\])?\s*$` → error *"invalid console script: '{value}'"* when no colon. L88–100 parses `entry_points.txt` case-sensitive, `=` only. L119–135 pip3.N special case.
- `crates/uv-trampoline/README.md`: *"This is a fork of posy trampolines"*.
- `crates/uv-build-backend/src/metadata.rs`: L76–87 errors *"Entrypoint groups must consist of letters and numbers separated by dots, invalid group: {0}"* · *"Script entry point name `{0}` must include a non-dot character and consist only of letters, numbers, dots, underscores and dashes"* · *"Use `project.scripts` instead of `project.entry-points.console_scripts`"*; L902–948 `write_group`; L943 *"TODO(konsti): Validate that the object references are valid Python identifiers."* → **uv_build does NOT validate the object reference at build time**; the installer does.
- uv CHANGELOG (0.12.12 tree): **0.12.0** *"Reject wheel files that could replace the Python interpreter"* — *"uv already rejected wheel entry points named `python`, but case variants such as `Python` were still accepted. On case-insensitive filesystems, including common macOS and Windows setups, these entry points could overwrite the virtual environment's interpreter."* · *"You cannot opt out of these checks. Rename conflicting entry points or wheel data files and rebuild the affected wheel."* · **0.11.15** *"Enforce that entry points cannot escape in the scripts directory"* (GHSA-4gg8-gxpx-9rph) · **0.11.16** *"Reject unsafe entry points in `uv-build`"*, *"Restrict delimiters in entry point parsing"* · **0.11.17** *"Ban names like "python3" as script entry points"* · **0.11.24** preview *"Make project environments relocatable under preview"* · **0.9.30** preview *"Use relocatable virtual environments by default"* (PREVIEW only) · **0.8.5** *"Support installing additional executables in `uv tool install`"* (= `--with-executables-from`) · **0.5.19** *"Remove `import re` from entrypoint wrapper scripts"* · **0.4.18** *"Support `uv run -m foo` to run a module"* · 0.4.21 *"Make `--relocatable` entrypoints robust to symlinking"*.

## 5 · uv docs (raw markdown at tag 0.12.12 + live CLI reference)

**Running commands in projects** — https://docs.astral.sh/uv/concepts/projects/run/
- *"When working on a project, it is installed into the virtual environment at `.venv`. This environment is isolated from the current shell by default, so invocations that require the project, e.g., `python -c "import example"`, will fail. Instead, use `uv run` to run commands in the project environment"*
- *"When using `run`, uv will ensure that the project environment is up-to-date before running the given command."*
- *"The given command can be provided by the project environment or exist outside of it"* · `uv run example-cli foo`
- Windows legacy scripts: *"Currently only legacy scripts with the `.ps1`, `.cmd`, and `.bat` extensions are supported."*
- Signals: *"uv does not cede control of the process to the spawned command in order to provide better error messages on failure."*

**Configuring projects → Entry points** — https://docs.astral.sh/uv/concepts/projects/config/#entry-points
- *"Using the entry point tables requires a build system to be defined."* · gui-scripts *"are only different from command-line interfaces on Windows, where they are wrapped by a GUI executable so they can be started without a console. On other platforms, they behave the same."* · plugin example loops `plugin.load()` · *"The `group` key can be an arbitrary value, it does not need to include the package name or "plugins". However, it is recommended to namespace the key by the package name to avoid collisions with other packages."*

**Cache → Dynamic metadata** — https://docs.astral.sh/uv/concepts/cache/#dynamic-metadata
- *"By default, uv will _only_ rebuild and reinstall local directory dependencies (e.g., editables) if the `pyproject.toml`, `setup.py`, or `setup.cfg` file in the directory root has changed, or if a `src` directory is added or removed. This is a heuristic and, in some cases, may lead to fewer re-installs than desired."* 🔴 resolves the 02c uncertainty: an edited `[project.scripts]` changes `pyproject.toml` → rebuild + reinstall on next sync/run.
- *"Setting `tool.uv.cache-keys` will replace defaults, so any necessary files (like `pyproject.toml`) should still be included in the user-defined cache keys."* · escape hatch `[tool.uv] reinstall-package = ["my-package"]` *"This will force uv to rebuild and reinstall `my-package` on every run"*.

**Tools concept** — https://docs.astral.sh/uv/concepts/tools/
- *"Tools are Python packages that provide command-line interfaces."* · *"Installing the tool is useful if you need the tool to be available to other programs on your system, e.g., if some script you do not control requires the tool, or if you are in a Docker image and want to make the tool available to users."*
- *"If the environment is manually deleted, the tool will fail to run."*
- *"Tool executables include all console entry points, script entry points, and binary scripts provided by a Python package. Tool executables are symlinked into the executable directory on Unix and copied on Windows."* · *"Executables provided by dependencies of tool packages are not installed."*
- *"Installation of tools will not overwrite executables in the executable directory that were not previously installed by uv. For example, if `pipx` has been used to install a tool, `uv tool install` will fail. The `--force` flag can be used to override this behavior."*
- `--with-executables-from`: *"`--with` includes additional packages as dependencies but does not install their executables"* / *"`--with-executables-from` includes both the packages as dependencies and installs their executables"*
- *"The invocation `uv tool run <name>` (or `uvx <name>`) is nearly equivalent to: `uv run --no-project --with <name> -- <name>`"* · *"If the tool should not be isolated from the project, e.g., when running `pytest` or `mypy`, then `uv run` should be used instead of `uv tool run`."*
- Python: ignores `.python-version` and `requires-python` for tools.

**Using tools guide** — https://docs.astral.sh/uv/guides/tools/
- *"The `--from` option can be used to invoke a command from a specific package, e.g., `http` which is provided by `httpie`"* · *"Unlike `uvx`, `uv tool install` operates on a _package_ and will install all executables provided by the tool."* · *"Note the `@` syntax cannot be used for anything other than an exact version."*

**CLI reference (live, 2026-09-10)** — https://docs.astral.sh/uv/reference/cli/
- `uv run`: *"When used with a file ending in `.py` or an HTTP(S) URL, the file will be treated as a script and run with a Python interpreter, i.e., `uv run file.py` is equivalent to `uv run python file.py`."* · *"Arguments following the command (or script) are not interpreted as arguments to uv. All options to uv must be provided before the command"* · `--module, -m` *"Run a Python module. Equivalent to `python -m <module>`."* · `--gui-script` *"Only available on Windows."* · `--no-editable` *"Install any editable dependencies, including the project and any workspace members, as non-editable"*
- `uv tool install`: *"Install commands provided by a Python package."* · *"The executables are linked the tool executable directory, which is determined according to the XDG standard and can be retrieved with `uv tool dir --bin`."* · *"If the tool was previously installed, the existing tool will generally be replaced."* · `--editable, -e` *"Install the target package in editable mode, such that changes in the package's source directory are reflected without reinstallation"* · `--force` *"Force installation of the tool. Will recreate any existing environment for the tool and replace any existing entry points with the same name in the executable directory."*
- `uv tool run`: *"By default, the package to install is assumed to match the command name."* · *"If the tool was previously installed, i.e., via `uv tool install`, the installed version will be used unless a version is requested or the `--isolated` flag is used."*
- `uv venv --relocatable`: *"A relocatable virtual environment can be moved around and redistributed without invalidating its associated entrypoint and activation scripts."* · *"Note that this can only be guaranteed for standard `console_scripts` and `gui_scripts`. Other scripts may be adjusted if they ship with a generic `#!python[w]` shebang, and binaries are left as-is."* (env `UV_VENV_RELOCATABLE`)

**uv source** `crates/uv/src/commands/project/run.rs` @0.12.12
- L1205–1263: bare `uv run` prints *"Provide a command or script to invoke with `uv run <command>` or `uv run <script>.py`."* and *"The following commands are available in the environment:"* (lists executables in the env's scripts dir, minus `activate*`).
- L1269–1293: child `PATH` = env scripts dir(s) **prepended** to the inherited `PATH`; sets `VIRTUAL_ENV`.
- L1319–1322: *"TODO(zanieb): Throw a nicer error message if the command is not found"* → error context *"Failed to spawn: `{}`"*.
- L1715–1732: for a Python-package target, *"If the target is an installed, executable script — prefer that"*.
- `commands/tool/run.rs` L578/613/630: *"An executable named `{}` is not provided by package `{}`."* · *"… but is available via the dependency `{}`. Consider using `{}` instead."*
- `commands/tool/common.rs` L60/781: *"No executables are provided by package `{}`; removing tool"* · L884 *"Executable{s} already {exists}: {} (use `--force` to overwrite)"* · L957–977 *"`{}` is not on your PATH. To use installed tools, run `{}` or `{}`."* (…`uv tool update-shell`).

## 6 · pipx 1.17.2 — https://pipx.pypa.io/stable/ (raw rst at tag 1.17.2)

- how-pipx-works: *"When the **uv backend** is active (the default whenever uv is available, via the ``pipx[uv]`` extra or on ``PATH``) pipx skips the shared environment and uses ``uv venv`` and ``uv pip`` instead"* · *"console and GUI scripts, into ``PIPX_BIN_DIR`` (default ``~/.local/bin``)"* · *"pipx symlinks each resource into place. On Windows, and on any filesystem that does not support symlinks, it copies the file instead."* · *"That launcher runs the venv's own Python against the installed package, so the app always uses its isolated dependencies and never your system site-packages."* · `pipx run`: *"cached environments expire after 14 days"*.
- making-packages-compatible: *"make sure you include ``scripts`` in your main table in ``pyproject.toml``"* · *"pipx also exposes ``gui-scripts`` entry points"* · **`pipx.run` group**: *"When a user runs ``pipx run PACKAGE``, pipx looks for a console script matching the package name."* · *"This entry point takes priority over console scripts when present."* · *"The build package uses this pattern so that ``pipx run build`` works even though build's console script is named ``pyproject-build``."*
- expose-apps: *"A dependency's apps are not exposed by default."* · `--include-deps` · `--include-resources-from PACKAGE` (renamed from `--include-apps-from`) · `pipx unexpose` *"when another command with the same name should win"*.
- configure-paths: *"Pass ``--prepend`` to ``pipx ensurepath`` to prepend the pipx bin directory to ``PATH`` instead of appending it, so pipx-installed binaries win over system binaries of the same name."* · `pipx ensurepath --dry-run`.
- source `src/pipx/commands/common.py` L186–240 `_symlink_package_resource`: existing file pointing elsewhere → warning *"File exists at {symlink_path} and points to {…}, not {path}. Not modifying."*; after linking, if the name was already on PATH → *"Note: {name} was already on your PATH at {existing}"*. L680–687 *"'{local_bin_dir}' is not on your PATH … Run `pipx ensurepath`"*.
- troubleshoot: `pipx health` *"exits with status 1 when an environment cannot run its Python interpreter"*; `pipx repair`.

## 7 · Python 3.14 docs

**importlib.metadata** — https://docs.python.org/3.14/library/importlib.metadata.html
- `entry_points(**select_params)`: *"Returns a `EntryPoints` instance describing entry points for the current environment. Any given keyword parameters are passed to the `select()` method for comparison to the attributes of the individual entry point definitions."* · *"Note: it is not currently possible to query for entry points based on their `EntryPoint.dist` attribute (as different `Distribution` instances do not currently compare equal, even if they have the same attributes)"*
- `EntryPoints`: *"Also provides a `.groups` attribute that reports all identified entry point groups, and a `.names` attribute that reports all identified entry point names."*
- `EntryPoint`: *"Each `EntryPoint` instance has `.name`, `.group`, and `.value` attributes and a `.load()` method to resolve the value. There are also `.module`, `.attr`, and `.extras` attributes for getting the components of the `.value` attribute, and `.dist` for obtaining information regarding the distribution package that provides the entry point."*
- examples: `eps.select(group='console_scripts')`, `scripts['wheel']`, `(wheel,) = entry_points(group='console_scripts', name='wheel')`.
- *"Changed in version 3.12: The "selectable" entry points were introduced in `importlib_metadata` 3.6 and Python 3.10. Prior to those changes, `entry_points` accepted no parameters and always returned a dictionary of entry points, keyed by group. With `importlib_metadata` 5.0 and Python 3.12, `entry_points` always returns an `EntryPoints` object."*
- *"Changed in version 3.13: `EntryPoint` objects no longer present a tuple-like interface (`__getitem__()`)."*
- *"Changed in version 3.10: `importlib.metadata` is no longer provisional."*
- *"By default, distribution metadata can live on the file system or in zip archives on `sys.path`."*
- `packages_distributions()`: *"Some editable installs, do not supply top-level names, and thus this function is not reliable with such installs."* (Added 3.10)
- `distribution(name)`: *"Raises `PackageNotFoundError` if the named distribution package is not installed in the current Python environment."*
- **source** `Lib/importlib/metadata/__init__.py` @v3.14.7: L143–147 regex `(?P<module>[\w.]+)\s*(:\s*(?P<attr>[\w.]+)\s*)?((?P<extras>\[.*\])\s*)?$`; L173–181 `load()` *"If only a module is indicated by the value, return that module. Otherwise, return the named object."* (`import_module` + `functools.reduce(getattr, …)`); L205–223 `matches(**params)` compares **any** attribute (`module=`, `attr=` work); L257–264 `EntryPoints.__getitem__(name)` → first match or `KeyError`; L273–278 `select`; L990–996 `_unique` = `unique_everseen` keyed on `_normalized_name` — *"Wrapper for ``distributions`` to return unique distributions by name."*; L999–1011 `entry_points()` chains `dist.entry_points for dist in _unique(distributions())` → **first distribution of a given name on `sys.path` wins; every call walks every distribution**; L716–770 `FastPath` directory listing cached (`lru_cache`, keyed on `mtime`).

**`__main__`** — https://docs.python.org/3.14/library/__main__.html
- *"When a Python module or package is imported, `__name__` is set to the module's name."* · top-level env list includes *"the Python module or package passed to the Python interpreter with the `-m` argument"*.
- Packaging Considerations: *"`main` functions are often used to create command-line tools by specifying them as entry points for console scripts. When this is done, pip inserts the function call into a template script, where the return value of `main` is passed into `sys.exit()`."* · *"the expectation is that your function will return some value acceptable as an input to `sys.exit()`; typically, an integer or `None` (which is implicitly returned if your function does not have a return statement)."* · *"In particular, be careful about returning strings from your `main` function. `sys.exit()` will interpret a string argument as a failure message, so your program will have an exit code of `1`, indicating failure, and the string will be written to `sys.stderr`."*
- `__main__.py`: *"`__main__.py` will be executed when the package itself is invoked directly from the command line using the `-m` flag."* · *"The content of `__main__.py` typically isn't fenced with an `if __name__ == '__main__'` block. Instead, those files are kept short and import functions to execute from other modules."* · *"This won't work for `__main__.py` files in the root directory of a `.zip` file though. Hence, for consistency, a minimal `__main__.py` without a `__name__` check is preferred."* · `venv` cited as a stdlib example.

**Command line** — https://docs.python.org/3.14/using/cmdline.html
- `-m`: *"Locate the module using the standard import mechanism and execute its contents as the `__main__` module."* · *"When a package name is supplied instead of a normal module, the interpreter will execute `<pkg>.__main__` as the main module."* · *"If this option is given, the first element of `sys.argv` will be the full path to the module file (while the module file is being located, the first element will be set to `"-m"`). As with the `-c` option, the current directory will be added to the start of `sys.path`."* · Changed 3.1 (package `__main__`), 3.4 (namespace packages).
- `<script>`: *"If the script name refers directly to a Python file, the directory containing that file is added to the start of `sys.path`, and the file is executed as the `__main__` module."* → a console-script wrapper puts the **scripts directory** (`.venv/bin`) at `sys.path[0]`, not the cwd.
- `-X importtime`: *"to show how long each import takes. It shows module name, cumulative time (including nested imports) and self time (excluding nested imports). Note that its output may be broken in multi-threaded application. Typical usage is `python -X importtime -c 'import asyncio'`."* · *"`-X importtime=2` enables additional output that indicates when an imported module has already been loaded."* · *"Changed in version 3.14: Added `-X importtime=2`"* · `PYTHONPROFILEIMPORTTIME`.

**sys** — https://docs.python.org/3.14/library/sys.html
- `sys.exit`: *"If it is an integer, zero is considered "successful termination" and any nonzero value is considered "abnormal termination" by shells and the like. Most systems require it to be in the range 0–127, and produce undefined results otherwise. … Unix programs generally use 2 for command line syntax errors and 1 for all other kinds of errors. If another type of object is passed, `None` is equivalent to passing zero, and any other object is printed to `stderr` and results in an exit code of 1."* · *"Since `exit()` ultimately "only" raises an exception, it will only exit the process when called from the main thread, and the exception is not intercepted."* · *"Changed in version 3.6: If an error occurs in the cleanup after the Python interpreter has caught `SystemExit` (such as an error flushing buffered data in the standard streams), the exit status is changed to 120."*
- `sys.argv`: *"`argv[0]` is the script name (it is operating system dependent whether this is a full pathname or not)."*
- stdio note: *"Under some conditions `stdin`, `stdout` and `stderr` as well as the original values `__stdin__`, `__stdout__` and `__stderr__` can be `None`. It is usually the case for Windows GUI apps that aren't connected to a console and Python apps started with pythonw."*

**exceptions** — https://docs.python.org/3.14/library/exceptions.html
- SystemExit: *"When it is not handled, the Python interpreter exits; no stack traceback is printed."* · *"if it is `None`, the exit status is zero; if it has another type (such as a string), the object's value is printed and the exit status is one."*

**signal → Note on SIGPIPE** — https://docs.python.org/3.14/library/signal.html#note-on-sigpipe
- *"Piping output of your program to tools like head(1) will cause a `SIGPIPE` signal to be sent to your process when the receiver of its standard output closes early. This results in an exception like `BrokenPipeError: [Errno 32] Broken pipe`. To handle this case, wrap your entry point to catch this exception as follows:"* (code: try/flush/except BrokenPipeError → `os.dup2(devnull, sys.stdout.fileno())`, `sys.exit(1)  # Python exits with error code 1 on EPIPE`) · *"Do not set `SIGPIPE`'s disposition to `SIG_DFL` in order to avoid `BrokenPipeError`. Doing that would cause your program to exit unexpectedly whenever any socket connection is interrupted while your program is still writing to it."*

**What's New 3.8** — https://docs.python.org/3.14/whatsnew/3.8.html
- *"When the Python interpreter is interrupted by Ctrl-C (SIGINT) and the resulting `KeyboardInterrupt` exception is not caught, the Python process now exits via a SIGINT signal or with the correct exit code such that the calling process can detect that it died due to a Ctrl-C."*

**argparse** — https://docs.python.org/3.14/library/argparse.html
- prog default: *"The `base name` of `sys.argv[0]` if a file was passed as argument."* · *"The Python interpreter name followed by `sys.argv[0]` if a directory or a zipfile was passed as argument."* · *"The Python interpreter name followed by `-m` followed by the module or package name if the `-m` option was used."* · *"Changed in version 3.14: The default `prog` value now reflects how `__main__` was actually executed, rather than always being `os.path.basename(sys.argv[0])`."*
- `ArgumentParser.error(message)`: *"This method prints a usage message, including the message, to `sys.stderr` and terminates the program with a status code of 2."*

**runpy source** `Lib/runpy.py` @v3.14.7 L121–130: RuntimeWarning *"{mod_name!r} found in sys.modules after import of package {pkg_name!r}, but prior to execution of {mod_name!r}; this may result in unpredictable behaviour"* · L145 *"No module named %s"* · L155 *"%s; %r is a package and cannot be directly executed"* · L147 *"Cannot use package as __main__ module"* · L159 *"%r is a namespace package and cannot be executed"*.

**CPython `Python/ceval.c`** @v3.14.7 L3295–3305: *"cannot import name %R from %R (%S)"*; L3280–3289 *"… from partially initialized module %R (most likely due to a circular import)"*.

## 8 · Plugin hosts, real sources

**pytest 9.1.1** — https://docs.pytest.org/en/stable/how-to/writing_plugins.html (raw `doc/en/how-to/writing_plugins.rst`)
- *"pytest looks up the ``pytest11`` entrypoint to discover its plugins, thus you can make your plugin available by defining it in your ``pyproject.toml`` file."* · example `[project.entry-points.pytest11]` `myproject = "myproject.pluginmodule"` · *"Confirm registration with ``pytest --trace-config``"*
- Discovery order: 1 `-p no:name` blocks (*"even builtin plugins can be blocked this way"*), 2 builtins, 3 `-p name`, 4 *"by loading all plugins registered through installed third-party package entry points, unless the PYTEST_DISABLE_PLUGIN_AUTOLOAD environment variable is set."*, 5 `PYTEST_PLUGINS`, 6 conftest.
- `how-to/plugins.rst`: `--disable-plugin-autoload` *"versionadded:: 8.4"*; `pytest -p no:NAME`; `PYTEST_ADDOPTS`.
- pytest's own `pyproject.toml` L73–74: `scripts."py.test" = "_pytest.config:_console_main"` · `scripts.pytest = "_pytest.config:_console_main"` (🔴 dotted command name quoted in TOML).
- `src/_pytest/config/__init__.py` L246–261 `_console_main`: *"This is the real implementation used by entry points and ``__main__.py``."*; catches `BrokenPipeError` exactly per the SIGPIPE note (comment links it); L264–276 public `console_main` *"deprecated:: 9.1 … slated for removal in pytest 10"*; `_pytest/deprecated.py` L73: *"pytest.console_main() is deprecated and will be removed in pytest 10.\nIt was never intended for programmatic use; use pytest.main() instead."* → **pytest moved its console script target to a private function**.
- `src/pytest/__main__.py`: `from _pytest.config import _console_main` / `if __name__ == "__main__": raise SystemExit(_console_main())`.

**flake8 7.3.0** — https://flake8.pycqa.org/en/latest/plugin-development/registering-plugins.html (raw rst @7.3.0)
- *"|Flake8| presently looks at two groups: ``flake8.extension`` … ``flake8.report``"* · entry-point name = error-code prefix (`X101`, `X10`, `X1`, `X`) · L136–137 *"|Flake8| requires each entry point to be unique amongst all plugins installed in the users environment. Selecting an entry point that is already used can cause plugins to be deactivated without warning!"*
- `src/flake8/plugins/finder.py`: L22 `FLAKE8_GROUPS = frozenset(("flake8.extension", "flake8.report"))`; L176–177 *"some misconfigured pythons (RHEL) have things on `sys.path` twice"* → dedupe by dist name; L183 *"perf: skip parsing `.metadata` (slow) if no entry points match"*; L150–173 flake8's own `F`/`E`/`W` are entry points attributed to pyflakes/pycodestyle.
- `setup.cfg` L41–52: `console_scripts = flake8 = flake8.main.cli:main`; `flake8.extension = F = flake8.plugins.pyflakes:FlakesChecker`, `E = …pycodestyle_logical`, `W = …pycodestyle_physical`; `flake8.report = default = …`.
- `src/flake8/main/cli.py`: `def main(argv: Sequence[str] | None = None) -> int:` … `if argv is None: argv = sys.argv[1:]` … `return app.exit_code()`; `__main__.py`: `from flake8.main.cli import main` / `if __name__ == "__main__": raise SystemExit(main())`.

## 9 · setuptools 84.0.0 — https://setuptools.pypa.io/en/latest/userguide/development_mode.html
- *"Adding new dependencies, entry-points or changing your project's metadata require a fresh "editable" re-installation."*
- *"Console scripts and GUI scripts MUST be specified via entry-points to work properly."*

## 10 · PEP 810 — https://peps.python.org/pep-0810/ (Status **Final**, Python-Version **3.15**, Resolution 03-Nov-2025)
- *"The effect is especially costly for command-line tools with multiple subcommands, where even running the command with `--help` can load dozens of unnecessary modules and take several seconds."*
- *"A somewhat common way to delay imports is to move the imports into functions (inline imports), but this practice requires more work to implement and maintain, and can be subverted by a single inadvertent top-level import."*
- *"This can reduce startup time by 50-70% in practice"* (the PEP's claim, not ours). **Not available in 3.14.**

## 11 · bash manual — https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html
- `hash`: *"Each time `hash` is invoked, it remembers the full filenames of the commands specified as name arguments, so they need not be searched for on subsequent invocations."* · *"The -r option causes the shell to forget all remembered locations. Assigning to the `PATH` variable also clears all hashed filenames."*

---

## Could NOT settle (write as uncertain or leave out)

1. Whether **hatchling / setuptools / flit** validate a colon-less `[project.scripts]` value at *build* time. uv_build does not (TODO in source); installers pip/installer/uv all reject it at *install* time. → say "the installer rejects it; whether your backend catches it earlier depends on the backend".
2. Exact behaviour of **uv when two distributions in one environment provide the same script name** beyond the source fact that `write_atomic_sync` overwrites; no documented warning found. pip: `clobber = True`, silent overwrite. Neither documents it as a policy.
3. Whether uv's **uninstall** path removes a wrapper by RECORD only (source says RECORD-driven `uninstall_wheel`); did not trace every branch. → say "RECORD-driven".
4. The **exact shell/kernel error text** for a broken shebang ("bad interpreter") varies by shell/OS — never quote it.
5. Cost numbers for `entry_points()` — none documented; say it walks every distribution's metadata on each call, no timings.
6. Whether `uvx`/`uv tool run` exposes a **`pipx.run`-style** default-command group — no evidence found; do not claim.
7. The Windows **uv-trampoline** internals (how it locates python, embedded script format) — only "fork of posy trampolines" + `windows_script_launcher(script, is_gui, python)` signature. Do not describe further.
8. PEP 810 syntax details beyond "explicit lazy imports, 3.15" — out of scope.

## Chunk plan (topic 06, Understand)

01 what-the-installer-writes · 02 windows-launchers-and-gui-scripts · 03 the-function-contract (exit codes, SIGPIPE, argv) ·
04 python-m-and-dunder-main · 05 reading-entry-points-at-runtime · 06 plugin-discovery-patterns (+06b real hosts) ·
07 uv-run-and-the-project-command · 08 getting-commands-to-users (uv tool / uvx / pipx) · 09 stale-wrappers-and-editable-installs ·
10 name-collisions-and-path-shadowing · 11 import-time-cost · 12 failure-modes-runbook (+ CI smoke test, setup-uv@v10.0.1, checkout@v7).

Findings outside the topic (report, do not fix): `01-pyproject-toml/10-entry-points-and-console-scripts.md` says a
dot-for-colon script value *"fails at run time with a `ModuleNotFoundError`"* — pip 26.2.1 (`MissingCallableSuffix`),
installer 1.0.1 (regex requires `:`) and uv 0.12.12 (*"invalid console script"*) all reject it at **install** time.
`02-uv/02c-uv-sync-makes-the-environment-match.md` flags as unconfirmed whether metadata changes trigger a re-sync —
uv's cache docs settle it (pyproject.toml change → rebuild + reinstall).

---

## 2026-09-10 additions (banked while writing — same session)

- **`Py_RunMain`** — https://docs.python.org/3.14/c-api/interp-lifecycle.html : *"the return value will be `0` if the interpreter exits normally (that is, without raising an exception), the exit status of an unhandled `SystemExit`, or `1` for any other unhandled exception."* (the sourced answer to "uncaught exception → status 1").
- **`venv`** — https://docs.python.org/3.14/library/venv.html : *"Because scripts installed in environments should not expect the environment to be activated, their shebang lines contain the absolute paths to their environment's interpreters. Because of this, environments are inherently non-portable, in the general case."* · *"If you move an environment because you moved a parent directory of it, you should recreate the environment in its new location. Otherwise, software installed into the environment may not work as expected."*
- **`sysconfig` posix_user** — https://docs.python.org/3.14/library/sysconfig.html : purelib `userbase/lib/pythonX.Y/site-packages` (per version) but scripts `userbase/bin` (shared by every version) → one `~/.local/bin/cmd` for all `pip install --user` Pythons.
- **What's New 3.14 — PEP 649/749** — https://docs.python.org/3.14/whatsnew/3.14.html : *"The annotations on functions, classes, and modules are no longer evaluated eagerly. Instead, annotations are stored in special-purpose annotate functions and evaluated only when necessary (except if `from __future__ import annotations` is used)."*
- **`PYTHONPROFILEIMPORTTIME`** — cmdline: *"If this environment variable is set to `1`, Python will show how long each import takes. If set to `2`, Python will include output for imported modules that have already been loaded. This is equivalent to setting the `-X` `importtime` option."*
- **`argparse.parse_args`** — *"args - List of strings to parse. The default is taken from `sys.argv`."*
- **`importlib.metadata` intro** — *"provides the entry point and metadata APIs that were previously exposed by the now-removed `pkg_resources` package."* · `version()` raises `PackageNotFoundError` *"if the named distribution package is not installed in the current Python environment."* · `Distribution.entry_points` (source L489–496) reads that distribution's `entry_points.txt` only · `PathDistribution.locate_file` (L921) is public.
- **pyproject `dynamic`** — https://packaging.python.org/en/latest/specifications/pyproject-toml/ : keys that *"MAY be specified statically and listed in `dynamic` simultaneously"* now include `entry-points`, `gui-scripts`, `scripts`; *"A build back-end MAY only append entries to the value; it MUST NOT remove, reorder, or modify any statically-specified entries."* → the wheel's `entry_points.txt` can hold scripts `pyproject.toml` does not show. uv_build: *"Dynamic metadata is not supported"*.
- **uv `script.rs`** L39–49: a script whose `[extras]` are not a subset of the requested extras is **skipped**; L94–96 error *"entry_points.txt is invalid: {err}"*; L256 `test_rejects_non_equals_entry_point_delimiters` (`script: package.module:main` must fail).
- **uv_build names** (`metadata.rs` L902–948): scripts → error *"Script entry point name `{0}` must include a non-dot character and consist only of letters, numbers, dots, underscores and dashes"*; other groups → warning *"Entrypoint names should consist of letters, numbers, dots, underscores and dashes; non-compliant name: {name}"*.
- **CPython `Python/import.c`** L3705–3709: *"attempted relative import with no known parent package"*. `ceval.c` L3250–3258 stdlib-shadowing hint *"cannot import name %R from %R (consider renaming %R since it has the same name as the standard library module named %R and prevents importing that standard library module)"*.
- **uv CLI `uv run`** (live 2026-09-10): `--no-sync` *"Avoid syncing the virtual environment"* (*"Implies `--frozen`"*) · `--frozen` *"Run without updating the `uv.lock` file"* · `--package` *"Run the command in a specific package in the workspace."* · `--all-packages` *"Run the command with all workspace members installed."* · `--with-editable` *"layered on top of the project environment in a separate, ephemeral environment"*.
- **uv `run.rs`** L1301–1304 sets `VIRTUAL_ENV`; child `PATH` = ephemeral scripts → requirements env scripts → base interpreter scripts → inherited `PATH`.
- **pipx inject** — https://pipx.pypa.io/stable/how-to/inject-packages/ : *"Add extra packages into an existing pipx-managed environment with ``pipx inject``."* · *"Injected packages do not add their entry points to your ``PATH`` by default. Use ``--include-apps`` to expose them"*.
- **pytest plugins.rst** — *"If a plugin is installed, ``pytest`` automatically finds and integrates it, there is no need to activate it."* · `--trace-config` *"will get an extended test header which shows activated plugins and their names"* · `-p` *"loads (or disables with ``-p no:<name>``) a plugin by name or entry point"* · `PYTEST_PLUGINS` *"is a comma-separated list of Python modules that are imported and registered as plugins during startup"*.
- **bash** — Command Search and Execution: function → builtin → `PATH` search; *"Bash uses a hash table to remember the full pathnames of executable files … Bash performs a full search of the directories in `$PATH` only if the command is not found in the hash table."* · `type -a`: *"returns all of the places that contain a command named name. This includes aliases, reserved words, functions, and builtins"*.

## Written from this bank — topic 06 CLOSED 2026-09-10

15 files, 3,194 lines, 90 ★: README · 01 · 01b · 02 · 03 · 04 · 05 · 06 · 06b · 07 · 08 · 09 · 10 · 11 · 12.

More findings outside the topic (report, not fixed): `01-pyproject-toml/10` also says entry points are *"how pip finds a PEP 517 backend"* — PEP 517 backends are imported from the `build-backend` string, not discovered through entry points; and lists *"Flask extensions"* as entry-point plugins where PyPUG cites Flask as the **naming-convention** example. `02-uv/09b-uv-build-and-uv-publish.md` line ~92 still says topic **04 · Project layout** *(not written yet)* — it is written. `02-uv/03b-upgrading-the-lockfile.md` L80 and `02-uv/05c` L89 pin `actions/checkout@v4` (current major v7).
