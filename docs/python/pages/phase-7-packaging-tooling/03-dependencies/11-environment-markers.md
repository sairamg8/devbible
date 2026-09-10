---
title: "An environment marker is a tiny typed expression language with no `and`-chaining, no unknown variables and one field per Python runtime fact — and getting its types wrong is how a dependency silently disappears"
sidebar_label: "11 · Environment markers"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Dependency specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/)),
> **PEP 508** ([peps.python.org](https://peps.python.org/pep-0508/)) and uv's **Resolution**
> concepts ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/), **uv 0.12.12**).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run** — marker values below are
> the specification's own sample values, not values read off this machine.

**A marker is the fifth slot of a dependency specifier: a semicolon, then an expression that decides
whether the dependency applies at all. It is deliberately a tiny language — no function calls, no
attribute access, no chained comparisons — because it has to be evaluated safely by an installer that
must not run your code. The two things that catch people are typing (`python_version` is a *version*
field, `sys_platform` is a *string* field, and using the wrong operator on either is "discouraged"
with tool-defined fallback behaviour) and the fact that markers are what make a lockfile portable
across platforms at all.**

## The mechanism

> *"Environment markers allow a dependency specification to provide a rule that describes when the
> dependency should be used. For instance, consider a package that needs argparse. In Python 2.7
> argparse is always present. On older Python versions it has to be installed as a dependency. This can
> be expressed as so: `argparse;python_version<"2.7"`"*

> *"A marker expression evaluates to either True or False. When it evaluates to False, the dependency
> specification should be ignored."*

Why it is a language and not an expression evaluated by Python:

> *"The marker language is inspired by Python itself, chosen for the ability to safely evaluate it
> without running arbitrary code that could become a security vulnerability."*

That constraint explains every limitation below. An installer resolving your package has to answer
"does this dependency apply?" without importing anything you wrote.

## The fields

> *"Unless otherwise noted below, marker evaluation environments MUST support all of the following
> marker fields"*

| Marker | Python equivalent | Type | Sample values, verbatim |
|---|---|---|---|
| `os_name` | `os.name` | String | `posix`, `java` |
| `sys_platform` | `sys.platform` | String | `linux`, `win32`, `darwin` — *"note that this is the most well defined field for use when declaring platform specific dependencies"* |
| `platform_machine` | `platform.machine()` | String | `x86_64`, `aarch64`, `AMD64`, `arm64` — *"note that this value is provided by the operating system, so the same CPU architecture may use different strings on different platforms"* |
| `platform_python_implementation` | `platform.python_implementation()` | String | `CPython`, `PyPy` |
| `platform_release` | `platform.release()` | Version \| String | `3.14.1-x86_64-linode39`, `14.5.0` |
| `platform_system` | `platform.system()` | String | `Linux`, `Windows`, `Java` |
| `platform_version` | `platform.version()` | Version \| String | kernel build strings |
| `python_version` | `'.'.join(platform.python_version_tuple()[:2])` | Version | `3.9`, `3.15` |
| `python_full_version` | `platform.python_version()` | Version | `3.10.12`, `3.15.0a1` |
| `implementation_name` | `sys.implementation.name` | String | `cpython`, `pypy` |
| `implementation_version` | see spec | Version | `3.10.12`, `7.3.17` |

Two of them are routinely confused. `python_version` is **two components** — `3.14`, never `3.14.7` —
so `python_version >= "3.14.1"` is a comparison against a value that is always exactly `major.minor`.
Use `python_full_version` when the patch level matters. And `sys_platform` versus `platform_system`:
uv's own quick-reference table gives `'linux'`/`'darwin'`/`'win32'` for the former and
`'Linux'`/`'Darwin'`/`'Windows'` for the latter, with the note that *"On Windows, `sys_platform` is
always `'win32'`, even on 64-bit systems."*

## The operators, and why type matters

> *"All marker comparison expressions are expected to compare a named marker field against a given user
> supplied constant. The type of the comparison is determined by the comparison operator used and the
> type of the named field"*

The defined set, with the spec's own examples:

> *"`==` (for example, `sys_platform == "win32"`) · `!=` · `>` (for example, `python_version > "3.10"`)
> · `>=` · `<` · `<=` · `~=` (for example, `python_version ~= "3"`) · `===` · `in` (for example,
> `"gui" in extras`, `"SMP" in platform_version`) · `not in` (for example, `"dev" not in
> dependency_groups`)"*

For **String** fields:

> *"For String fields, `==`, `!=`, `in`, and `not in` are defined as they are for Python strings (case
> sensitive, with no value normalization of any kind)."*

🔴 And the discouraged combinations, with their fallback behaviour spelled out:

> *"The use of `~=` or `===` with string fields is explicitly discouraged and publishing tools SHOULD
> emit an error, index servers MAY disallow uploads containing such environment markers, while locking
> and installation tools MAY instead interpret them as equivalent to `==`. The use of ordered
> comparisons (`<`, `<=`, `>`, `>=`) with string fields is explicitly discouraged (as it makes no
> semantic sense in the packaging context) and publishing tools SHOULD emit an error, index servers MAY
> disallow uploads containing such environment markers, while locking and installation tools SHOULD
> implement the following behavior: treat `>=` and `<=` as equivalent to `==` · treat `>` and `<` as
> always being False"*

Read that last clause carefully: `sys_platform > "linux"` is not an error at install time — it is
**always False**, so the dependency silently never installs. That is the disappearing-dependency bug.

For **Version** fields:

> *"For Version fields, the comparison operations are defined by the Version specifier specification when
> either both the marker field value and the user supplied constant can be parsed as valid version
> specifiers or the `===` arbitrary equivalence comparison operator is used."*

