---
name: research-python-p07-t03-dependencies
description: Banked primary-source research for devbible Python Phase 7 topic 03 "Dependencies done right" — PEP 440/508/621/631/685/735/751, packaging.python.org specs, pip docs, uv docs. Every load-bearing sentence quoted verbatim with URL. do not re-derive.
metadata:
  type: research
  project: devbible
  track: python
  topic: phase-7-packaging-tooling/03-dependencies
  fetched: 2026-09-10
---

# 🔴 do not re-derive — banked 2026-09-10

Fetched **once** on 2026-09-10 with `curl` + a stdlib HTML→text filter, so every string
below is the upstream page's own text, not a paraphrase. Written the whole topic from
this file. If a later session needs a claim that is **not** here, that is the signal to
fetch — not the excuse to re-fetch what is.

## Version spine (given as fact by the dispatch, 2026-09-10 — do not re-check)

| Thing | Version | Released |
|---|---|---|
| CPython | **3.14.7** | 2026-08-05 |
| uv | **0.12.12** | 2026-09-09 |
| ruff | 0.16.6 | 2026-09-03 |
| pre-commit | 4.6.2 | 2026-08-10 |

Topic spine on the `> Verified:` lines: the **PyPA specifications** (PEP 440, 508, 621,
735) plus **Python 3.14.7**; uv commands named against **uv 0.12.12**.

---

## 1 · PEP 440 / "Version specifiers" spec

URLs:
- `https://peps.python.org/pep-0440/`
- `https://packaging.python.org/en/latest/specifications/version-specifiers/` (canonical; PEP 440 now carries *"This PEP is a historical document. The up-to-date, canonical spec, Version specifiers, is maintained on the PyPA specs page."*)

### Version scheme

> *"The canonical public version identifiers MUST comply with the following scheme:
> `[N!]N(.N)*[{a|b|rc}N][.postN][.devN]`"*

> *"Public version identifiers are separated into up to five segments: Epoch segment: `N!`
> · Release segment: `N(.N)*` · Pre-release segment: `{a|b|rc}N` · Post-release segment:
> `.postN` · Development release segment: `.devN`"*

> *"All numeric components MUST be interpreted and ordered according to their numeric
> value, not as text strings."*

> *"Comparison and ordering of release segments considers the numeric value of each
> component of the release segment in turn. When comparing release segments with different
> numbers of components, the shorter segment is padded out with additional zeros as
> necessary."*

> *"`X.Y` and `X.Y.0` are not considered distinct release numbers, as the release segment
> comparison rules implicit expand the two component form to `X.Y.0` when comparing it to
> any release segment that includes three components."*

> *"Developmental releases are ordered by their numerical component, immediately before the
> corresponding release (and before any pre-releases with the same release segment), and
> following any previous release (including any post-releases)."*

> *"Post-releases are ordered by their numerical component, immediately following the
> corresponding release, and ahead of any subsequent release."*

> *"Pre-releases for a given release are ordered first by phase (alpha, beta, release
> candidate) and then by the numerical component within that phase."*

Epoch:

> *"If no explicit epoch is given, the implicit epoch is `0`."*
> *"Most version identifiers will not include an epoch, as an explicit epoch is only needed
> if a project changes the way it handles version numbering in a way that means the normal
> version ordering rules will give the wrong answer."*

Doc's own example of the epoch sort problem: `1.0 1.1 2.0 2013.10 2014.04` becomes
`2013.10 2014.04 1!1.0 1!1.1 1!2.0`.

### Local versions

> *"Local version identifiers MUST comply with the following scheme:
> `<public version identifier>[+<local version label>]`"*

> *"Local version identifiers are used to denote fully API (and, if applicable, ABI)
> compatible patched versions of upstream projects."*

> *"As the Python Package Index is intended solely for indexing and hosting upstream
> projects, it MUST NOT allow the use of local version identifiers."*

> *"Except where specifically noted below, local version identifiers MUST NOT be permitted
> in version specifiers, and local version labels MUST be ignored entirely when checking if
> candidate versions match a given version specifier."*

Local label charset: ASCII letters, ASCII digits, periods; must start and end with a
letter or digit. Comparison: per-segment, digit-only segments compare as integers, a
numeric segment compares **greater** than a lexicographic one, and more segments beats
fewer when the shorter is a prefix.

### Normalization (all verbatim)

> *"All ascii letters should be interpreted case insensitively within a version and the
> normal form is lowercase. This allows versions such as `1.1RC1` which would be normalized
> to `1.1rc1`."*

> *"All integers are interpreted via the `int()` built in and normalize to the string form
> of the output. This means that an integer version of `00` would normalize to `0` while
> `09000` would normalize to `9000`."*

> *"Pre-releases should allow a `.`, `-`, or `_` separator between the release segment and
> the pre-release segment. The normal form for this is without a separator."*

> *"Pre-releases allow the additional spellings of `alpha`, `beta`, `c`, `pre`, and
> `preview` for `a`, `b`, `rc`, `rc`, and `rc` respectively."*

> *"Pre releases allow omitting the numeral in which case it is implicitly assumed to be
> `0`. The normal form for this is to include the `0` explicitly. This allows versions such
> as `1.2a` which is normalized to `1.2a0`."*

> *"Post-releases allow the additional spellings of `rev` and `r`. This allows versions such
> as `1.0-r4` which normalizes to `1.0.post4`."*

> *"Post releases allow omitting the post signifier all together. When using this form the
> separator MUST be `-` and no other form is allowed. This allows versions such as `1.0-1`
> to be normalized to `1.0.post1`. This particular normalization MUST NOT be used in
> conjunction with the implicit post release number rule. In other words, `1.0-` is not a
> valid version and it does not normalize to `1.0.post0`."*

> *"Installation tools SHOULD interpret `c` versions as being equivalent to `rc` versions
> (that is, `c1` indicates the same version as `rc1`)."*

### The operators

> *"`~=`: Compatible release clause · `==`: Version matching clause · `!=`: Version
> exclusion clause · `<=`, `>=`: Inclusive ordered comparison clause · `<`, `>`: Exclusive
> ordered comparison clause · `===`: Arbitrary equality clause."*

> *"The comma (“,”) is equivalent to a logical and operator: a candidate version must match
> all given version clauses in order to match the specifier as a whole."*

> *"When multiple candidate versions match a version specifier, the preferred version SHOULD
> be the latest version as determined by the consistent ordering defined by the standard
> Version scheme."*

#### `~=` compatible release

> *"For a given release identifier `V.N`, the compatible release clause is approximately
> equivalent to the pair of comparison clauses: `>= V.N, == V.*`"*

> *"This operator MUST NOT be used with a single segment version number such as `~=1`."*

> *"`~= 2.2` → `>= 2.2, == 2.*`" · "`~= 1.4.5` → `>= 1.4.5, == 1.4.*`"*

> *"If a pre-release, post-release or developmental release is named in a compatible release
> clause as `V.N.suffix`, then the suffix is ignored when determining the required prefix
> match"* — `~= 2.2.post3` → `>= 2.2.post3, == 2.*`; `~= 1.4.5a4` → `>= 1.4.5a4, == 1.4.*`.

> *"The padding rules for release segment comparisons means that the assumed degree of
> forward compatibility in a compatible release clause can be controlled by appending
> additional zeros to the version specifier"* — `~= 2.2.0` → `>= 2.2.0, == 2.2.*`;
> `~= 1.4.5.0` → `>= 1.4.5.0, == 1.4.5.*`.

Examples section, verbatim:

> *"`~=3.1`: version 3.1 or later, but not version 4.0 or later. · `~=3.1.2`: version 3.1.2
> or later, but not version 3.2.0 or later. · `~=3.1a1`: version 3.1a1 or later, but not
> version 4.0 or later. · `== 3.1`: specifically version 3.1 (or 3.1.0), excludes all
> pre-releases, post releases, developmental releases and any 3.1.x maintenance releases. ·
> `== 3.1.*`: any version that starts with 3.1. Equivalent to the `~=3.1.0` compatible
> release clause. · `~=3.1.0, != 3.1.3`: version 3.1.0 or later, but not version 3.1.3 and
> not version 3.2.0 or later."*

#### `==` and `.*`

> *"By default, the version matching operator is based on a strict equality comparison: the
> specified version must be exactly the same as the requested version. The only substitution
> performed is the zero padding of the release segment to ensure the release segments are
> compared with the same length."*

> *"Prefix matching may be requested instead of strict comparison, by appending a trailing
> `.*` to the version identifier in the version matching clause."*

Table of matches against candidate `1.1.post1`: `== 1.1` no · `== 1.1.post1` yes ·
`== 1.1.*` yes. Against `1.1a1`: `== 1.1` no · `== 1.1a1` yes · *"`== 1.1.*` # Same prefix,
so `1.1a1` matches clause if pre-releases are requested"*. Against `1.1`: `== 1.1` yes ·
`== 1.1.0` yes (zero padding) · `== 1.1.dev1` no · `== 1.1a1` no · `== 1.1.post1` no ·
`== 1.1.*` yes.

> *"For purposes of prefix matching, the pre-release segment is considered to have an implied
> preceding `.`"*

> *"It is invalid to have a prefix match containing a development or local release such as
> `1.0.dev1.*` or `1.0+foo1.*`."*

🔴 The load-bearing sentence for "applications pin, libraries do not":

> *"The use of `==` (without at least the wildcard suffix) when defining dependencies for
> published distributions is strongly discouraged as it greatly complicates the deployment of
> security fixes. The strict version comparison operator is intended primarily for use when
> defining dependencies for repeatable deployments of applications while using a shared
> distribution index."*

#### `!=`

> *"The allowed version identifiers and comparison semantics are the same as those of the
> Version matching operator, except that the sense of any match is inverted."*

#### `<` `>` exclusive ordered comparison

> *"The exclusive ordered comparisons `>` and `<` … specifically exclude pre-releases,
> post-releases, and local versions of the specified version."*

> *"The exclusive ordered comparison `>V` MUST NOT allow a post-release of the given version
> unless `V` itself is a post release. … For example, `>1.7` will allow `1.7.1` but not
> `1.7.0.post1` and `>1.7.post2` will allow `1.7.1` and `1.7.0.post3` but not `1.7.0`."*

> *"The exclusive ordered comparison `<V` MUST NOT allow a pre-release of the specified
> version unless the specified version is itself a pre-release. Allowing pre-releases that
> are earlier than, but not equal to a specific pre-release may be accomplished by using
> `<V.rc1` or similar."*

Local versions are *"NOT permitted"* in `<=`, `>=`, `<`, `>` specifiers.

#### `===` arbitrary equality

> *"Arbitrary equality comparisons are simple string equality operations which do not take
> into account any of the semantic information such as zero padding or local versions. This
> operator also does not support prefix matching as the `==` operator does."*

