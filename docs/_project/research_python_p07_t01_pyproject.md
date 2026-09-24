---
name: research-python-p07-t01-pyproject
description: Banked primary-source research for devbible Python Phase 7 topic 01 (pyproject.toml) — verbatim quotes from packaging.python.org, the PyPA specifications, PEPs 517/518/621/639/660/794, pip, setuptools, flit, hatch. DO NOT RE-DERIVE.
metadata:
  type: research
  track: python
  topic: phase-7/01-pyproject-toml
  fetched: 2026-09-10
---

# 🔴 DO NOT RE-DERIVE — banked 2026-09-10

Every quote below was fetched once, on **2026-09-10**, from the primary source named.
Write chunks from this file. Re-fetching per chunk pays the research cost fourteen times
for the same document.

## Version spine (given as fact by the dispatch, 2026-09-10 — do not contradict)

- **Python 3.14.7** (released 2026-08-05)
- **uv 0.12.12** (2026-09-09)
- **ruff 0.16.6** (2026-09-03)
- **pre-commit 4.6.2** (2026-08-10)
- Core metadata: legal values observed on packaging.python.org today are
  `"1.0", "1.1", "1.2", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6"`.
- PEP 794 (`Import-Name` / `Import-Namespace`, core metadata **2.5**) is **Accepted**.

---

## 1 · PEP 518 — https://peps.python.org/pep-0518/

The catch-22 (the sentence the whole topic hangs on):

> *"You can't execute a `setup.py` file without knowing its dependencies, but currently
> there is no standard way to know what those dependencies are in an automated fashion
> without executing the `setup.py` file where that information is stored."*

> *"It's a catch-22 of a file not being runnable without knowing its own contents which
> can't be known programmatically unless you run the file."*

On `setup_requires`:

> *"No tooling (besides setuptools itself) can access this information without executing
> the `setup.py`, but `setup.py` can't be executed without having these items installed."*

Why TOML:

> *"This format was chosen as it is human-usable (unlike JSON), it is flexible enough
> (unlike configparser), stems from a standard (also unlike configparser), and it is not
> overly complex (unlike YAML)."*

`requires`:

> *"This key must have a value of a list of strings representing PEP 508 dependencies
> required to execute the build system (currently that means what dependencies are
> required to execute a `setup.py` file)."*

Missing table:

> *"If the file exists but is lacking the `[build-system]` table then the default values
> as specified above should be used."*

The `[tool]` table:

> *"The `[tool]` table is where any tool related to your Python project, not just build
> tools, can have users specify configuration data as long as they use a sub-table within
> `[tool]`"* — example given: *"the flit tool would store its configuration in
> `[tool.flit]`"*.

🔴 The ownership rule:

> *"A project can use the subtable `tool.$NAME` if, and only if, they own the entry for
> `$NAME` in the Cheeseshop/PyPI."*

---

## 2 · PEP 517 — https://peps.python.org/pep-0517/

The three problems with distutils/setuptools:

> *"While `distutils` / `setuptools` have taken us a long way, they suffer from three
> serious problems: (a) they're missing important features like usable build-time
> dependency declaration, autoconfiguration, and even basic ergonomic niceties like
> DRY-compliant version number management, and (b) extending them is difficult, so while
> there do exist various solutions to the above problems, they're often quirky, fragile,
> and expensive to maintain, and yet (c) it's very difficult to use anything else,
> because distutils/setuptools provide the standard interface for installing packages
> expected by both users and installation tools like `pip`."*

`build-backend`:

> *"`build-backend` is a string naming a Python object that will be used to perform the
> build... This is formatted following the same `module:object` syntax as a `setuptools`
> entry point."*

> *"if the string is `"flit.api:main"` as in the example above, this object would be
> looked up by executing the equivalent of: `import flit.api` then
> `backend = flit.api.main`"*

`backend-path`:

> *"Projects can specify that their backend code is hosted in-tree by including the
> `backend-path` key in `pyproject.toml`. This key contains a list of directories, which
> the frontend will add to the start of `sys.path` when loading the backend, and running
> the backend hooks."*

Hooks:

