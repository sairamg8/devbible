---
title: "Swapping a raise for a None return is the most silent breaking change available in Python — nothing raises, no test fails, callers keep building, and their except blocks simply stop running — so the failure channel is versioned by the function name or not at all"
sidebar_label: "05l · Versioning the failure channel"
sidebar_position: 140.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Python 3.14 documentation —
> [`dict.get`](https://docs.python.org/3.14/library/stdtypes.html#dict.get)
> (*"never raises a `KeyError`"*),
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict)
> (`d[key]` — *"Raises a `KeyError` if key is not in the dictionary"*),
> [`warnings.warn`](https://docs.python.org/3.14/library/warnings.html#warnings.warn)
> (`stacklevel`),
> [`warnings` — Warning Categories](https://docs.python.org/3.14/library/warnings.html#warning-categories),
> [`re.search`](https://docs.python.org/3.14/library/re.html#re.search) — and
> [PEP 561](https://peps.python.org/pep-0561/#packaging-type-information) (`py.typed`).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**A return type is versioned by the type checker: widen it and somebody's CI goes red. The
raising channel has no such property, and neither does the move between the two channels.
Change a function from raising to returning `None` and every caller keeps compiling, keeps
passing its happy-path tests, and quietly loses its error handling — because a dead
`except` clause is not an error in any checker and a latent `AttributeError` on `None` only
fires in the case nobody tests. The only thing that carries the failure channel to a call
site is the function's *name*, which is why `dict` ships three spellings of one lookup and
why the migration for this change is a rename rather than an edit.**

## The change that nothing reports

```python
# v1.0 — raises
def get_config(name: str) -> str:
    return _CONFIG[name]                     # KeyError when unset

# v1.1 — "improved" to return None. Every `except KeyError:` in every caller is now
# dead code, and every unguarded use has acquired a latent AttributeError on None.
def get_config(name: str) -> str | None:
    return _CONFIG.get(name)
```

Trace what each tool sees:

| Tool | What it reports |
|---|---|
| The interpreter at import | nothing — both are valid functions |
| The caller's test suite | nothing — the happy path is unchanged |
| The caller's type checker | the *unguarded* uses, if they run one and the annotation is published |
| Anything at all, about the now-dead `except KeyError:` | **nothing** |

The last row is the one that ruins a weekend. An unreachable `except` clause is legal
Python and reports nothing anywhere, so the caller's carefully written fallback — the log
line, the default, the alert — simply stops running, and the first evidence is a missing
alert during an incident.

The reverse direction is equally silent in the other half. Change `find_x` from returning
`None` to raising, and callers that were narrowing with `if x is None:` now have an
unreachable branch and an uncaught exception. Their checker is perfectly happy: narrowing a
type that can no longer be `None` is not an error.

## The migration that works: a new name beside the old one

```python
import warnings


def find_config(name: str) -> str | None:
    """Return the configured value, or None if it is not set."""
    return _CONFIG.get(name)


def get_config(name: str) -> str:
    """Return the configured value.

    Raises:
        KeyError: the setting is not configured.

    .. deprecated:: 1.1
       Use :func:`find_config` and handle ``None``.
    """
    warnings.warn(
        "get_config() is deprecated; use find_config() and handle None",
        DeprecationWarning,
        stacklevel=2,
    )
    return _CONFIG[name]
```

Two details do the work:

- **`stacklevel=2`.** Without it the warning is attributed to the frame that called
  `warnings.warn` — a line inside your own library — so the consumer sees a file path they
  do not own and cannot act on. With it, the warning lands on their call site.
- **A new name, not a changed one.** A caller who must edit a call site notices the change.
  A caller whose code keeps compiling does not. That is the entire difference between a
  migration and an outage.

⚠️ **Do not assume the warning was seen.** The `warnings` reference describes the category
itself as ignored:

> *"`DeprecationWarning` — Base category for warnings about deprecated features when those
> warnings are intended for other Python developers (ignored by default, unless triggered by
> code in `__main__`)."*

So a library's deprecation is invisible to most consumers unless they have turned warnings on
deliberately or run their tests with `-W error::DeprecationWarning`. The practical consequence
is not "skip the warning" — it is
**keep the old name working for longer than feels necessary**, and put the change in the
release notes where somebody will actually read it.

## The name is the only part of the raising contract at the call site

The return type reaches a call site through the checker. The `Raises:` section reaches
nobody who does not open the definition. That leaves the **function name** as the only
carrier, which is why the convention is worth being rigid about:

| Name | Contract | Standard-library model |
|---|---|---|
| `get_x(key)` | raises if absent | `d[key]` — *"Raises a `KeyError` if key is not in the dictionary"* |
| `find_x(key)` | returns `None` if absent | `re.search` — *"Return `None` if no position in the string matches the pattern"* |
| `get_x(key, default)` | returns the caller's default | `d.get(k, default)` — *"never raises a `KeyError`"* |

`dict` ships all three spellings of the same question deliberately, and the documentation
of `get` says exactly why the third exists:

> *"Return the value for key if key is in the dictionary, else `default`. If `default` is
> not given, it defaults to `None`, so that this method never raises a `KeyError`."*

Copying that arrangement means a reader knows the failure channel from the call site
without opening anything. Which of the three a mapping lookup should use is
[03 · Mappings, the decision table](03-mappings-the-decision-table.md).

**The failure mode is a module with both conventions and no rule.** `find_order` that
raises and `get_customer` that returns `None`, in the same file, is worse than either
convention applied consistently — because now the name carries no information at all and
every caller has to read every definition, which is the cost the convention existed to
remove.

## The six channel changes, and what each one breaks

Not every change to a failure channel is equally dangerous. Sorted by how loudly they fail:

| Change | Who notices, and when |
|---|---|
| Narrowing a return type (`str \| None` → `str`) | nobody breaks; existing narrowing branches become dead but harmless |
| Widening a return type (`str` → `str \| None`) | **every caller's checker**, immediately — the only change in this table that is loud |
| Adding a raised exception type | nobody, until it is raised in production |
| Removing a raised exception type | nobody, ever — the handler just stops running |
| Raise → `None` return | nobody, until the absent case occurs |
| `None` return → raise | nobody, until the absent case occurs |

Five of the six are silent, and the one that is loud is loud only where someone runs a
checker on published annotations. **That distribution is the argument for treating the
raising channel as a major-version surface even though your tooling will never agree with
you.** A library that adds an exception type in a patch release is technically correct and
practically hostile.

## Gotchas

**★ Symptom: a function was changed from raising to returning `None` and a caller's
error-handling path silently stopped running.** Cause: the failure moved to a channel the
caller was not reading, and dead `except` clauses are reported by nothing. Fix: change the
name too, and deprecate the old one for a release — a caller who has to edit a call site
notices; a caller whose code keeps compiling does not.

```python
def find_config(name: str) -> str | None: ...   # new name, new channel
def get_config(name: str) -> str: ...           # old name, old channel, deprecated
```

**★ Symptom: a deprecation warning points at a line inside the library instead of the
caller's code, and nobody can find what to change.** Cause: `warnings.warn` attributes the
warning to the frame that called it — which is your own function. Fix: `stacklevel=2` so it
lands on the caller.

```python
warnings.warn("use find_config()", DeprecationWarning, stacklevel=2)
```

**★ Symptom: a deprecation shipped two releases ago, the old name is removed, and half the
consumers are broken and surprised.** Cause: `DeprecationWarning` is ignored by Python's
default filters outside `__main__`, so most consumers never saw it at all. Fix: do not
treat the warning as notification — put it in the release notes, and keep the old name for
longer than the warning period suggests.

```python
# In the consumer's test config, so warnings from dependencies are visible at all:
# pytest.ini
# filterwarnings = error::DeprecationWarning
```

**★ Symptom: `find_order` raises and `get_customer` returns `None` in the same module.**
Cause: two conventions and no rule, so the name carries no information and every caller
must open every definition. Fix: pick one mapping of prefix to channel per package, write
it down, and rename the outliers with the deprecation dance above.

```python
def get_customer(customer_id: str) -> Customer:          # raises CustomerNotFound
def find_customer(customer_id: str) -> Customer | None:  # returns None
```

**Symptom: a caller's `if result is None:` branch became unreachable after an upgrade and
nothing said so.** Cause: the callee narrowed its return type from `T | None` to `T`,
which is a *relaxation* and therefore not an error anywhere — the branch is simply dead.
Fix: this one is benign, but say so in the release notes, because a reader encountering a
provably-dead branch will waste time deciding whether it is a bug.

**Symptom: the annotation says `str | None` but the published package ships no
`py.typed`, so no consumer's checker ever sees it.** Cause: PEP 561 requires the marker —
*"Package maintainers who wish to support type checking of their code MUST add a marker file
named `py.typed` to their package supporting typing"* — so an unmarked package's annotations
are not used, and even the *one* loud change in the table above becomes silent. Fix: ship the
marker, which is what makes the return type a versioned artefact rather than a private note.

```
# In the package: src/payments/py.typed  (an empty marker file)
# pyproject.toml
# [tool.setuptools.package-data]
# payments = ["py.typed"]
```

**Symptom: a `try/except KeyError:` around a call keeps working, but now catches a
`KeyError` from inside the caller's own dictionary access instead of the library's.**
Cause: the library stopped raising, so the handler's only remaining source of `KeyError` is
the caller's own code — the handler did not become dead, it became *wrong*, which is worse.
Fix: narrow the `try` to the one call, which is the width rule
[06 · Narrowing the try](06-narrowing-the-try.md) exists for, so a channel change turns the
clause dead rather than silently repurposing it.

```python
try:
    value = get_config(name)
except KeyError:
    value = DEFAULT                 # only this call can raise into this handler
```

## Interview questions

**★ Why is swapping a raise for a `None` return a breaking change when nothing about the
runtime changed?**
Because you moved the failure to a channel the old callers were not reading. Their `except`
blocks stop matching — and an unreachable `except` clause is not an error in any checker, so
no tool reports it — while their unguarded call sites acquire a latent `AttributeError` on
`None` that fires the first time the value is genuinely absent, at a line that does not
mention your function. Both symptoms appear only in the failure case, which is precisely the
case nobody's happy-path tests cover. The migration that works is a new name beside the old
one, the old one deprecated with a `DeprecationWarning` at `stacklevel=2` for at least a
release, so the change is visible before it is mandatory.

**★ Which changes to a function's failure behaviour are loud, and which are silent?**
Exactly one is loud: widening a return type, `str` to `str | None`, which every consumer's
type checker reports at every call site — provided they run one and your package is marked
typed. Everything else is silent. Narrowing a return type breaks nobody and leaves dead
branches. Adding a raised exception type is invisible until it is raised in production;
removing one is invisible forever, because the handler just stops running. Moving between
raising and returning `None`, in either direction, is invisible until the absent case
occurs. That distribution is the whole reason the raising channel has to be treated as a
major-version surface by discipline: five of the six changes have no tool that will disagree
with you.

**★ Why does `dict` ship three spellings of the same lookup, and what should you copy from
that?**
Because the three differ only in what happens on a miss, and that is a decision the caller
owns rather than the library. `d[key]` raises — *"Raises a `KeyError` if key is not in the
dictionary"* — `d.get(key)` returns `None`, and `d.get(key, default)` returns whatever the
caller nominated; the documentation is explicit that the default exists *"so that this
method never raises a `KeyError`"*. What to copy is the *naming*: `get_x` raises, `find_x`
returns `None`, `get_x(default)` takes a default. Since the raising half of the contract is
invisible at the call site, the name is the only thing carrying it, and a module that uses
both conventions with no rule has thrown that away.

**A team wants to move a whole codebase from raising finders to `None`-returning ones. How
do you do it without an incident?**
Not in place, and not all at once. Add the new names alongside the old ones so both channels
exist during the transition, deprecate the old ones with `stacklevel=2` and record the change
in release notes rather than trusting the warning — Python's default filters hide
`DeprecationWarning` outside `__main__`. Then migrate call sites in batches, because each one
needs a decision that the automated change cannot make: whether this particular caller should
narrow the `None` or convert it straight back into a raise. That last point is the one worth
saying out loud in an interview — a mechanical rewrite that turns every `get_x()` into
`find_x()` plus `if x is None: raise` has not simplified anything, it has just moved the raise
into a hundred call sites, which is [05j](05j-type-checkers-and-silent-apis.md)'s arithmetic
running backwards.

**Your library annotates `-> str | None` and a consumer's checker never complains. Why?**
Almost certainly because the package is not marked as typed. A checker will not use
annotations from an installed third-party package unless it carries the `py.typed` marker, so
an unmarked package's signatures are invisible to every consumer and the calls are inferred
as `Any`. That converts the one *loud* change in the whole table — widening a return type —
into another silent one, and it also means the `X | None` you carefully chose is compelling
nothing at any call site. Shipping the marker is what makes the return type an enforced,
versioned part of the API rather than a private note to yourself.

---

← Prev: [The raising contract](05k-the-raising-contract.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [The bill every caller pays](05m-the-bill-every-caller-pays.md)
