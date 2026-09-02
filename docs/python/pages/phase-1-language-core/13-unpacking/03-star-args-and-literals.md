---
title: "`*` and `**` in calls and literals: PEP 448 and the later-wins merge"
sidebar_label: "3 · `*` and `**` in calls"
sidebar_position: 132
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against [PEP 448 — Additional Unpacking Generalizations](https://peps.python.org/pep-0448/),
> the Python 3.14 Language Reference
> [Calls](https://docs.python.org/3.14/reference/expressions.html#calls)
> and [Displays](https://docs.python.org/3.14/reference/expressions.html#list-displays),
> and the Library Reference
> [`dict`](https://docs.python.org/3.14/library/stdtypes.html#dict).
> Target: **CPython 3.14**.

**The same `*` and `**` that unpack on the left of an assignment also unpack on
the *right* — into a call's arguments, or into a list, set, tuple or dict
literal. PEP 448 (Python 3.5) removed the old limit of one of each: *"Function
calls may accept an unbounded number of `*` and `**` unpackings"*, and displays
accept them too. That is what makes `{**defaults, **overrides}` the standard
merge — and its rule is the one to memorise: *"In dictionaries, later values
will always override earlier ones."***

## In calls

```python
def connect(host, port, *, timeout=30, retries=3): ...

args = ("localhost", 5432)
opts = {"timeout": 5}

connect(*args, **opts)                  # host="localhost", port=5432, timeout=5
connect(*args, **opts, retries=1)       # keyword after ** is fine
connect(*["a"], *["b"], **{"timeout": 1}, **{"retries": 2})   # all legal, PEP 448
```

Two rules govern the argument side, and both produce `TypeError` rather than
anything subtle:

**An argument given twice is an error.** PEP 448 keeps the existing behaviour:
*"if an argument is given multiple times — such as a positional argument given
both positionally and by keyword — a `TypeError` is raised"*, and that
restriction *"remains enforced for duplicate arguments from multiple `**`
unpackings"*. So unlike a dict display, `f(**a, **b)` with a key in both does
**not** silently prefer the later one — it raises
`TypeError: got multiple values for keyword argument 'x'`.

That asymmetry is worth stating plainly, because it is the most surprising thing
in this chunk:

| Construct | Duplicate key |
|---|---|
| `{**a, **b}` | later wins, silently |
| `f(**a, **b)` | `TypeError` |

**Keys must be strings, and valid ones.** `f(**{"1": 2})` raises `TypeError:
keywords must be strings` for a non-string key; a string that is not an
identifier is accepted by some call paths and rejected by others, so do not rely
on it. If your keys are arbitrary, you want a dict parameter, not `**`.

### The forwarding idiom

```python
def wrapper(*args, **kwargs):
    log.debug("calling with %r %r", args, kwargs)
    return wrapped(*args, **kwargs)
```

`*args`/`**kwargs` in a *signature* collects; `*args`/`**kwargs` at a *call site*
spreads. The same syntax means opposite things depending on which side of the
`def` it is on, which is the single most common source of confusion here. The
signature side properly belongs to **Phase 2 — Functions**; this chunk owns the
call side.

Note that `args` is a **tuple** in a signature but the star accepts any iterable
at a call site, and `kwargs` is a plain `dict` — since 3.7 an ordered one,
preserving the order the keywords were written.

## In displays

```python
[*a, *b]                 # concatenate any two iterables into a list
(*a, *b)                 # ... into a tuple
{*a, *b}                 # ... into a set (deduplicating)
{**a, **b}               # merge two mappings into a dict
[*range(4), 4]           # PEP 448's own example
{'x': 1, **{'y': 2}}     # mix literal entries and unpackings freely
```

This is often better than the alternatives:

```python
combined = [*first, *second]        # vs first + second — works on any iterable,
                                    # not just two lists of the same type
merged = {**defaults, **overrides}  # vs a copy-then-update pair of statements
unique = {*a, *b}                   # vs set(a) | set(b)
```

`[*a, *b]` works where `a + b` does not: `a` can be a tuple and `b` a generator,
and the result is a list either way. `+` requires matching sequence types.

### The later-wins rule

PEP 448 is explicit, with its own examples:

```python
{'x': 1, **{'x': 2}}     # {'x': 2}
{**{'x': 2}, 'x': 1}     # {'x': 1}
```

So the **rightmost** occurrence wins, whether it comes from an unpacking or a
literal entry. That is what makes the config-layering idiom read correctly:

```python
config = {**site_defaults, **env_config, **cli_overrides}
```

Later sources override earlier ones, left to right, which matches how everyone
already reads a precedence list. Compare the equivalent written with `update`,
which needs three statements and a copy to avoid mutating `site_defaults`.

:::note
`dict1 | dict2` (PEP 584, Python 3.9) does the same merge with the same
later-wins rule and is often clearer for exactly two dicts. `{**a, **b}` still
wins when you are mixing literal entries in, unpacking something that is not a
`dict` but is a mapping, or merging more than two.
:::

### The merge is shallow

```python
a = {"db": {"host": "x", "port": 1}}
b = {"db": {"host": "y"}}
{**a, **b}          # {"db": {"host": "y"}} — port is GONE
```

Nested dicts are replaced wholesale, not merged. This is the single most common
production bug from this idiom: a config layer that meant to override one nested
key silently drops its siblings. Fix it with an explicit recursive merge, or by
keeping config flat with dotted keys. There is no deep-merge in the standard
library.

## `*` in other positions

```python
first, *rest = xs                  # assignment target — see chunk 2
def f(*args): ...                  # signature — Phase 2
f(*xs)                             # call site — this chunk
[*xs]                              # display — this chunk
for x in *a, *b: ...               # 3.11+ in a for's expression list
case [first, *rest]:               # a match sequence pattern — topic 10
```

Six positions, four meanings. The unifying idea is "spread this iterable into
the surrounding structure", and the exceptions are the assignment target and the
signature, where the star *collects* rather than spreads.

## Gotchas

**Symptom — `{**a, **b}` silently drops keys from a nested dict.** Cause: the
merge is shallow; a duplicate key's value is replaced wholesale rather than
merged. Fix: write an explicit recursive merge, or keep configuration flat.
There is no deep-merge in the standard library, and this is the most common
production bug from the idiom.

**Symptom — `f(**a, **b)` raises `TypeError: got multiple values for keyword
argument` where `{**a, **b}` would have worked.** Cause: a dict display resolves
duplicates by later-wins; a *call* treats an argument supplied twice as an
error, and PEP 448 kept that. Fix: merge first and then call —
`f(**{**a, **b})` — if later-wins is what you meant.

**Symptom — `f(**d)` raises `TypeError: keywords must be strings`.** Cause: a
non-string key in the mapping. Fix: if your keys are arbitrary data, pass the
dict as a single argument rather than spreading it — `**` is for named
parameters, not for data.

**Symptom — `a + b` raises `TypeError: can only concatenate list (not "tuple")
to list`.** Cause: `+` requires matching sequence types. Fix: `[*a, *b]`, which
accepts any two iterables and always produces a list.

**Symptom — a merge with `|` fails on Python 3.8.** Cause: `dict | dict` is
PEP 584, added in 3.9. Fix: `{**a, **b}` works from 3.5 and is the portable
spelling.

**Symptom — `{**a, **b}` returns a plain `dict` when `a` was an `OrderedDict` or
a `defaultdict`.** Cause: a dict display constructs a `dict`, whatever the
sources were — the `default_factory` and the subclass are lost. Fix: construct
the target type explicitly — `defaultdict(list, {**a, **b})`.

**Symptom — the order of a merged dict is not what you expected.** Cause: keys
appear in first-insertion order, but a duplicate key keeps its **original
position** while taking the **later value**. So `{**{"a": 1, "b": 2}, **{"a":
3}}` is `{"a": 3, "b": 2}` — `a` is still first. Fix: none needed, but do not
assume a re-specified key moves to the end.

**Symptom — `f(*args)` passes a string as many separate arguments.** Cause: a
`str` is iterable, so the star spreads it into characters. Fix: wrap it —
`f(*[s])` or just `f(s)`. Same root cause as `a, b = "hi"` unpacking to
characters.

**Symptom — `for x in *a, *b:` fails on Python 3.10.** Cause: starred elements
in a `for` statement's expression list are 3.11+. Fix:
`itertools.chain(a, b)`, which is clearer and works everywhere.

## Interview questions

**★ Q: How do you merge two dicts, and what happens to duplicate keys?**
`{**a, **b}` or, from 3.9, `a | b`. PEP 448: *"In dictionaries, later values
will always override earlier ones"* — so the rightmost occurrence wins, which is
why `{**defaults, **overrides}` reads correctly as a precedence chain. The merge
is **shallow**: a nested dict is replaced wholesale, not merged.

**★ Q: `{**a, **b}` prefers the later value for a duplicate key. Does `f(**a, **b)`?**
No — it raises `TypeError: got multiple values for keyword argument`. PEP 448
kept the existing rule that an argument supplied twice is an error, including
across multiple `**` unpackings. If you want later-wins at a call site, merge
first: `f(**{**a, **b})`.

**★ Q: What is the difference between `*args` in a `def` and `*args` in a call?**
Opposite directions. In a signature the star **collects** the remaining
positional arguments into a tuple; at a call site it **spreads** an iterable
into separate arguments. Same syntax, and which one applies depends only on
whether you are on the `def` line or the call line.

**Q: Why prefer `[*a, *b]` to `a + b`?**
Because `+` requires both operands to be the same sequence type, while `[*a,
*b]` accepts any two iterables — a tuple and a generator, say — and always
produces a list. It also extends to three or more sources without repeated
concatenation.

**Q: Does `{**a, **b}` preserve `a`'s type if `a` is a `defaultdict`?**
No. A dict display always constructs a plain `dict`, so the subclass and any
`default_factory` are lost. Construct the target type explicitly if you need it:
`defaultdict(list, {**a, **b})`.

**Q: In `{**{"a": 1, "b": 2}, **{"a": 3}}`, where does key "a" appear in the order?**
First — a duplicate key keeps its original insertion position while taking the
later value, so the result is `{"a": 3, "b": 2}`. Re-specifying a key updates it
in place rather than moving it to the end.

**Q: What is the shallow-merge trap?**
`{**a, **b}` replaces a duplicate key's value entirely, so merging
`{"db": {"host": "x", "port": 1}}` with `{"db": {"host": "y"}}` loses `port`.
Config layering is where this bites, because the intent was almost always to
override one nested key. There is no deep-merge in the standard library — write
one, or keep the config flat.

**Q: How many `*` and `**` unpackings may a call have?**
Any number, since PEP 448 (3.5): *"Function calls may accept an unbounded number
of `*` and `**` unpackings"*, and they may be interleaved with ordinary
arguments. Before 3.5 you got one of each.

---

← Prev: [Starred unpacking](02-starred-unpacking.md) · Index: [Unpacking](README.md) · Next → **`None` and the "no result" contract** *(not written yet)*
