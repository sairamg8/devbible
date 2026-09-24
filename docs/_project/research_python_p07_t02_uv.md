---
name: research-python-p07-t02-uv
description: Banked primary-source research for devbible Python Phase 7 topic 02 (uv). Every load-bearing sentence quoted verbatim with its URL. do not re-derive.
metadata:
  type: research
  track: python
  topic: phase-7-packaging-tooling/02-uv
  date: 2026-09-10
---

# 🔴 do not re-derive — banked 2026-09-10

Research for **`docs/python/pages/phase-7-packaging-tooling/02-uv/`**. One pass, all
chunks written from this file. Fetched 2026-09-10. **No sandbox was used, nothing was
run, no timings were measured.** Everything below is T0/T2: a verbatim quote from
`docs.astral.sh/uv`, `github.com/astral-sh/uv/releases`, `docs.python.org/3.14`, or
`packaging.python.org`.

## Version spine (given as fact by the dispatch, 2026-09-10)

- **uv 0.12.12** — released 2026-09-09 ← the topic's pin
- Python **3.14.7** — 2026-08-05
- ruff **0.16.6** — 2026-09-03
- pre-commit **4.6.2** — 2026-08-10

uv is pre-1.0 and ships weekly. Observed on the releases page: 0.12.3 (2026-08-07)
through 0.12.12 (2026-09-09) — ten releases in about five weeks.

---

## 1 · What uv is — https://docs.astral.sh/uv/

- *"An extremely fast Python package and project manager, written in Rust."*
- *"A single tool to replace `pip`, `pip-tools`, `pipx`, `poetry`, `pyenv`, `twine`, `virtualenv`, and more."*
- *"10-100x faster than `pip`."* ← **uv's own published claim.** Cite as a claim, never as measured.
- *"Provides comprehensive project management, with a universal lockfile."*
- *"Runs scripts, with support for inline dependency metadata."*
- *"Installs and manages Python versions."*
- *"Runs and installs tools published as Python packages."*
- *"Includes a pip-compatible interface for a performance boost with a familiar CLI."*
- *"Supports Cargo-style workspaces for scalable projects."*
- *"Disk-space efficient, with a global cache for dependency deduplication."*
- *"Installable without Rust or Python via `curl` or `pip`."*
- *"Supports macOS, Linux, and Windows."*

## 2 · Installation — https://docs.astral.sh/uv/getting-started/installation/

- `curl -LsSf https://astral.sh/uv/install.sh | sh`
- `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
- Version-pinned installer: `curl -LsSf https://astral.sh/uv/0.12.12/install.sh | sh`
- `pipx install uv` · `pip install uv` · `brew install uv` · `sudo port install uv` ·
  `winget install --id=astral-sh.uv -e` · `scoop install main/uv` · `cargo install --locked uv`
- `uv self update`
- 🔴 *"When another installation method is used, self-updates are disabled."*
- Completion: `echo 'eval "$(uv generate-shell-completion bash)"' >> ~/.bashrc`
- Uninstall: `uv cache clean` · `rm -r "$(uv python dir)"` · `rm -r "$(uv tool dir)"`
- Default install directory: `~/.local/bin/`

## 3 · Project layout / uv.lock / .venv — https://docs.astral.sh/uv/concepts/projects/layout/

- *"Python project metadata is defined in a `pyproject.toml` file. uv requires this file to identify the root directory of a project."*
- *"It is not recommended to include the `.venv` directory in version control; it is automatically excluded from `git` with an internal `.gitignore` file."*
- *"uv creates a `uv.lock` file next to the `pyproject.toml`."*
- 🔴 *"`uv.lock` is a universal or cross-platform lockfile that captures the packages that would be installed across all possible Python markers such as operating system, architecture, and Python version."*
- 🔴 *"This file should be checked into version control, allowing for consistent and reproducible installations across machines."*
- 🔴 *"`uv.lock` is a human-readable TOML file but is managed by uv and should not be edited manually. The `uv.lock` format is specific to uv and not usable by other tools."*
- The venv lives *"in a `.venv` directory next to the `pyproject.toml`"*; *"uv will create a virtual environment as needed"*.

## 4 · Locking and syncing — https://docs.astral.sh/uv/concepts/projects/sync/

- 🔴 *"Locking is the process of resolving your project's dependencies into a lockfile. Syncing is the process of installing a subset of packages from the lockfile into the project environment."*
- *"Locking and syncing are automatic in uv. For example, when `uv run` is used, the project is locked and synced before invoking the requested command."*
- 🔴 *"`uv sync` performs 'exact' syncing by default, which means it will remove any packages that are not present in the lockfile."*
- *"To disable automatic locking, use the `--locked` option... If the lockfile is not up-to-date, uv will raise an error instead of updating the lockfile."*
- *"To use the lockfile without checking if it is up-to-date, use the `--frozen` option."*
- *"To run a command without checking if the environment is up-to-date, use the `--no-sync` option."*
- *"You can check if the lockfile is up-to-date by passing the `--check` flag to `uv lock`."*
- `--inexact` *"retain extraneous packages"*.
- 🔴 *"`uv run` uses 'inexact' syncing by default... To enable exact syncing with `uv run`, use the `--exact` flag."*
- *"To upgrade all packages: `$ uv lock --upgrade`"*
- *"To upgrade a single package to the latest version, while retaining the locked versions of all other packages: `$ uv lock --upgrade-package <package>`"*
- *"To quickly enable all extras, use the `--all-extras` option."* · groups via `--all-groups`.
- 🔴 *"The `dev` group is special-cased and synced by default."* `--no-dev` excludes it;
  `--only-dev` installs the dev group without the project and its dependencies;
  `--only-group <name>` also excludes default groups.