> *"def build_wheel(wheel_directory, config_settings=None, metadata_directory=None): ...
> Must build a .whl file, and place it in the specified `wheel_directory`. It must return
> the basename (not the full path) of the `.whl` file it creates, as a unicode string."*

> *"def build_sdist(sdist_directory, config_settings=None): ... Must build a .tar.gz
> source distribution and place it in the specified `sdist_directory`."*

> *"This hook MUST return an additional list of strings containing PEP 508 dependency
> specifications, above and beyond those specified in the `pyproject.toml` file, to be
> installed when calling the `build_wheel` or `prepare_metadata_for_build_wheel` hooks."*
> (`get_requires_for_build_wheel`)

> *"Must create a `.dist-info` directory containing wheel metadata inside the specified
> `metadata_directory`... This directory MUST be a valid `.dist-info` directory as defined
> in the wheel specification, except that it need not contain `RECORD` or signatures."*
> (`prepare_metadata_for_build_wheel`)

Environment:

> *"All requirements specified by the project's build-requirements must be available for
> import from Python."*

> *"Frontends should call each hook in a fresh subprocess, so that backends are free to
> change process global state (such as environment variables or the working directory)."*

> *"A build backend MUST be prepared to function in any environment which meets the above
> criteria. In particular, it MUST NOT assume that it has access to any packages except
> those that are present in the stdlib, or that are explicitly declared as
> build-requirements."*

🔴 The legacy fallback:

> *"If the `pyproject.toml` file is absent, or the `build-backend` key is missing, the
> source tree is not using this specification, and tools should revert to the legacy
> behaviour of running `setup.py` (either directly, or by implicitly invoking the
> `setuptools.build_meta:__legacy__` backend)."*

---

## 3 · PEP 621 — https://peps.python.org/pep-0621/

> *"This PEP specifies how to write a project's core metadata in a `pyproject.toml` file
> for packaging-related tools to consume."*

Rationale bullets:

> *"Provide a tool-agnostic way of specifying metadata for ease of learning and
> transitioning between build back-ends"*

> *"Allow for more code sharing between build back-ends for the 'boring parts' of a
> project's metadata"*

`dynamic`:

> *"Specifies which fields listed by this PEP were intentionally unspecified so another
> tool can/will provide such metadata dynamically."*

> *"By requiring that dynamic metadata be specified, it disambiguates the intent when
> metadata goes unspecified"*

`name` static requirement:

> *"Tools MUST require users to statically define this field"*

🔴 No extension of `[project]`:

> *"No tools may add fields to this table which are not defined by this PEP or subsequent
> PEPs. For tools wishing to store their own settings in `pyproject.toml`, they may use
> the `[tool]` table as defined in PEP 518."*

⚠️ **Not confirmed:** PEP 621 does not contain a single sentence saying "only `name` and
`version` are required". The current spec states it differently (see §4).

---

## 4 · The pyproject.toml specification — https://packaging.python.org/en/latest/specifications/pyproject-toml/

`[build-system]`:

> *"The `[build-system]` table is used to store build-related data. Initially, only one
> key of the table is valid and is mandatory for the table: `requires`."*

> *"This key must have a value of a list of strings representing dependencies required to
> execute the build system."*

> *"If the file exists but is lacking the `[build-system]` table then the default values
> as specified above should be used."*

> *"Build tools are expected to use the example configuration file above as their default
> semantics when a `pyproject.toml` file is not present."*

> *"If the table is specified but is missing required fields then the tool should consider
> it an error."*

Example shown on the page:

```toml
[build-system]
# Minimum requirements for the build system to execute.
requires = ["setuptools"]
```

`name`:

> *"The name of the project. Tools SHOULD normalize this name, as soon as it is read for
> internal consistency."*

`version`:

> *"The version of the project, as defined in the Version specifier specification."*

> *"The keys which are required but may be specified _either_ statically or listed as
> dynamic are: * `version`"*

`description`:

> *"The summary description of the project in one line. Tools MAY error if this includes
> multiple lines."*

`readme`:

> *"If it is a string then it is a path relative to `pyproject.toml` to a text file
> containing the full description."*

> *"If the file path ends in a case-insensitive `.md` suffix, then tools MUST assume the
> content-type is `text/markdown`."*

