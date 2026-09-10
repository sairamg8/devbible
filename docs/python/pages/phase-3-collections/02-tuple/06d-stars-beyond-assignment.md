---
title: "Outside an assignment the star builds rather than splits — a display makes one new tuple, a call packs `*args` into a tuple, a pattern binds a list, and `**` overwrites in a dict but raises in a call"
sidebar_label: "6d · Stars beyond assignment"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against [PEP 448 — Additional Unpacking Generalizations](https://peps.python.org/pep-0448/)
> and [PEP 3132 — Extended Iterable Unpacking](https://peps.python.org/pep-3132/);
> the Python 3.14 language reference on
> [Expression lists](https://docs.python.org/3.14/reference/expressions.html#expression-lists),
> [Function definitions](https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions)
> and [Sequence Patterns](https://docs.python.org/3.14/reference/compound_stmts.html#sequence-patterns);
> and the [common sequence operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> note on concatenation. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**The star has one meaning on the left of `=` — "collect the rest into a list" — and a
family of related meanings everywhere else. In a tuple, list, set or dict display it
*expands* an iterable into the new container. In a `for` target it collects, exactly as in
an assignment. In a `match` sequence pattern it collects into a list again. And in a
function signature it packs the excess positional arguments into a **tuple** — the one
place the collected remainder is immutable and hashable. Knowing which of these you are
looking at decides whether the result can be a dict key, whether duplicates are an error,
and whether a pattern you wrote as `(a, b)` also matches a list.**

## Starred unpacking in displays — PEP 448

Since 3.5 the star works inside tuple, list and set displays, and `**` inside dict
displays:

> *"Unpacking is proposed to be allowed inside tuple, list, set, and dictionary displays:
> `>>> *range(4), 4` → `(0, 1, 2, 3, 4)`"* — [PEP 448](https://peps.python.org/pep-0448/)

```python
combined = (*base_scopes, *extra_scopes, "admin")   # one new tuple, no chain of +
as_list  = [*base_scopes, "admin"]
as_set   = {*base_scopes, *extra_scopes}
merged   = {**defaults, **overrides}                # later keys win
```

> *"The keys in a dictionary remain in a right-to-left priority order, so
> `{**{'a': 1}, 'a': 2, **{'a': 3}}` evaluates to `{'a': 3}`."*

PEP 448 states the design goal as a symmetry with the assignment form, and it is worth
reading because it names the one thing that does *not* round-trip:

> *"there is a symmetry of assignment, where `fst, *other, lst = elems` and
> `elems = fst, *other, lst` are approximate inverses, ignoring the specifics of types."*

*"Ignoring the specifics of types"* is the whole of [6c](06c-starred-unpacking.md): the
left side hands you `other` as a list, the right side builds `elems` as a tuple.

🔴 **A display is the fix for a chain of `+` between a fixed number of tuples.**
`a + b + c` evaluates `a + b` into an intermediate tuple and then builds a second tuple for
the result; a single display names every source once and builds the result without that
intermediate. The documentation does not say how CPython assembles a starred display
internally, so do not read this as a promise of "one allocation". The loop case — growing a
tuple one `+` at a time — is a different and worse problem, the quadratic cost the sequence
documentation warns about, and its fix is a list; see
[10b · What operations cost](10b-what-operations-cost.md).

## `**` in a display overwrites; `**` in a call raises

The same two stars behave differently in the two places they can appear, and PEP 448
records both halves:

> *"In dictionaries, later values will always override earlier ones"*

> *"Currently, if an argument is given multiple times — such as a positional argument given
> both positionally and by keyword — a TypeError is raised.  This remains true for duplicate
> arguments provided through multiple ** unpackings, e.g. `f(**{'x': 2}, **{'x': 3})`,
> except that the error will be detected at runtime."*

```python
defaults  = {"timeout": 30, "retries": 3}
overrides = {"timeout": 5}

settings = {**defaults, **overrides}        # {"timeout": 5, "retries": 3} — silent merge
connect(**defaults, **overrides)            # TypeError at runtime: timeout given twice
connect(**{**defaults, **overrides})        # merge first, then call — what you meant
```

The PEP itself lists this as a known wart: *"Concerns have been raised about the unexpected
difference between duplicate keys in dictionaries being allowed but duplicate keys in
function call syntax raising an error."*

## In a `for` target and in a `match`

PEP 3132 covers the loop case explicitly:

> *"Note that this proposal also applies to tuples in implicit assignment context, such as
> in a for statement: `for a, *b in [(1, 2, 3), (4, 5, 6, 7)]:`"*

```python
for command, *args in parsed_lines:
    dispatch(command, args)          # args is a list, and may be empty
```

Sequence patterns in `match` use the same shape and the same list result:

> *"the star subpattern matches a list formed of the remaining subject items"* —
> [Sequence Patterns](https://docs.python.org/3.14/reference/compound_stmts.html#sequence-patterns)

```python
match parts:
    case [command, *args]:           # args is a list here too
        dispatch(command, args)
```

⚠️ A sequence pattern matches **any** sequence, not only a tuple — the reference says a
non-sequence fails, and that *"if the subject value is an instance of `str`, `bytes` or
`bytearray` the sequence pattern fails"*. So `case (a, b)` will happily match a two-element
*list*. The same section is explicit that the bracket style carries no meaning:

> *"There is no difference if parentheses or square brackets are used for sequence patterns
> (i.e. `(...)` vs `[...]` )."*

— with one exception that is the comma rule of [5](05-the-comma-makes-the-tuple.md) again:
*"A single pattern enclosed in parentheses without a trailing comma (e.g. `(3 | 4)`) is a
group pattern. While a single pattern enclosed in square brackets (e.g. `[3 | 4]`) is still a
sequence pattern."* The full treatment of `match` is [Phase 1 · 10 — `match` pattern
matching](../../phase-1-language-core/10-match-pattern-matching/README.md).

## `*args` is a tuple; `**kwargs` is a dict

> *"If the form "`*identifier`" is present, it is initialized to a tuple receiving any
> excess positional parameters, defaulting to the empty tuple.  If the form
> "`**identifier`" is present, it is initialized to a new ordered mapping receiving any
> excess keyword arguments"* —
> [Function definitions](https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions)

```python
seen = set()

def audit(event, *details, **fields):
    # details is a tuple — hashable if its contents are, and safe to store
    log_entry = (event, details, tuple(sorted(fields.items())))
    seen.add(log_entry)          # works: every component is hashable
```

That is the practical payoff of the parameter form being a tuple: `*args` can go straight
into a cache key or a set, and `*rest` from an assignment cannot.

At the **call** site the star runs the other way: `f(*items)` iterates `items` to build the
positional arguments, so the callee receives a tuple no matter what you passed — a list, a
generator, a set. A generator passed with `*` is consumed completely before the function
body runs.

## Gotchas

**★ Symptom: `case (a, b):` in a `match` matched a list and a caller was surprised.** Cause:
a sequence pattern matches any sequence except `str`, `bytes` and `bytearray` — the
parentheses in a pattern are not a tuple check. Fix: test the type with a class pattern if it
matters.

```python
match value:
    case tuple((a, b)):
        handle_pair(a, b)
    case _:
        raise TypeError(f"expected a 2-tuple, got {type(value).__name__}")
```

**★ Symptom: `TypeError` about a keyword argument given more than once, from a call that
merged two config dicts with `**`.** Cause: PEP 448 keeps duplicate keywords an error in a
call — *"detected at runtime"* — whereas the same two dicts in a `{**a, **b}` display merge
silently. Fix: merge into one dict first, so the precedence is explicit.

```python
connect(**{**defaults, **overrides})
```

**Symptom: `combined = a + b + c` on tuples builds a throwaway intermediate.** Cause: `+` is
binary, so `a + b` is materialised as its own tuple before `+ c` builds the result. Fix: one
display names every source once.

```python
combined = (*a, *b, *c)
```

**Symptom: `args.append(x)` inside a `*args` function raises `AttributeError`.** Cause: the
reference initialises `*identifier` to *"a tuple receiving any excess positional
parameters"*; tuples have no `append`. Fix: copy into a list when the function genuinely
needs to grow it.

```python
def run(*steps):
    pending = list(steps)
    pending.append("cleanup")
```

**Symptom: `for name, *values in rows:` raises `ValueError: not enough values to unpack
(expected at least 1, got 0)` on one row.** Cause: an empty row cannot satisfy even the one
fixed target, and the `for` target follows the same rule as an assignment. Fix: skip or
reject empty rows before unpacking.

```python
for row in rows:
    if not row:
        continue
    name, *values = row
```

**Symptom: `{*a, *b}` lost the order and duplicates the tuple version kept.** Cause: the
star expands into whatever display it sits in; in a set display the result is a set, with a
set's semantics. Fix: pick the display for the semantics you want — `(*a, *b)` to keep
order and duplicates, `tuple(dict.fromkeys((*a, *b)))` to drop duplicates but keep first-seen
order.

```python
unique_in_order = tuple(dict.fromkeys((*a, *b)))
```

**Symptom: `process(*read_rows(path))` used gigabytes before the first line of `process`
ran.** Cause: a starred argument is expanded into the call's positional arguments, so the
generator is drained into a tuple before the body starts. Fix: pass the iterable itself and
iterate inside.

```python
def process(rows):
    for row in rows:
        handle(row)

process(read_rows(path))
```

## Interview questions

**★ Why is `*args` a tuple when `*rest` is a list?**
Because they were designed for opposite purposes. `*args` is a snapshot of a call that the
function should not modify, so an immutable, hashable tuple is right — and it can go
straight into a cache key. `*rest` is the tail of a sequence you are in the middle of
processing, so a mutable list is more useful. PEP 3132 acknowledges the inconsistency and
accepts it, which is worth saying out loud in an interview: it is not an accident.

**★ `{**a, **b}` and `f(**a, **b)` — what happens when `a` and `b` share a key?**
The display merges and the later key wins, per PEP 448's *"later values will always override
earlier ones"*. The call raises `TypeError` at runtime, because a keyword argument supplied
twice has always been an error and PEP 448 kept it one: *"This remains true for duplicate
arguments provided through multiple ** unpackings"*. The PEP lists the asymmetry among its own
concerns. When you want merge semantics in a call, merge first: `f(**{**a, **b})`.

**How do you merge three tuples without chaining `+`?**
`(*a, *b, *c)`, using PEP 448's unpacking-in-displays. `a + b + c` is two binary
concatenations, so the `a + b` result exists only to be copied into the final tuple; the
display names each source once. The documentation does not specify how CPython builds a
starred display internally, so the defensible claim is "no intermediate tuple per `+`", not
"exactly one allocation". The dict equivalent is `{**a, **b}`, with the documented
right-to-left key priority.

**In a `match` statement, what does `case [x, *rest]:` bind `rest` to?**
A list, matching the assignment behaviour — the reference says *"the star subpattern matches
a list formed of the remaining subject items"*. And a caveat worth adding: the pattern
matches any sequence, so a tuple, a list and a `range` all match; `str`, `bytes` and
`bytearray` are specifically excluded so that a string does not decompose into characters.

**Is `case (a, b):` different from `case [a, b]:`?**
No. The reference says *"There is no difference if parentheses or square brackets are used
for sequence patterns"*. Both match any two-element sequence other than `str`, `bytes` and
`bytearray`. The one place the brackets matter is a single sub-pattern: `(3 | 4)` without a
comma is a group pattern, while `[3 | 4]` is still a one-element sequence pattern — the same
"the comma makes the tuple" rule that governs expressions. To demand an actual tuple, use a
class pattern, `case tuple((a, b)):`.

**What does `f(*gen)` do to a generator?**
It exhausts it before `f` runs. Starred arguments are expanded into the positional argument
tuple at the call site, so every item is produced and held at once. That is harmless for a
handful of values and a memory problem for a file or a cursor; pass the generator itself and
let the callee iterate lazily.

---

← [Starred unpacking](06c-starred-unpacking.md) · [Topic index](README.md) · Next → [Multiple return values](07-multiple-return-values.md)