> *"The primary use case for arbitrary equality is to allow for specifying a version which
> cannot otherwise be represented by this PEP. This operator is special and acts as an escape
> hatch"* … *"Use of this operator is heavily discouraged and tooling MAY display a warning
> when it is used."*

> *"This operator may also be used to explicitly require an unpatched version of a project
> such as `===1.0` which would not match for a version `1.0+downstream1`."*

### Pre-release handling — 🔴 quote this in full, it is the whole rule

> *"Pre-releases of any kind, including developmental releases, are implicitly excluded from
> all version specifiers, unless they are already present on the system, explicitly requested
> by the user, or if the only available version that satisfies the version specifier is a
> pre-release."*

> *"By default, dependency resolution tools SHOULD: accept already installed pre-releases for
> all version specifiers · accept remotely available pre-releases for version specifiers where
> there is no final or post release that satisfies the version specifier · exclude all other
> pre-releases from consideration"*

> *"Post-releases and final releases receive no special treatment in version specifiers - they
> are always included unless explicitly excluded."*

### Direct references

> *"A direct reference consists of the specifier `@` and an explicit URL."*

> *"Public index servers SHOULD NOT allow the use of direct references in uploaded
> distributions. Direct references are intended as a tool for software integrators rather
> than publishers."*

> *"All direct references that do not refer to a local file URL SHOULD specify a secure
> transport mechanism (such as https) AND include an expected hash value in the URL for
> verification purposes."*

Doc's own examples: `pip @ file:///localbuilds/pip-1.3.1.zip`,
`pip @ https://github.com/pypa/pip/archive/1.3.1.zip#sha1=da9234ee9982d4bbb3c72346a6de940a148ea686`.

---

## 2 · PEP 508 / "Dependency specifiers" spec

URLs:
- `https://peps.python.org/pep-0508/` (carries *"This PEP is a historical document. The up-to-date, canonical spec, Dependency specifiers, is maintained on the PyPA specs page."*)
- `https://packaging.python.org/en/latest/specifications/dependency-specifiers/`

The one-line example, verbatim from PEP 508:

> *"`requests [security,tests] >= 2.8.1, == 2.8.* ; python_version < "2.7"`"*

> *"A dependency specification always specifies a distribution name. It may include extras,
> which expand the dependencies of the named distribution to enable optional features. The
> version installed can be controlled using version limits, or giving the URL to a specific
> artifact to install. Finally the dependency can be made conditional using environment
> markers."*

Grammar (canonical spec):

```
name_req      = name wsp* extras? wsp* versionspec? wsp* quoted_marker?
url_req       = name wsp* extras? wsp* urlspec (wsp+ quoted_marker?)?
specification = wsp* ( url_req | name_req ) wsp*
```

> *"Non line-breaking whitespace is mostly optional with no semantic meaning. The sole
> exception is detecting the end of a URL requirement."*

Name regex (run with `re.IGNORECASE`): `^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$`.

### Extras

> *"An extra is an optional part of a distribution. Distributions can specify as many extras
> as they wish, and each extra results in the declaration of additional dependencies of the
> distribution when the extra is used in a dependency specification."*

> *"Extras union in the dependencies they define with the dependencies of the distribution
> they are attached to. The example above would result in `requests` being installed, and
> `requests` own dependencies, and also any dependencies that are listed in the “security”
> extra of `requests`."*

> *"If multiple extras are listed, all the dependencies are unioned together."*

> *"Restrictions on names for extras are defined in the Core metadata specification.
> Publication tools SHOULD enforce these restrictions in dependency specifiers, while locking
> and installation tools MAY normalize invalid extra names in order to accept published
> metadata using core metadata versions prior to 2.3."*

### Markers

> *"A marker expression evaluates to either True or False. When it evaluates to False, the
> dependency specification should be ignored."*

> *"The marker language is inspired by Python itself, chosen for the ability to safely
> evaluate it without running arbitrary code that could become a security vulnerability."*

> *"Comparisons in marker expressions are typed by the comparison operator."* … PEP 508's
own error examples: `"dog" ~= "fred"` and `python_version ~= "surprise"`.

> *"Unknown variables must raise an error rather than resulting in a comparison that
> evaluates to True or False."* (PEP 508) — superseded/refined by the canonical spec:

> *"References to unknown marker fields SHOULD render a package version ineligible for
> installation or inclusion in a locked dependency tree rather than resulting in a comparison
> that evaluates to True or False. This is so that published package versions with unknown
> marker fields are either ignored when resolving dependencies or emit a descriptive
> installation failure, rather than producing an apparently successful installation that then
> fails at runtime due to missing dependencies (if the unknown marker is treated as False) or
> a potentially cryptic installation failure of a dependency that is not valid for the current
> platform (if the unknown marker is treated as True)."*

> *"Python’s comparison chaining (such as `3.4 < python_version < 3.9`) is NOT supported in
> environment markers (such expressions must instead be written out as two separate
> comparisons joined by `and`)."*

> *"Variables whose value cannot be calculated on a given Python implementation should
> evaluate to `0` for Version fields, and an empty string for all other variables (including
> Version | String fields)."*

> *"User supplied constants are always given as strings within either `'` or `"` quote marks.
> Triple-quoted multi-line strings are NOT permitted."*

Canonical marker field table (type column is new vs PEP 508):

| Marker | Python equivalent | Type | Sample values / note (verbatim) |
|---|---|---|---|
| `os_name` | `os.name` | String | `posix`, `java` |
| `sys_platform` | `sys.platform` | String | `linux`, `win32`, `darwin`, `java1.8.0_51` — *"note that this is the most well defined field for use when declaring platform specific dependencies"* |
| `platform_machine` | `platform.machine()` | String | `x86_64`, `aarch64`, `AMD64`, `arm64` — *"note that this value is provided by the operating system, so the same CPU architecture may use different strings on different platforms"* |
| `platform_python_implementation` | `platform.python_implementation()` | String | `CPython`, `PyPy` |
| `platform_release` | `platform.release()` | Version \| String | `3.14.1-x86_64-linode39`, `14.5.0` |
| `platform_system` | `platform.system()` | String | `Linux`, `Windows`, `Java` |
| `platform_version` | `platform.version()` | Version \| String | kernel build strings |
| `python_version` | `'.'.join(platform.python_version_tuple()[:2])` | Version | `3.9`, `3.15` |
| `python_full_version` | `platform.python_version()` | Version | `3.10.12`, `3.15.0a1` |
| `implementation_name` | `sys.implementation.name` | String | `cpython`, `pypy` |
| `implementation_version` | see spec | Version | `3.10.12`, `7.3.17` |

Comparison operators defined for markers, verbatim examples:
`== (sys_platform == "win32")` · `!=` · `>` · `>=` · `<` · `<=` · `~= (python_version ~= "3")`
· `=== (implementation_version === "not.a.valid.version")` · *"`in` (for example, `"gui" in
extras`, `"SMP" in platform_version`)"* · *"`not in` (for example, `"dev" not in
dependency_groups`)"*.

> *"For String fields, `==`, `!=`, `in`, and `not in` are defined as they are for Python
> strings (case sensitive, with no value normalization of any kind)."*

> *"The use of ordered comparisons (`<`, `<=`, `>`, `>=`) with string fields is explicitly
> discouraged (as it makes no semantic sense in the packaging context) … locking and
> installation tools SHOULD implement the following behavior: treat `>=` and `<=` as
> equivalent to `==` · treat `>` and `<` as always being False"*

Set-valued marker fields (`extras`, `dependency_groups`) — lockfile-only:

> *"For backwards compatibility with older locking and installation tools, the `extras` and
> `dependency_groups` fields are currently only valid for use in `packages.marker` fields in
> lock files."*

> *"`extra == "name"` in a dependency declaration is similar to `"name" in extras`, while
> `extra != "name"` is similar to `"name" not in extras`. For dependency marker evaluations,
> the set of extra names used for these comparisons is the full set of requested extras for
> that particular package, whether requested directly in a top level dependency declaration,
> or indirectly in a transitive dependency declaration."*

---

## 3 · PEP 621 / PEP 631 / "pyproject.toml" spec — the declaration side

URLs: `https://peps.python.org/pep-0621/`, `https://peps.python.org/pep-0631/`,
`https://packaging.python.org/en/latest/specifications/pyproject-toml/`,
`https://packaging.python.org/en/latest/guides/writing-pyproject-toml/`

PEP 631 (*"This PEP has been accepted and was merged into PEP 621."*):

> *"All dependency entries MUST be valid PEP 508 strings."*
> *"Build backends SHOULD abort at load time for any parsing errors."*

Canonical `pyproject.toml` spec:

> *"`dependencies` lists the expected dependencies of the project as an array of strings.
> Each string represents a dependency of the project and MUST be formatted as a valid
> dependency specifier. Each string maps directly to a `Requires-Dist` entry."*

> *"Dependencies listed in this array are always considered for installation, but may still
> contain environment markers that cause them to be skipped in some environments."*

> *"`optional-dependencies` is a table where each key specifies an extra and whose value is
> an array of strings using the same format as the `dependencies` array."*

> *"The optionality of these dependencies is recorded by modifying the environment marker
> clause on the related `Requires-Dist` entries to check the extra name. Optional dependencies
> are thus only considered for installation if installation if the associated extra name is
> requested."* (the doubled *"if installation if"* is upstream's own typo — do not quote that
> fragment)

> *"Dependency specifiers in an extra may self-reference other extras from the current project
> (e.g. `all = ["your-project-name[gui, cli]"]`). … Most package managers now support this kind
> of extra, including pip, uv, poetry, hatch, pdm and Pipenv."*

Guide, on why a hand-maintained `all` rots — 🔴 the whole "install-everything extras age
badly" argument, upstream's own words:

> *"You can also define an extra that refers back to the current project with other extras.
> This is useful for convenience extras that combine several optional features (such as an
> `all` extra hosting dependencies from both `gui` and `cli`)"*

> *"The combined extra does not need its own manually maintained copy of each referenced
> extra's dependencies, which can otherwise fall out of sync after a few years of maintenance
> and bug fixes"*

and the guide's own before/after, verbatim:

```toml
gui = ["PyQt5"]
cli = [
  "rich>=14.2",   # version range is added after last "all" extra update
  "textual",      # dependency newly added since last "all" extra update
  "click",
]
all = ["PyQt5", "rich", "click"]
```

`requires-python`, canonical spec:

> *"`requires-python` · TOML type: string · Corresponding core metadata field:
> `Requires-Python` · The Python version requirements of the project."*

Guide: *"This lets you declare the minimum version of Python that you support."*

