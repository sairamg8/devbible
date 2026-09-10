---
title: "A direct URL in a dependency is a tool for integrators, not publishers — it makes your project unpublishable to PyPI, and the fix is to keep the declaration abstract and put the URL in a tool table"
sidebar_label: "10 · Direct references"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/)),
> the PyPA **Dependency specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/))
> and uv's **Managing dependencies**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/), **uv 0.12.12**).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**The fourth slot of a dependency specifier replaces the version range with `@` and a URL. It is
the only slot that names *where* an artifact comes from, which is why the specification calls it a
tool for integrators rather than publishers and why public indexes are told to refuse
distributions that contain one. The practical rule is short: a direct URL is fine in your own
`requirements.txt` and fatal in a library's `[project.dependencies]`. Modern tooling gives you the
third option — an abstract declaration plus a development-only source table — and that is the shape
to reach for.**

## The syntax

> *"Some automated tools may permit the use of a direct reference as an alternative to a normal version
> specifier. A direct reference consists of the specifier `@` and an explicit URL."*

The specification's own examples:

```text
pip @ file:///localbuilds/pip-1.3.1.zip
pip @ file:///localbuilds/pip-1.3.1-py33-none-any.whl
pip @ https://github.com/pypa/pip/archive/1.3.1.zip#sha1=da9234ee9982d4bbb3c72346a6de940a148ea686
```

> *"Depending on the use case, some appropriate targets for a direct URL reference may be an sdist or a
> wheel binary archive. The exact URLs and targets supported will be tool dependent."*

Note the grammar consequence from [09](09-the-requirement-string.md): the URL slot **replaces** the
version specifier. `mypkg @ https://... >=1.0` is not a thing — a URL names one artifact, so there is
nothing to range over.

## Why publishers must not use one

> *"Whether or not direct references are appropriate depends on the specific use case for the version
> specifier. Automated tools SHOULD at least issue warnings and MAY reject them entirely when direct
> references are used inappropriately."*

🔴 And the rule that decides the matter:

> *"Public index servers SHOULD NOT allow the use of direct references in uploaded distributions.
> Direct references are intended as a tool for software integrators rather than publishers."*

The reasoning is the abstract/concrete split that [13](13-applications-lock-libraries-range.md)
develops in full. A published dependency says *what* is needed; a URL says *where to get it*. Encoding
"where" in published metadata removes your consumers' ability to use a mirror, an internal index, an
air-gapped wheelhouse or a security-scanned rebuild — decisions that belong to whoever installs, not
whoever publishes.

## Security: transport and hash are both required

> *"All direct references that do not refer to a local file URL SHOULD specify a secure transport
> mechanism (such as https) AND include an expected hash value in the URL for verification purposes. If
> a direct reference is specified without any hash information, with hash information that the tool
> doesn't understand, or with a selected hash algorithm that the tool considers too weak to trust,
> automated tools SHOULD at least emit a warning and MAY refuse to rely on the URL. If such a direct
> reference also uses an insecure transport, automated tools SHOULD NOT rely on the URL."*

Where the hash goes:

> *"For source archive and wheel references, an expected hash value may be specified by including a
> `<hash-algorithm>=<expected-hash>` entry as part of the URL fragment."*

Which algorithms:

> *"It is RECOMMENDED that only hashes which are unconditionally provided by the latest version of the
> standard library's `hashlib` module be used for source archive hashes. At time of writing, that list
> consists of `'md5'`, `'sha1'`, `'sha224'`, `'sha256'`, `'sha384'`, and `'sha512'`."*

⚠️ That list is PEP 440's, and it is broader than what pip will accept today for hash-checking mode,
where *"weaker ones such as `md5`, `sha1`, and `sha224` are excluded to avoid giving a false sense of
security"* ([19](19-hashes-and-hash-checking-mode.md)). Use `sha256`.

## VCS references

> *"For version control references, the `VCS+protocol` scheme SHOULD be used to identify both the
> version control system and the secure transport, and a version control system with hash based commit
> identifiers SHOULD be used. Automated tools MAY omit warnings about missing hashes for version control
> systems that do not provide hash based commit identifiers."*

> *"To handle version control systems that do not support including commit or tag references directly in
> the URL, that information may be appended to the end of the URL using the `@<commit-hash>` or the
> `@<tag>#<commit-hash>` notation."*

And the reason both a tag *and* a hash are prescribed, in the spec's own note:

> *"the commit hash is included even when retrieving based on a tag, in order to meet the requirement
> above that every link should include a hash to make things harder to forge (creating a malicious repo
> with a particular tag is easy, creating one with a specific hash, less so)"*

The same note warns that this is not pip's historical spelling:

> *"This isn't quite the same as the existing VCS reference notation supported by pip. Firstly, the
> distribution name is moved in front rather than embedded as part of the URL."*

So `git+https://…#egg=mypkg` (pip's old form) and `mypkg @ git+https://…` (the standard form) are two
notations for one idea. Write the standard one.

## The shape to use instead

Keep the published declaration abstract and move the URL into a tool table that is stripped from the
built distribution:

```toml
[project]
name = "acme-reports"
requires-python = ">=3.12"
dependencies = ["httpx", "acme-core"]        # publishable: plain names

[tool.uv.sources]
httpx = { git = "https://github.com/encode/httpx" }   # a fork, during development
acme-core = { path = "../acme-core", editable = true }  # a sibling package in a monorepo
```

uv's documentation states the division of labour:

> *"The `tool.uv.sources` table extends the standard dependency tables with alternative dependency
> sources, which are used during development."*

> *"Dependency sources add support for common patterns that are not supported by the
> `project.dependencies` standard, like editable installations and relative paths."*

and tells you how to prove the separation holds before publishing:

> *"When publishing a package, we recommend running `uv build --no-sources` to ensure that the package
> builds correctly when `tool.uv.sources` is disabled, as is the case when using other build tools, like
> `pypa/build`."*

`uv add` will write the source entry for you when you give it a non-registry target — from uv's docs:
*"When adding a dependency from a source other than a package registry, uv will add an entry in the
sources field."*

```bash
uv add "httpx @ git+https://github.com/encode/httpx"
# → dependencies = ["httpx"] plus [tool.uv.sources] httpx = { git = "..." }
```

Git dependencies also get lockfile treatment, which is what makes them reproducible:

> *"uv applies similar logic to Git dependencies. For example, if a Git dependency references the `main`
> branch, uv will prefer the locked commit SHA in an existing `uv.lock` file over the latest commit on
> the `main` branch, unless the `--upgrade` or `--upgrade-package` flags are used."*

## Gotchas

**★ Symptom: `twine upload` or the index rejects a distribution whose metadata contains a URL.** Cause:
a direct reference in `[project.dependencies]` — *"Public index servers SHOULD NOT allow the use of
direct references in uploaded distributions."* Fix: keep the published dependency abstract and move the
override to a tool table:

```toml
- dependencies = ["httpx @ git+https://github.com/encode/httpx"]
+ dependencies = ["httpx"]
+
+ [tool.uv.sources]
+ httpx = { git = "https://github.com/encode/httpx" }
```

**★ Symptom: a marker on a URL requirement is silently ignored.** Cause: whitespace. The grammar is
`urlspec (wsp+ quoted_marker?)?` — a space before the `;` is *required*, because *"The sole exception is
detecting the end of a URL requirement."* Without it, the `;` is parsed as part of the URL. Fix:

```text
- mypkg @ https://example.com/mypkg.whl; sys_platform == 'linux'
+ mypkg @ https://example.com/mypkg.whl ; sys_platform == 'linux'
```

**★ Symptom: a Git dependency changes behaviour between machines even though the URL is pinned to a
tag.** Cause: a tag is mutable. The spec's own reasoning: *"creating a malicious repo with a particular
tag is easy, creating one with a specific hash, less so"*, and it prescribes `@<tag>#<commit-hash>`. Fix:
include the commit hash, or lock the dependency so uv records the resolved commit and prefers it over the
branch head.

**★ Symptom: an internal wheel URL works for months, then a build starts failing with a hash mismatch.**
Cause: the artifact behind the URL was replaced. A direct reference without a hash has no defence — the
spec asks for one and says tools *"MAY refuse to rely on the URL"* without it. Fix: put the hash in the
fragment:

```text
mypkg @ https://internal.example/wheels/mypkg-1.2.3-py3-none-any.whl#sha256=<expected-hash>
```

**★ Symptom: `uv build` succeeds locally and the published wheel cannot be installed by anyone else.**
Cause: `tool.uv.sources` resolved a path or Git dependency during your build, but the *published*
metadata names a registry package that does not exist — or exists at a version your fork's code does not
match. Fix: build the way a foreign tool would, before publishing:

```bash
uv build --no-sources        # fails now if the abstract declaration is not self-sufficient
```

**★ Symptom: a `file://` path dependency works on one machine and not another.** Cause: an absolute path
in a URL, or a relative path interpreted against a different working directory. `file:///home/alice/...`
is not portable, and the standard specifier grammar has no relative-path form at all — that is precisely
why PEP 735 declined to add one, noting there are *"no existing standards for these features"*. Fix: use
a tool source with a project-relative path:

```toml
[tool.uv.sources]
acme-core = { path = "../acme-core", editable = true }
```

**★ Symptom: `pip install "mypkg @ git+https://…"` works and the same string in `pyproject.toml` is
rejected by the build backend.** Cause: two different acceptors. pip accepts its own extended
requirements syntax; `[project.dependencies]` must contain valid dependency specifiers only, and
PEP 631's rule applies — *"Build backends SHOULD abort at load time for any parsing errors."* In practice
the standard `name @ url` form parses in both; pip's older `git+https://…#egg=name` form parses only in
pip. Fix: write the standard form, and keep it out of published metadata regardless.

**★ Symptom: an sdist-only Git dependency slows every resolution to a crawl.** Cause: uv (or pip) must
build the package to learn its dependencies — *"for packages that only provide source distributions, the
metadata may not be available upfront … In such cases, uv has to build the package to determine its
metadata (e.g., by invoking `setup.py`). This can introduce a performance penalty during resolution."*
Fix: declare the metadata up front so the build is skipped during resolution:

```toml
[[tool.uv.dependency-metadata]]
name = "flash-attn"
version = "2.6.3"
requires-dist = ["torch", "einops"]
```

uv's note on that table: the `version` field *"is optional for registry-based dependencies … but required
for direct URL dependencies (like Git dependencies)."*

## Interview questions

**★ Why should a published library never contain a direct URL dependency?**
Because the specification tells index servers to refuse it — *"Public index servers SHOULD NOT allow the
use of direct references in uploaded distributions. Direct references are intended as a tool for software
integrators rather than publishers."* Structurally, a URL is *concrete*: it names where the artifact comes
from, which is a decision belonging to whoever installs. A library that hard-codes a URL removes its
consumers' ability to use a mirror, a private index or an approved rebuild, and it cannot be resolved at
all in an air-gapped environment. Development overrides belong in a tool table such as `tool.uv.sources`,
which is not part of the published metadata.

**★ Where is whitespace significant in a specifier, and why there specifically?**
Only at the end of a URL requirement: *"Non line-breaking whitespace is mostly optional with no semantic
meaning. The sole exception is detecting the end of a URL requirement."* URLs can legally contain
semicolons, so without a mandatory space the parser cannot tell where the URL stops and the marker
begins. Everywhere else — around operators, around commas, inside the extras brackets — whitespace is
free.

**★ You depend on an unreleased fix in a library. Walk through the options in order of preference.**
First, ask whether you can avoid it: a workaround in your own code costs nothing downstream. Second, if
you are building an *application*, add a development source — an abstract `dependencies` entry plus
`[tool.uv.sources]` pointing at the fork or commit — and lock it, so the resolved commit SHA is recorded
and reviewable. Third, if you are building a *library*, do not encode it at all: publish a range that
excludes the broken releases and document the requirement, because a URL in your metadata makes you
unpublishable and un-mirrorable. Last resort, vendor the fix into your own package with a comment naming
the upstream issue. The one option that is never right is a URL in a published library's
`[project.dependencies]`.

**★ Why does the specification insist on a commit hash even when you reference a Git tag?**
Because a tag is a mutable pointer and a hash is not. The spec's note is blunt about the threat model:
*"creating a malicious repo with a particular tag is easy, creating one with a specific hash, less so."*
A tag can be moved, deleted and recreated on a different commit without any signal to a consumer, so a
tag-only reference is not reproducible and not verifiable. The prescribed notation is
`@<tag>#<commit-hash>` — the tag for humans, the hash for the tool.

**★ What does `uv build --no-sources` prove, and why run it in CI?**
It builds the distribution with `tool.uv.sources` disabled, which is *"the case when using other build
tools, like `pypa/build`"* — i.e. it builds the way every consumer's tooling will. If your project only
works because a path or Git source resolved locally, that build fails, which is exactly the failure you
want *before* publishing rather than after. In CI it costs one step and it catches the whole class of
"works on my machine because of a sibling checkout" packaging bugs.

---

← [09 · The requirement string](09-the-requirement-string.md) · [Topic index](README.md) · Next → [11 · Environment markers](11-environment-markers.md)