> *"If the file path ends in a case-insensitive `.rst`, then tools MUST assume the
> content-type is `text/x-rst`."*

> *"A table specified in the `readme` key also has a `content-type` key which takes a
> string specifying the content-type of the full description. A tool MUST raise an error
> if the metadata does not specify this key in the table. If the metadata does not specify
> the `charset` parameter, then it is assumed to be UTF-8."*

> *"These keys are mutually-exclusive, thus tools MUST raise an error if the metadata
> specifies both keys."*

`requires-python`:

> *"The Python version requirements of the project."* → core metadata `Requires-Python`.

`license` (string form, PEP 639):

> *"Text string that is a valid SPDX license expression."*

> *"This key should **only** be specified if the license expression for any and all
> distribution files created by a build backend using the `pyproject.toml` is the same as
> the one specified."*

`license` (table form):

> *"These keys are mutually exclusive, so a tool MUST raise an error if the metadata
> specifies both keys."*

> *"The table subkeys were deprecated by PEP 639 in favor of the string value."*

`license-files`:

> *"The strings MUST contain valid glob patterns, as specified in glob patterns."*

> *"Tools MUST assume that license file content is valid UTF-8 encoded text, and SHOULD
> validate this and raise an error if it is not."*

> *"Build tools: MUST include all files matched by a listed pattern in all distribution
> archives."*

> *"If the `license-files` key is present and is set to a value of an empty array, then
> tools MUST NOT include any license files and MUST NOT raise an error."*

`authors` / `maintainers`:

> *"Both keys are optional, but at least one of the keys must be specified in the table."*

> *"The `name` value MUST be a valid email name (i.e. whatever can be put as a name,
> before an email, in RFC 822) and not contain commas."*

> *"The `email` value MUST be a valid email address."*

`keywords`:

> *"The keywords for the project."*

`classifiers`:

> *"Trove classifiers which apply to the project."*

> *"The use of `License ::` classifiers is deprecated and tools MAY issue a warning
> informing users about that."*

`urls`:

> *"A table of URLs where the key is the URL label and the value is the URL itself."*

Entry points:

> *"The key of the table is the name of the entry point and the value is the object
> reference."*

> *"Build back-ends MUST raise an error if the metadata defines a
> `[project.entry-points.console_scripts]` or `[project.entry-points.gui_scripts]` table,
> as they would be ambiguous."*

`dependencies`:

> *"Each string represents a dependency of the project and MUST be formatted as a valid
> dependency specifier."*

> *"Each string maps directly to a Requires-Dist entry."*

`optional-dependencies`:

> *"The keys MUST be valid values for Provides-Extra."*

> *"Each value in the array thus becomes a corresponding Requires-Dist entry for the
> matching Provides-Extra metadata."*

> *"Optional dependencies are thus only considered for installation if installation if the
> associated extra name is requested."* (sic — the doubled "if installation if" is in the
> source as fetched; quote it with `[sic]` or paraphrase around it)

`dynamic`:

> *"A build back-end MUST honour statically-specified metadata (which means the metadata
> did not list the key in `dynamic`)."*

> *"A build back-end MUST raise an error if the metadata specifies `name` in `dynamic`."*

> *"Build back-ends MUST raise an error if the metadata specifies a key statically as well
> as being listed in `dynamic`, _unless_ the key represents a list or arbitrary table that
> can be extended."*

> *"When such a key is specified both statically and listed in `dynamic`: A build back-end
> MAY only _append_ entries to the value; it MUST NOT remove, reorder, or modify any
> statically-specified entries."*

Keys that MAY be listed in `dynamic`, as enumerated on the page today:
`authors, classifiers, dependencies, entry-points, gui-scripts, import-names,
import-namespaces, keywords, license-files, maintainers, optional-dependencies, scripts,
urls`

`[tool]`:

> *"The `[tool]` table is where any tool related to your Python project, not just build
> tools, can have users specify configuration data as long as they use a sub-table within
> `[tool]`, e.g. the flit tool would store its configuration in `[tool.flit]`."*

---

## 5 · Writing your pyproject.toml — https://packaging.python.org/en/latest/guides/writing-pyproject-toml/