Core metadata (`https://packaging.python.org/en/latest/specifications/core-metadata/`):

> *"This field specifies the Python version(s) that the distribution is compatible with.
> Installation tools may look at this when picking which version of a project to install. The
> value must be in the format specified in Version specifiers."*
> *"This field cannot be followed by an environment marker."*

`Provides-Extra`, core metadata 2.3:

> *"Changed in version 2.3: PEP 685 restricted valid values to be unambiguous (i.e. no
> normalization required)."*

> *"A string containing the name of an optional feature. A valid name consists only of
> lowercase ASCII letters, ASCII numbers, and hyphen. It must start and end with a letter or
> number. Hyphens cannot be followed by another hyphen. Names are limited to those which match
> the following regex (which guarantees unambiguity): `^[a-z0-9]+(-[a-z0-9]+)*$`"*

Core metadata's own example pair:

```
Provides-Extra: pdf
Requires-Dist: reportlab; extra == 'pdf'
```

> *"A second distribution requires an optional dependency by placing it inside square
> brackets, and can request multiple features by separating them with a comma (`,`). The
> requirements are evaluated for each requested feature and added to the set of requirements
> for the distribution."* — example: `Requires-Dist: beaglevote[pdf]`

PEP 685 (`https://peps.python.org/pep-0685/`):

> *"When comparing extra names, tools MUST normalize the names being compared using the
> semantics outlined in PEP 503 for names: `re.sub(r"[-_.]+", "-", name).lower()`"*

> *"For tools writing core metadata, they MUST write out extra names in their normalized form.
> This applies to the `Provides-Extra` field and the `extra` marker when used in the
> `Requires-Dist` field."*

> *"Tools generating metadata MUST raise an error if a user specified two or more extra names
> which would normalize to the same name."*

Name normalization spec
(`https://packaging.python.org/en/latest/specifications/name-normalization/`):

> *"The name should be lowercased with all runs of the characters `.`, `-`, or `_` replaced
> with a single `-` character."*
> Equivalent forms it lists: `friendly-bard` (normalized), `Friendly-Bard`, `FRIENDLY-BARD`,
> `friendly.bard`, `friendly_bard`, `friendly--bard`, `FrIeNdLy-._.-bArD`.

---

## 4 · Abstract vs concrete — the central argument's primary source

`https://packaging.python.org/en/latest/discussions/install-requires-vs-requirements/`

> *"`install_requires` is a Setuptools `setup.py` keyword that should be used to specify what
> a project minimally needs to run correctly."*

> *"It is not considered best practice to use `install_requires` to pin dependencies to
> specific versions, or to specify sub-dependencies (i.e. dependencies of your dependencies).
> This is overly-restrictive, and prevents the user from gaining the benefit of dependency
> upgrades."*

> *"Lastly, it's important to understand that `install_requires` is a listing of “Abstract”
> requirements, i.e just names and version restrictions that don't determine where the
> dependencies will be fulfilled from (i.e. from what index or source). The where (i.e. how
> they are to be made “Concrete”) is to be determined at install time using pip options."*

> *"Whereas `install_requires` defines the dependencies for a single project, Requirements
> Files are often used to define the requirements for a complete Python environment."*

> *"Whereas `install_requires` requirements are minimal, requirements files often contain an
> exhaustive listing of pinned versions for the purpose of achieving repeatable installations
> of a complete environment."*

> *"Whereas `install_requires` metadata is automatically analyzed by pip during an install,
> requirements files are not, and only are used when a user specifically installs them using
> `python -m pip install -r`."*

Also: *"it's best practice to indicate any known lower or upper bounds"* with the doc's own
progression `['A', 'B']` → `['A>=1', 'B>=2']` → `['A>=1,<2', 'B>=2']`, the last justified by
*"it may also be known that project ‘A' introduced a change in its v2 that breaks the
compatibility of your project with v2 of ‘A' and later"*.

---

## 5 · The lockfile

### pip freeze — 🔴 the sentence that settles what `pip freeze` is not

`https://pip.pypa.io/en/stable/cli/pip_freeze/`

> *"Output installed packages in requirements format."*

> *"By default, pip freeze omits bootstrap packaging tools so the output focuses on your
> project's dependencies. On Python 3.11 and earlier this excludes pip, setuptools, wheel and
> distribute; on Python 3.12 and later only pip is excluded. Use `--all` to include those
> packages when you need a complete environment snapshot. pip freeze reports what is
> installed; it does not compute a lockfile or a solver result."*

### pip "Repeatable Installs"

`https://pip.pypa.io/en/stable/topics/repeatable-installs/`

> *"This page walks through increasingly stricter definitions of what “repeatable” means."*

> *"A requirements file, containing pinned package versions can be generated using `pip
> freeze`. This would pin not only the top-level packages, but also all of their transitive
> dependencies. Performing the installation using `--no-deps` would provide an extra dose of
> insurance against installing anything not explicitly listed."*

> *"This strategy is easy to implement and works across OSes and architectures. However, it
> trusts the locations you're fetching the packages from (like PyPI) and the certificate
> authority chain. It also relies on those locations not allowing packages to change without a
> version increase. (PyPI does protect against this.)"*

> *"Beyond pinning version numbers, you can add hashes against which to verify downloaded
> packages … This protects against a compromise of PyPI or the HTTPS certificate chain. It also
> guards against a package changing without its version number changing (on indexes that allow
> this). This approach is a good fit for automated server deployments."*

> *"pip-tools is a package that builds upon pip, and provides a good workflow for managing and
> generating requirements files."*

### pip requirements file format

`https://pip.pypa.io/en/stable/reference/requirements-file-format/`

> *"Requirements files serve as a list of items to be installed by pip, when using `pip
> install`."*

> *"The requirements file format is closely tied to a number of internal details of pip (e.g.,
> pip's command line options). The basic format is relatively stable and portable but the full
> syntax, as described here, is only intended for consumption by pip, and other tools should
> take that into account before using it for their own purposes."*

Global options accepted in a requirements file: `-i/--index-url`, `--extra-index-url`,
`--no-index`, `-c/--constraint`, `-r/--requirement`, `-e/--editable`, `-f/--find-links`,
`--no-binary`, `--only-binary`, `--prefer-binary`, `--require-hashes`, `--no-require-hashes`,
`--pre`.

> *"A line ending in an unescaped `\` is treated as a line continuation and the newline
> following it is effectively ignored."*

### pip hash-checking mode

`https://pip.pypa.io/en/stable/topics/secure-installs/`

> *"This mode uses local hashes, embedded in a `requirements.txt` file, to protect against
> remote tampering and network issues. These hashes are specified using a `--hash` per
> requirement option."*

> *"Note that hash-checking is an all-or-nothing proposition. Specifying `--hash` against any
> requirement will activate this mode globally."*

Its own example block (verbatim, keep the continuations):

```
FooProject == 1.2 \
  --hash=sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 \
  --hash=sha256:486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7
```

The three additional restrictions, verbatim headings + bodies:

> *"Hashes are required for all requirements. This is because a partially-hashed requirements
> file is of little use and thus likely an error: a malicious actor could slip bad code into
> the installation via one of the unhashed requirements."*

> *"Hashes are required for all dependencies. If there is a dependency that is not spelled out
> and hashed in the requirements file, it will result in an error."*

> *"Requirements must be pinned (either to a URL, filesystem path or using `==`). This prevents
> a surprising hash mismatch upon the release of a new version that matches the requirement
> specifier."*

> *"It is possible to force the hash checking mode to be enabled, by passing `--require-hashes`
> command-line option. This can be useful in deploy scripts, to ensure that the author of the
> requirements file provided hashes."*

> *"The recommended hash algorithm at the moment is `sha256`, but stronger ones are allowed,
> including all those supported by `hashlib`. However, weaker ones such as `md5`, `sha1`, and
> `sha224` are excluded to avoid giving a false sense of security."*

> *"PyPI (and certain other index servers) provides a hash for the distribution, in the
> fragment portion of each download URL, like `#sha256=123...`, which pip checks as a protection
> against download corruption. … Since this hash originates remotely, it is not a useful guard
> against tampering and thus does not satisfy the `--require-hashes` demand that every package
> have a local hash."*

> *"Changed in version 23.1: The locally-built wheel cache is used in hash-checking mode too."*
> *"When installing from the cache of locally built wheels in hash-checking mode, pip verifies
> the hashes against those of the original source distribution that was used to build the wheel.
> These original hashes are obtained from a `origin.json` file stored in each cache entry."*

