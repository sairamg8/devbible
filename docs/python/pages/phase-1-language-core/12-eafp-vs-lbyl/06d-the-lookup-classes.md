---
title: "LookupError merges two findings that have different fixes, a slice cannot fail at all so it cannot tell you anything, and KeyError has at least five sources that are not the dict subscript you were guarding"
sidebar_label: "06d · The lookup classes"
sidebar_position: 144
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html) reference —
> `LookupError`, `IndexError` and `KeyError`, quoted verbatim below; the
> [`collections`](https://docs.python.org/3.14/library/collections.html) reference for
> `defaultdict.__missing__`; and `set.pop.__doc__` **probed** on the installed CPython
> **3.14.4**, one patch behind the corpus pin. Target: **Python 3.14**.
> Documentation-validated; **no sandbox run**.

**[06c](06c-the-breadth-of-one-class.md) took `OSError` apart because it is the widest
class anyone catches on purpose. `KeyError` and `IndexError` look like the opposite —
about as narrow as a builtin gets, each naming one operation on one kind of container.
They are not. `LookupError` merges two findings whose fixes are different and can also be
raised by `codecs.lookup()`; a slice cannot raise at all, so choosing one is not the same
as handling the failure; and `KeyError` has at least five distinct sources, so
`except KeyError` around a suite that formats a string, reads an environment variable or
pops a set is guarding four things you did not mean. The attribute, value and type
classes are [06e](06e-attribute-value-and-exception.md).**

## `LookupError`: exactly two classes, and one surprise

> *"The base class for the exceptions that are raised when a key or index used on a
> mapping or sequence is invalid: `IndexError`, `KeyError`. This can be raised directly
> by `codecs.lookup()`."*

Narrower than `OSError` by an order of magnitude, and still a width defect in most
blocks, because the two children have different causes:

> `KeyError` — *"Raised when a mapping (dictionary) key is not found in the set of
> existing keys."*
> `IndexError` — *"Raised when a sequence subscript is out of range. (Slice indices are
> silently truncated to fall in the allowed range; if an index is not an integer,
> `TypeError` is raised.)"*

"A name I expected is absent" and "this sequence is shorter than I expected" are
different findings with different fixes. `except LookupError` is defensible when a chain
genuinely mixes both and one recovery is right for both — and then it needs a comment
saying so, because the next reader will read it as laziness. The chained-lookup case is
[03c · Sequences, sets and nesting](03c-sequences-sets-and-nested-lookups.md).

The parenthetical about slices is a real trap of its own: `payload["items"][5:10]` never
raises, so a slice-based "safe" access silently returns fewer elements while
`payload["items"][5]` raises. A handler cannot narrow a failure that does not occur.

## `KeyError` has at least five sources

The reference sentence is about mappings — *"Raised when a mapping (dictionary) key is
not found in the set of existing keys"* — and that is how everyone reads their own
`except KeyError`. In a suite of more than one statement it is rarely the only source.

| Source | What raises it | Why it surprises |
|---|---|---|
| `d[key]` | the mapping subscript you meant | — |
| `d.pop(key)` with no default | documented as raising `KeyError` when the key is absent | reads like `.pop(key, None)` at a glance |
| `str.format` / `format_map` | a replacement field naming a key the arguments do not supply | the "missing key" is a **template** bug, not a data one |
| `os.environ[name]` | a mapping over the process environment | a deployment problem dressed as a lookup |
| `set.remove(x)` and `set.pop()` on an empty set | probed on CPython **3.14.4**: `set.pop.__doc__` is *"Remove and return an arbitrary set element. Raises `KeyError` if the set is empty."* | a *sequence*-shaped operation raising a *mapping* exception |
| a `__missing__` hook | `collections` documents `defaultdict.__missing__` as raising *"a `KeyError` exception with the key as argument"* when `default_factory` is `None` | raised by code three levels down that you do not own |

So this handler is four assumptions wearing one clause:

```python
# 🔴 One except KeyError. Four different failures, one recovery.
def render_alert(template: str, event: dict[str, str], seen: set[str]) -> str:
    try:
        seen.remove(event["id"])
        region = os.environ["AWS_REGION"]
        return template.format(region=region, **event)
    except KeyError:
        return ""
```

A typo in the template, an unset `AWS_REGION`, a re-delivered event whose id is no longer
in `seen`, and a genuinely absent `event["id"]` all produce an empty alert. Three of the
four are operational failures somebody needs to be told about.

```python
def render_alert(template: str, event: dict[str, str], seen: set[str]) -> str:
    seen.discard(event["id"])              # idempotent by design, not by handler
    region = os.environ["AWS_REGION"]      # unset config must crash at startup
    try:
        return template.format(region=region, **event)
    except KeyError as exc:
        raise TemplateError(f"alert template references {exc.args[0]!r}") from exc
```

`set.discard` rather than `remove` is the same choice one method name lower —
[03c · Sequences, sets and nesting](03c-sequences-sets-and-nested-lookups.md) has the
pair of docstrings.

## Gotchas

**Symptom: `except LookupError` was chosen because a chain mixed a dict and a list, and
it later hid a `codecs.lookup()` failure.** Cause: the reference notes `LookupError`
*"can be raised directly by `codecs.lookup()`"*, so a class you picked for subscripts
also covers an encoding-name lookup. Fix: name `KeyError` and `IndexError` explicitly if
you really mean both, so a third source cannot join the clause silently.

```python
try:
    return payload["items"][index]
except (KeyError, IndexError):        # exactly the two, not their base
    return None
```

**Symptom: a "safe" slice-based access silently returns a short list instead of
raising.** Cause: the reference's parenthetical — *"Slice indices are silently truncated
to fall in the allowed range"* — so `items[5:6]` on a three-element list yields `[]` and
no handler ever runs. Fix: if you need to know that the element was absent, subscript and
catch, or check the length; a slice cannot tell you.

```python
try:
    first_overflow = items[5]
except IndexError:
    first_overflow = None            # items[5:6] would have said nothing at all
```

**★ Symptom: a `KeyError` handler returns a default and the log line does not say which
key was missing.** Cause: the exception object carries the key and the handler discarded
it — the `collections` documentation describes `defaultdict.__missing__` as raising
*"a `KeyError` exception with the key as argument"*, and plain `dict` behaves the same
way. Fix: bind it and log it.

```python
try:
    region = routing[tenant_id]
except KeyError as exc:
    log.warning("no routing entry for %s", exc.args[0])
    region = DEFAULT_REGION
```

**Symptom: `except IndexError` does not fire when the index is a string.** Cause: the
reference's parenthetical — *"if an index is not an integer, `TypeError` is raised"* — so
a wrong-typed index is a different class entirely, and the "short sequence" handler never
sees it. Fix: validate the index's type where it is produced, not where it is used; do
not widen the clause.

```python
def nth_column(row: Sequence[str], index: int) -> str:
    if not isinstance(index, int):
        raise TypeError(f"column index must be int, got {type(index).__name__}")
    try:
        return row[index]
    except IndexError:
        return ""
```

**★ Symptom: a template typo produces an empty message instead of an error.** Cause:
`str.format` raises `KeyError` for a replacement field the arguments do not supply, so an
`except KeyError` written for a data lookup absorbs a bug in the template string. Fix:
guard the format call alone and translate — the key in `exc.args[0]` is the field name,
which is the whole error message.

```python
try:
    body = template.format(**event)
except KeyError as exc:
    raise TemplateError(f"template references unknown field {exc.args[0]!r}") from exc
```

**★ Symptom: an unset environment variable is reported as a missing record.** Cause:
`os.environ` is a mapping, so `os.environ["AWS_REGION"]` raises the same class as
`record["id"]`, and one clause covering both turns a deployment fault into a data fault.
Fix: read configuration once at startup, outside every handler, so an unset variable
fails the process rather than a request.