> *"`pyproject.toml` is a configuration file used by packaging tools, as well as other
> tools such as linters, type checkers, etc. There are three possible TOML tables in this
> file."*

> *"The `[tool]` table has tool-specific subtables, e.g., `[tool.hatch]`, `[tool.black]`,
> `[tool.mypy]`. We only touch upon this table here because its contents are defined by
> each tool."*

> *"You may want to make some of your dependencies optional, if they are only needed for a
> specific feature of your package. In that case, put them in `optional-dependencies`."*

> *"Each of the keys defines a 'packaging extra'... one could use, e.g.,
> `pip install your-project-name[gui]` to install your project with GUI support."*

🔴 `requires-python` vs classifiers:

> *"Although the list of classifiers is often used to declare what Python versions a
> project supports, this information is only used for searching and browsing projects on
> PyPI, not for installing projects. To actually restrict what Python versions a project
> can be installed on, use the `requires-python` argument."*

> *"This lets you declare the minimum version of Python that you support."*
> (`requires-python`)

> *"When a field is dynamic, it is the build backend's responsibility to fill it. Consult
> your build backend's documentation to learn how it does it."*

> *"To install a command as part of your package, declare it in the `[project.scripts]`
> table... Executing this command will do the equivalent of
> `import sys; from spam import main_cli; sys.exit(main_cli())`."*

> *"Usually, you'll just copy what your build backend's documentation suggests (after
> choosing your build backend)."*

Backends named on this page: Hatchling, setuptools, Flit, PDM, and uv-build.

---

## 6 · Name normalization — https://packaging.python.org/en/latest/specifications/name-normalization/

Valid name regex, as printed on the page:

```
^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])\Z
```

(matched case-insensitively)

> *"The name should be lowercased with all runs of the characters `.`, `-`, or `_`
> replaced with a single `-` character."*

```python
import re

def normalize(name):
    return re.sub(r"[-_.]+", "-", name).lower()
```

> *"This means that the following names are all equivalent:"* — followed by
`friendly-bard`, `Friendly-Bard`, `friendly.bard`, `friendly_bard`, and further variants.

⚠️ **Not on this page:** any statement about escaping runs of characters to `_` in wheel
or sdist filenames. Do not claim the filename rule from this URL.

---

## 7 · Core metadata — https://packaging.python.org/en/latest/specifications/core-metadata/

`Metadata-Version`:

> *"Version of the file format; legal values are "1.0", "1.1", "1.2", "2.1", "2.2",
> "2.3", "2.4", "2.5", and "2.6"."*

`Requires-Python`:

> *"This field specifies the Python version(s) that the distribution is compatible with.
> Installation tools may look at this when picking which version of a project to
> install."*

`Requires-Dist`:

> *"Each entry contains a string naming some other distutils project required by this
> distribution."*

`Provides-Extra`:

> *"A string containing the name of an optional feature. A valid name consists only of
> lowercase ASCII letters, ASCII numbers, and hyphen."* — regex `^[a-z0-9]+(-[a-z0-9]+)*$`

`Dynamic`:

> *"The field names `Name`, `Version`, and `Metadata-Version` may not be specified in this
> field."*

`License-Expression`: *"Text string that is a valid SPDX license expression"*
`License-File`: *"Each entry is a string representation of the path of a license-related
file."*
`Name`: *"The name of the distribution...must conform to the name format specification."*

---

## 8 · PEP 639 — https://peps.python.org/pep-0639/

> *"This PEP defines a specification how licenses are documented in the Python projects."*

> *"The `License-Expression` optional [Core Metadata field] is specified to contain a text
> string that is a valid SPDX [license expression]"*

> *"Build and publishing tools SHOULD check that the `License-Expression` field contains a
> valid SPDX expression"*

> *"The legacy unstructured-text `License` [Core Metadata field] is deprecated and
> replaced by the new `License-Expression` field."*

> *"Using [license classifier]s in the `Classifier` [Core Metadata field] is deprecated
> and replaced by the more precise `License-Expression` field."*

> *"Table values for the `license` key in the `[project]` table, including the `text` and
> `file` table subkeys, are now deprecated."*

> *"Tools also SHOULD store a case-normalized version of the `License-Expression` field
> using the reference case for each SPDX license identifier and uppercase for the `AND`,
> `OR` and `WITH` keywords."*

