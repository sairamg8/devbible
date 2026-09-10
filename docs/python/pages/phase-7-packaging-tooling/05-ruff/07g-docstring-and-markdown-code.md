---
title: "`ruff format` reaches past `.py` files into code examples — Python fences in Markdown are formatted by default since 0.16.0, docstring examples only when you opt in — and it decides what counts as Python by info string and by whether the text parses, so an unlabelled `ls -la` in a docstring is formatted as a subtraction"
sidebar_label: "07g · Docstring and Markdown code"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Formatter: Docstring formatting* and *Markdown code formatting*,
> read as raw Markdown at the `0.16.6` tag ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/#docstring-formatting),
> [source](https://github.com/astral-sh/ruff/blob/0.16.6/docs/formatter.md)); settings reference for
> [`format.docstring-code-format`](https://docs.astral.sh/ruff/settings/#format_docstring-code-format) and
> [`format.docstring-code-line-length`](https://docs.astral.sh/ruff/settings/#format_docstring-code-line-length);
> the 0.15.0 and 0.16.0 [CHANGELOG](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md) entries; the `ruff-format` hook manifest in
> [ruff-pre-commit at `v0.16.6`](https://github.com/astral-sh/ruff-pre-commit/blob/v0.16.6/.pre-commit-hooks.yaml).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Code examples rot faster than code, because nothing runs them. ruff's answer is to format
them with the same engine as the module around them: Python fences in Markdown files (stable and
on by default since 0.16.0) and, if you opt in, examples inside docstrings. That is a good trade
until it meets the edges — the formatter has to guess what counts as Python. It guesses by info
string, treats some unlabelled blocks as Python, and skips anything that does not parse. A shell
command that happens to be valid Python, or a page that shows badly formatted code on purpose, is
exactly where the guess goes wrong.**

## Code examples inside docstrings — opt-in

> *"The Ruff formatter provides an opt-in feature for automatically formatting Python code examples in docstrings."*

```toml
[tool.ruff.format]
docstring-code-format = true
```

The default is `false`, and the configuration page adds that *"it is planned for this to be
opt-out in the future"* — so a future minor release may turn it on for everyone, with the
reformat that implies. What ruff recognises, verbatim:

> *"The Python doctest format."*
> *"CommonMark fenced code blocks with the following info strings: `python`, `py`, `python3`, or `py3`. Fenced code blocks without an info string are assumed to be Python code examples and also formatted."*
> *"reStructuredText literal blocks. While literal blocks may contain things other than Python, this is meant to reflect a long-standing convention in the Python ecosystem where literal blocks often contain Python code."*
> *"reStructuredText `code-block` and `sourcecode` directives. As with Markdown, the language names recognized for Python are `python`, `py`, `python3`, or `py3`."*

And the safety net:

> *"If a code example is recognized and treated as Python, the Ruff formatter will automatically skip it if the code does not parse as valid Python or if the reformatted code would produce an invalid Python program."*

```python
def apply_discount(total_cents: int, percent: int) -> int:
    """Apply a whole-number percentage discount.

    >>> apply_discount(total_cents = 1000, percent = 10)
    900

    Run the reconciliation from a shell with::

        billing-reconcile --since 2026-09-01
    """
    return total_cents - total_cents * percent // 100
```

With the option on, the `>>>` line is Python and is formatted by the same rules as the module —
keyword arguments lose the spaces around `=`. The expected-output line `900` is not code. The
rST literal block after `::` is *assumed* to be Python; `billing-reconcile --since 2026-09-01`
does not parse, so it is skipped. The danger is the command that *does* parse.

### A shell line that parses as Python

`ls -la` is a valid Python expression: the name `ls`, minus the name `la`. Any single word
followed by one flag has the same shape — `df -h`, `ps -ef`, `sort -u` all parse as
subtractions. Multi-word commands such as `git log -p`, `make test` or `uv run pytest -x` do not
parse, and are skipped. A docstring that shows a parseable one in an unlabelled fence or an rST
literal block has it formatted as Python: `ls - la`. The fix is to label what is not Python:

```python
def rotate_logs() -> None:
    """Rotate the service logs.

    Inspect the directory first:

    .. code-block:: console

        $ ls -la /var/log/billing
    """
```

### Line length for docstring code

> *"The default is a special value, `dynamic`, which instructs the formatter to respect the line length limit setting for the surrounding Python code. The `dynamic` setting ensures that even when code examples are found inside indented docstrings, the line length limit configured for the surrounding Python code will not be exceeded."*

So a doctest inside a method's docstring, already indented eight spaces, is formatted to fit
`line-length` *including* that indentation. An integer sets a fixed limit instead; the docs
describe only `dynamic` as accounting for the docstring's indentation:

```toml
[tool.ruff.format]
docstring-code-format = true
docstring-code-line-length = 72
```

## Python code blocks in Markdown — on by default

> *"The Ruff formatter can also format Python code blocks in Markdown files. In these files, Ruff will format any CommonMark fenced code blocks with the following info strings: `python`, `py`, `python3`, `py3`, `pyi`, or `pycon`. The formatter will automatically skip a code block if the code does not parse as valid Python or if the reformatted code would produce an invalid Python program."*

> *"Code blocks marked as `pyi` are formatted like stub files, `pycon` blocks as REPL sessions, and the others use normal Python file formatting."*

Previewed in 0.15.0, stabilised and enabled by default in 0.16.0 (*"Ruff can now format Python
code blocks in Markdown files and will do this by default."*). The page also notes Quarto-style
executable blocks — the language name in curly braces, as in a fence opened with
`{python}` — are supported.

⚠️ Note the asymmetry with docstrings: in **Markdown**, only the listed info strings are
formatted; an unlabelled fence is left alone. In **docstrings**, an unlabelled fence is assumed
to be Python.

### Keeping a block as written

A documentation page that shows badly formatted code on purpose — "this is what not to do" —
needs a way out. Suppression comments inside a block work as usual ([07h](07h-format-suppression-comments.md)),
and whole blocks can be fenced off with HTML comments:

````markdown
<!-- fmt:off -->
```py
print( 'hello' )
```
<!-- fmt:on -->
````

> *"Any number of code blocks may be contained within a matching pair of `off` and `on` HTML comments, and any `off` comment *without* a matching `on` comment will implicitly cover the remaining portion of the document."*

> *"The Ruff formatter will also recognize HTML comments from blacken-docs, `<!-- blacken-docs:off -->` and `<!-- blacken-docs:on -->`, which are equivalent to `<!-- fmt:off -->` and `<!-- fmt:on -->` respectively."*

To stop formatting Markdown altogether: *"To disable formatting of Markdown files, add them to
extend-exclude in your project settings."*

```toml
[tool.ruff]
extend-exclude = ["*.md"]
```

### Markdown and pre-commit

The formatter page says: *"If you run Ruff via ruff-pre-commit, Markdown support needs to be
explicitly included by adding it to `types_or`"*. At `v0.16.6` the `ruff-format` hook's own
manifest already lists `types_or: [python, pyi, jupyter, markdown]`, and the ruff-pre-commit
README says *"By default, the format hook also formats Python code blocks in Markdown files."* The
sentence on the formatter page matters when you override `types_or` yourself — an override
replaces the manifest's list, so include `markdown` in it if you still want Markdown:

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.16.6
    hooks:
      - id: ruff-format
        types_or: [python, pyi, jupyter, markdown]
```

## Gotchas

**★ Symptom: after enabling `docstring-code-format`, a docstring's `ls -la` became `ls - la`.**
Cause: the command sat in an unlabelled fence or an rST literal block, both of which docstring
formatting assumes are Python — and `ls -la` parses as a subtraction. Fix: label non-Python
blocks.

````python
def rotate_logs() -> None:
    """Rotate the service logs.

    ```console
    $ ls -la /var/log/billing
    ```
    """
````

**★ Symptom: a documentation page demonstrating a style anti-pattern was "fixed" by `ruff format`
on the next commit.** Cause: since 0.16.0 Python fences in Markdown are formatted by default.
Fix: fence the demonstration off with the HTML suppression comments shown above, or exclude
that directory.

```toml
[tool.ruff]
extend-exclude = ["docs/style-antipatterns/*.md"]
```

**★ Symptom: after upgrading to ruff 0.16, `ruff format --check` fails in CI on files nobody
touched — all of them `.md`.** Cause: Markdown formatting became default behaviour in 0.16.0.
Fix: land a one-off commit formatting the Markdown (or exclude it), and treat the upgrade as a
reformat commit.

```bash
uv run ruff format . && git commit -am "ruff 0.16: format Python blocks in Markdown"
```

**Symptom: a Python block in `README.md` with an obvious formatting problem is left alone.**
Cause: either its fence has no info string (Markdown formatting only touches `python`, `py`,
`python3`, `py3`, `pyi` and `pycon`), or the block does not parse as Python and is skipped. Fix:
label it, and check that it is complete, valid code.

````markdown
```python
total = sum(line.amount for line in invoice.lines)
```
````

**Symptom: a `<!-- fmt:off -->` near the top of a Markdown file disabled formatting for every
block below it.** Cause: an `off` comment with no matching `on` *"will implicitly cover the
remaining portion of the document."* Fix: close the region.

````markdown
<!-- fmt:off -->
```py
print( 'hello' )
```
<!-- fmt:on -->
````

**Symptom: after customising the `ruff-format` hook's `types_or` to add `pyi`, Markdown files
are no longer formatted by pre-commit.** Cause: the override replaced the manifest's list,
which included `markdown`. Fix: list it explicitly.

```yaml
      - id: ruff-format
        types_or: [python, pyi, jupyter, markdown]
```

**Symptom: docstring examples are formatted to a width that pushes the docstring past
`line-length`.** Cause: `docstring-code-line-length` was set to a fixed integer; only `dynamic`
is documented as fitting examples inside the surrounding limit once the docstring's indentation is
counted. Fix: go back to `dynamic`, which fits examples inside the surrounding
limit.

```toml
[tool.ruff.format]
docstring-code-line-length = "dynamic"
```

## Interview questions

**★ How does `ruff format` decide whether a code example is Python?**
By location and label. In Markdown files it formats only fences whose info string is `python`,
`py`, `python3`, `py3`, `pyi` or `pycon`. In docstrings (with `docstring-code-format` on) it
formats doctests, fences with those Python info strings, fences with no info string at all,
reStructuredText literal blocks, and `code-block`/`sourcecode` directives naming Python. In every
case it skips a block that does not parse, or whose reformatted result would not be valid Python.

**★ Why is an unlabelled shell command in a docstring a formatting hazard?**
Because docstring formatting assumes unlabelled fences and rST literal blocks are Python, and
the only safety net is "skip if it does not parse". Many shell commands are syntactically valid
Python expressions — `ls -la` is `ls` minus `la` — so they are formatted, turning into
`ls - la`. Labelling the block with its real language removes the guess.

**What does `docstring-code-line-length = "dynamic"` do?**
It makes the formatter fit docstring examples within the configured `line-length` of the
surrounding code, counting the docstring's indentation, so an example in a deeply indented
method still does not produce lines past the limit. A fixed integer instead applies that width to
the example regardless of where it sits.

**Why would a project want its Markdown code blocks formatted, and how does it opt out?**
Examples in documentation are copied by readers, and unformatted examples drift from the
project's style and teach the wrong one; formatting them with the same engine keeps them
consistent at no cost. The opt-outs are granular: HTML `fmt:off`/`fmt:on` comments (or
blacken-docs' equivalents) around specific blocks, an `extend-exclude` for specific files or
all `*.md`, and the usual suppression comments inside a block.

**What changed about Markdown between ruff 0.15 and 0.16?**
Markdown code-block formatting arrived as a preview feature in 0.15.0 and became stable and
enabled by default in 0.16.0. For a repository upgrading across that boundary, it means
`ruff format` — and `ruff format --check` in CI — now covers `.md` files that were never
formatted before, so the upgrade needs its own reformat commit or an explicit exclusion.

---

← Prev: [07f · Indentation, commas and line endings](07f-indentation-commas-and-line-endings.md) · [Topic index](README.md) · Next → [07h · Format suppression comments](07h-format-suppression-comments.md)
