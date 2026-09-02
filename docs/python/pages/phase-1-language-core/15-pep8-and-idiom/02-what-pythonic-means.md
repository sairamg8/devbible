---
title: "What \"pythonic\" actually means — the real signal and the cargo cult"
sidebar_label: "2 · What \"pythonic\" means"
sidebar_position: 151
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations),
> [PEP 20 — The Zen of Python](https://peps.python.org/pep-0020/),
> the Python 3.14 Library Reference
> [`this`](https://docs.python.org/3.14/library/this.html),
> and the [ruff rules index](https://docs.astral.sh/ruff/rules/).
> Target: **CPython 3.14**.

**"Pythonic" is used for two different things, and only one of them is worth
anything in a review. The real sense is **using the language's own mechanisms
instead of reimplementing them** — iterating the thing rather than its indices,
letting a `with` block close the file, returning `None` deliberately rather than
accidentally. The cargo-cult sense is **preferring whatever is shortest**, which
produces the nested comprehension nobody can read and the one-liner that hides a
bug. PEP 20 covers both, and the line people forget is the one that settles the
argument: *readability counts*.**

## The Zen, as an actual tool

`import this` prints PEP 20. Most of it is aphorism, but four lines do real work
in a code review and are worth quoting at the moment of disagreement:

> *Explicit is better than implicit.*
> *Simple is better than complex.*
> *Flat is better than nested.*
> *Readability counts.*

And the pair that resolves the "but it fits on one line" argument:

> *Sparse is better than dense.*
> *There should be one — and preferably only one — obvious way to do it.*

The last one is routinely misquoted as "only one way to do it", which Python
plainly does not obey. The actual claim is weaker and more useful: for a given
problem there should be an *obvious* approach, and if you are choosing between
three clever ones, none of them is it.

## The recommendations with teeth

PEP 8's "Programming Recommendations" section is the part that outlives
formatting, because each item prevents a specific bug. The ones already covered
elsewhere in this phase, gathered:

| Recommendation | Why | Covered in |
|---|---|---|
| `is None`, never `== None` | `==` is overridable and returns an array on numpy | [14 · `None`](../14-none-and-no-result/01-what-none-is.md) |
| Not `== True` / `is True` | `1 == True`, so `!= True` misses `1` | [05 · Truthiness](../05-truthiness/03b-precedence-and-negation.md) |
| `if not seq:` for empty sequences | Survives a change of container type | [05 · Truthiness](../05-truthiness/01-what-falsy-means.md) |
| Beware `if x` when you mean `if x is not None` | Falsy-but-valid values | [05 · Truthiness](../05-truthiness/02-empty-versus-missing.md) |
| `x not in y`, `x is not None` | Single operators; the prefix forms read backwards | [05 · Truthiness](../05-truthiness/03b-precedence-and-negation.md) |
| No mutable default arguments | Evaluated once at `def` time | [07 · Aliasing](../07-assignment-and-aliasing/README.md) |
| Catch specific exceptions, never bare `except:` | A bare `except:` eats `KeyboardInterrupt` | **11 · Exceptions** *(not written yet)* |
| `def f():` over `f = lambda:` | A named function has a `__name__` in tracebacks | — |

That last row is worth stating since it has no home elsewhere: assigning a
`lambda` to a name gives you a function whose `__name__` is `<lambda>`, so every
traceback and every `repr` is less useful than it needed to be. Use `lambda` for
what it is good at — a throwaway `key=` argument — and `def` for anything with a
name. `ruff` flags the assignment as `E731`.

## Real signal versus cargo cult

The distinction that matters in review:

| Cargo cult ("pythonic" as a synonym for short) | Real signal |
|---|---|
| A nested comprehension a reader must re-parse | A comprehension replacing a three-line append loop |
| `reduce(lambda a, b: ..., xs)` | `sum()`, `math.prod()`, or a plain loop |
| Chaining six methods on one line | A named intermediate variable |
| A one-line `if`/`else` ternary spanning 100 chars | Two lines of `if` |
| `[x for x in xs if p(x)][0]` | `next((x for x in xs if p(x)), None)` |
| Clever `__getattr__` magic | An explicit method |
| `*` imports "to keep it tidy" | Explicit imports |

The unifying test: **does the shorter version make the reader do work the longer
version did for them?** A comprehension that replaces `result = []` /
`for` / `append` is genuinely better — it says "this is a transformation" in its
shape. A comprehension with two `for` clauses and a conditional expression says
"good luck".

The honest version of the rule, which **topic 09 · Comprehensions** *(not
written yet)* owns in full: a comprehension you have to read twice should have been a loop.

## Where idiom is genuinely load-bearing

Some idioms are not style at all — they are correctness:

```python
with open(path) as f:            # closes on exception; a bare open() may not
    data = f.read()

for x in xs:                     # works on generators; range(len(xs)) does not
    ...

if user is None:                 # distinguishes missing from empty
    ...

def f(items=None):               # a mutable default is shared across calls
    items = [] if items is None else items

first, *rest = parts             # validates the length; parts[0], parts[1:] does not

zip(a, b, strict=True)           # a length mismatch is a bug, not a truncation
```

Each of those has a non-idiomatic spelling that *works* until it does not, and
each failure is covered in its own topic. Calling them "idiom" undersells them —
they are the shapes that make the common bug impossible.

## Tooling settles most of this now

The practical answer to "is this pythonic" in 2026 is largely "what does `ruff`
say":

```toml
# pyproject.toml
[tool.ruff]
line-length = 88

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "SIM", "C4"]
```

- **`E`/`F`** — pycodestyle and pyflakes: the PEP 8 mechanics and undefined names.
- **`I`** — import sorting, replacing isort.
- **`B`** — flake8-bugbear: this is the valuable one. `B006` is the mutable
  default; `B008` is a function call in a default; `B023` is the loop-variable
  closure bug.
- **`UP`** — pyupgrade: rewrites to modern syntax as you raise the floor.
- **`SIM`**/**`C4`** — simplification and comprehension rules, including the
  `C419` unnecessary-list-in-`any()` from [topic 08](../08-control-flow/README.md).

Adding a type checker (`mypy` or `pyright`) catches the other half — the
`T | None` that nobody branched on. Between them, most of what used to be a
"pythonic" argument is now a CI failure, which is a better place for it.

**What no tool checks: naming, decomposition, and whether the abstraction is the
right one.** That is what a review is for.

## Gotchas

**Symptom — "make it more pythonic" produces code nobody can maintain.** Cause:
"pythonic" read as "shorter". Fix: apply the test — does the shorter version
make the reader do work the longer one did for them? A comprehension replacing
an append loop passes; a nested comprehension does not.

**Symptom — a traceback shows `<lambda>` instead of a function name.** Cause: a
`lambda` assigned to a name. Fix: `def`. PEP 8 recommends it and `ruff` flags it
as `E731`; the only cost is one extra line and the benefit is every future
traceback.

**Symptom — a bare `except:` swallows Ctrl-C.** Cause: `KeyboardInterrupt`
derives from `BaseException`, not `Exception`, precisely so that
`except Exception:` does not catch it — but a bare `except:` catches everything.
Fix: catch specific types; `except Exception:` at worst.

**Symptom — a "clean-up" commit rewrites loops as comprehensions and a bug
appears.** Cause: a comprehension cannot `break`, cannot `try`, and evaluates
eagerly; a mechanical rewrite loses the early exit or changes when exceptions
fire. Fix: rewrite only where the loop was genuinely a transformation, and run
the tests.

**Symptom — team review comments are dominated by style.** Cause: no formatter
and no linter in CI, so every reviewer is a linter. Fix: `ruff format` plus
`ruff check` in CI. It moves the entire category out of human review and leaves
naming and design, which is where review is actually valuable.

**Symptom — `ruff` with a broad rule selection produces hundreds of errors on an
existing codebase.** Cause: enabling everything at once on legacy code. Fix:
start with `E`, `F`, `I`, `B`; add rule families one at a time; use
`# noqa` with a code and a reason for the genuine exceptions, and
`--add-noqa` to baseline the rest.

**Symptom — a reviewer cites "there should be only one way to do it" to reject a
reasonable alternative.** Cause: PEP 20 is being misquoted. The actual line is
*"There should be one — and preferably only one — obvious way to do it"*, which
is about there being an obvious approach, not about forbidding alternatives.
Fix: quote it accurately; it usually supports the *simpler* option, not the
stricter reviewer.

**Symptom — a codebase mixes `snake_case` and `camelCase` after integrating a
library.** Cause: wrapping an external API whose names follow another
convention. Fix: PEP 8's own answer — consistency within the project wins, so
convert at the boundary. A thin adapter layer that renames once is better than
two conventions leaking through the codebase.

## Interview questions

**★ Q: What makes code "pythonic"?**
Using the language's own mechanisms instead of reimplementing them: iterate the
object rather than its indices, let a `with` block handle cleanup, use a
comprehension where you mean a transformation, use `is None` for the
missing-value question. It is *not* a synonym for short — the test is whether
the shorter version makes the reader do work the longer version did for them.

**★ Q: Why is `f = lambda x: x + 1` discouraged?**
Because the resulting function's `__name__` is `<lambda>`, so every traceback and
`repr` involving it is less informative than it needed to be. PEP 8 recommends
`def` for anything you are naming; `lambda` is for throwaway expressions like a
`key=` argument. `ruff` flags it as `E731`.

**★ Q: Which PEP 8 recommendations prevent actual bugs, rather than being style?**
`is None` rather than `== None` (`==` is overridable and returns an array on
numpy); not comparing booleans to `True` (because `1 == True`); `if not seq:`
rather than `seq == []` (survives a container-type change); no mutable default
arguments; and catching specific exceptions rather than a bare `except:`, which
swallows `KeyboardInterrupt`.

**Q: How do you settle style disagreements on a team?**
Move them out of review: a formatter (`ruff format` or Black) with the line
length pinned in `pyproject.toml`, and a linter in CI. PEP 8 explicitly allows a
team to agree a longer line length, so the number is not worth arguing about.
What is left for humans — naming, decomposition, whether the abstraction is
right — is what no tool checks.

**Q: What does PEP 20 actually say about "one way to do it"?**
*"There should be one — and preferably only one — obvious way to do it."* It is
about there being an obvious approach, not about the language forbidding
alternatives, which it plainly does not. Misquoted as "only one way", it gets
used to reject reasonable code; quoted correctly, it usually argues for the
simpler option.

**Q: Which `ruff` rule families would you enable first on an existing codebase?**
`E` and `F` for the mechanics and undefined names, `I` for import sorting, and
`B` (bugbear) for the ones that are genuinely bugs — `B006` mutable defaults,
`B023` the loop-variable closure trap. Add families incrementally; enabling
everything at once on legacy code produces a wall of errors nobody triages.

**Q: A library you wrap uses `camelCase`. What do you do?**
Convert at the boundary. PEP 8's own ordering says consistency within a project
outranks consistency with the guide, and either way two conventions leaking
through the codebase is the worst outcome. A thin adapter that renames once is
cheap.

---

← Prev: [What PEP 8 says](01-what-pep8-actually-says.md) · Index: [PEP 8 and idiom](README.md) · Next → [`del`, `pass`, `Ellipsis`](../16-del-pass-ellipsis/README.md)