> *"If the `License-Expression` field is present, build tools MAY raise an error if one or
> more license classifiers is included in a `Classifier` field"*

⚠️ **Not settled by the fetch:** no mandatory default for `license-files` when the key is
absent. Write that as unspecified-by-the-spec / backend-defined.

---

## 9 · Dependency groups (PEP 735) — https://packaging.python.org/en/latest/specifications/dependency-groups/

> *"This specification defines dependency groups, a mechanism for storing package
> requirements in `pyproject.toml` files such that they are not included in project
> metadata when it is built."*

🔴 > *"Build backends MUST NOT include Dependency Group data in built distributions as
package metadata."*

> *"Dependency groups are suitable for internal development use-cases like linting and
> testing, as well as for projects which are not built for distribution, like collections
> of related scripts."*

> *"An include is a table with exactly one key, `"include-group"`, whose value is a
> string, the name of another Dependency Group."*

> *"Includes are defined to be exactly equivalent to the contents of the named Dependency
> Group, inserted into the current group at the location of the include."*

> *"[dependency-groups] keys, sometimes also called 'group names', must be valid
> non-normalized names. Tools which handle Dependency Groups MUST normalize these names
> before comparisons."*

> *"Dependency Group Includes MUST NOT include cycles, and tools SHOULD report an error if
> they detect a cycle."*

Also noted on the page: there is *"no syntax or specification-defined interface for
installing or referring to dependency groups"* — which is what separates a group from an
extra.

---

## 10 · Dependency specifiers — https://packaging.python.org/en/latest/specifications/dependency-specifiers/

Grammar, verbatim:

```
name_req = name wsp* extras? wsp* versionspec? wsp* quoted_marker?
quoted_marker = ';' wsp* marker
url_req = name wsp* extras? wsp* urlspec
```

Marker fields tabled on the page include `python_version` (Version, e.g. 3.9, 3.15),
`sys_platform` (String, e.g. linux, win32, darwin), `platform_machine` (String, e.g.
x86_64, aarch64), `os_name` (String, e.g. posix, java), and `extra`.

> *"extra == "name" in a dependency declaration is similar to "name" in extras, while
> extra != "name" is similar to "name" not in extras."*

> *"publishing tools SHOULD emit an error if projects attempt to reference the extras or
> dependency_groups fields in their published dependency declaration metadata"*

⚠️ **Not stated on this page:** any prohibition on URL dependencies in PyPI uploads. PyPI
itself rejects them, but this URL does not say so — do not cite this page for that claim.

---

## 11 · Version specifiers — https://packaging.python.org/en/latest/specifications/version-specifiers/

> *"For a given release identifier `V.N`, the compatible release clause is approximately
> equivalent to the pair of comparison clauses: `>= V.N, == V.*`"* — with `~= 2.2`
> equivalent to `>= 2.2, == 2.*`

> *"Prefix matching may be requested instead of strict comparison, by appending a trailing
> `.*` to the version identifier in the version matching clause."*

> *"Pre-releases of any kind, including developmental releases, are implicitly excluded
> from all version specifiers, _unless_ they are already present on the system, explicitly
> requested by the user, or if the only available version that satisfies the version
> specifier is a pre-release."*

⚠️ **Not on this page as fetched:** a section on how `Requires-Python` is interpreted, or
a MUST-NOT-install sentence. The strongest available statement is the core metadata one in
§7 (*"Installation tools may look at this…"*). Do not upgrade "may" to "must".

---

## 12 · Entry points — https://packaging.python.org/en/latest/specifications/entry-points/

> *"The **object reference** points to a Python object. It is either in the form
> `importable.module`, or `importable.module:object.attr`. Each of the parts delimited by
> dots and the colon is a valid Python identifier."*

> *"Within a value, readers must accept and ignore spaces (including multiple consecutive
> spaces) before or after the colon, between the object reference and the left square
> bracket."*

> *"Install tools are expected to set up wrappers for both `console_scripts` and
> `gui_scripts` in the scripts directory of the install scheme."*

> *"Entry points are defined in a file called `entry_points.txt` in the `*.dist-info`
> directory of the distribution."*