```python
AWS_REGION = os.environ["AWS_REGION"]      # module import time; crash loudly if unset
```

**Symptom: `except KeyError` fires on a retry that should have been a no-op.** Cause:
`set.remove` raises `KeyError` when the element is absent — probed on CPython 3.14.4,
`set.pop.__doc__` is *"Remove and return an arbitrary set element. Raises `KeyError` if
the set is empty"*, and `remove` is documented the same way — so an idempotent cleanup
inside a wide handler looks like a lookup failure. Fix: `discard`, and take the operation
out of the `try` entirely.

```python
seen.discard(event_id)      # no exception, no handler, no clause to widen
```

## Interview questions

**★ Name three sources of `KeyError` in a typical request handler that are not the dict
subscript you were guarding.**
`str.format` or `format_map` raising for a replacement field the arguments do not supply;
`os.environ[name]` for an unset environment variable; `set.remove` or an empty `set.pop`;
`dict.pop(key)` without a default; and a `__missing__` hook in a mapping subclass — the
`collections` reference describes `defaultdict.__missing__` as raising *"a `KeyError`
exception with the key as argument"* when there is no factory. The point of the list is
that `except KeyError` reads as narrow and is only narrow when the suite contains exactly
one lookup.

**Why does an empty `set.pop()` raise `KeyError` rather than `IndexError`, when a set has
no keys?**
Because `set` is implemented on the same hash-table machinery as `dict` and its removal
methods report absence in the same vocabulary — probed on CPython 3.14.4,
`set.pop.__doc__` reads *"Remove and return an arbitrary set element. Raises `KeyError`
if the set is empty."* For width, that is the interesting part: `IndexError` versus
`KeyError` does not track "sequence versus mapping" as cleanly as `LookupError`'s
documentation suggests, so a clause chosen by reasoning about container kinds will be
wrong somewhere.

**★ Is `except LookupError` ever right?**
Only when you can state that every lookup in the block is optional *in the same way* and
one recovery is right for all of them — and then say so in a comment, because the next
reader will assume laziness. Two things argue against it even then: `KeyError` and
`IndexError` have different causes and different fixes, and the reference notes
`LookupError` *"can be raised directly by `codecs.lookup()`"*, so a class chosen for
subscripts can silently acquire a third source.

**Why does the `IndexError` entry mention `TypeError` at all, and why does that matter
for width?**
Because it draws the line between "the sequence is too short" and "the index is not an
index" — *"Slice indices are silently truncated to fall in the allowed range; if an index
is not an integer, `TypeError` is raised"*. For width, it means the obvious handler is
incomplete in one direction and, if you widen it, badly over-broad in the other. The
resolution is not a wider clause: it is validating the index where it is produced, so the
`try` keeps its single assumption.

**A slice never raises. Is that an argument for slicing instead of subscripting?**
Only if you genuinely do not need to know. *"Slice indices are silently truncated to fall
in the allowed range"*, so `items[5:6]` on a three-element list yields `[]` — no
exception, no handler, no signal. That is the right tool when "however many there are" is
the requirement, and the wrong one when the absence of an element is information. Choosing
a construct that cannot fail is not the same as handling the failure, and the two get
confused constantly.

**How does the `KeyError` object help a narrow handler that a wide one throws away?**
It carries the key. The `collections` documentation describes `defaultdict.__missing__`
as raising *"a `KeyError` exception with the key as argument"*, and plain `dict` does the
same — so `except KeyError as exc` gives you `exc.args[0]`, which is usually the entire
content of the log line you want. A wide handler that catches three classes cannot do
this, because there is no attribute the three have in common; the width costs you the
diagnosis as well as the precision.

---

← Prev: [The breadth of one class](06c-the-breadth-of-one-class.md) · Index: [EAFP vs LBYL](README.md) · Next → [Attribute, value and Exception](06e-attribute-value-and-exception.md)