`--no-require-hashes`, *"Added in version 26.2"* (pip's own admonition):

> *"By default, when at least one requirement has hashes, hashes become required for all
> requirements. This behaviour notably prevents the combination of hashed requirements with
> local directories or VCS URLs. To help with such use cases, a `--no-require-hashes` flag is
> available to disable this mechanism. Hashes are then verified only for requirements where
> they are provided."*

CLI reference (`https://pip.pypa.io/en/stable/cli/pip_install/`):

> *"`--require-hashes` — Require a hash to check each requirement against, for repeatable
> installs. This option is implied when any package in a requirements file has a `--hash`
> option."*

> *"`--only-binary <format_control>` — Do not use source packages. … Packages without binary
> distributions will fail to install when this option is used on them."*

> *"`--upgrade-strategy <upgrade_strategy>` — Determines how dependency upgrading should be
> handled [default: only-if-needed]. “eager” - dependencies are upgraded regardless of whether
> the currently installed version satisfies the requirements of the upgraded package(s).
> “only-if-needed” - are upgraded only when they do not satisfy the requirements of the upgraded
> package(s)."*

> *"`--group <[path:]group>` — Install a named dependency-group from a “pyproject.toml” file. If
> a path is given, the name of the file must be “pyproject.toml”. Defaults to using
> “pyproject.toml” in the current directory."*

### PEP 751 — `pylock.toml`

`https://peps.python.org/pep-0751/`

> *"This PEP proposes a new file format for specifying dependencies to enable reproducible
> installation in a Python environment. The format is designed to be human-readable and
> machine-generated. Installers consuming the file should be able to calculate what to install
> without the need for dependency resolution at install-time."*

> *"Currently, no standard exists to create an immutable record, such as a lock file, which
> specifies what direct and indirect dependencies should be installed into a virtual
> environment."*

> *"Those tools also vary in what locking scenarios they support. For instance, `pip freeze` and
> pip-tools only generate single-use lock files for the current environment while PDM, Poetry,
> and uv can/try to lock for multiple environments and use-cases at once."*

> *"The closest the community has to a standard are pip's requirements files … Unfortunately, the
> format is not a standard but is supported by convention. It's also designed very much for pip's
> needs, limiting its flexibility and ease of use (e.g. it's a bespoke file format). Lastly, it is
> not secure by default (e.g. file hash support is entirely an opt-in feature …)."*

> *"A lock file MUST be named `pylock.toml` or match the regular expression
> `r"^pylock\.([^.]+)\.toml$"` if a name for the lock file is desired or if multiple lock files
> exist."*

> *"The file format is also designed to not require a resolver at install time."*

> *"Lock files can be single-use and multi-use. Single-use lock files are things like
> `requirements.txt` files, which serve a single use-case/purpose … Multi-use lock files represent
> multiple use-cases within a single file, often expressed through extras and Dependency Groups."*

> *"At least one secure algorithm from `hashlib.algorithms_guaranteed` SHOULD always be included
> (at time of writing, `sha256` specifically is recommended."* (upstream's unclosed paren)

`requires-python` in a lock file: *"Specifies the `Requires-Python` for the minimum Python version
compatible for any environment supported by the lock file (i.e. the minimum viable Python version
for the lock file)."*

---

## 6 · uv 0.12.12

### Locking and syncing — `https://docs.astral.sh/uv/concepts/projects/sync/`

> *"Locking is the process of resolving your project's dependencies into a lockfile. Syncing is
> the process of installing a subset of packages from the lockfile into the project environment."*

> *"Locking and syncing are automatic in uv. For example, when `uv run` is used, the project is
> locked and synced before invoking the requested command."*

> *"To disable automatic locking, use the `--locked` option … If the lockfile is not up-to-date,
> uv will raise an error instead of updating the lockfile."*

> *"To use the lockfile without checking if it is up-to-date, use the `--frozen` option"*

> *"When considering if the lockfile is up-to-date, uv will check if it matches the project
> metadata. For example, if you add a dependency to your `pyproject.toml`, the lockfile will be
> considered outdated. Similarly, if you change the version constraints for a dependency such that
> the locked version is excluded, the lockfile will be considered outdated. However, if you change
> the version constraints such that the existing locked version is still included, the lockfile
> will still be considered up-to-date."*

> *"You can check if the lockfile is up-to-date by passing the `--check` flag to `uv lock` … This
> is equivalent to the `--locked` flag for other commands."*

🔴 > *"uv will not consider lockfiles outdated when new versions of packages are released — the
lockfile needs to be explicitly updated if you want to upgrade dependencies."*

> *"`uv sync` performs "exact" syncing by default, which means it will remove any packages that are
> not present in the lockfile. To retain extraneous packages, use the `--inexact` flag"*

> *"In contrast, `uv run` uses "inexact" syncing by default, ensuring that all required packages are
> installed but not removing extraneous packages."*

> *"uv does not sync extras by default. Use the `--extra` option to include an extra."*

> *"uv reads development dependencies from the `[dependency-groups]` table (as defined in PEP 735).
> The dev group is special-cased and synced by default."*

> *"Group exclusions always take precedence over inclusions, so given the command `uv sync
> --no-group foo --group foo` The `foo` group would not be installed."*

> *"With an existing `uv.lock` file, uv will prefer the previously locked versions of packages when
> running `uv sync` and `uv lock`. Package versions will only change if the project's dependency
> constraints exclude the previous, locked version."*

> *"To upgrade all packages: `uv lock --upgrade` · To upgrade a single package to the latest version,
> while retaining the locked versions of all other packages: `uv lock --upgrade-package <package>`"*

> *"In all cases, upgrades are limited to the project's dependency constraints. For example, if the
> project defines an upper bound for a package then an upgrade will not go beyond that version."*

> *"If you need to integrate uv with other tools or workflows, you can export `uv.lock` to different
> formats including `requirements.txt`, `pylock.toml` (PEP 751), and CycloneDX SBOM."*

### Project layout / the lockfile — `https://docs.astral.sh/uv/concepts/projects/layout/`

> *"`uv.lock` is a universal or cross-platform lockfile that captures the packages that would be
> installed across all possible Python markers such as operating system, architecture, and Python
> version."*

> *"Unlike the `pyproject.toml`, which is used to specify the broad requirements of your project, the
> lockfile contains the exact resolved versions that are installed in the project environment. This
> file should be checked into version control, allowing for consistent and reproducible installations
> across machines."*

> *"A lockfile ensures that developers working on the project are using a consistent set of package
> versions. Additionally, it ensures when deploying the project as an application that the exact set
> of used package versions is known."*

> *"`uv.lock` is a human-readable TOML file but is managed by uv and should not be edited manually.
> The `uv.lock` format is specific to uv and not usable by other tools."*

> *"`pylock.toml` is a resolution output format intended to replace `requirements.txt` … `pylock.toml`
> is standardized and tool-agnostic, such that in the future, `pylock.toml` files generated by uv
> could be installed by other tools, and vice versa."*

> *"Some of uv's functionality cannot be expressed in the `pylock.toml` format; as such, uv will
> continue to use the `uv.lock` format within the project interface."*

> *"It is not recommended to include the `.venv` directory in version control"*

### Resolution — `https://docs.astral.sh/uv/concepts/resolution/`

> *"Resolution is the process of taking a list of requirements and converting them to a list of
> package versions that fulfill the requirements."*

> *"The dependencies defined by the current project are called direct dependencies. The dependencies
> added by each dependency of the current project are called indirect or transitive dependencies."*

Its two worked scenarios (paraphrase-safe to restate, but the punchline is verbatim):

> *"foo 2.0.0 and bar 2.0.0 cannot be installed together as they conflict on their required version
> of lib, so the resolver must select either foo 1.0.0 (along with bar 2.0.0) or bar 1.0.0 (along with
> foo 2.0.0). Both are valid solutions, and different resolution algorithms may yield either result."*

> *"Typically, Python package resolvers use the markers of the current platform to determine which
> dependencies to use since the package is often being installed on the current platform. However, for
> locking dependencies this is problematic — the lockfile would only work for developers using the same
> platform the lockfile was created on."*

> *"By default, uv's pip interface, i.e., `uv pip compile`, produces a resolution that is
> platform-specific, like pip-tools. There is no way to use platform-specific resolution in the uv's
> project interface."*

🔴 The `requires-python` rule — the load-bearing quote for chunk on `requires-python`:

> *"During universal resolution, all required packages must be compatible with the entire range of
> `requires-python` declared in the `pyproject.toml`. For example, if a project's `requires-python` is
> `>=3.8`, resolution will fail if all versions of given dependency require Python 3.9 or later, since
> the dependency lacks a usable version for (e.g.) Python 3.8, the lower bound of the project's
> supported range. In other words, the project's `requires-python` must be a subset of the
> `requires-python` of all its dependencies."*

> *"When selecting the compatible version for a given dependency, uv will (by default) attempt to
> choose the latest compatible version for each supported Python version."*

> *"When evaluating `requires-python` ranges for dependencies, uv only considers lower bounds and
> ignores upper bounds entirely. For example, `>=3.8, <4` is treated as `>=3.8`. Respecting upper
> bounds on `requires-python` often leads to formally correct but practically incorrect resolutions,
> as, e.g., resolvers will backtrack to the first published version that omits the upper bound"*

> *"If your project supports only a limited set of platforms or Python versions, you can constrain the
> set of solved platforms via the `environments` setting, which accepts a list of PEP 508 environment
> markers."*

> *"Entries in the `environments` setting must be disjoint (i.e., they must not overlap)."*

> *"While the `environments` setting limits the set of environments that uv will consider when
> resolving dependencies, `required-environments` expands the set of platforms that uv must support
> when resolving dependencies."*

> *"If resolution output file exists, i.e., a uv lockfile (`uv.lock`) or a requirements output file
> (`requirements.txt`), uv will prefer the dependency versions listed there."*

🔴 Resolution strategy — the lower-bound-is-never-tested argument:

> *"By default, uv tries to use the latest version of each package. For example, `uv pip install
> flask>=2.0.0` will install the latest version of Flask, e.g., 3.0.0. If `flask>=2.0.0` is a
> dependency of the project, only flask 3.0.0 will be used. This is important, for example, because
> running tests will not check that the project is actually compatible with its stated lower bound of
> flask 2.0.0."*

> *"With `--resolution lowest`, uv will install the lowest possible version for all dependencies, both
> direct and indirect (transitive). Alternatively, `--resolution lowest-direct` will use the lowest
> compatible versions for all direct dependencies, while using the latest compatible versions for all
> other dependencies."*

> *"When publishing libraries, it is recommended to separately run tests with `--resolution lowest` or
> `--resolution lowest-direct` in continuous integration to ensure compatibility with the declared
> lower bounds."*

Pre-releases:

> *"By default (`if-necessary`), uv prefers stable versions over pre-releases, falling back to
> pre-releases only if every stable candidate that satisfies the active constraints is rejected during
> resolution."*

> *"Use `--prerelease allow` to consider pre-releases for every package without preferring stable
> candidates first, or `--prerelease disallow` to exclude them entirely."*

> *"The `explicit` mode considers pre-releases only for first-party requirements that contain a
> pre-release identifier"*

Fork strategy:

> *"By default (`--fork-strategy requires-python`), uv will optimize for selecting the latest version of
> each package for each supported Python version, while minimizing the number of selected versions
> across platforms."*

uv's own numpy illustration:

```
numpy==1.24.4 ; python_version == "3.8"
numpy==2.0.2 ; python_version == "3.9"
numpy==2.2.0 ; python_version >= "3.10"
```

> *"Under `--fork-strategy fewest`, uv will instead minimize the number of selected versions for each
> package, preferring older versions that are compatible with a wider range of supported Python
> versions or platforms."*

Constraints vs overrides vs exclusions:

> *"Like pip, uv supports constraint files (`--constraint constraints.txt`) which narrow the set of
> acceptable versions for the given packages. Constraint files are similar to requirements files, but
> being listed as a constraint alone will not cause a package to be included to the resolution.
> Instead, constraints only take effect if a requested package is already pulled in as a direct or
> transitive dependency."*

> *"Dependency overrides allow bypassing unsuccessful or undesirable resolutions by overriding a
> package's declared dependencies. Overrides are a useful last resort for cases in which you know that
> a dependency is compatible with a certain version of a package, despite the metadata indicating
> otherwise."*

> *"Concretely, if `pydantic>=1.0,<3` is included as an override, uv will ignore all declared
> requirements on pydantic, replacing them with the override."*

> *"While constraints can only reduce the set of acceptable versions for a package, overrides can expand
> the set of acceptable versions, providing an escape hatch for erroneous upper version bounds."*

> *"If a package has a dependency with a marker, it is replaced unconditionally when using overrides — it
> does not matter if the marker evaluates to true or false."*

> *"Dependency exclusions remove packages from the dependency graph."* — `[tool.uv] exclude-dependencies
> = ["foo"]`; scoped form `{ package = { name = "bar", version = "0.0.5" }, dependencies = ["foo"] }`;
> *"If the same dependency is both overridden and excluded in a matching scope, the exclusion takes
> precedence."*

Metadata:

> *"During resolution, uv needs to resolve the metadata for each package it encounters, in order to
> determine its dependencies. This metadata is often available as a static file in the package index;
> however, for packages that only provide source distributions, the metadata may not be available
> upfront."*

> *"In such cases, uv has to build the package to determine its metadata (e.g., by invoking `setup.py`).
> This can introduce a performance penalty during resolution. Further, it imposes the requirement that
> the package can be built on all platforms, which may not be true."*

🔴 Conflicting extras / groups — with uv's OWN error text (this is the only sourced uv resolver
transcript; quote it inline, never invent another):

> *"uv requires that all dependencies declared by a project are compatible with each other and resolves
> all dependencies together when creating the lockfile. This includes project dependencies, optional
> dependencies ("extras"), and dependency groups (development dependencies)."*

Given `extra1 = ["numpy==2.1.2"]` and `extra2 = ["numpy==2.0.0"]`, the docs show `uv lock` printing:

```
  x No solution found when resolving dependencies:
  `-> Because myproject[extra2] depends on numpy==2.0.0 and myproject[extra1] depends on numpy==2.1.2, we can conclude that myproject[extra1] and
      myproject[extra2] are incompatible.
      And because your project requires myproject[extra1] and myproject[extra2], we can conclude that your projects's requirements are unsatisfiable.
```

and after declaring `[tool.uv] conflicts = [[{ extra = "extra1" }, { extra = "extra2" }]]`:

```
error: extra `extra1`, extra `extra2` are incompatible with the declared conflicts: {`myproject[extra1]`, `myproject[extra2]`}
```

> *"This error occurs because installing both extra1 and extra2 would result in installing two different
> versions of a package into the same environment."*

> *"The only difference from conflicting extras is that you need to use the `group` key instead of
> `extra`."*

### Managing dependencies — `https://docs.astral.sh/uv/concepts/projects/dependencies/`

> *"`project.dependencies`: Published dependencies. · `project.optional-dependencies`: Published optional
> dependencies, or "extras". · `dependency-groups`: Local dependencies for development. ·
> `tool.uv.sources`: Alternative sources for dependencies during development."*

> *"The `project.dependencies` and `project.optional-dependencies` fields can be used even if `project`
> isn't going to be published. `dependency-groups` are a recently standardized feature and may not be
> supported by all tools yet."*

> *"The dependency will include a constraint, e.g., `>=0.27.2`, for the most recent, compatible version of
> the package. The kind of bound can be adjusted with `--bounds`, or the constraint can be provided
> directly"*

`uv add "httpx>9999"` in the docs prints:

```
  × No solution found when resolving dependencies:
  ╰─▶ Because only httpx<=1.0.0b0 is available and your project depends on httpx>9999,
      we can conclude that your project's requirements are unsatisfiable.
```

> *"The `project.dependencies` table represents the dependencies that are used when uploading to PyPI or
> building a wheel."*

> *"Unlike optional dependencies, development dependencies are local-only and will not be included in the
> project requirements when published to PyPI or other indexes. As such, development dependencies are not
> included in the `[project]` table."*

> *"The `dev` group is special-cased; there are `--dev`, `--only-dev`, and `--no-dev` flags to toggle
> inclusion or exclusion of its dependencies. … Additionally, the `dev` group is synced by default."*

> *"uv requires that all dependency groups are compatible with each other and resolves all groups together
> when creating the lockfile."*

> *"An included group's dependencies cannot conflict with the other dependencies declared in a group."*

> *"By default, uv includes the `dev` dependency group in the environment (e.g., during `uv run` or `uv
> sync`). The default groups to include can be changed using the `tool.uv.default-groups` setting."*

> *"By default, dependency groups must be compatible with your project's `requires-python` range. If a
> dependency group requires a different range of Python versions than your project, you can specify a
> `requires-python` for the group in `[tool.uv.dependency-groups]`"*

> *"Before `[dependency-groups]` was standardized, uv used the `tool.uv.dev-dependencies` field … Eventually,
> the `dev-dependencies` field will be deprecated and removed."*

> *"It is common for projects that are published as libraries to make some features optional to reduce the
> default dependency tree. For example, Pandas has an `excel` extra and a `plot` extra to avoid installation
> of Excel parsers and matplotlib unless someone explicitly requires them."*

> *"When publishing a package, we recommend running `uv build --no-sources` to ensure that the package builds
> correctly when `tool.uv.sources` is disabled"*

### uv CLI reference — `https://docs.astral.sh/uv/reference/cli/`

> *"`--locked` — Assert that the `uv.lock` will remain unchanged … Requires that the lockfile is up-to-date.
> If the lockfile is missing or needs to be updated, uv will exit with an error."*

> *"`--frozen` — Run without updating the `uv.lock` file … Instead of checking if the lockfile is up-to-date,
> uses the versions in the lockfile as the source of truth. If the lockfile is missing, uv will exit with an
> error. If the `pyproject.toml` includes changes to dependencies that have not been included in the lockfile
> yet, they will not be present in the environment."*

> *"`uv lock --check` — Check if the lockfile is up-to-date. Asserts that the `uv.lock` would remain unchanged
> after a resolution. If the lockfile is missing or needs to be updated, uv will exit with an error."*

> *"`uv sync --check` — Check if the Python environment is synchronized with the project. If the environment is
> not up to date, uv will exit with an error."*

> *"`--bounds` — The kind of version specifier to use when adding dependencies. When adding a dependency to the
> project, if no constraint or URL is provided, a constraint is added based on the latest compatible version of
> the package. By default, a lower bound constraint is used, e.g., `>=1.2.3`. … This option is in preview and may
> change in any future release."* Possible values, verbatim: *"`lower`: Only a lower bound, e.g., `>=1.2.3` ·
> `major`: Allow the same major version, similar to the semver caret, e.g., `>=1.2.3, <2.0.0` · `minor`: Allow the
> same minor version, similar to the semver tilde, e.g., `>=1.2.3, <1.3.0` · `exact`: Pin the exact version, e.g.,
> `==1.2.3`"*

> *"`uv export` … `--no-hashes` — Omit hashes in the generated output"* (so hashes are the export default)
> *"`uv pip compile … --generate-hashes` — Include distribution hashes in the output file"*
> *"Export the project's lockfile to an alternate format. At present, `requirements.txt`, `pylock.toml` (PEP 751)
> and CycloneDX v1.5 JSON output formats are supported. The project is re-locked before exporting unless the
> `--locked` or `--frozen` flag is provided."*

`uv init` (`https://docs.astral.sh/uv/concepts/projects/init/`):

> *"When creating projects, uv supports two basic templates: applications and libraries. By default, uv will
> create a project for an application. The `--lib` flag can be used to create a project for a library instead."*

> *"A library provides functions and objects for other projects to consume. Libraries are intended to be built and
> distributed, e.g., by uploading them to PyPI."*
> *"Libraries always require a packaged project."*
> *"Prior to v0.12, uv did not define a build system for applications by default."*

---

## 7 · PEP 735 — dependency groups

`https://peps.python.org/pep-0735/` and
`https://packaging.python.org/en/latest/specifications/dependency-groups/`

> *"This PEP specifies a mechanism for storing package requirements in `pyproject.toml` files such that they are
> not included in any built distribution of the project."*

> *"This is suitable for creating named groups of dependencies, similar to `requirements.txt` files, which
> launchers, IDEs, and other tools can find and identify by name."*

> *"There are two major use cases for which the Python community has no standardized answer: How should
> development dependencies be defined for packages? How should dependencies be defined for projects which do not
> build distributions (non-package projects)?"*

Limitations of `requirements.txt`, verbatim:

> *"There is no standardized naming convention such that tools can discover or use these files by name."*
> *"`requirements.txt` files are not standardized, but instead provide options to pip."*
> *"The lack of a standard for `requirements.txt` contents also means they are not portable to any alternative
> tools which wish to process them other than pip."*
> *"Additionally, `requirements.txt` files require a file per dependency list. For some use-cases, this makes the
> marginal cost of dependency groupings high, relative to their benefit."*

🔴 Limitations of extras — the sentences that settle "groups are not hidden extras":

> *"Because extras are package metadata, they are not guaranteed to be statically defined and may require a build
> system to resolve. Furthermore, definition of a `[project.optional-dependencies]` indicates to many tools that a
> project is a package, and may drive tool behaviors such as validation of the `[project]` table."*

> *"Because an extra defines optional additional dependencies, it is not possible to install an extra without
> installing the current package and its dependencies."*

> *"Because they are user-installable, extras are part of the public interface for packages. Because extras are
> published, package developers often are concerned about ensuring that their development extras are not confused
> with user-facing extras."*

> *"Dependency Groups have two additional features which are similar to `requirements.txt` files: they are not
> published as distinct metadata in any built distribution · installation of a dependency group does not imply
> installation of a package's dependencies or the package itself"*

> *"Dependency Groups are very similar to extras which go unpublished. However, there are two major features which
> distinguish them from extras further: they support non-package projects · installation of a Dependency Group does
> not imply installation of a package's dependencies (or the package itself)"*

Canonical spec:

> *"Dependency groups are suitable for internal development use-cases like linting and testing, as well as for
> projects which are not built for distribution, like collections of related scripts."*

> *"Fundamentally, dependency groups should be thought of as being a standardized subset of the capabilities of
> `requirements.txt` files (which are pip-specific)."*

> *"`[dependency-groups]` keys, sometimes also called “group names”, must be valid non-normalized names. Tools which
> handle Dependency Groups MUST normalize these names before comparisons."*

> *"Requirement lists, the values in `[dependency-groups]`, may contain strings, tables (`dict` in Python), or a mix
> of strings and tables. Strings must be valid dependency specifiers, and tables must be valid Dependency Group
> Includes."*

> *"An include is a table with exactly one key, `"include-group"`, whose value is a string, the name of another
> Dependency Group."*

> *"Includes are defined to be exactly equivalent to the contents of the named Dependency Group, inserted into the
> current group at the location of the include. For example, if `foo = ["a", "b"]` is one group, and `bar = ["c",
> {include-group = "foo"}, "d"]` is another, then `bar` should evaluate to `["c", "a", "b", "d"]` when Dependency
> Group Includes are expanded."*

> *"Dependency Group Includes may specify the same package multiple times. Tools SHOULD NOT deduplicate or otherwise
> alter the list contents produced by the include."*

Its own worked example: `group-a = ["foo"]`, `group-b = ["foo>1.0"]`, `group-c = ["foo<1.0"]`,
`all = ["foo", {include-group = "group-a"}, {include-group = "group-b"}, {include-group = "group-c"}]` →
> *"The resolved value of `all` SHOULD be `["foo", "foo", "foo>1.0", "foo<1.0"]`. Tools should handle such a list
> exactly as they would handle any other case in which they are asked to process the same requirement multiple times
> with different version constraints."*

> *"Dependency Group Includes MUST NOT include cycles, and tools SHOULD report an error if they detect a cycle."*

🔴 > *"Build backends MUST NOT include Dependency Group data in built distributions as package metadata. This means
that sdist `PKG-INFO` and wheel `METADATA` files should not include referenceable fields containing dependency
groups."*

> *"It is, however, valid to use dependency groups in the evaluation of dynamic metadata, and `pyproject.toml` files
> included in sdists will still contain `[dependency-groups]`. However, the table's contents are not part of a built
> package's interfaces."*

> *"There is no syntax or specification-defined interface for installing or referring to dependency groups. Tools are
> expected to provide dedicated interfaces for this purpose."*

PEP 735's reasoning for *why* there is no `pkg[group]` syntax:

> *"No syntax is defined for expressing the Dependency Group of a package, for two reasons: it would not be valid to
> refer to the Dependency Groups of a third-party package from PyPI (because the data is defined to be unpublished) ·
> there is not guaranteed to be a current package for Dependency Groups"*

> *"Tools authors are advised that the specification does not forbid having an extra whose name matches a Dependency
> Group. Separately, users are advised to avoid creating dependency groups whose names match extras, and tools MAY
> treat such matching as an error."*

> *"Tools SHOULD error when evaluating or processing unrecognized data in dependency groups. Tools SHOULD NOT eagerly
> validate the contents of all dependency groups unless they have a need to do so."*

Its own illustration of lazy validation: `foo = ["pyparsing"]` alongside
`bar = [{set-phasers-to = "stun"}]` — *"most tools should allow the `foo` group to be used and only error if the `bar`
group is used"*.

> *"Note that none of these Dependency Group declarations implicitly install the current package, its dependencies, or
> any optional dependencies. Use of a Dependency Group like `test` to test a package requires that the user's
> configuration or toolchain also installs the current package (`.`)."*

Its canonical four-group example:

```toml
[dependency-groups]
test = ["pytest", "coverage"]
docs = ["sphinx", "sphinx-rtd-theme"]
typing = ["mypy", "types-requests"]
typing-test = [{include-group = "typing"}, {include-group = "test"}, "useful-types"]
```

Use cases it names: *"Web Applications deployed via a non-python-packaging build process · Libraries with unpublished
dev dependency groups · Data science projects with groups of dependencies but no core package · Input data to lockfile
generation (Dependency Groups should generally not be used as a location for locked dependency data) · Input data to an
environment manager, such as tox, Nox, or Hatch · Configurable IDE discovery of test and linter requirements"*

Ecosystem warning worth a gotcha:

> *"It is our expectation that no such tools would support the new Dependency Groups at first, and broad ecosystem
> support could take many months or even some number of years to arrive. As a result, users of Dependency Groups would
> experience a degradation in their workflows and tool support at the time that they start using Dependency Groups."*

Reference implementation error strings (from the PEP's own code, so quotable):
`Duplicate dependency group names: {...}` · `Cyclic dependency group include: {group} -> {past_groups}` ·
`Dependency group '{group}' not found` · `Dependency group '{group}' is not a list` ·
`Invalid dependency group item: {item}`.

---

## 8 · pip's resolver — backtracking and failure messages

`https://pip.pypa.io/en/stable/topics/dependency-resolution/`

> *"At the start of a `pip install` run, pip does not have all the dependency information of the requested packages. It
> needs to work out the dependencies of the requested packages, the dependencies of those dependencies, and so on."*

> *"Changed in version 20.3: Pip's dependency resolver is now capable of backtracking."*

> *"During dependency resolution, pip needs to make assumptions about the package versions it needs to install and,
> later, check these assumptions were not incorrect. When pip finds that an assumption it made earlier is incorrect, it
> has to backtrack, which means also discarding some of the work that has already been done, and going back to choose
> another path."*

> *"This can look like pip downloading multiple versions of the same package, since pip explicitly presents each download
> to the user. The backtracking of choices made during this step is not unexpected behaviour or a bug. It is part of how
> dependency resolution for Python packages works."*

pip's own INFO line, quotable inline:
`INFO: pip is looking at multiple versions of this package to determine which version is compatible with other
requirements. This could take a while.`

> *"If pip starts backtracking during dependency resolution, it does not know how many choices it will reconsider, and how
> much computation would be needed."*

> *"Backtracking reduces the risk that installing a new package will accidentally break an existing installed package, and
> so reduces the risk that your environment gets messed up. To do this, pip has to do more work, to find out which version
> of a package is a good candidate to install."*

> *"There is no one-size-fits-all answer to situations where pip is backtracking excessively during dependency resolution.
> There are ways to reduce the degree to which pip might backtrack though. Nearly all of these approaches require some
> amount of trial and error."*

> *"However, it is a possible that pip will not be able to find a set of compatible versions. For this, pip will try every
> possible combination that it needs to and determine that there is no compatible set."*

> *"It is usually a good idea to add constraints the package(s) that pip is backtracking on"*

> *"During deployment, you can create a lockfile stating the exact package and version number for each dependency of that
> package. You can create this with pip-tools. This means the “work” is done once during development process, and thus will
> avoid performing dependency resolution during deployment."*

🔴 The `ResolutionImpossible` message, verbatim from the docs (hypothetical packages are the docs' own):

```
ERROR: Cannot install package_coffee==0.44.1 and package_tea==4.3.0 because these package versions have conflicting dependencies.
The conflict is caused by:
    package_coffee 0.44.1 depends on package_water<3.0.0,>=2.4.2
    package_tea 4.3.0 depends on package_water==2.3.1
```

> *"Note: package_coffee, package_tea, and package_water are hypothetical packages used only to illustrate dependency
> conflicts. They are not real projects you can install."*

The fix ladder, in the docs' own order and headings:
1. *"Audit your top level requirements"* — *"As a first step, it is useful to audit your project and remove any unnecessary
   or out of date requirements … Removing these can significantly reduce the complexity of your dependency tree, thereby
   reducing opportunities for conflicts to occur."*
2. *"Loosen your top level requirements"* — *"Sometimes the packages that you have asked pip to install are incompatible
   because you have been too strict when you specified the package version."* … *"If you want to prioritize one package over
   another, you can add version specifiers to only the more important package"* … *"Now that you have resolved the issue, you
   can repin the compatible package versions as required."*
3. *"Loosen the requirements of your dependencies"* — *"Requesting that the package maintainers loosen their dependencies ·
   Forking the package and loosening the dependencies yourself"* with *"If you choose to fork the package yourself, you are
   opting out of any support provided by the package maintainers. Proceed at your own risk!"*
4. *"All requirements are appropriate, but a solution does not exist"* — *"Sometimes it's simply impossible to find a
   combination of package versions that do not conflict. Welcome to dependency hell."* → *"Using an alternative package, if
   that is acceptable for your project"* · *"Refactoring your project to reduce the number of dependencies (for example, by
   breaking up a monolithic code base into smaller pieces)."*

`ResolutionTooDeep`:

> *"Sometimes pip's dependency resolver may exceed its search depth and terminate with a `ResolutionTooDeepError` exception.
> This typically occurs when the dependency graph is extremely complex or when there are too many package versions to
> evaluate."*

Its remedies: *"Specify Reasonable Lower Bounds"* (*"By setting a higher lower bound for your dependencies, you narrow the
search space. This excludes older versions that might trigger excessive backtracking."*) · *"Use the `--upgrade` Flag"* ·
*"Utilize Constraint Files"* (*"If you need to impose additional version restrictions on transitive dependencies (dependencies
of dependencies), consider using a constraint file."*) · *"Use Upper Bounds Sparingly"* (*"Although upper bounds are generally
discouraged because they can complicate dependency management, they may be necessary when certain versions are known to cause
conflicts."*).

pip's operator table, footnote 1, verbatim: *"Compatible versions are higher versions that only differ in the final segment.
`~=3.1.2` is equivalent to `>=3.1.2, ==3.1.*`. `~=3.1` is equivalent to `>=3.1, ==3.*`."*

---

## 9 · Claims I could NOT settle from a primary source

Written on the pages as explicitly uncertain, or left out:

1. **"A library must never commit its lockfile."** No PyPA or uv page states this as a rule. What *is* sourced: a lockfile
   is not published in a distribution, uv's *"This file should be checked into version control"* is written about
   applications/projects generally, and PEP 735 lists *"Libraries with unpublished dev dependency groups"* as a use case. The
   pages therefore argue from the **mechanism** (a consumer resolving your library never reads your lock) and say the "don't
   commit it" convention is a convention, not a spec rule.
2. **Exact wording of a `requires-python` mismatch error** from uv or pip. Not found in the docs. Mechanism explained in prose
   instead; no error string invented.
3. **Whether `uv.lock` stores hashes for every distribution.** uv's docs say the lockfile is TOML, managed by uv, not to be
   edited, and that `uv export --no-hashes` exists (so export emits them by default) — they do not state the on-disk lock
   schema. Pages say hashes are present in exports and do not claim a `uv.lock` field name.
4. **pip's current release number.** The pip docs date `--no-require-hashes` as *"Added in version 26.2"*; that admonition is
   quoted as-is and no pip version is pinned anywhere on the pages.
5. **Poetry/PDM caret semantics** beyond what uv's `--bounds major` documents (`>=1.2.3, <2.0.0` "similar to the semver
   caret"). Nothing is claimed about Poetry's own resolver.

---

## 10 · Gap pass — resume session 2026-09-10 (appended; do not re-derive)

Two sources: (a) the dead author's raw upstream dumps in the topic's `_scratch/` (fetched
2026-09-10 with curl, deleted at topic close — the quotes below are banked so nothing is lost);
(b) six WebFetches made to close gaps. Every string is upstream text.

### uv CLI reference (`https://docs.astral.sh/uv/reference/cli/`, uv 0.12.12)

- `uv sync` header: *"Syncing ensures that all project dependencies are installed and up-to-date with the
  lockfile."* · *"By default, an exact sync is performed: uv removes packages that are not declared as
  dependencies of the project. Use the --inexact flag to keep extraneous packages. Note that if an extraneous
  package conflicts with a project dependency, it will still be removed. Additionally, if --no-build-isolation
  is used, uv will not remove extraneous packages to avoid removing possible build dependencies."* ·
  *"The project is re-locked before syncing unless the --locked or --frozen flag is provided."* ·
  🔴 *"Note that, when installing from a lockfile, uv will not provide warnings for yanked package versions."*
- `uv lock` header: *"If the project lockfile (uv.lock) does not exist, it will be created. If a lockfile is
  present, its contents will be used as preferences for the resolution. If there are no changes to the
  project's dependencies, locking will have no effect unless the --upgrade flag is provided."*
- `uv lock --check-exists`: *"Assert that a uv.lock exists without checking if it is up-to-date [env: UV_FROZEN=]
  Equivalent to --frozen."* · `--check` *"Equivalent to --locked."* · `--dry-run` *"Perform a dry run, without
  writing the lockfile."*
- env forms: `--locked` `[env: UV_LOCKED=]` · `--frozen` `[env: UV_FROZEN=]` · `--no-dev` `[env: UV_NO_DEV=]`.
- `--all-extras`: *"When two or more extras are declared as conflicting in tool.uv.conflicts, using this flag will
  always result in an error. Note that all optional dependencies are always included in the resolution; this
  option only affects the selection of packages to install."*
- `--extra` / `--group`: *"When multiple extras or groups are specified that appear in tool.uv.conflicts, uv will
  report an error."* · `--no-extra`: *"Exclude the specified optional dependencies, if --all-extras is supplied."*
- `--no-group`: *"This option always takes precedence over default groups, --all-groups, and --group."*
- `--no-dev`: *"This option is an alias of --no-group dev."* · `--only-group`: *"Only include dependencies from the
  specified dependency group. The project and its dependencies will be omitted."* · `--only-dev` *"Implies
  --no-default-groups."* · `--no-default-groups`: *"uv includes the groups defined in tool.uv.default-groups by
  default. This disables that option, however, specific groups can still be included with --group."*
- `--no-install-project`: *"By default, the current project is installed into the environment with all of its
  dependencies. The --no-install-project option allows the project to be excluded, but all of its dependencies
  are still installed. This is particularly useful in situations like building Docker images…"*
- `--upgrade`: *"Allow package upgrades, ignoring pinned versions in any existing output file. Implies --refresh"* ·
  `--upgrade-package, -P` · `--upgrade-group`: *"Allow upgrades for all packages in a dependency group, ignoring
  pinned versions in any existing output file"* (changelog 0.12.0: *"Require `--upgrade-group` to name an existing
  dependency group"*).
- `--exclude-newer`: *"Limit candidate packages to those that were uploaded prior to the given date. The date is
  compared against the upload time of each individual distribution artifact (i.e., when each file was uploaded to
  the package index), not the release date of the package version. Accepts RFC 3339 timestamps …, local dates …, a
  "friendly" duration (e.g., 24 hours, 1 week, 30 days), or an ISO 8601 duration (e.g., PT24H, P7D, P30D)."* ·
  *"Use false to disable exclude-newer."* · `--exclude-newer-package PACKAGE=DATE`.
- `--index-strategy`: *"By default, uv will stop at the first index on which a given package is available, and limit
  resolutions to those present on that first index (first-index). This prevents "dependency confusion" attacks,
  whereby an attacker can upload a malicious package under the same name to an alternate index."* Values:
  *"first-index: Only use results from the first index that returns a match for a given package name ·
  unsafe-first-match: Search for every package name across all indexes, exhausting the versions from the first index
  before moving on to the next · unsafe-best-match: Search for every package name across all indexes, preferring the
  "best" version found."*
- `--extra-index-url`: *"(Deprecated: use --index instead)"*.
- `--no-sources`: *"Used to lock against the standards-compliant, publishable package metadata, as opposed to using any
  workspace, Git, URL, or local path sources"*.
- `--no-build`: *"Don't build source distributions."*
- 🔴 `uv audit`: *"Audit the project's dependencies. Dependencies are audited for known vulnerabilities, as well as
  'adverse' statuses such as deprecation and quarantine. By default, all extras and groups within the project are
  audited. To exclude extras and/or groups from the audit, use the --no-extra, --no-group, and related options."* ·
  `--frozen` *"Audit the requirements without locking the project"* · `--ignore` *"Ignore a vulnerability by ID."* ·
  `--ignore-until-fixed` *"Ignore a vulnerability by ID, but only while no fix is available. … Once a fix version
  becomes available, the vulnerability will be reported again."* · `--output-format` text/json/sarif ·
  `--service-format` default `osv`, *"OSV: https://api.osv.dev/"*. ⚠️ The release `uv audit` landed in is NOT
  confirmed — the changelog fetch surfaced only 0.12.2's *"Audit one or all installed tools with `uv tool audit`"*.
- `uv export` header: *"At present, requirements.txt, pylock.toml (PEP 751) and CycloneDX v1.5 JSON output formats are
  supported. The project is re-locked before exporting unless the --locked or --frozen flag is provided."* ·
  `--format`: *"uv will infer the output format from the file extension of the output file, if provided. Otherwise,
  defaults to requirements.txt."* · `--no-hashes` *"Omit hashes in the generated output"* · `--no-emit-project` ·
  `--no-emit-local` · `--prune` *"Prune the given package from the dependency tree."*
- `uv pip compile`: *"Compile a requirements.in file to a requirements.txt or pylock.toml file"* · `--universal`:
  *"Perform a universal resolution, attempting to generate a single requirements.txt output file that is compatible
  with all operating systems, architectures, and Python implementations. In universal mode, the current Python version
  (or user-provided --python-version) will be treated as a lower bound."* · `--no-strip-markers`: *"By default, uv
  strips environment markers, as the resolution generated by compile is only guaranteed to be correct for the target
  environment."* · `--generate-hashes` · `--output-file`: *"If the file already exists, the existing versions will be
  preferred when resolving dependencies, unless --upgrade is also specified."* · `--constraints`: *"Constraints files
  are requirements.txt-like files that only control the version of a requirement that's installed. However, including
  a package in a constraints file will not trigger the installation of that package. This is equivalent to pip's
  --constraint option."* · `--overrides`: *"While constraints are additive, in that they're combined with the
  requirements of the constituent packages, overrides are absolute, in that they completely replace the requirements
  of the constituent packages."* · `--excludes` · `--build-constraints`.
- `uv pip install/sync --require-hashes`: *"By default, uv will verify any available hashes in the requirements file,
  but will not require that all requirements have an associated hash. When --require-hashes is enabled, all
  requirements must include a hash or set of hashes, and all requirements must either be pinned to exact versions
  (e.g., ==1.0.0), or be specified via direct URL. Hash-checking mode introduces a number of additional constraints:
  Git dependencies are not supported. - Editable installations are not supported. - Local dependencies are not
  supported, unless they point to a specific wheel (.whl) or source archive (.zip, .tar.gz), as opposed to a
  directory."* · `--strict`: *"Validate the Python environment after completing the installation, to detect packages
  with missing dependencies or other issues"*.
- uv changelog 0.12.0 (2026-07-28): *"Reject MD5-only hashes in hash-checking mode"*.

### uv Resolution (`https://docs.astral.sh/uv/concepts/resolution/`) — sections not in §6

- Dependency preferences: *"If resolution output file exists, i.e., a uv lockfile (uv.lock) or a requirements output file
  (requirements.txt), uv will prefer the dependency versions listed there. Similarly, if installing a package into a
  virtual environment, uv will prefer the already installed version if present. This means that locked or installed
  versions will not change unless an incompatible version is requested or an upgrade is explicitly requested with
  --upgrade."*
- Platform-specific: *"Unlike universal resolution, during platform-specific resolution, the provided --python-version is
  the exact python version to use, not a lower bound."*
- Constraints: *"Constraints are useful for reducing the range of available versions for a transitive dependency. They can
  also be used to keep a resolution in sync with some other set of resolved versions, regardless of which packages are
  overlapping between the two."*
- Overrides: *"As with constraints, global overrides do not add a dependency on the package and only take effect if the
  package is requested in a direct or transitive dependency."* · *"In a pyproject.toml, use tool.uv.override-dependencies
  to define a list of overrides."* · scoped form `{ package = { name = "bar", version = "0.0.5" }, dependencies = ["foo>2"] }`
  — *"If bar does not declare a dependency on foo, the scoped override adds it."* · *"Scoped overrides currently support
  registry version specifiers only."* · *"If multiple overrides are provided for the same package, they must be
  differentiated with markers."*
- Exclusions combined with overrides to swap `lightning` → `pytorch-lightning` for `bar==0.0.5`.
- Conflicts across workspace members use a `package` key: `{ package = "member1", extra = "extra1" }`; *"These workspace
  members will not be installable together"*.
- 🔴 Lower bounds: *"By default, uv add adds lower bounds to dependencies and, when using uv to manage projects, uv will
  warn if direct dependencies don't have lower bounds."* · *"If there are no lower bounds, the resolver can (and often
  will) backtrack down to the oldest version of a package. This isn't only problematic because it's slow, the old version
  of the package often fails to build, or the resolver can end up picking a version that's old enough that it doesn't
  depend on the conflicting package, but also doesn't work with your code."*
- 🔴 Reproducible resolutions: *"uv supports an --exclude-newer option to limit resolution to distributions uploaded before a
  specific date, allowing reproduction of installations regardless of new package releases."* · *"The package index must
  support the upload-time field as specified in PEP 700. If the field is not present for a given distribution, the
  distribution will be treated as unavailable unless …"* · *"PyPI provides upload-time for all packages."* · *"To ensure
  reproducibility, messages for unsatisfiable resolutions will not mention that distributions were excluded due to the
  --exclude-newer flag — newer distributions will be treated as if they do not exist."* · *"The --exclude-newer option is
  only applied to packages that are read from a registry (as opposed to, e.g., Git dependencies)."*
- 🔴 Dependency cooldowns: *"uv also supports dependency "cooldowns" in which resolution will ignore packages newer than a
  duration. This is a good way to improve security posture by delaying package updates until the community has had the
  opportunity to vet new versions of packages."* · *"When a duration is used for resolution, a timestamp is calculated
  relative to the current time. When using a uv.lock file, the timestamp is included in the lockfile. uv will not update
  the lockfile when the current time changes, instead, uv will update the timestamp when a new resolution is performed,
  e.g., when --upgrade or --refresh is used."* · `[tool.uv] exclude-newer = "1 week"`, `exclude-newer-package = { setuptools
  = "30 days" }`.
- Lockfile versioning: *"Any given version of uv can read and write lockfiles with the same schema version, but will
  reject lockfiles with a greater schema version."* · *"all uv patch versions within a given minor uv release are
  guaranteed to have full lockfile compatibility. In other words, lockfiles may only be rejected across minor releases."*
- Required environments: *"Some packages (like PyTorch) publish built distributions, but omit a source distribution. Such
  packages are only installable on platforms for which a built distribution is available."*

### uv Locking and syncing — sections not in §6

- `uv run --no-sync`; `uv run --exact`; *"commands which read the lockfile, such as uv tree, will automatically update it
  before running."*
- Malware checks: *"On-sync malware checking is in preview, and is subject to change until stabilized."* · *"While syncing,
  uv can perform a lightweight scan of your lockfile for known malware by checking it against OSV. OSV references MAL
  advisories from the OpenSSF's malicious packages database."* · *"If a locked dependency matches a malware advisory, the
  sync will be terminated."* · *"set audit.malware-check = true in your uv settings or set UV_MALWARE_CHECK=1"*.

### uv Managing dependencies — sections not in §6

- `uv add httpx --optional network`; per-extra sources: `torch = [{ index = "torch-cpu", extra = "cpu" }, { index =
  "torch-gpu", extra = "gpu" }]`.
- `uv add --group lint ruff`; *"The --dev, --only-dev, and --no-dev flags are equivalent to --group dev, --only-group dev,
  and --no-group dev respectively."* · `[tool.uv] default-groups = ["dev", "foo"]` or `"all"`.
- Legacy: *"Dependencies declared in this section will be combined with the contents in the dependency-groups.dev."* ·
  *"If a tool.uv.dev-dependencies field exists, uv add --dev will use the existing section instead of adding a new
  dependency-groups.dev section."*

### uv Indexes (`https://docs.astral.sh/uv/concepts/indexes/`) — WebFetch, summarised by the fetch model; only the
quoted strings are verbatim

- `torch = { index = "pytorch" }` + `[[tool.uv.index]] name/url/explicit = true`; explicit means *"torch is installed from
  the pytorch index, but all other packages are installed from PyPI"*.
- *"While unsafe-best-match is the closest to pip's behavior, it exposes users to the risk of 'dependency confusion'
  attacks."*
- *"Credentials are never stored in the uv.lock file; as such, uv must have access to the authenticated URL at installation
  time."*

### uv resolver internals (`https://docs.astral.sh/uv/reference/internals/resolver/`)

- *"uv uses pubgrub-rs, the Rust implementation of PubGrub, an incremental version solver."*
- *"From the incompatibilities tracked in PubGrub, an error message is constructed to enumerate the involved packages."*
- *"inspired by Poetry, uv uses a forking resolver: whenever there are multiple requirements for a package with different
  markers, the resolution is split."* · *"the resolution-markers of each fork and each package that diverges between forks
  is written to the lockfile."*
- *"Introducing a requires-python upper bound to a project that previously wasn't using one will not prevent the project
  from being used on a too recent Python version."*

### uv + Dependabot (`https://docs.astral.sh/uv/guides/integration/dependabot/`)

- *"It is considered best practice to regularly update dependencies, to avoid being exposed to vulnerabilities, limit
  incompatibilities between dependencies, and avoid complex upgrades when upgrading from a too old version."*
- `package-ecosystem: "uv"`; cooldown advice: *"set the equivalent `cooldown` option in Dependabot, to avoid ending up with
  pull requests where uv would not be able to lock the dependencies."* (`cooldown: default-days: 7` for a 1-week
  exclude-newer) · *"Dependabot has announced support for uv, but there are some use cases that are not yet working"*.
- GitHub changelog 2025-03-13: *"Dependabot version updates now support uv in general availability"*
  (`https://github.blog/changelog/2025-03-13-dependabot-version-updates-now-support-uv-in-general-availability/`).
  ⚠️ The GitHub supported-ecosystems page, as fetched, did not surface a uv row; security-update support for uv is
  NOT confirmed.

### pip (docs v26.2.1)

- `pip install` behaviour: *"Where more than one source of the chosen version is available, it is assumed that any source is
  acceptable (as otherwise the versions would differ)."* · `--extra-index-url`: *"Extra URLs of package indexes to use in
  addition to --index-url."* · `-r`: *"The file or URL can be in pip's requirements.txt format, or pylock.toml format.
  pylock.toml support is experimental."* · `--only-deps`: *"Take only the dependencies of the provided requirements into
  account, not the requirements themselves."* · `--pre`: *"By default, pip only finds stable versions."*
- Secure installs: *"By default, pip does not perform any checks to protect against remote tampering and involves running
  arbitrary code from distributions."* → *"Enable Hash-checking Mode, by passing --require-hashes · Disallow source
  distributions, by passing --only-binary :all:"* · Hash-checking *"Added in version 8.0."* · *"Note that hashes embedded
  in URL-style requirements via the #md5=... syntax suffice to satisfy this rule (regardless of hash strength, for legacy
  reasons)"* · `--require-hashes` *"is also a convenient way to bootstrap your list of hashes, since it shows the hashes of
  the packages it fetched. It fetches only the preferred archive for each package, so you may still need to add hashes for
  alternatives archives using pip hash"* · *"Multiple hashes per package … This is important when a package offers binary
  distributions for a variety of platforms or when it is important to allow both binary and source distributions."* ·
  *"Be careful not to nullify all your security work by installing your actual project by using setuptools' deprecated
  interfaces directly"* → `python -m pip install --no-deps .`
- Repeatable installs: *"Hash-checking mode is a labour-saving alternative to running a private index server containing
  approved packages"* · wheelhouse: *"such a wheelhouse contains compiled packages, which are typically OS and
  architecture-specific, so these archives are not necessarily portable across machines."*
- `pip lock` (`https://pip.pypa.io/en/stable/cli/pip_lock/`): EXPERIMENTAL; `-o, --output` *"Lock file name
  (default=pylock.toml). Use - for stdout."*; *"The generated lock file is only guaranteed to be valid for the current python
  version and platform."*
- Resolution: *"This behaviour can be disabled by passing --no-deps to pip install."*; reduce backtracking with
  `python -m pip install tea "cup >= 3.13"`; *"There is a possibility that the addition constraint is incorrect. When this
  happens, the reduced search space makes it easier for pip to more quickly determine what caused the conflict"*.

### pip-tools 7.6.1 (`https://pip-tools.readthedocs.io/en/stable/`) — fetch-model summary; quoted strings verbatim

- *"A set of command line tools to help you keep your `pip`-based packages fresh, even when you've pinned them."*
- *"To force `pip-compile` to update all packages in an existing `requirements.txt`, run `pip-compile --upgrade`."*
- pip-sync: *"This will install/upgrade/uninstall everything necessary to match the `requirements.txt` contents."*
- *"the resulting `requirements.txt` can differ for each environment"*; advice to run pip-compile *"on each Python
  environment separately"*.

### PEP 592 — yanked (`https://peps.python.org/pep-0592/`, Final; canonical spec now the Simple Repository API)

- *"Yanked files are always ignored, unless they are the only file that matches a version specifier that "pins" to an exact
  version using either `==` (without any modifiers that make it a range, such as `.*`) or `===`."*
- *"Regardless of the specific strategy that an installer chooses for deciding when to install yanked files, an installer
  SHOULD emit a warning when it does decide to install a yanked file."*
- *"The value of the `data-yanked` attribute, if present, is an arbitrary string that represents the reason for why the file
  has been yanked."*

### PEP 751 — pieces not in §5

- `packages.archive.hashes` / `packages.wheels.hashes`: *"Required?: yes"*; *"The table MUST contain at least one entry."*
- *"Packages MAY be listed multiple times with varying data, but all packages to be installed MUST narrow down to a single
  entry at install time."*
- *"Tools supporting extras MUST also support dependency groups."* (and the converse)
- Install steps include *"Validate the file size and hash."*; *"tools MUST NOT try to change what wheel file to download
  based on what's available; what file to install should be determined in an offline fashion for reproducibility"*.
- *"Requiring hashes, recording file sizes, and where a file was found – both the index and the location of the file itself
  – help with auditing and validating the files that were locked against. Compare that with requirements files which can
  optionally include hashes, but it is an opt-in feature and can be bypassed."*
- *"Being explicit about the supported Python versions and environments for the file overall is also unique to this PEP.
  This is to alleviate the issue of not knowing when a requirements file targets a specific platform."*

### PEP 751 — build requirements are NOT locked (from the `_scratch/pep751.txt` dump, before deletion)

- *"An earlier version of this PEP tried to lock the build requirements for sdists under a `packages.build-requires`
  key. Unfortunately, it confused enough people about how it was expected to operate and there were enough edge case
  issues to decide it wasn't worth trying to do in this PEP upfront. Instead, a future PEP could propose a solution."*
- sdist install steps: *"Else if no wheel file is found or sdist is solely set: Get the file. … Validate the file size
  and hash. Build the package. Install."*

### uv Settings reference (`https://docs.astral.sh/uv/reference/settings/`) — WebFetch 2026-09-10

- `constraint-dependencies`: *"Constraints to apply when resolving the project's dependencies. Constraints are used to
  restrict the versions of dependencies that are selected during resolution."* — example `["grpcio<1.65"]`.
- `build-constraint-dependencies`: *"Constraints to apply when solving build dependencies."* — example
  `["setuptools==60.0.0"]`.
- `override-dependencies`: *"Overrides are used to force selection of a specific version of a package, regardless of
  the version requested by any other package."*
- `exclude-dependencies`: *"Excludes are used to prevent a package from being selected during resolution, regardless of
  whether it's requested by any other package."*
- For each of the four: *"In `uv lock`, `uv sync`, and `uv run`, uv will only read `<setting>` from the `pyproject.toml`
  at the workspace root, and will ignore any declarations in other workspace members or `uv.toml` files."*
- `conflicts`: *"Declare collections of extras or dependency groups that are conflicting (i.e., mutually exclusive). By
  making such conflicts explicit, uv can generate a universal resolution for a project."*
- `required-version`: *"Enforce a requirement on the version of uv. If the version of uv does not meet the requirement at
  runtime, uv will exit with an error. Accepts a PEP 440 specifier, like `==0.5.0` or `>=0.5.0`."*

### uv tool run / uvx (CLI reference)

- *"The name of the command can include an exact version in the format <package>@<version>"* · *"uvx is provided as a
  convenient alias for uv tool run, their behavior is identical."* · *"Packages are installed into an ephemeral virtual
  environment in the uv cache directory."*
- `uv tree --invert`: *"Show the reverse dependencies for the given package."* · `--outdated`: *"Show the latest available
  version of each package in the tree"*.
- `uv init --bare`: *"Only create a pyproject.toml."* · `uv add -r/--requirements`; `uv add -c`: *"The constraints will
  not be added to the project's pyproject.toml file, but will be respected during dependency resolution."*

### Topic close — 2026-09-10 resume session

Topic finished at 33 chunks + README (17→17/17b/17c, 19→19/19b, 21→21/21b, 22→22/22b/22c, 23→23/23b, 25→25/25b).
`_scratch/` deleted; everything reusable from it is banked above.