> *"Note that `in` and `not in` containment checks are NOT valid for Version fields and publishing tools
> SHOULD emit an error … while locking and installation tools MAY treat them as always being False."*

So `"3" in python_version` — a plausible-looking way to say "any Python 3" — is invalid and may
evaluate to False forever.

PEP 508's own error examples make the typing concrete: `"dog" ~= "fred"` and
`python_version ~= "surprise"` both *"result in errors"*.

## Composition, and the missing chain

> *"More complex marker expressions may be composed using the `and` and `or` logical operators.
> Parentheses may be used as necessary to control operand precedence (with all comparison operations
> having a higher precedence)."*

The spec's example: `sys_platform == "ios" or sys_platform == "darwin"`.

🔴 And there is no chaining:

> *"Python's comparison chaining (such as `3.4 < python_version < 3.9`) is NOT supported in
> environment markers (such expressions must instead be written out as two separate comparisons
> joined by `and`)."*

```text
# invalid — chaining
mypkg; "3.10" < python_version < "3.13"
# valid
mypkg; python_version > "3.10" and python_version < "3.13"
```

Constants are always quoted:

> *"User supplied constants are always given as strings within either `'` or `"` quote marks.
> Triple-quoted multi-line strings are NOT permitted."*

> *"Backslash escapes are not specified, although tools MAY support them."*

## Gotchas

**★ Symptom: a dependency with a marker never installs anywhere.** Cause: an ordered comparison on a
String field, which locking and installation tools *"SHOULD"* treat as *"always being False"* for `>` and
`<`. `sys_platform > "linux"` is not an error; it is permanent False. Fix: use equality or containment:

```text
- mypkg; sys_platform > "linux"
+ mypkg; sys_platform == "linux"
```

**★ Symptom: `python_version >= "3.14.1"` behaves oddly.** Cause: `python_version` is `major.minor` only —
*"`'.'.join(platform.python_version_tuple()[:2])`"* — so it is `3.14` on every 3.14.x. Comparing it to a
three-component constant is comparing `3.14` to `3.14.1`, which is False by zero-padding. Fix: use the
field that carries the patch level:

```text
- mypkg; python_version >= "3.14.1"
+ mypkg; python_full_version >= "3.14.1"
```

**★ Symptom: a chained comparison is rejected by the build backend.** Cause: *"Python's comparison chaining
… is NOT supported in environment markers"*. Fix: two comparisons joined with `and`:

```toml
dependencies = [
  "mypkg; python_version > '3.10' and python_version < '3.13'",
]
```

**★ Symptom: a Windows-only dependency installs on Linux.** Cause: the wrong field or the wrong case.
`platform_system == "windows"` is False on Windows, because String comparisons are *"case sensitive, with no
value normalization of any kind"* and the value is `Windows`. Fix: prefer `sys_platform`, which the spec
calls *"the most well defined field for use when declaring platform specific dependencies"*:

```text
- mypkg; platform_system == "windows"
+ mypkg; sys_platform == "win32"
```

**★ Symptom: an ARM-only wheel dependency is skipped on an Apple machine and installed on a Linux ARM
box.** Cause: `platform_machine` is whatever the OS reports, and the spec warns *"the same CPU architecture
may use different strings on different platforms"* — `arm64` on macOS, `aarch64` on Linux, `ARM64` on
Windows. Fix: enumerate, or combine with `sys_platform`:

```text
mypkg; platform_machine == "arm64" or platform_machine == "aarch64"
```

**★ Symptom: `"3" in python_version` matches nothing.** Cause: containment is not defined for Version
fields — *"`in` and `not in` containment checks are NOT valid for Version fields"*, and tools *"MAY treat
them as always being False"*. Fix: a version comparison:

```text
- mypkg; "3" in python_version
+ mypkg; python_version >= "3"
```

## Interview questions

**★ Why is the marker language deliberately so limited?**
Because an installer has to evaluate it *before* installing your package, and therefore without running any
of your code. The spec says so: the language is *"chosen for the ability to safely evaluate it without
running arbitrary code that could become a security vulnerability."* Every limitation follows — no calls,
no attributes, no chaining, a fixed field list, quoted constants only. If markers could call Python, reading
a package's dependency metadata would mean executing untrusted code, which is exactly the `setup.py` problem
that PEP 621 exists to end.

**★ What is the difference between `python_version` and `python_full_version`?**
`python_version` is `major.minor` — the spec defines it as
*"`'.'.join(platform.python_version_tuple()[:2])`"*, sample values `3.9`, `3.15`. `python_full_version` is
the whole thing, `platform.python_version()`, with sample values `3.10.12` and `3.15.0a1`. Use
`python_version` for "which Python line", and `python_full_version` when a patch release or a pre-release
matters — including when you need to distinguish `3.15.0a1` from `3.15.0`, which `python_version` cannot see
at all.

**★ `sys_platform > "linux"` — what happens?**
Nothing visible, which is the problem. It is an ordered comparison on a String field, *"explicitly
discouraged (as it makes no semantic sense in the packaging context)"*; publishing tools should error, but
locking and installation tools *"SHOULD"* treat `>` and `<` as *"always being False"*. So the dependency is
silently never installed, on any platform, and the only symptom is an `ImportError` at runtime. The related
trap is `>=`/`<=` on a string field, which those tools treat as `==` — a different wrong answer.

---

← [10 · Direct references](10-direct-references-and-sources.md) · [Topic index](README.md) · Next → [12 · Marker fields that only lock files may use](12-markers-special-fields-and-portability.md)
