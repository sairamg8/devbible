---
title: "Dedupe decides what 'duplicate' means for you — `1`, `1.0` and `True` collapse into one element, two strings that render identically stay two, a list of dicts cannot be deduplicated at all, and the set that comes out is not something JSON can serialise"
sidebar_label: "4b · Dedupe: equality and the container"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the
> [data model](https://docs.python.org/3.14/reference/datamodel.html#set-types), the
> [operator precedence footnotes](https://docs.python.org/3.14/reference/expressions.html#operator-precedence),
> [`json`](https://docs.python.org/3.14/library/json.html), the
> [`itertools` recipes](https://docs.python.org/3.14/library/itertools.html#itertools-recipes) and
> the [3.14 What's New](https://docs.python.org/3.14/whatsnew/3.14.html) (the unhashable-element
> message); CPython v3.14.7 `Lib/json/encoder.py` for the error string. Split out of
> [4 · Dedupe and what it destroys](04-dedupe-and-what-it-destroys.md) on a concept boundary.
> Documentation-verified — **no sandbox run, no program output**.

**[4](04-dedupe-and-what-it-destroys.md) covers what a dedupe throws away — order, counts, the choice
of survivor. This page covers what it *decides*. A set's idea of "the same value" is `==` plus
`hash()`, which is both wider than yours (numbers of different types collapse) and narrower (strings
that look identical do not), and the set it hands back is a different kind of object from the list
that went in.**

## Loss 4 — values that were equal but not the same

A set cannot hold two elements that compare equal, and Python's idea of equal is wider than yours:

> *"Note that numeric types obey the normal rules for numeric comparison: if two numbers compare
> equal (e.g., `1` and `1.0`), only one of them can be contained in a set."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#set-types)

So `[1, 1.0, True]` dedupes to one element, and by loss 3 in [4](04-dedupe-and-what-it-destroys.md) it is the `1` that arrived first — a
column of flags and counts mixed together silently collapses. The full treatment of `1`, `1.0`,
`True`, `Decimal`, `Fraction` and NaN is [7 · Equal but distinct elements](07-equal-but-distinct-elements.md).

The opposite failure is values you consider equal that Python does not. Strings compare by code
point:

> *"The comparison operators on strings compare at the level of Unicode code points. This may be
> counter-intuitive to humans. For example, `"\u00C7" == "\u0043\u0327"` is `False`, even though
> both strings represent the same abstract character “LATIN CAPITAL LETTER C WITH CEDILLA”."* —
> [operator precedence, footnote 3](https://docs.python.org/3.14/reference/expressions.html#operator-precedence)

Two user names that render identically — one typed on a keyboard that produces the precomposed
character, one pasted from a source that produces the combining sequence — are two elements. Neither
case nor surrounding whitespace is folded either. Decide what *duplicate* means and make it the key:

```python
import unicodedata
from collections.abc import Iterable, Iterator


def display_key(name: str) -> str:
    return unicodedata.normalize("NFC", name).strip().casefold()


def unique_names(names: Iterable[str]) -> Iterator[str]:
    seen: set[str] = set()
    for name in names:
        k = display_key(name)
        if k not in seen:
            seen.add(k)
            yield name                      # keep the first spelling the user actually typed
```

## Loss 5 — the container

The result of `set(items)` is not a list, and code downstream of a dedupe usually expected one.
Three places it breaks:

- **JSON.** The encoder's conversion table maps `dict`, `list`, `tuple`, `str`, numbers, `True`,
  `False` and `None` — there is no row for `set`. Serialising one raises
  `Object of type set is not JSON serializable` (`Lib/json/encoder.py`, 3.14.7); 3.14 also attaches
  an exception note naming where in the structure it was found. The fix is a sorted list at the
  boundary, which also removes the run-to-run order difference:

  ```python
  import json

  def tags_payload(post_id: int, tags: set[str]) -> str:
      return json.dumps({"post_id": post_id, "tags": sorted(tags)})
  ```

- **Indexing and random choice.** `unique[0]` raises `'set' object is not subscriptable`, and
  `random.choice` and `random.sample` need a sequence — the full story is
  [1b](01b-what-the-table-costs-you.md).
- **Unhashable elements never got this far.** `set(rows)` over a list of dicts raises
  `TypeError: cannot use 'dict' as a set element (unhashable type: 'dict')` on 3.14. Dedupe by a
  hashable key (`first_per_key`), or by a canonical form of the whole record:

  ```python
  import json

  def dedupe_records(rows: list[dict]) -> list[dict]:
      seen: set[str] = set()
      kept: list[dict] = []
      for row in rows:
          fingerprint = json.dumps(row, sort_keys=True, default=str)
          if fingerprint not in seen:
              seen.add(fingerprint)
              kept.append(row)
      return kept
  ```

  `sort_keys=True` makes two dicts with the same items in a different insertion order produce the
  same text; `default=str` makes values such as dates serialisable, at the cost of treating any two
  values with the same `str()` as equal. The recipes also offer `unique()` — *"Yield unique elements
  in sorted order. Supports unhashable inputs."* — which sorts first, so it needs orderable elements
  and gives up arrival order.

## Gotchas

**★ Symptom: `TypeError: Object of type set is not JSON serializable` from an endpoint that "just
removed duplicates".** Cause: the dedupe returned a set, and JSON has no set type. Fix: convert at the
boundary, sorted — `tags_payload` above.

**Symptom: a column of mixed `1`, `1.0` and `True` values has one distinct value.** Cause: those
three compare equal, so only one can be in a set, and the first to arrive is kept. Fix: dedupe on
`(type(v), v)` when the type is part of the value.

```python
def dedupe_typed(values: list[object]) -> list[object]:
    return [v for _, v in dict.fromkeys((type(v), v) for v in values)]
```

**Symptom: two accounts named "Çelik" survive dedupe and look identical in the admin UI.** Cause:
one uses the precomposed character and one the combining sequence; strings compare by code point.
Fix: normalise and casefold into the key — `display_key` above.

**Symptom: `TypeError: cannot use 'dict' as a set element (unhashable type: 'dict')` from
`list(set(rows))`.** Cause: dicts are unhashable. Fix: a key or a fingerprint — `first_per_key` or
`dedupe_records` above.

## Interview questions

**★ Why might two strings that look identical not be deduplicated?**
Because string equality is code-point equality. The reference's own example is that a precomposed
`Ç` does not equal `C` followed by a combining cedilla. Normalise with `unicodedata.normalize` (and
usually `casefold()` and `strip()`) into the dedupe key, and keep the original spelling as the value.

**How would you dedupe a list of dicts?**
Dicts are unhashable, so not with a set directly. Either pick the fields that define identity and
dedupe on a tuple of them, or build a canonical fingerprint such as `json.dumps(row,
sort_keys=True)` and dedupe on that. The `unique()` recipe handles unhashable inputs by sorting, but
needs orderable elements and loses arrival order.

---

← Prev: [Dedupe and what it destroys](04-dedupe-and-what-it-destroys.md) · [Topic index](README.md) · Next → [frozenset — hashable sets](05-frozenset-hashable-sets.md)
