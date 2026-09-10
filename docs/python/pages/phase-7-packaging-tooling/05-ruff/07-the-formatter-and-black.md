---
title: "`ruff format` is built to be a drop-in replacement for Black, not a clone of it — over 99.9% of lines come out identical on Black-formatted code, the rest is a short list of deliberate deviations and ruff's own yearly style guide, so migrating is one reviewed reformat commit, and running both formatters side by side is a formatting war"
sidebar_label: "07 · The formatter and Black"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Formatter* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/)),
> *Known deviations from Black* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/black/)), the *FAQ* ([docs.astral.sh](https://docs.astral.sh/ruff/faq/)),
> *Versioning* ([docs.astral.sh](https://docs.astral.sh/ruff/versioning/)), and the 0.9.0, 0.15.0 and 0.16.0 entries of the
> [CHANGELOG](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md); formatter pages read as raw Markdown at the `0.16.6` tag.
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Black settled the Python formatting argument by refusing to have it: one style, almost no
options, and a promise that formatted code stays formatted. `ruff format` keeps that deal and
changes the engine — it is written in Rust inside the same binary as the linter, and its stated
goal is to produce Black's output, not a better one. On code Black already formatted, over 99.9%
of lines come out unchanged. The remaining fraction is where the traps are: a short list of
deliberate deviations, ruff's own style guide that moves in minor releases, a few things ruff
formats that Black never touched (f-string expressions, Markdown code blocks), and the fact
that "compatible" does not mean "interchangeable" — two formatters that disagree on 0.1% of
lines will rewrite each other's output forever.**

## The promise, in the project's words

> *"The Ruff formatter is an extremely fast Python code formatter designed as a drop-in replacement for Black, available as part of the `ruff` CLI via `ruff format`."*

> *"The initial goal of the Ruff formatter is not to innovate on code style, but rather, to innovate on performance, and provide a unified toolchain across Ruff's linter, formatter, and any and all future tools."*

> *"Specifically, the formatter is intended to emit near-identical output when run over existing Black-formatted code. When run over extensive Black-formatted projects like Django and Zulip, > 99.9% of lines are formatted identically."*
> — [The Ruff Formatter](https://docs.astral.sh/ruff/formatter/)

Read the last sentence carefully: *existing Black-formatted code*. The measurement is about
code that has already passed through Black. On code that has not, the FAQ lowers the bar:

> *"When migrating an existing project from Black to Ruff, you should expect to see a few differences on the margins, but the vast majority of your code should be unchanged."*

> *"When run over non-Black-formatted code, the formatter makes some different decisions than Black, and so more deviations should be expected, especially around the treatment of end-of-line comments."*
> — [FAQ](https://docs.astral.sh/ruff/faq/)

And the page is explicit that compatibility is a migration property, not a licence to mix:

> *"While the formatter is designed to be a drop-in replacement for Black, it is not intended to be used interchangeably with Black on an ongoing basis, as the formatter does differ from Black in a few conscious ways"*

## Where the 0.1% comes from

Three independent sources of difference, and each has a different remedy.

| Source | What it looks like | Where it is covered |
|---|---|---|
| **Deliberate deviations** | ruff formats a construct differently on purpose — trailing end-of-line comments, pragma comments ignored for line width, `assert` messages, tuples | [07c](07c-known-deviations-from-black.md), [07d](07d-layout-deviations-from-black.md) |
| **Style-guide drift** | ruff's stable style is revised in a minor release (the 2025 style in 0.9.0, the 2026 style in 0.15.0); Black revises its own yearly | this page, and upgrading (**14** *(not written yet)*) |
| **Scope ruff added** | f-string expressions, Python blocks in Markdown, code in docstrings (opt-in) — places Black leaves alone | this page, formatter settings (**07e** *(not written yet)*) |

### The style guide moves in minor releases

ruff's versioning policy puts formatter style changes on the minor number:

> *"The stable style changed"* — listed under changes that bump the **minor** version.

> *"The stable style changed to prevent invalid syntax, changes to the program's semantics, or removal of comments"* — the only style change allowed in a **patch**.

> *"Similar to Black, Ruff implements formatting changes under the `preview` flag, promoting them to stable through minor releases, in accordance with our versioning policy."*
> — [Versioning](https://docs.astral.sh/ruff/versioning/), [The Ruff Formatter](https://docs.astral.sh/ruff/formatter/)

Two such promotions define the style `ruff format` 0.16.6 prints:

- **0.9.0 — the 2025 style guide.** Among its changes, verbatim from the changelog:
  *"Format expressions in f-string elements"*, *"Automatically join an implicitly concatenated
  string into a single string literal if it fits on a single line"*, *"Remove the `ISC001`
  incompatibility warning"*, *"Prefer parenthesizing the `assert` message over breaking the
  assertion expression"*.
- **0.15.0 — the 2026 style guide.** *"Ruff now formats your code according to the 2026 style
  guide."* The changelog's bullets include lambda parameters kept on one line with the body
  parenthesised, *"Parentheses around tuples of exceptions in `except` clauses will now be
  removed on Python 3.14 and later"*, *"A single empty line is now permitted at the beginning
  of function bodies"*, and changes to `match` `as` captures, escaped-quote spacing and blank
  lines before decorated classes in stub files.

I could not confirm a complete list of every construct the 2026 style changed beyond those
changelog bullets; treat the bullets as representative, not exhaustive.

The practical consequence: **a ruff minor upgrade may reformat code nobody touched.** That is a
feature of the versioning policy, and it is why the formatter's version belongs in the lockfile
and the pre-commit `rev`, not floating (**11b** *(not written yet)*).

### The except-tuple change depends on your target

The 2026 rule about `except` parentheses is gated on Python 3.14 — the version where
parenthesis-free exception tuples became valid syntax. The formatter reads the target Python
version the same way the linter does, so the same source formats differently depending on
`target-version`:

```python
def load_invoice(path: str) -> bytes:
    try:
        with open(path, "rb") as handle:
            return handle.read()
    except (FileNotFoundError, PermissionError):
        return b""
```

Per the changelog bullet, targeting 3.14 or later, the 2026 style removes those parentheses;
targeting 3.13 or earlier it must keep them, because the unparenthesised form is a syntax error
there. (PEP 758 allows the bare form only without an `as` clause, so `except (A, B) as exc:`
keeps its parentheses on every target.) A project whose `target-version` is wrong in either direction gets either a missed style
change or — far worse, if forced — code that does not parse on the interpreter it deploys to.
Where the target version comes from is **09b** *(not written yet)*.

## What `ruff format` touches that Black does not

**f-string expressions.** *"Unlike Black, Ruff formats the expression parts of f-strings which
are the parts inside the curly braces `{...}`."* (stable since 0.9.0). Line breaks are
conservative: *"it will only split the expression parts of an f-string across multiple lines if
there was already a line break within any of the expression parts."*

**Implicitly concatenated strings.** *"Ruff merges implicitly concatenated strings if the entire
string fits on a single line"* — so `"Invoice " "overdue"` on a short line becomes one literal.
That is why the formatter and `ISC001` no longer conflict (**08** *(not written yet)*).

**Python code in Markdown files — by default since 0.16.0.** *"Ruff can now format Python code
blocks in Markdown files and will do this by default."* A repository migrating from Black on
ruff 0.16 gets its `README.md` and `docs/*.md` code fences reformatted in the same run
([07b](07b-migrating-from-black.md) shows the opt-out).

**Code examples in docstrings — only if asked.** `docstring-code-format` defaults to `false`;
the configuration page says *"it is planned for this to be opt-out in the future"* — another
candidate for a future minor-version reformat.

**Notebooks.** `.ipynb` files are *"linted and formatted by default on version `0.6.0` and
higher."*

## Configuration: a little more than Black, deliberately no more

> *"Like Black, the Ruff formatter does not support extensive code style configuration; however, unlike Black, it does support configuring the desired quote style, indent style, line endings, and more."*

> *"Given the focus on Black compatibility (and unlike formatters like YAPF), Ruff does not currently expose any other configuration options."*

The whole surface — `line-length`, `indent-width`, and the `[tool.ruff.format]` table — is
**07e** *(not written yet)*. One property matters before you migrate: `line-length` is a
*target*, not a limit. The settings reference: *"While the formatter will attempt to format lines
such that they remain within the `line-length`, it isn't a hard upper bound, and formatted lines
may exceed the `line-length`."* Black has the same property; it is why `E501` and the formatter
need care together (**08** *(not written yet)*).

### Preview style

`[tool.ruff.format] preview = true` opts in to the unstable style — *"Whether to enable the
unstable preview style formatting."* The formatter page also states: *"Going forward, the Ruff
Formatter will support Black's preview style under Ruff's own preview mode."* It is ruff's
preview, on ruff's schedule; the fluent method-chain layout is the current example
([07d](07d-layout-deviations-from-black.md)). Moving a codebase off Black step by step is
[07b](07b-migrating-from-black.md).

## Gotchas

**★ Symptom: a patch-level-looking dependency bump (`ruff 0.14.x` → `0.15.0`) reformatted
hundreds of files nobody edited.** Cause: `0.15.0` is a *minor* release, and it shipped the 2026
style guide — formatter style changes are exactly what ruff's minor number is for. Fix: pin
ruff exactly, and upgrade it in a commit of its own that contains only the reformat.

```bash
uv add --dev "ruff==0.16.6"
uv run ruff format . && git commit -am "ruff 0.16.6: reformat"
```

**Symptom: the formatted code is fine on one machine and `ruff format --check` fails in CI on
the `except (A, B):` lines.** Cause: the two runs resolved different target versions — the
2026 style drops those parentheses only when targeting 3.14 or later — typically because one
invocation used a different configuration or working directory. Fix: set the target explicitly
in the committed configuration.

```toml
[project]
requires-python = ">=3.14"
```

## Interview questions

**★ Is `ruff format` a drop-in replacement for Black?**
For migration, yes: it is designed to produce near-identical output on Black-formatted code, and
on large Black-formatted projects over 99.9% of lines are unchanged. It is not a clone — it
deviates deliberately in a documented set of cases, formats things Black leaves alone
(f-string expressions, Markdown code blocks), has a few extra options (quote style, indent style,
line endings), and follows its own style-guide revisions. So you switch from Black to ruff once;
you do not run them together.

**★ Why is running Black and `ruff format` on the same code a problem if they are 99.9%
compatible?**
Because formatting has to be a fixed point: running the formatter on its own output must change
nothing. With two formatters, the fixed point of one is not the fixed point of the other on the
lines where they differ, so each run undoes the previous one. The result is perpetual diffs,
failing `--check` gates and pre-commit loops. The docs say the formatter is *"not intended to be
used interchangeably with Black on an ongoing basis"*.

**Why can upgrading ruff change formatting, and how do you keep that under control?**
ruff's versioning policy puts stable-style changes on the minor version — 0.9.0 introduced the
2025 style, 0.15.0 the 2026 style — while patch releases may only change style to prevent
invalid syntax, semantic changes or lost comments. An unpinned ruff can therefore reformat
untouched code on a routine dependency update. Pin the exact version everywhere, and upgrade in
a dedicated commit that contains the reformat and nothing else.

**What does `ruff format` format that Black does not?**
The expressions inside f-string replacement fields (with line breaks only where the source
already had one), Python code blocks in Markdown files by default since 0.16.0, and, when
`docstring-code-format` is enabled, code examples inside docstrings. It also joins implicitly
concatenated strings that fit on one line, which is why it no longer conflicts with `ISC001`.

**Is `line-length` a maximum for the formatter?**
No. It is the width the formatter aims for; the settings reference says formatted lines *"may
exceed the `line-length`"* — a long string literal or a long name cannot be split. That is why a
linter rule that treats the same number as a hard limit (`E501`) can fire on freshly formatted
code, and why it needs a deliberate decision rather than being enabled by habit.

**Why might the formatter produce different output for the same file on Python 3.13 and 3.14
targets?**
Some style rules are gated on syntax the target supports. The 2026 style removes the
parentheses around an `except` tuple only for Python 3.14 and later, where the unparenthesised
form is valid; below that, removing them would produce a syntax error. The formatter therefore
depends on the resolved target version, exactly like version-dependent lint rules do.

---

← Prev: [06c · Unused suppressions and adoption](06c-unused-suppressions-and-adoption.md) · [Topic index](README.md) · Next → [07b · Migrating from Black](07b-migrating-from-black.md)