- 🔴 *"When the environment is synced, uv will install the project (and other workspace members) as editable packages, such that re-syncing is not necessary for changes to be reflected in the environment."*
- *"`--no-install-project`: Do not install the current project"*
- Export: *"If you need to integrate uv with other tools or workflows, you can export `uv.lock` to different formats including `requirements.txt`, `pylock.toml` (PEP 751), and CycloneDX SBOM."*
  Commands shown: `uv export --format requirements.txt`, `uv export --format pylock.toml`,
  `uv export --format cyclonedx1.5`.
- ⚠️ `--no-emit-project` — **absent** from this page. `UV_PROJECT_ENVIRONMENT` — **absent** from this page (it is in the env reference, §10).

## 5 · uv run — https://docs.astral.sh/uv/concepts/projects/run/

- 🔴 *"When using `run`, uv will ensure that the project environment is up-to-date before running the given command."*
- *"use `uv run` to run commands in the project environment"*
- *"The given command can be provided by the project environment or exist outside of it"*
- *"The `--with` option is used to include a dependency for the invocation"*
- 🔴 *"The requested version will be respected regardless of the project's requirements."* (about `--with`)
- *"Scripts that declare inline metadata are automatically executed in environments isolated from the project."*
- *"Currently only legacy scripts with the `.ps1`, `.cmd`, and `.bat` extensions are supported."* /
  *"you don't need to specify the extension. `uv` will automatically look for files ending in `.ps1`, `.cmd`, and `.bat`"*
- 🔴 *"uv will forward most signals (with the exception of SIGKILL, SIGCHLD, SIGIO, and SIGPOLL) to the child process."* (Unix)
- *"uv ignores Ctrl-C events, deferring handling to the child process so it can exit cleanly."* (Windows)
- 🔴 *"uv does not cede control of the process to the spawned command in order to provide better error messages on failure."*

## 6 · Dependencies, uv add / uv remove — https://docs.astral.sh/uv/concepts/projects/dependencies/

- *"To add a dependency: `$ uv add httpx` An entry will be added in the `project.dependencies` field"*
- 🔴 *"The dependency will include a constraint, e.g., `>=0.27.2`, for the most recent, compatible version of the package."*
- *"The kind of bound can be adjusted with `--bounds`, or the constraint can be provided directly"*
- *"`--dev` flag: uv uses the `[dependency-groups]` table (as defined in PEP 735) for declaration of development dependencies."*
- *"Development dependencies can be divided into multiple groups, using the `--group` flag."*
- *"To add an optional dependency, use the `--optional <extra>` option: `$ uv add httpx --optional network`"*
- 🔴 *"When adding a dependency from a source other than a package registry, uv will add an entry in the sources field."*
- `[tool.uv.sources]` example: `httpx = { git = "https://github.com/encode/httpx" }`
- *"To add a path source, provide the path of a wheel (ending in `.whl`), a source distribution... or a directory containing a `pyproject.toml`."*
- *"To add an editable dependency, use the `--editable` flag: `$ uv add --editable ./path/foo`"*
- *"To remove a dependency: `$ uv remove httpx` The `--dev`, `--group`, or `--optional` flags can be used to remove a dependency from a specific table. If a source is defined for the removed dependency, and there are no other references to the dependency, it will also be removed."*

## 7 · Resolution — https://docs.astral.sh/uv/concepts/resolution/

- *"By default, uv's pip interface, i.e., `uv pip compile`, produces a resolution that is platform-specific, like `pip-tools`."*
- 🔴 *"uv's lockfile (`uv.lock`) is created with a universal resolution and is portable across platforms."*
- Universal resolution ensures *"dependencies are locked for everyone working on the project, regardless of operating system, architecture, and Python version."*
- *"Universal resolution is also available in uv's pip interface, i.e., `uv pip compile`, with the `--universal` flag."*
- `--resolution lowest`: *"install the lowest possible version for all dependencies"*.
- `--resolution lowest-direct`: *"use the lowest compatible versions for all direct dependencies, while using the latest compatible versions for all other dependencies"*.
- *"`--exclude-newer` option to limit resolution to distributions uploaded before a specific date, allowing reproduction of installations regardless of new package releases"*
- Forking: during universal resolution *"a package may be listed multiple times with different versions"*; `--fork-strategy` controls the trade-off.
- 🔴 *"all required packages must be compatible with the entire range of `requires-python` declared in the `pyproject.toml`"*

## 8 · Python versions — https://docs.astral.sh/uv/concepts/python-versions/

- *"uv bundles a list of downloadable CPython and PyPy distributions for macOS, Linux, and Windows."*
- *"uv installs Python executables into your `PATH` by default, e.g., on Unix `uv python install 3.12` will install a Python executable into `~/.local/bin`"*
- Commands: `uv python install` · `uv python list` · `uv python find` · `uv python pin`.
- *"A `.python-version` file can be created in the current directory with the `uv python pin` command."*
- *".python-version file can be used to create a default Python version request"*
- 🔴 *"uv will respect Python requirements defined in `requires-python` in the `pyproject.toml` file during project command invocations"*
- Discovery order: *"Managed Python installations in the `UV_PYTHON_INSTALL_DIR`"* first, then
  *"A Python interpreter on the `PATH`"*, then Windows registry entries.
