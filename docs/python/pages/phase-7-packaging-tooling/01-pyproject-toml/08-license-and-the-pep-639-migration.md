---
title: "PEP 639 replaced three overlapping ways of stating a licence with one SPDX expression string, deprecated the classifier that everyone still writes, and drew a hard version line at setuptools 77 that turns the new form into a build failure on older backends"
sidebar_label: "08 · license and PEP 639"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against PEP 639 — *Improving License Clarity with Better Package Metadata* ([peps.python.org](https://peps.python.org/pep-0639/)), the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), *Core metadata specifications* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)), and the PyPA packaging tutorial ([packaging.python.org](https://packaging.python.org/en/latest/tutorials/packaging-projects/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**Before PEP 639 a project could state its licence in three places that were allowed to disagree: a free-text `License` field, a `license = { text = ... }` or `{ file = ... }` table, and a `License :: OSI Approved :: MIT License` trove classifier. Nothing reconciled them, and machine licence auditing was therefore guesswork. PEP 639 makes the licence one string containing an SPDX expression, adds `license-files` for the actual legal text, and deprecates both the old table subkeys and the classifiers. The migration is genuinely easy — three lines become two — and it has one sharp edge: the new string form requires a recent backend, so writing `license = "MIT"` against an old setuptools produces a build error rather than a warning.**

## The new form, in full

```toml
[project]
name = "invoice-service"
version = "0.4.2"
license = "MIT"
license-files = ["LICENSE"]
classifiers = [
    "Programming Language :: Python :: 3.14",
    # 🔴 no "License :: OSI Approved :: MIT License" — deprecated
]
```

Two keys. The expression says *what* the licence is, in a form a machine can evaluate; `license-files` says *where the text is*, so the legal document travels inside the distribution.

## `license` is now an SPDX expression string

In `[project]`:

> *"Text string that is a valid SPDX license expression."*

and, importantly, a scope condition:

> *"This key should **only** be specified if the license expression for any and all distribution files created by a build backend using the `pyproject.toml` is the same as the one specified."*

That sentence is doing real work. If your wheel bundles a vendored dependency under a different licence, a single expression covering the whole artifact is a claim you may not be able to make — and the honest answer is a compound expression, not silence.

PEP 639 defines the metadata side:

> *"The `License-Expression` optional [Core Metadata field] is specified to contain a text string that is a valid SPDX [license expression]"*

> *"Build and publishing tools SHOULD check that the `License-Expression` field contains a valid SPDX expression"*

### The expression syntax you will actually use

| Expression | Means |
|---|---|
| `MIT` | a single SPDX identifier |
| `Apache-2.0` | note the exact identifier — not `Apache2`, not `Apache License 2.0` |
| `MIT OR Apache-2.0` | dual-licensed; the *user* chooses |
| `MIT AND BSD-3-Clause` | both apply simultaneously — different parts, different terms |
| `GPL-2.0-or-later` | the modern identifier; `GPL-2.0+` is deprecated in SPDX |
| `Apache-2.0 WITH LLVM-exception` | a licence plus a named exception |
| `LicenseRef-Proprietary` | the escape hatch for a licence not in the SPDX list |

`OR` and `AND` are not interchangeable and the difference is legal, not stylistic: `OR` means the recipient may pick either, `AND` means both sets of obligations bind at once. Getting it backwards misstates your licence to every automated audit downstream.

Case is normalised but only *should* be:

> *"Tools also SHOULD store a case-normalized version of the `License-Expression` field using the reference case for each SPDX license identifier and uppercase for the `AND`, `OR` and `WITH` keywords."*

So `mit or apache-2.0` is likely to be accepted and normalised; write it in reference case anyway, because a SHOULD is not a guarantee.

## `license-files` ships the legal text

> *"The strings MUST contain valid glob patterns, as specified in glob patterns."*

> *"Build tools: MUST include all files matched by a listed pattern in all distribution archives."*

> *"Tools MUST assume that license file content is valid UTF-8 encoded text, and SHOULD validate this and raise an error if it is not."*

```toml
[project]
license = "Apache-2.0 AND MIT"
license-files = ["LICENSE", "NOTICE", "licenses/*.txt"]
```

Each matched file becomes a `License-File` core metadata entry:

> *"Each entry is a string representation of the path of a license-related file."*

And there is an explicit way to say "none":

> *"If the `license-files` key is present and is set to a value of an empty array, then tools MUST NOT include any license files and MUST NOT raise an error."*

⚠️ **What happens when the key is absent is not settled by the sources I checked.** PEP 639 as fetched does not mandate a default, so a backend may glob for common names like `LICENSE*` or may include nothing. Do not rely on the implicit behaviour — state `license-files` explicitly if you care whether the text ships, which for any licence with an attribution requirement you do.

## What is deprecated, and how loudly

**The free-text `License` field:**

> *"The legacy unstructured-text `License` [Core Metadata field] is deprecated and replaced by the new `License-Expression` field."*

**The classifiers:**

> *"Using [license classifier]s in the `Classifier` [Core Metadata field] is deprecated and replaced by the more precise `License-Expression` field."*

The `pyproject.toml` spec restates it from the tooling side:

> *"The use of `License ::` classifiers is deprecated and tools MAY issue a warning informing users about that."*

**The table subkeys:**

> *"Table values for the `license` key in the `[project]` table, including the `text` and `file` table subkeys, are now deprecated."*

and they were always mutually exclusive with each other:

> *"These keys are mutually exclusive, so a tool MUST raise an error if the metadata specifies both keys."*

Combining a classifier with an expression is a MAY-level error:

> *"If the `License-Expression` field is present, build tools MAY raise an error if one or more license classifiers is included in a `Classifier` field"*

"MAY" means: some backends will build it, some will refuse, and you cannot predict which from the specification. Remove the classifier rather than betting on your backend's leniency.

## Before and after

⚠ **Deprecated** — the shape that is still in most repositories:

```toml
[project]
name = "invoice-service"
version = "0.4.2"
license = { file = "LICENSE" }
classifiers = [
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3.14",
]
```

✅ The PEP 639 form:

```toml
[project]
name = "invoice-service"
version = "0.4.2"
license = "MIT"
license-files = ["LICENSE"]
classifiers = [
    "Programming Language :: Python :: 3.14",
]
```

Three declarations that could disagree become one that cannot, plus an explicit statement of which files carry the text.

## The version line: setuptools 77

The PyPA tutorial's setuptools block pins the floor:

```toml
[build-system]
requires = ["setuptools >= 77.0.3"]
build-backend = "setuptools.build_meta"
```

That pin is what makes `license = "MIT"` safe under setuptools. An older setuptools reads the string form as a violation of the *table* schema it knows about, and the result is a build error, not a warning — which is a good failure, because the alternative is a wheel whose licence metadata was silently dropped. The other documented backend floors from the same tutorial:

```toml
[build-system]
requires = ["hatchling >= 1.26"]
build-backend = "hatchling.build"
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

If you adopt PEP 639's `license` string, raise the backend floor in the same commit. A `requires` array that permits an old backend and a `[project]` table that needs a new one is a build that works on your machine and fails in a clean environment.

## Gotchas

**★ Symptom: a schema-validation failure on `project.license`, on a file that was fine yesterday.** Cause: you moved to `license = "MIT"` while `requires` still allows a pre-PEP-639 backend, so the backend validates the string against the *table* schema it knows and rejects it. The message text varies by backend and version and I did not verify any of them, so none is quoted here. Fix: raise the floor in the same change.

```toml
[build-system]
requires = ["setuptools >= 77.0.3"]
build-backend = "setuptools.build_meta"
```

**★ Symptom: your build fails only when a licence classifier is present alongside `license = "MIT"`.** Cause: this is the MAY-level error — *"build tools MAY raise an error if one or more license classifiers is included in a `Classifier` field"* — so it is backend-dependent by design. Fix: delete the classifier; the expression is strictly more precise.

```toml
[project]
license = "MIT"
classifiers = ["Programming Language :: Python :: 3.14"]
```

**★ Symptom: an SPDX validation step rejects `Apache2`, `BSD`, or `MIT License`.** Cause: those are not SPDX identifiers. The list is exact and case-normalised: `Apache-2.0`, `BSD-3-Clause` (or `BSD-2-Clause` — "BSD" alone is ambiguous), `MIT`. Fix: use the identifier, and check it against the SPDX list rather than guessing from the licence's title.

```toml
[project]
license = "BSD-3-Clause"
```

**★ Symptom: `LICENSE` is in your repository and missing from the installed distribution.** Cause: with `license-files` absent, whether a backend globs for common names is not specified — my sources do not mandate a default. Fix: say it explicitly; the spec then makes inclusion a MUST.

```toml
[project]
license-files = ["LICENSE"]
```

**★ Symptom: a build error about non-UTF-8 licence content.** Cause: a `LICENSE` file saved in a legacy encoding, hitting the rule that tools *"MUST assume that license file content is valid UTF-8 encoded text, and SHOULD validate this."* Fix: re-save the file as UTF-8. The typical culprit is a copyright line containing a non-ASCII name or a `©` written in cp1252.

**★ Symptom: your dual-licensed project shows as more restrictive than intended in a compliance report.** Cause: `AND` instead of `OR`. `MIT AND Apache-2.0` says both sets of obligations apply; `MIT OR Apache-2.0` says the recipient may choose. Fix: the operator is a legal statement, so match it to your LICENSE files.

```toml
[project]
license = "MIT OR Apache-2.0"
license-files = ["LICENSE-MIT", "LICENSE-APACHE"]
```

**★ Symptom: `license = { text = "MIT", file = "LICENSE" }` is a hard error.** Cause: the two subkeys are mutually exclusive at MUST level — *"a tool MUST raise an error if the metadata specifies both keys."* Fix: neither; both subkeys are deprecated. Use the expression plus `license-files`.

**★ Symptom: your wheel vendors a third-party library and the single `license = "MIT"` is now a false claim.** Cause: the spec's scope condition — the key *"should only be specified if the license expression for any and all distribution files created by a build backend using the `pyproject.toml` is the same as the one specified."* Fix: state the compound expression and ship every text.

```toml
[project]
license = "MIT AND BSD-3-Clause"
license-files = ["LICENSE", "vendor/fastcsv/LICENSE"]
```

**★ Symptom: a proprietary package fails SPDX validation with no valid identifier to use.** Cause: your licence is not in the SPDX list, and there is no "Proprietary" identifier. Fix: use the `LicenseRef-` prefix, which SPDX reserves for exactly this, and ship the text.

```toml
[project]
license = "LicenseRef-Proprietary"
license-files = ["LICENSE"]
```

**★ Symptom: a `license-files` glob matches nothing and the build passes anyway.** Cause: the MUST applies to including *files matched by a listed pattern* — a pattern matching zero files has nothing to include, and the spec's only explicit no-error case is the empty array. So a typo in the pattern can be silent. Fix: keep patterns simple and verify the built artifact contains the file before publishing, rather than trusting the glob.

## Interview questions

**★ Why was a licence *classifier* not good enough?**
Because a classifier is a label from a fixed list, not an expression, so it cannot say "either of these two", cannot say "this plus an exception", and cannot say "these two licences apply to different parts of the artifact". It also had no relationship to the other two places a licence could be stated, so a project could carry `License :: OSI Approved :: MIT License`, a `License` field reading "Apache 2", and a LICENSE file containing something else again, with nothing detecting the contradiction. PEP 639 deprecates classifiers precisely because `License-Expression` is *"more precise"*, and precision here means machine-checkable.

**★ What is the difference between `license` and `license-files`, and can you have one without the other?**
`license` is the expression — a machine-evaluable statement of the terms. `license-files` is a list of glob patterns naming the actual legal documents that must be included in every distribution archive. They answer different questions and are independent keys: you can state an expression without shipping any text (legal for permissive licences that do not require it, and explicitly supported by setting `license-files = []`), and you can ship files without an expression. In practice a licence with an attribution requirement — Apache-2.0, BSD, MIT — needs both, because the notice has to travel with the code.

**★ You add `license = "MIT"` to an existing project and the build breaks. What happened and what is the fix?**
The string form of `license` is PEP 639, and a backend older than the release that implemented it validates `license` against the *table* schema, so a bare string fails validation. It is a build error rather than a warning, which is the right behaviour — the alternative would be silently dropping the licence from the metadata. The fix is to raise the backend floor in the same commit; the PyPA tutorial's own setuptools block pins `setuptools >= 77.0.3` for this reason. Adopting a metadata feature without raising `requires` is the general form of this mistake, and it always presents as "works here, fails in CI".

**★ `MIT OR Apache-2.0` versus `MIT AND Apache-2.0` — does it matter?**
Yes, and it is the one thing on this page that is not a tooling question. `OR` means the recipient may comply with either licence and pick whichever suits them, which is the standard Rust-ecosystem-style dual licence. `AND` means both sets of obligations apply simultaneously, which is what you write when different files in the same artifact carry different terms — typically because you vendored something. A compliance scanner takes the expression at face value, so `AND` where you meant `OR` presents your permissive project as carrying two sets of obligations, and `OR` where you meant `AND` understates a real obligation you inherited.

**★ How do you express a licence that is not on the SPDX list?**
With the `LicenseRef-` prefix — `LicenseRef-Proprietary`, `LicenseRef-Acme-Internal-1.0`. SPDX reserves that prefix for licences outside its own list, so the expression stays syntactically valid and a tool checking that *"the `License-Expression` field contains a valid SPDX expression"* passes, while making it unmistakable that the terms are not a standard one. Ship the actual text via `license-files`, since a `LicenseRef` carries no meaning to a reader on its own.

**★ Does the licence text automatically end up in the wheel?**
Only if a pattern in `license-files` matches it. When the key is present, inclusion is a MUST — *"MUST include all files matched by a listed pattern in all distribution archives"* — and when it is set to an empty array, tools *"MUST NOT include any license files and MUST NOT raise an error."* What happens when the key is *absent* is not settled by PEP 639 as I read it, so backends differ: some glob for common names, some include nothing. Since a missing NOTICE file under Apache-2.0 is a compliance failure rather than a cosmetic one, the key is worth writing explicitly every time.

**★ Why does the spec say `license` should only be used if the expression covers *all* files the backend produces?**
Because the field is a single claim about a whole artifact, and a wheel is not always made only of your code. If the build vendors a dependency, embeds a generated parser, or bundles a font, the artifact carries terms your own licence does not describe — and a downstream audit reading one expression will conclude, wrongly, that one licence governs everything. The spec's wording pushes you either to a compound expression that is true of the whole archive or to not making the claim at all.

---

← Prev: [07 · Extras and dependency groups](07-extras-and-dependency-groups.md) · [Topic index](README.md) · Next → [09 · authors, classifiers and urls](09-authors-classifiers-and-urls.md)