> *"The name may contain any characters except `=`, but it cannot start or end with any
> whitespace character, or start with `[`. For new entry points, it is recommended to use
> only letters, numbers, underscores, dots and dashes (regex `[\w.-]+`)."*

---

## 13 · pip build system reference — https://pip.pypa.io/en/stable/reference/build-system/

> *"For building packages using this interface, pip uses an _isolated environment_. That
> is, pip will install build-time Python dependencies in a temporary directory which will
> be added to `sys.path` for the build commands."*

> *"This can be disabled using the `--no-build-isolation` flag -- users supplying this flag
> are responsible for ensuring the build environment is managed appropriately, including
> ensuring that all required build-time dependencies are installed, since pip does not
> manage build-time dependencies when this flag is passed."*

🔴 > *"If a project does not have a `pyproject.toml` file containing a `build-system`
> section, and contains a `setup.py` it will be assumed to have the following backend
> settings: [build-system] requires = ["setuptools>=40.8.0"]
> build-backend = "setuptools.build_meta:__legacy__""*

⚠️ pip's docs do **not** contain a sentence contrasting `setuptools.build_meta` with
`setuptools.build_meta:__legacy__`. Explain the difference mechanically (the legacy backend
is the one selected when there is no declared backend) and do not attribute a comparison to
pip.

---

## 14 · setuptools — https://setuptools.pypa.io/en/latest/userguide/pyproject_config.html

> *"If compatibility with legacy builds or versions of tools that don't support certain
> packaging standards (e.g. PEP 517 or PEP 660), a simple `setup.py` script can be added to
> your project (while keeping the configuration in `pyproject.toml`)"*

> *"When these fields are expected to be provided by `setuptools` a corresponding entry is
> required in the `tool.setuptools.dynamic` table. For example:
> version = {attr = "my_package.__version__"} [and]
> readme = {file = ["README.rst", "USAGE.rst"]}"*

> *"When both `py-modules` and `packages` are left unspecified, `setuptools` will attempt
> to perform Automatic discovery...you might need to use the `find` directive"*

⚠️ The page does **not** say setup.py is "no longer required" in so many words, and does
**not** warn against running `python setup.py`. Do not attribute either sentence to it.

---

## 15 · flit — https://flit.pypa.io/en/stable/pyproject_toml.html

> *"If you want Flit to get this from a `__version__` attribute, leave it out of the TOML
> config and include "version" in the `dynamic` field."*

> *"If you want Flit to get this from the module docstring, leave it out of the TOML config
> and include "description" in the `dynamic` field."*

> *"The name your package will have on PyPI. This field is required. For Flit, this name,
> with any hyphens replaced by underscores, is also the default value of the import name."*

> *"Flit looks for the source of the package by its import name. The source may be located
> either in the directory that holds the `pyproject.toml` file, or in a `src/`
> subdirectory."*

⚠️ Flit's docs as fetched do not state that it *imports* your module. Say "reads" and do
not claim the mechanism.

---

## 16 · hatch / hatchling

https://hatch.pypa.io/latest/version/

> *"When the version is not statically set, configuration is defined in the
> `tool.hatch.version` table."*

```toml
[tool.hatch.version]
path = "src/hatch_demo/__about__.py"
```

https://hatch.pypa.io/latest/config/metadata/

> *"By default, dependencies are not allowed to define direct references. To disable this
> check, set `allow-direct-references` to `true`"*

⚠️ Not confirmed: hatchling's exact error text for a field that is dynamic but
unconfigured, and the exact TOML for `source = "vcs"`. Do not invent either.

---

## 17 · PEP 660 — https://peps.python.org/pep-0660/

> *"This document describes a PEP 517 style method for the installation of packages in
> editable mode."*

> *"The only way to retain editable installs for these distributions was to provide a
> compatible setup.py develop implementation."*

> *"Must build a .whl file, and place it in the specified wheel_directory."*
> (`build_editable`) — listed among *"three optional hooks"*.

> *"If a build frontend needs this information and the method is not defined, it should
> call build_editable and look at the resulting metadata directly."*
> (`prepare_metadata_for_build_editable`)

