---
title: "authors, keywords, classifiers and urls are the four fields that change nothing about how your package installs and everything about whether anyone finds it — and every one of them has a validation rule that only fires at upload time"
sidebar_label: "09 · authors, classifiers, urls"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), *Core metadata specifications* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)), PEP 639 ([peps.python.org](https://peps.python.org/pep-0639/)), and *Writing your pyproject.toml* ([packaging.python.org](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**None of these four fields affects resolution, and that is exactly why they are shipped broken so often: a comma in an author's name, a classifier with a typo, a `urls` key that PyPI does not recognise as a repository link — none of it fails a local `pip install .`, and all of it fails or degrades at the moment you publish. They are also the fields with the least documentation per unit of confusion, because the spec's descriptions are one line each while the validation rules live in RFC 822, in PyPI's classifier list, and in an icon-matching heuristic nobody wrote down for you.**

## `authors` and `maintainers` — a list of tables, with an RFC 822 rule

The spec's description is compact and every clause matters:

> *"Both keys are optional, but at least one of the keys must be specified in the table."*

> *"The `name` value MUST be a valid email name (i.e. whatever can be put as a name, before an email, in RFC 822) and not contain commas."*

> *"The `email` value MUST be a valid email address."*

Note which "table" the first sentence is about: each *entry* is a table with `name`, `email`, or both — an entry with neither is invalid.

```toml
[project]
authors = [
    { name = "Priya Raman", email = "priya@example.com" },
    { name = "Tomas Novak" },                              # name only — valid
    { email = "ops@example.com" },                         # email only — valid
]
maintainers = [
    { name = "Invoice Platform Team", email = "invoice-dev@example.com" },
]
```

### The comma rule, and why it exists

`name` MUST NOT contain a comma. This is not stylistic: the metadata field is an RFC 822 address list, where the comma is the separator between addresses. `{ name = "Raman, Priya" }` produces something a parser reads as two addresses, one of them malformed.

```toml
[project]
# 🔴 comma in name — forbidden by the spec, corrupts the address list
authors = [{ name = "Raman, Priya, PhD", email = "priya@example.com" }]

# ✅
authors = [{ name = "Priya Raman", email = "priya@example.com" }]
```

The same trap catches organisations: `{ name = "Acme, Inc." }` is invalid. Write `Acme Inc.`

### The `Author` / `Author-email` split is not one-to-one

A backend converts your list into core metadata, and the mapping depends on whether each entry has an email. Entries with an email become RFC 822 addresses in `Author-email` (`Priya Raman <priya@example.com>`); entries with only a name typically go into the plain `Author` field. So a mixed list is split across two metadata fields, and PyPI displays them differently. If you want everyone shown together, give everyone an email — or accept that name-only contributors appear separately.

⚠️ **Author versus maintainer is a convention, not a mechanism.** Nothing in the specification says a maintainer has any different rights or that PyPI treats the two differently in permissions. Upload rights come from PyPI's own project roles, not from this field. Use `authors` for who wrote it and `maintainers` for who answers issues now, and do not expect any tool to care.

## `keywords` — a flat list, and PyPI's own search does the rest

> *"The keywords for the project."*

That is the entire specification. It is a list of strings:

```toml
[project]
keywords = ["invoicing", "billing", "stripe", "accounting"]
```

Practical notes: one concept per string, not a comma-joined blob (`keywords = ["invoicing, billing"]` is one keyword containing a comma), lowercase, and do not repeat the project name or words already in `description` — those are already indexed. This field is the lowest-value metadata in the file, and it costs nothing, so fill it in and move on.

## `classifiers` — a controlled vocabulary that is checked at upload

> *"Trove classifiers which apply to the project."*

They are strings from a fixed list, and the fixed-ness is the whole point: PyPI's filters are built on exact matches, so a plausible-looking invention is worse than an omission because it silently matches nothing.

```toml
[project]
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "Operating System :: OS Independent",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
    "Programming Language :: Python :: 3.14",
    "Topic :: Office/Business :: Financial :: Accounting",
    "Typing :: Typed",
]
```

Three rules that are not obvious:

**1 · They do not constrain anything.** The packaging guide is explicit:

> *"Although the list of classifiers is often used to declare what Python versions a project supports, this information is only used for searching and browsing projects on PyPI, not for installing projects. To actually restrict what Python versions a project can be installed on, use the `requires-python` argument."*

See **[04 · version and requires-python](04-version-and-requires-python.md)** for the field that does constrain.

**2 · `License ::` classifiers are deprecated.**

> *"The use of `License ::` classifiers is deprecated and tools MAY issue a warning informing users about that."*

and PEP 639 replaces them with the expression covered in **[08 · license and PEP 639](08-license-and-the-pep-639-migration.md)**.

The controlled vocabulary is not the packaging spec's own — core metadata delegates it:

> *"Classifiers are described in PEP 301, and the Python Package Index publishes a dynamic list of currently defined classifiers."*

with each entry described as *"a string giving a single classification value for the distribution."* So the list is PyPI's, published dynamically, and the `trove-classifiers` package on PyPI is its packaged form.

**3 · `Private :: Do Not Upload` is the one classifier with teeth.** It works because the index validates against that list and a classifier that will never be added to it can never pass — so an upload attempt fails at the index. ⚠️ The core metadata spec establishes the controlled vocabulary but does **not** itself state that an unknown classifier is rejected; that is index behaviour I did not verify against a primary source here. Treat the guard as strong and widely relied upon rather than as spec-guaranteed, and back it up with a publish step that names your own index explicitly instead of falling through to the default — the flag for that is tool-specific and belongs to **12 · Publishing to PyPI** *(not written yet)*.

```toml
[project]
classifiers = ["Private :: Do Not Upload"]
```

## `urls` — an arbitrary label-to-URL table

> *"A table of URLs where the key is the URL label and the value is the URL itself."*

The labels are yours to choose, which is both the freedom and the trap: PyPI renders recognised labels with icons and groups them, and an unrecognised label becomes a plain link.

```toml
[project.urls]
Homepage = "https://example.com/invoice-service"
Documentation = "https://invoice-service.readthedocs.io"
Repository = "https://github.com/example/invoice-service"
Issues = "https://github.com/example/invoice-service/issues"
Changelog = "https://github.com/example/invoice-service/blob/main/CHANGELOG.md"
Funding = "https://github.com/sponsors/example"
```

⚠️ The exact set of labels PyPI special-cases, and its matching rules, are a property of PyPI's implementation rather than of the packaging specification — I did not verify them against a primary source here. `Homepage`, `Documentation`, `Repository`, `Issues`, `Changelog` and `Funding` are the conventional set in wide use; treat icon rendering as a nicety you cannot rely on and the URLs themselves as the value.

`Homepage` deserves one specific note: if your project has no website, point it at the repository rather than omitting it, because a package page with no links at all reads as abandoned regardless of how recently you released.

## What these four fields are worth

| Field | Affects install? | Where a human meets it | Failure mode |
|---|---|---|---|
| `authors` / `maintainers` | no | PyPI sidebar, `pip show` | a comma breaks the RFC 822 address list |
| `keywords` | no | PyPI search | a comma-joined string becomes one useless keyword |
| `classifiers` | no | PyPI filters and badges | an invalid string is rejected at upload |
| `urls` | no | PyPI sidebar links | a wrong label loses an icon; a wrong URL loses a user |

Every failure mode in that column happens at publish time or later — which is why they are worth a five-minute review before a first release rather than after a bug report.

## Gotchas

**★ Symptom: PyPI rejects the upload with an invalid-classifier error.** Cause: a classifier not in Trove's list — a typo (`Programming Language :: Python :: 3.14.0`), a version PyPI has not added yet, or an invention (`Framework :: FastAPI` when the real string differs). Fix: copy the strings from PyPI's classifier list rather than typing them, and validate before uploading:

```python
from trove_classifiers import classifiers   # pip install trove-classifiers

declared = ["Development Status :: 4 - Beta", "Programming Language :: Python :: 3.14"]
print([c for c in declared if c not in classifiers])   # anything printed will be rejected
```

**★ Symptom: your author list on PyPI shows a mangled or extra entry.** Cause: a comma in a `name` value, which the spec forbids because the metadata field is an RFC 822 address list and the comma is its separator. Fix: remove the comma; reorder the name or drop the suffix.

```toml
[project]
authors = [{ name = "Priya Raman", email = "priya@example.com" }]
```

**★ Symptom: an author appears in a different place on the PyPI page from the others.** Cause: entries with an email go into `Author-email` as RFC 822 addresses while name-only entries go into the plain `Author` field, so a mixed list is split across two metadata fields. Fix: give every entry an email, or accept the split deliberately.

**★ Symptom: `authors = ["Priya Raman"]` fails to build.** Cause: the value is a list of *tables*, not a list of strings. Fix: wrap each entry in a table with `name` and/or `email`.

```toml
[project]
authors = [{ name = "Priya Raman" }]
```

**★ Symptom: an internal package gets published to public PyPI by an over-eager CI job.** Cause: nothing in `pyproject.toml` said not to. Fix: the classifier PyPI will always reject, which turns the upload into a hard failure instead of a leak.

```toml
[project]
classifiers = ["Private :: Do Not Upload"]
```

**★ Symptom: your `Programming Language :: Python :: 3.13` classifier is accurate and users on 3.9 still install a broken package.** Cause: classifiers are *"only used for searching and browsing projects on PyPI, not for installing projects."* Fix: `requires-python`, in the same commit.

```toml
[project]
requires-python = ">=3.13"
```

**★ Symptom: your PyPI page shows one keyword and it looks absurd.** Cause: `keywords = ["invoicing, billing, stripe"]` is a single-element list whose one element contains commas — a leftover habit from `setup.py`, where `keywords` accepted a comma-separated string. Fix: one string per keyword.

```toml
[project]
keywords = ["invoicing", "billing", "stripe"]
```

**★ Symptom: the licence classifier you kept "for compatibility" now fails the build.** Cause: combining a licence classifier with a PEP 639 `license` expression is a MAY-level error, so some backends refuse it. Fix: delete the classifier; the expression carries strictly more information.

**★ Symptom: `[project.urls]` is ignored.** Cause: it is written as `[urls]` or `[project.url]`. It is a subtable of `[project]`, singular-to-plural exact. Fix:

```toml
[project.urls]
Repository = "https://github.com/example/invoice-service"
```

**★ Symptom: your repository link on PyPI renders as a bare link with no icon while other projects get one.** Cause: PyPI matches on the label text, and `Source Code`, `GitHub` and `Repository` are not the same string. This is PyPI implementation behaviour, not a specification rule, so it can change. Fix: use the conventional labels and do not treat the icon as important enough to guess at.

**★ Symptom: `Development Status :: 5 - Production/Stable` on a `0.x` version, and users complain about breakage.** Cause: nothing validates the claim — the classifier is free-form within the vocabulary and has no relationship to your version number. Fix: keep it honest, because it is the only signal a browsing user has before they read your changelog. `4 - Beta` for `0.x`, `5 - Production/Stable` once you intend to keep the API.

## Interview questions

**★ Why is a comma forbidden in an author's name when it is allowed in almost every other string in the file?**
Because this particular string is destined for an RFC 822 address list, where the comma separates addresses. `Raman, Priya <priya@example.com>` parses as two entries — a bare `Raman` with no address, and a malformed `Priya <priya@example.com>` — so a comma does not just look wrong, it changes how many authors the metadata claims. The spec states the constraint directly: the name *"MUST be a valid email name (i.e. whatever can be put as a name, before an email, in RFC 822) and not contain commas."* Nothing catches it locally, because a local install never parses the address list.

**★ Do classifiers do anything at all?**
Nothing to installation, and quite a lot to discovery. The packaging guide is explicit that classifier information *"is only used for searching and browsing projects on PyPI, not for installing projects"* — so `Programming Language :: Python :: 3.13` neither restricts nor enables anything, and the field that does is `requires-python`. What classifiers buy you is being findable through PyPI's filters and, in the `Development Status` and `Typing` cases, communicating a claim about maturity and type coverage that a browsing user reads before your README. The exception with real mechanical force is `Private :: Do Not Upload`, which works because the index validates against the classifier list it publishes — though note that the rejection itself is index behaviour rather than something the core metadata specification states.

**★ How would you stop an internal package being published by accident?**
Add `Private :: Do Not Upload` to `classifiers`. The core metadata spec makes classifiers a controlled vocabulary — *"the Python Package Index publishes a dynamic list of currently defined classifiers"* — and the index validates against it, so a string that will never appear on that list means an upload attempt fails at the index rather than succeeding quietly. It is better than relying on CI configuration because it travels with the package: a colleague running the publish command by hand, from their own machine, hits the same wall. Belt and braces is to also point the publish step at your private index explicitly, but the classifier is the part that cannot be forgotten.

**★ What is the actual difference between `authors` and `maintainers`?**
Convention only. The specification describes both with the same structural rules and says nothing about differing semantics, and no packaging tool grants rights based on either — upload permissions come from the index's own project roles. The useful convention is that `authors` records who created the work, which does not change, and `maintainers` records who currently answers for it, which does. A project whose original author has moved on should update `maintainers` and leave `authors` alone, and nothing but that convention makes the distinction meaningful.

**★ Why do your author entries sometimes land in `Author` and sometimes in `Author-email`?**
Because the two core metadata fields carry different shapes. An entry with an email can be rendered as an RFC 822 address — `Priya Raman <priya@example.com>` — and belongs in `Author-email`; an entry with only a name has no address to put there and goes into the plain `Author` field. A mixed list therefore splits across both, and PyPI presents them in different places. The practical rule is to be consistent: either everyone has an email or nobody does, so the presentation is predictable.

**★ Which `[project.urls]` labels should you use?**
The conventional set — `Homepage`, `Documentation`, `Repository`, `Issues`, `Changelog`, `Funding` — because PyPI recognises common labels and renders them with icons and grouping. But the specification says only that it is *"a table of URLs where the key is the URL label and the value is the URL itself"*: the labels are arbitrary and the icon behaviour is PyPI's implementation, not a standard. So use the conventional names for the presentation benefit, and never make anything depend on it. The URL that matters most is the one to the issue tracker, since it is the only field that tells a user how to reach you.

**★ Is it worth filling in `keywords` at all?**
Marginally, and it costs one line. PyPI's search already indexes your name, summary and description, so keywords mostly add synonyms and adjacent terms a user might search that do not appear in your prose — the payment processor you integrate with, the domain word you avoided in the summary. What is worth knowing is the failure mode: in `setup.py`, `keywords` accepted a comma-separated string, so the habit produces `["a, b, c"]` in TOML, which is one keyword with commas in it and matches nothing.

---

← Prev: [08 · license and PEP 639](08-license-and-the-pep-639-migration.md) · [Topic index](README.md) · Next → [10 · Entry points and console scripts](10-entry-points-and-console-scripts.md)