- 🔴 *"uv instead uses pre-built distributions from the Astral `python-build-standalone` project"*
  (https://github.com/astral-sh/python-build-standalone)
- 🔴 *"These distributions have some behavior quirks, generally as a consequence of portability; see the `python-build-standalone` quirks documentation for details"*
  (https://gregoryszorc.com/docs/python-build-standalone/main/quirks.html)
- *"To install `python` and `python3` executables, include the experimental `--default` option: `$ uv python install 3.12 --default`"*
- *"uv-managed Python versions can be upgraded to the latest supported patch release with the `python upgrade` command"*
- 🔴 *"By default, uv will automatically download Python versions when needed."*
- `python-preference` values, verbatim:
  - `only-managed`: *"Only use managed Python installations; never use system Python installations."*
  - default: *"By default, the `python-preference` is set to `managed` which prefers managed Python installations over system Python installations. However, system Python installations are still preferred over downloading a managed Python version."*
  - `system`: *"Prefer system Python installations over managed Python installations."*
  - `only-system`: *"Only use system Python installations; never use managed Python installations."*
- ⚠️ `uv python pin --rm` / `--resolved` — **absent** from the page as fetched. Do not claim them.

## 9 · uv venv — https://docs.astral.sh/uv/pip/environments/ + reference/cli

- *"to create a virtual environment at `.venv`"*
- *"A Python version can be requested, e.g., to create a virtual environment with Python 3.11: `uv venv --python 3.11`"*
- 🔴 *"When using the default virtual environment name, uv will automatically find and use the virtual environment during subsequent invocations."*
- *"setting `VIRTUAL_ENV=/path/to/venv` will cause uv to install into `/path/to/venv`, regardless of where uv is installed"*
- 🔴 *"if `VIRTUAL_ENV` is set to a directory that is not a PEP 405 compliant virtual environment, it will be ignored"*
- Discovery: *"A virtual environment at `.venv` in the current directory, or in the nearest parent directory"*
- From https://docs.astral.sh/uv/reference/cli/ — `uv venv`, *"Create a virtual environment"*:
  - `--python`: *"The Python interpreter to use for the virtual environment."*
  - 🔴 `--seed`: *"Seed the virtual environment with pip, setuptools, and wheel."*
  - `--clear`: *"Remove an existing virtual environment at the target location."*
  - `--allow-existing`: *"Allow creation of a virtual environment in a non-empty directory."*
  - `--system-site-packages`: *"Give the virtual environment access to the system site-packages."*
  - `--relocatable`: *"Create a virtual environment with a relative path."*
  - `--no-project`: *"Avoid discovering the project or workspace."*
  - `--link-mode`: *"The method to use when installing packages from the global cache."*
  - `--python-preference`: *"The strategy for selecting a Python version."*

## 10 · Environment variables — https://docs.astral.sh/uv/reference/environment/

- `UV_PROJECT_ENVIRONMENT`: *"Specifies the path to the directory to use for a project virtual environment."*
- `UV_FROZEN`: *"Equivalent to the `--frozen` command-line argument. If set, uv will run without updating the `uv.lock` file."*
- `UV_LOCKED`: *"Equivalent to the `--locked` command-line argument. If set, uv will assert that the `uv.lock` remains unchanged."*
- `UV_NO_SYNC`: *"Equivalent to the `--no-sync` command-line argument. If set, uv will skip updating the environment."*
- `UV_SYSTEM_PYTHON`: *"Equivalent to the `--system` command-line argument. If set to `true`, uv will use the first Python interpreter found in the system `PATH`."*
- `UV_PYTHON`: *"Equivalent to the `--python` command-line argument. If set to a path, uv will use this Python interpreter for all operations."*
- `UV_PYTHON_DOWNLOADS`: *"Equivalent to the `python-downloads` setting and, when disabled, the `--no-python-downloads` option. Whether uv should allow Python downloads."*
- `UV_LINK_MODE`: *"Equivalent to the `--link-mode` command-line argument. If set, uv will use this as a link mode."*
- `UV_COMPILE_BYTECODE`: *"Equivalent to the `--compile-bytecode` command-line argument. If set, uv will compile Python source files to bytecode after installation."*
- `UV_CACHE_DIR`: *"Equivalent to the `--cache-dir` command-line argument. If set, uv will use this directory for caching instead of the default cache directory."*
- `UV_NO_CACHE`: *"Equivalent to the `--no-cache` command-line argument. If set, uv will not use the cache for any operations."*
- `UV_INDEX_URL`: *"Equivalent to the `--index-url` command-line argument. ... (Deprecated: use `UV_DEFAULT_INDEX` instead.)"*
- `UV_DEFAULT_INDEX`: *"Equivalent to the `--default-index` command-line argument. If set, uv will use this index as the default index when searching for packages."*
- `UV_PYTHON_INSTALL_DIR`: *"Specifies the directory for storing managed Python installations."*
- `UV_TOOL_DIR`: *"Specifies the directory where uv stores managed tools."*

## 11 · Cache — https://docs.astral.sh/uv/concepts/cache/

- Cache directory order: *"1. A temporary cache directory, if `--no-cache` was requested. 2. The specific cache directory specified via `--cache-dir`, `UV_CACHE_DIR`, or `tool.uv.cache-dir`"*
- 🔴 *"It is important for performance for the cache directory to be located on the same file system as the Python environment uv is operating on."*
- 🔴 *"uv provides a `uv cache prune --ci` command, which removes all pre-built wheels and unzipped source distributions from the cache, but retains any wheels that were built from source."*
- *"`uv cache clean` removes all cache entries from the cache directory, clearing it out entirely."*
- *"To force uv to revalidate cached data for all dependencies, pass `--refresh` to any command (e.g., `uv sync --refresh`)"*
- *"To force uv to ignore existing installed versions, pass `--reinstall` to any installation command"*
- 🔴 *"Each bucket is versioned, such that if a release contains a breaking change to the cache format, uv will not attempt to read from or write to an incompatible cache bucket."*
- *"uv's cache is designed to be thread-safe and append-only, and thus robust to multiple concurrent readers and writers."*
- ⚠️ `--link-mode` values and the platform default are **not** on this page. Do not claim a default.

## 12 · Docker — https://docs.astral.sh/uv/guides/integration/docker/

- `COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/`
- 🔴 *"It is best practice to pin to a specific uv version, e.g., with:"* `ghcr.io/astral-sh/uv:0.12.12`
- 🔴 *"`uv sync --no-install-project` will install the dependencies of the project but not the project itself. Since the project changes frequently, but its dependencies are generally static, this can be a big time saver."*
- Verbatim layer:
  ```dockerfile
  RUN --mount=type=cache,target=/root/.cache/uv \
      --mount=type=bind,source=uv.lock,target=uv.lock \
      --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
      uv sync --locked --no-install-project
  ```
- Workspaces: *"Use `--frozen` instead of `--locked` during the initial sync"* and
  *"Use the `--no-install-workspace` flag which excludes the project and any workspace members."*
- *"To enable bytecode compilation, use the `--compile-bytecode` flag"* / `ENV UV_COMPILE_BYTECODE=1`
- 🔴 *"Changing the `UV_LINK_MODE` silences warnings about not being able to link files since the cache and sync target are on separate file systems."* (`ENV UV_LINK_MODE=copy`)
- *"you can either activate the project virtual environment by placing its binary directory at the front of the path:"* `ENV PATH="/app/.venv/bin:$PATH"`
- `ENV UV_PYTHON_CACHE_DIR` *"can be used in combination with a cache mount"*.

## 13 · uv init — https://docs.astral.sh/uv/guides/projects/

- 🔴 *"uv will create the following files and directories: .git/, .gitignore, .python-version, pyproject.toml, README.md and src/hello_world/__init__.py"*
- *"The `.python-version` file contains the project's default Python version. This file tells uv which Python version to use when creating the project's virtual environment."*
- 🔴 *"uv will create a virtual environment and `uv.lock` file in the root of your project the first time you run a project command, i.e., `uv run`, `uv sync`, or `uv lock`."*
- ⚠️ No explicit sentence telling users never to touch `.venv`. Do not quote one.

## 14 · Project config — https://docs.astral.sh/uv/concepts/projects/config/

- *"The Python version requirement determines the Python syntax that is allowed in the project and affects selection of dependency versions"*
- *"You probably need a package if you want to: Add commands to the project, Distribute the project to others, Use a `src` and `test` layout, Write a library. You probably do not need a package if you are: Writing scripts, Building a simple application, Using a flat layout"*
- 🔴 *"uv uses the presence of a build system to determine if a project contains a package that should be installed in the project virtual environment."*
- 🔴 *"If a build system is not defined, uv will not attempt to build or install the project itself, just its dependencies."*
- `tool.uv.package = true` forces packaging; `false` prevents it even with a build system.

## 15 · uv pip compatibility — https://docs.astral.sh/uv/pip/compatibility/

- 🔴 *"uv is designed as a drop-in replacement for common `pip` and `pip-tools` workflows"* … *"uv is not intended to be an exact clone of `pip`."*
- 🔴 *"`uv pip install` and `uv pip sync` are designed to work with virtual environments by default. Specifically, uv will always install packages into the currently active virtual environment, or search for a virtual environment named `.venv` in the current directory or any parent directory (even if it is not activated)."*
- *"differs from `pip`, which will install packages into a global environment if no virtual environment is active."*
- *"`--system` flag, which installs into the first Python interpreter found on the `PATH`, like `pip`."*
- *"Neither `pip` nor uv make any guarantees about the exact set of packages that will be installed"* … *"in some cases, `pip` and uv will yield different resolutions."*
- *"uv's resolver and pip's resolver have a different set of package priorities."*
- *"By default (`if-necessary`), uv prefers stable versions over pre-releases, falling back to pre-releases only if every stable candidate that satisfies the active constraints is rejected during resolution."*
- *"uv uses PEP 517 build isolation by default"* with the escape hatch *"`uv pip install --no-build-isolation`."*
- 🔴 *"uv does not read configuration files or environment variables that are specific to `pip`, like `pip.conf` or `PIP_INDEX_URL`."*

## 16 · uv pip compile / sync — https://docs.astral.sh/uv/pip/compile/

- *"Locking is to take a dependency, e.g., `ruff`, and write an exact version to use to a file."*
- 🔴 *"When installing with `uv pip install`, packages that are already installed will not be removed unless they conflict with the lockfile."*
- 🔴 *"To ensure the environment exactly matches the lockfile, use `uv pip sync` instead."*
- *"To sync an environment with a `requirements.txt` file: `$ uv pip sync requirements.txt`"*
- *"To upgrade a dependency, use the `--upgrade-package` flag"* · *"To upgrade all dependencies, there is an `--upgrade` flag."*
- ⚠️ `--generate-hashes` and the `--universal` contrast are **not** on this page as fetched; the `--universal` quote is on the resolution page (§7).

## 17 · Tools / uvx — https://docs.astral.sh/uv/guides/tools/ + /concepts/tools/

- *"This is exactly equivalent to: `$ uv tool run ruff`"* (i.e. `uvx ruff`)
- *"Tools are installed into temporary, isolated environments when using `uvx`."*
- *"When a tool is installed, its executables are placed in a `bin` directory in the `PATH`"*
- *"If it's not on the `PATH`, a warning will be displayed and `uv tool update-shell` can be used to add it to the `PATH`."*
- *"The `--from` option can be used to invoke a command from a specific package, e.g., `http` which is provided by `httpie`"*
- 🔴 *"Unlike `uv pip install`, installing a tool does not make its modules available in the current environment."*
- *"To upgrade a tool, use `uv tool upgrade"* · *"To instead upgrade all tools: `$ uv tool upgrade --all`"*
- *"For example, to run a specific version of Ruff: `$ uvx ruff@0.6.0 --version`"*
- *"uv tool install will also respect the `{package}@{version}` and `{package}@latest` specifiers"*
- *"To request the latest version of Ruff and refresh the cache, use the `@latest` suffix"*
- 🔴 *"When running a tool with `uvx`, a virtual environment is stored in the uv cache directory and is treated as disposable"* · *"The environment is only cached to reduce the overhead of repeated invocations"*
- 🔴 *"Once a tool is installed with `uv tool install`, `uvx` will use the installed version by default"*
- *"Tool environments may be upgraded via `uv tool upgrade`, or re-created entirely via subsequent `uv tool install` operations"*
- *"To upgrade a single package in a tool environment: `$ uv tool upgrade black --upgrade-package click`"*
- *"Additional packages can be included during tool execution: `$ uvx --with <extra-package> <tool>`"*
- ⚠️ `uv tool list` / `uv tool uninstall` are not quoted verbatim on the pages as fetched.

## 18 · Version commands — https://docs.astral.sh/uv/reference/cli/

- 🔴 `uv version` — *"Read or update the project's version"*
- `uv self version` — *"Display the installed uv version"*
- `uv self update` — *"Update the uv executable to the latest available release"*
- `uv version` carries `--short`, `--bump`, `--dry-run` (descriptions were summarised by the
  fetch, not returned verbatim — do not quote them).

## 19 · Release notes — https://github.com/astral-sh/uv/releases

Version boundaries worth naming on a page:

- **0.12.9 (2026-09-01)** — *"Add `--no-locked` and `--no-frozen` to disable lock modes enabled by `UV_LOCKED` and `UV_FROZEN`"* and *"Report the exact command-line lock-mode flag in warnings and errors"*.
- **0.12.7 (2026-08-27)** — *"Support Linux `s390x`, `ppc64le`, and `loongarch64` targets for cross-platform dependency resolution"*.
- **0.12.6 (2026-08-25)** — preview: *"Add `uv workspace metadata --sync --exact` to remove packages outside the selected resolution"*.
- **0.12.5 (2026-08-14)** — preview: *"Allow `--index` and `--default-index` to select configured package indexes by name"*.
- **0.12.4 (2026-08-13)** — preview: *"Add `uv check --no-install-project` and respect `UV_NO_INSTALL_PROJECT`"*.
- **0.12.11 (2026-09-08)** — preview: *"Generate missing artifact hashes when exporting `pylock.toml` files to ensure they conform to PEP 751"* and *"Warn when `pylock.toml` artifact hash tables are empty, which will be rejected in a future uv release"*.
- **0.12.10 (2026-09-04)** — preview: *"Omit `exclude-newer-package` settings for packages outside the resolution from `uv.lock`"*.
- **0.12.12 (2026-09-09)** and **0.12.8 (2026-08-31)** — nothing in scope for this topic.

## 20 · The pip + venv baseline

**https://docs.python.org/3.14/library/venv.html**

- *"It also creates a `bin` (or `Scripts` on Windows) subdirectory containing a copy or symlink of the Python executable (as appropriate for the platform or arguments used at environment creation time). It also creates a `lib/pythonX.Y/site-packages` subdirectory (on Windows, this is `Lib\site-packages`)."*
- *"This creates the target directory (including parent directories as needed) and places a `pyvenv.cfg` file in it with a `home` key pointing to the Python installation from which the command was run."*
- 🔴 *"You don't specifically need to activate a virtual environment, as you can just specify the full path to that environment's Python interpreter when invoking Python. Furthermore, all scripts installed in the environment should be runnable without activating it."*
- 🔴 *"In order to achieve this, scripts installed into virtual environments have a "shebang" line which points to the environment's Python interpreter, `#!/<path-to-venv>/bin/python`. This means that the script will run with that interpreter regardless of the value of `PATH`."*
- 🔴 *"Because of this, environments are inherently non-portable, in the general case... If you move an environment because you moved a parent directory of it, you should recreate the environment in its new location."*
- `--system-site-packages`: *"Give the virtual environment access to the system site-packages directory."*
- `--without-pip`: *"Skips installing or upgrading pip in the virtual environment (pip is bootstrapped by default)."*
- `--upgrade-deps`: *"Upgrade core dependencies (pip) to the latest version in PyPI."*
- *"Changed in version 3.5: The use of `venv` is now recommended for creating virtual environments."*

**https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/**

- *"This will create a new virtual environment in a local folder named `.venv`"* (`python3 -m venv .venv`)
- *"Activating a virtual environment will put the virtual environment-specific `python` and `pip` executables into your shell's `PATH`."*
- *"When you switch projects, you can create a new virtual environment which is isolated from other virtual environments. You benefit from the virtual environment since packages can be installed confidently and will not interfere with another project's environment."*
- *"Instead of installing packages individually, pip allows you to declare all dependencies in a Requirements File."*
- 🔴 *"`pip freeze` command is useful for creating Requirements Files that can re-create the exact versions of all packages installed in an environment."*
- ⚠️ The page does **not** say `pip freeze` output is unsuitable cross-platform. Argue that from
  what it does say (*"installed in an environment"*) — never attribute the stronger claim to it.

**https://packaging.python.org/en/latest/specifications/pyproject-toml/**

- 🔴 *"The `[tool]` table is where any tool related to your Python project, not just build tools, can have users specify configuration data as long as they use a sub-table within `[tool]`"*
- *"A project can use the subtable `tool.$NAME` if, and only if, they own the entry for `$NAME` in the Cheeseshop/PyPI."*
- `requires-python`: *"The Python version requirements of the project."*

---

## 🔴 Claims the documentation would NOT settle — write as uncertain or leave out

1. **What `--link-mode` defaults to per platform.** The cache page does not say. Only the
   Docker page's *"separate file systems"* sentence is quotable.
2. **What uv does when an unrelated venv is activated during a *project* command.** The pip
   interface honours `VIRTUAL_ENV`; the project interface uses `.venv` /
   `UV_PROJECT_ENVIRONMENT`. The seam is documented from both sides; the conflict behaviour
   is not stated. Do not invent a warning string.
3. **Whether `uv lock --upgrade-package X` may move X's transitive dependencies** when the
   new X requires them. The docs say only *"while retaining the locked versions of all other packages"*.
4. **Whether `.python-version` outside `requires-python` errors or is overridden.** Not stated.
5. **pyenv's internals** (shims, build-from-source). Not fetched from pyenv's docs — hedge any
   comparison, or state only uv's side.
6. **Whether a new `[project.scripts]` entry is picked up without re-syncing.** The docs say
   only that *"re-syncing is not necessary for changes to be reflected"*; they do not
   distinguish code from metadata. Say so.
7. **Any timing, multiplier or byte count.** The only number available is uv's own published
   *"10-100x faster than `pip`"* — cite it as uv's claim with the URL, never as measured.

---

# Gap fetch — 2026-09-10 (resume session, after the first author died)

Fetched for the chunks the first pass did not reach: tools, configuration, workspaces,
`uv init`, build/publish, settings. Same rules: verbatim or not at all.

## 21 · Configuration files — https://docs.astral.sh/uv/concepts/configuration-files/

- *"Specifically, uv will search for a `pyproject.toml` or `uv.toml` file in the current directory, or in the nearest parent directory."*
- 🔴 *"For `tool` commands, which operate at the user level, local configuration files will be ignored."*
- *"In workspaces, uv will begin its search at the workspace root, ignoring any configuration defined in workspace members."*
- 🔴 *"`uv.toml` files take precedence over `pyproject.toml` files, so if both `uv.toml` and `pyproject.toml` files are present in a directory, configuration will be read from `uv.toml`, and `[tool.uv]` section in the accompanying `pyproject.toml` will be ignored."*
- *"uv will also discover `uv.toml` configuration files in the user- and system-level configuration directories, e.g., user-level configuration in `~/.config/uv/uv.toml` on macOS and Linux, or `%APPDATA%\uv\uv.toml` on Windows, and system-level configuration at `/etc/uv/uv.toml` on macOS and Linux, or `%PROGRAMDATA%\uv\uv.toml` on Windows."*
- *"User- and system-level configuration files cannot use the `pyproject.toml` format."*
- 🔴 *"If project-, user-, and system-level configuration files are found, the settings will be merged, with project-level configuration taking precedence over the user-level configuration, and user-level configuration taking precedence over the system-level configuration."*
- 🔴 *"If an array is present in both tables, the arrays will be concatenated, with the project-level settings appearing earlier in the merged array."*
- 🔴 *"Settings provided via environment variables take precedence over persistent configuration, and settings provided via the command line take precedence over both."*
- *"uv accepts a `--no-config` command-line argument which, when provided, disables the discovery of any persistent configuration."*
- *"uv also accepts a `--config-file` command-line argument, which accepts a path to a `uv.toml` to use as the configuration file. When provided, this file will be used in place of _any_ discovered configuration files."*
- *"`uv run` can load environment variables from dotenv files (e.g., `.env`, `.env.local`, `.env.development`)."*
- *"To load a `.env` file from a dedicated location, set the `UV_ENV_FILE` environment variable, or pass the `--env-file` flag to `uv run`."*
- *"The `--env-file` flag can be provided multiple times, with subsequent files overriding values defined in previous files."*
- *"To disable dotenv loading (e.g., to override `UV_ENV_FILE` or the `--env-file` command-line argument), set the `UV_NO_ENV_FILE` environment variable to `1`, or pass the`--no-env-file` flag to `uv run`."*
- 🔴 *"If the same variable is defined in the environment and in a `.env` file, the value from the environment will take precedence."*
- *"A dedicated `[tool.uv.pip]` section is provided for configuring _just_ the `uv pip` command line interface. Settings in this section will not apply to `uv` commands outside the `uv pip` namespace."*
- ⚠️ The fetch did not state whether dotenv loading is on by default or requires `--env-file`. Do not claim either way beyond the quotes.

## 22 · Tools concept — https://docs.astral.sh/uv/concepts/tools/

- *"In most cases, executing a tool with `uvx` is more appropriate than installing the tool."*
- *"Tools can be invoked without installation using `uv tool run`, in which case their dependencies are installed in a temporary virtual environment isolated from the current project."*
- *"Tools can also be installed with `uv tool install`, in which case their executables are available on the `PATH`."*
- *"When installing a tool with `uv tool install`, a virtual environment is created in the uv tools directory."*
- *"Unless a specific version is requested, `uv tool install` will install the latest available of the requested tool."*
- *"`uvx` will use the latest available version of the requested tool on the first invocation. After that, `uvx` will use the cached version."* (first fetch; a second fetch returned a context-dependent sentence about `@latest` — do not quote that one)
- 🔴 *"Tool upgrades will respect the version constraints provided when installing the tool."*
- Code on the page: `uv tool upgrade black --upgrade-package click`, `uv tool install black>=24` (changes the constraint), `uv tool upgrade black --reinstall`, `uv tool upgrade black --reinstall-package click`, `uvx --isolated ruff --version` (bypasses the installed version), `uv tool install --with <extra-package> <tool-package>`.
- *"Each tool environment is linked to a specific Python version."*
- 🔴 *"If the Python version used by a tool is _uninstalled_, the tool environment will be broken and the tool may be unusable."*
- (paraphrased by the fetch, NOT verbatim: tool environments ignore `.python-version` and `requires-python`. State it as "the page says tool environments ignore local version requests" without quote marks, or leave out.)
- 🔴 *"Tool environments are not intended to be mutated directly. It is strongly recommended never to mutate a tool environment manually."*
- *"Tools are always run isolated from the project."*
- *"Tool executables include all console entry points, script entry points, and binary scripts provided by a Python package."* — symlinked on Unix, copied on Windows (fetch paraphrase).
- 🔴 *"Executables provided by dependencies of tool packages are not installed."*
- 🔴 *"Installation of tools will not overwrite executables in the executable directory that were not previously installed by uv."* — `--force` overrides.
- 🔴 *"`uv tool run <name>` (or `uvx <name>`) is nearly equivalent to: `uv run --no-project --with <name> -- <name>`"*
- 🔴 *"If a tool is already installed, `uv tool run` will use the installed version but `uv run` will not"*

## 23 · Using tools guide — https://docs.astral.sh/uv/guides/tools/

- *"`uvx` is provided as an alias for convenience."*
- 🔴 *"If you are running a tool in a _project_ and the tool requires that your project is installed, e.g., when using `pytest` or `mypy`, you'll want to use `uv run` instead of `uvx`."*
- *"To run a tool at the latest version, use `command@latest`: `$ uvx ruff@latest check`"*
- Alternative: *"`$ uvx --from 'ruff==0.3.0' ruff check`"*
- Extras: *"`$ uvx --from 'mypy[faster-cache,reports]' mypy --xml-report mypy_report`"*
- Git: *"`$ uvx --from git+https://github.com/httpie/cli httpie`"*
- Python: *"`$ uvx --python 3.10 ruff`"* · *"`$ uv tool install --python 3.10 ruff`"*
- Constraint replace: *"`$ uv tool install ruff>=0.4`"*

## 24 · Storage — https://docs.astral.sh/uv/reference/storage/

- *"By default, tools are installed in a `tools/` subdirectory of the persistent data directory, e.g., `~/.local/share/uv/tools`."*
- *"Use the `UV_TOOL_DIR` environment variable to configure the installation directory."*
- *"By default, tool executables are stored in the executable directory."* Unix order: `$XDG_BIN_HOME` → `$XDG_DATA_HOME/../bin` → `$HOME/.local/bin`. Windows: `%XDG_BIN_HOME%` → `%XDG_DATA_HOME%\..\bin` → `%USERPROFILE%\.local\bin`.
- *"Use the `UV_TOOL_BIN_DIR` environment variable to configure the tool executable directory."*
- *"By default, Python versions managed by uv are stored in a `python/` subdirectory of the persistent data directory, e.g., `~/.local/share/uv/python`."*
- Cache: Unix `$XDG_CACHE_HOME/uv` or `$HOME/.cache/uv`; Windows `%LOCALAPPDATA%\uv\cache`.
- *"When using uv's standalone installer to install uv, the `uv` and `uvx` executables are installed into the executable directory."* · *"Use the `UV_INSTALL_DIR` environment variable to configure uv's installation directory."*

## 25 · CLI one-liners — https://docs.astral.sh/uv/reference/cli/

- `uv tool run` *"Run a command or script provided by a Python package"* · `uv tool install` *"Install a command provided by a Python package"* · `uv tool upgrade` *"Upgrade a command provided by a Python package"* · `uv tool list` *"List all installed tool commands"* · `uv tool uninstall` *"Uninstall a command provided by a Python package"* · `uv tool dir` *"Show the directory where uv tool commands are installed"*
- ⚠️ `uv tool update-shell`'s CLI one-liner came back as "Update shell completions…" — looks wrong; use the guide's sentence (§17) instead.
- `uv tool run --isolated` *"Run the command in an isolated virtual environment"* · `uv tool install --force` *"Force reinstall even if already installed"* · `uv tool install --editable` *"Install the command in editable mode"*
- `uv init` *"Create a new project"* · `--app` *"Create a project for an application"* · `--lib` *"Create a project for a library"* · `--package` *"Set up the project to be built as a Python package"* · `--no-package` *"Do not set up the project to be built as a Python package."* · `--bare` *"Only create a `pyproject.toml`"* · `--script` *"Create a script with embedded metadata"* · `--vcs` *"Initialize a version control system for the project."* · `--no-workspace` *"Avoid discovering a workspace and create a standalone project."* · `--no-readme` · `--no-pin-python` *"Do not create a `.python-version` file for the project."* · `--build-backend` *"Initialize a build-backend of choice for the project."* · `--python` *"The Python interpreter to use to determine the minimum supported Python version."*
- `uv build` *"Build Python packages into source distributions and wheels"* · `--no-sources` *"Ignore the `tool.uv.sources` table when building"*
- `uv publish` *"Upload distributions to an index"* · `uv tree` *"Display the project's dependency tree"* · `--outdated` *"Display outdated dependencies"* · `--invert` *"Invert the dependency tree display"* · `uv workspace` *"Inspect uv workspaces"*

## 26 · Creating projects — https://docs.astral.sh/uv/concepts/projects/init/

- *"By default, uv will create a project for an application."*
- *"Application projects are suitable for web servers, scripts, and command-line interfaces."*
- *"Libraries can be created by using the `--lib` flag"* · *"Libraries always require a packaged project."*
- 🔴 **As of the docs for uv 0.12.12, `uv init example-app` produces a src layout WITH a build system.** Verbatim example:
  ```toml
  [project]
  name = "example-app"
  version = "0.1.0"
  description = "Add your description here"
  readme = "README.md"
  requires-python = ">=3.11"
  dependencies = []

  [project.scripts]
  example-app = "example_app:main"

  [build-system]
  requires = ["uv_build>=0.12.12,<0.13"]
  build-backend = "uv_build"
  ```
  Tree: `.python-version`, `README.md`, `pyproject.toml`, `src/example_app/__init__.py`. `--lib` adds `py.typed` and has no `[project.scripts]`.
- 🔴 The generated `uv_build` requirement is bounded to the running uv's minor (`>=0.12.12,<0.13`).
- Default backend is `uv_build`; `--build-backend` alternatives named by the page (fetch-listed): hatchling, uv_build, flit-core, pdm-backend, setuptools, maturin, scikit-build-core.
- ⚠️ Older uv docs showed a flat `main.py` app with no build system. Which release changed the default was NOT fetched — say "older uv versions" without naming one.

## 27 · Workspaces — https://docs.astral.sh/uv/concepts/projects/workspaces/

- *"Inspired by the Cargo concept of the same name, a workspace is "a collection of one or more packages, called _workspace members_, that are managed together.""* (sentence shape reconstructed from two fetched fragments: quote the two fragments separately)
- 🔴 *"In a workspace, each package defines its own `pyproject.toml`, but the workspace shares a single lockfile, ensuring that the workspace operates with a consistent set of dependencies."*
- *"In defining a workspace, you must specify the `members` (required) and `exclude` (optional) keys, which direct the workspace to include or exclude specific directories as members respectively, and accept lists of globs"*
  ```toml
  [tool.uv.workspace]
  members = ["packages/*"]
  exclude = ["packages/seeds"]
  ```
- *"Within a workspace, dependencies on workspace members are facilitated via `tool.uv.sources`"* — `bird-feeder = { workspace = true }`
- *"The `workspace = true` key-value pair in the `tool.uv.sources` table indicates the `bird-feeder` dependency should be provided by the workspace"*
- 🔴 *"`uv lock` operates on the entire workspace at once, while `uv run` and `uv sync` operate on the workspace root by default, though both accept a `--package` argument"*
- *"Every directory included by the `members` globs (and not excluded by the `exclude` globs) must contain a `pyproject.toml` file."*
- 🔴 *"uv's workspaces enforce a single `requires-python` for the entire workspace, taking the intersection of all members' `requires-python` values."*
- *"Any `tool.uv.sources` definitions in the workspace root apply to all members, unless overridden in the `tool.uv.sources` of a specific member."*
- Not suitable for *"cases in which members have conflicting requirements, or desire a separate virtual environment for each member. In this case, path dependencies are often preferable."* — `bird-feeder = { path = "packages/bird-feeder" }`

## 28 · Building and publishing — https://docs.astral.sh/uv/guides/package/

- *"By default, `uv build` will build the project in the current directory, and place the built artifacts in a `dist/` subdirectory."*
- 🔴 *"When publishing a package, we recommend running `uv build --no-sources` to ensure that the package builds correctly when `tool.uv.sources` is disabled, as is the case when using other build tools."*
- *"To increase the version of your package semantics, use the `--bump` option"* — `uv version --bump minor`, `uv version --bump patch --bump beta` (the page shows the resulting versions; do not reproduce them as output)
- *"Set a PyPI token with `--token` or `UV_PUBLISH_TOKEN`, or set a username with `--username` or `UV_PUBLISH_USERNAME` and password with `--password` or `UV_PUBLISH_PASSWORD`."*
- *"For publishing to PyPI from GitHub Actions or another Trusted Publisher, you don't need to set any credentials."*
- `uv run --with <PACKAGE> --no-project -- python -c "import <PACKAGE>"` — *"`--no-project` flag is used to avoid installing the package from your local project directory."*

## 29 · Settings reference — https://docs.astral.sh/uv/reference/settings/

- 🔴 `required-version`: *"Enforce a requirement on the version of uv. If the version of uv does not meet the requirement at runtime, uv will exit with an error."*
- `managed`: *"Whether the project is managed by uv. If `false`, uv will ignore the project when `uv run` is invoked."*
- `environments`: *"A list of supported environments against which to resolve dependencies. By default, uv will resolve for all possible environments during a `uv lock` operation."*
- `required-environments`: *"A list of required platforms, for packages that lack source distributions. When a package does not have a source distribution, its availability will be limited to the platforms supported by its built distributions (wheels)."*
- `constraint-dependencies`: *"Constraints to apply when resolving the project's dependencies. Including a package as a constraint will _not_ trigger installation of the package on its own."*
- 🔴 `override-dependencies`: *"Overrides to apply when resolving the project's dependencies. While constraints are _additive_, overrides are _absolute_, completely replacing requirements of constituent packages."*
- `conflicts`: *"Declare collections of extras or dependency groups that are conflicting (mutually exclusive). By making such conflicts explicit, uv can generate a universal resolution for a project."*
- `default-groups`: *"The list of `dependency-groups` to install by default. Can also be the literal `"all"` to default enable all groups."*
- `exclude-newer`: *"Limit candidate packages to those that were uploaded prior to the given date. The date is compared against the upload time of each individual distribution artifact."*
- ⚠️ `python-downloads` and `[[tool.uv.index]]` `default`/`explicit` came back paraphrased. Index semantics as fetched (paraphrase, do NOT quote): `default = true` makes that index the lowest-priority fallback and disables PyPI; `explicit = true` makes it used only by packages that select it through `[tool.uv.sources]`.

## 30 · From pip to a uv project — https://docs.astral.sh/uv/guides/migration/pip-to-project/

- `uv add -r requirements.in`
- 🔴 `uv add -r requirements.in -c requirements.txt` — *"Your existing versions will be retained when producing a `uv.lock` file."*
- 🔴 *"Notice we used the `requirements.in` file, which does not pin to exact versions of packages so uv will solve for new versions of these packages."*
- `uv add --dev -r requirements-dev.in -c requirements-dev.txt` · `uv add -r requirements-docs.in -c requirements-docs.txt --group docs`
- `sed '/^-r /d' requirements-dev.in | uv add --dev -r - -c requirements-dev.txt` (dev `.in` files that start with `-r requirements.in`)
- `uv pip compile requirements.in -o requirements-win.txt --python-platform windows --no-strip-markers` then `uv add -r requirements.in -c requirements-win.txt -c requirements-linux.txt`
- ⚠️ Whether `uv pip sync` accepts several files at once was NOT confirmed (the CLI reference page is too long to fetch whole). Do not claim it.

## 31 · Docker guide, second pass — https://docs.astral.sh/uv/guides/integration/docker/

- 🔴 *"It is best practice to add `.venv` to a `.dockerignore` file in your repository to prevent it from being included in image builds. The project virtual environment is dependent on your local platform and should be created from scratch in the image."* (the `.dockerignore` link on the page is https://docs.docker.com/build/concepts/context/#dockerignore-files)
- 🔴 *"`uv sync` and `uv run` both accept a `--no-editable` flag, which instructs uv to install the project in non-editable mode, removing any dependency on the source code."*
- Multi-stage: *"Copy the environment, but not the source code"* — `COPY --from=builder /app/.venv /app/.venv`
- 🔴 *"Pinning a specific SHA256 is considered best practice in environments that require reproducible builds as tags can be moved across different commit SHAs."*
- ⚠️ Non-root users: not on the page as fetched. `UV_PYTHON_PREFERENCE` / `--no-managed-python`: not confirmed on the page.