> *"The .whl file must comply with the Wheel binary file format specification (PEP 427)."*

> *"Build backends may use different techniques to achieve the goals of an editable
> install. This section provides examples and is not normative."*

---

## 18 · Backend `[build-system]` blocks, verbatim from the PyPA tutorial

https://packaging.python.org/en/latest/tutorials/packaging-projects/

> *"this tutorial uses Hatchling by default, but it will work identically with Setuptools,
> Flit, PDM, and others"*

> *"The build backend determines how your project will specify its configuration,
> including metadata and input files."*

> *"The `pyproject.toml` tells build frontend tools like pip and build which backend to use
> for your project."*

```toml
[build-system]
requires = ["hatchling >= 1.26"]
build-backend = "hatchling.build"
```

```toml
[build-system]
requires = ["setuptools >= 77.0.3"]
build-backend = "setuptools.build_meta"
```

```toml
[build-system]
requires = ["flit_core >= 3.12.0, <5"]
build-backend = "flit_core.buildapi"
```

```toml
[build-system]
requires = ["pdm-backend >= 2.4.0"]
build-backend = "pdm.backend"
```

⚠️ maturin's `[build-system]` block was **not** fetched. If a chunk names maturin, describe
it without quoting a `requires` pin, or say the pin was not verified.

---

## 19 · What I could NOT confirm — carry these forward as uncertain

1. No primary sentence saying installers **MUST** refuse a distribution whose
   `Requires-Python` does not match. Core metadata says *"may look at this"*.
2. No sentence in setuptools' docs declaring `setup.py` optional/obsolete.
3. No PEP 621 sentence stating "`name` and `version` are the only required fields".
4. hatchling's exact error strings, and the `source = "vcs"` TOML.
5. Whether PyPI rejects direct-URL dependencies — the dependency-specifiers spec does not
   say so; do not cite it for that.
6. maturin's current `requires` pin.
7. The default for `license-files` when the key is absent.

---

## 20 · Added during writing — two more verified sources (same date, 2026-09-10)

### Core metadata, `Classifier` field — https://packaging.python.org/en/latest/specifications/core-metadata/

> *"Each entry is a string giving a single classification value for the distribution."*

> *"Classifiers are described in PEP 301, and the Python Package Index publishes a dynamic
> list of currently defined classifiers."*

⚠️ The spec establishes classifiers as a **controlled vocabulary owned by PyPI**, but does
**not** state that an unknown classifier is rejected. The `Private :: Do Not Upload` guard
relies on index behaviour, not on a spec guarantee. Written up as such in chunk 09.

### Configuring Ruff — https://docs.astral.sh/ruff/configuration/

🔴 Precedence, verbatim:

> *"If Ruff detects multiple configuration files in the same directory, the `.ruff.toml`
> file will take precedence over the `ruff.toml` file, and the `ruff.toml` file will take
> precedence over the `pyproject.toml` file."*

> *"In locating the 'closest' `pyproject.toml` file for a given path, Ruff ignores any
> `pyproject.toml` files that lack a `[tool.ruff]` section."*

`--config`:

> *"Either a path to a TOML configuration file (`pyproject.toml` or `ruff.toml`), or a TOML
> `<KEY> = <VALUE>` pair overriding a specific configuration option."*

`--show-settings`:

> *"See the settings Ruff will use to lint a given Python file"*

---

## 21 · Topic 01 status — CLOSED 2026-09-10

15 files, 3,370 lines, positions 0–14, no lettered splits needed (every chunk landed
180–274 lines by choosing narrow concept boundaries up front). Real footers wired on all
15 — **no `{/* FOOTER */}` markers remain**. mdxcheck 0 hazards, `yarn linkcheck` 0 problems.
Every reference out of the topic directory is de-linked bold text; the only external link is
the phase index `../README.md`.

**Invented error strings removed in a correctness pass:** seven tool-specific message
strings originally written as illustrative were replaced with prose descriptions (chunks
02 ×3, 03, 07, 08, 13). Retained deliberately: CPython exception formats
(`ModuleNotFoundError: No module named 'x'`, `TypeError: … takes 1 positional argument but
0 were given`) and the POSIX shell's `command not found` — language/shell-level, not tool
output.
