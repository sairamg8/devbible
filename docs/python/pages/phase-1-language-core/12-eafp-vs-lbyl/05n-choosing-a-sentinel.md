---
title: "A sentinel is only useful if it is not a member of the success type — str.find returns -1 inside the int it is typed to return, so no checker can force anyone to test for it, and that single property is what separates the two famous find() bugs from re.search returning None"
sidebar_label: "05n · Choosing a sentinel"
sidebar_position: 140.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Python 3.14 documentation —
> [`str.find`](https://docs.python.org/3.14/library/stdtypes.html#str.find) and
> [`str.index`](https://docs.python.org/3.14/library/stdtypes.html#str.index),
> [`re.search`](https://docs.python.org/3.14/library/re.html#re.search),
> [`dict.get`](https://docs.python.org/3.14/library/stdtypes.html#dict.get).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[05m](05m-the-bill-every-caller-pays.md) argued about *whether* to return a sentinel. This
chunk is about *which value*, and one rule governs the whole question: a sentinel must not
be a member of the success type. Break it and the checker has nothing to object to, so
nobody can be compelled to test for the miss — which is exactly why `str.find` returning
`-1` produces two famous bugs and `re.search` returning `None` produces none. The corollary
is the collection case, where a sentinel is not needed at all because `[]` already says it.
The case where `None` itself becomes a member of the success type is
[05o](05o-the-sentinel-object.md).**

## An in-band sentinel is invisible to the checker

`str.find` returns an *in-band* sentinel:

> *"Return the lowest index in the string where substring `sub` is found within the slice
> `s[start:end]`. … Return `-1` if `sub` is not found."*

Its return type is `int`. Not `int | None` — `int`. So the checker has nothing to object to,
nothing to force, and no way to distinguish the failure token from a legitimate result.
Every guarantee `X | None` buys you is gone, and the two classic bugs follow immediately:

```python
if line.find("ERROR"):          # 🔴 -1 is truthy, and index 0 is falsy.
    ...                         # fires when the substring is ABSENT, and silently
                                # does not fire when it is at the start of the line.

start = line.find("ERROR")
print(line[start:start + 5])    # 🔴 on a miss this slices from -1 — no error, wrong text
```

The library's own documentation heads this off with a note:

> *"The `find()` method should be used only if you need to know the position of `sub`. To
> check if `sub` is a substring or not, use the `in` operator"*

So the three correct spellings, in the order you should reach for them:

```python
if "ERROR" in line:                       # the membership question, asked directly
    ...

start = line.find("ERROR")                # the position question, sentinel handled
if start != -1:
    print(line[start:start + 5])

try:
    start = line.index("ERROR")           # the position question, absence exceptional
except ValueError:
    start = None
```

`str.index` is documented as *"Like `find()`, but raise `ValueError` when the substring is
not found"* — the standard library shipping both designs for the same question. Contrast
`re.search`, which chose the out-of-band sentinel and got a checkable type for it:

> *"Return `None` if no position in the string matches the pattern; note that this is
> different from finding a zero-length match at some point in the string."*

Its type is `Match[str] | None`, so `m.group(0)` without a narrowing is a type error rather
than an `AttributeError` at 3am. **If you must return a sentinel, return one that is not a
member of the success type.** That is the entire difference between `-1` and `None`.

## Collections: `[]` is already "nothing found"

The one case where `| None` buys nothing at all:

```python
def tags_for(post_id: int) -> list[str] | None: ...   # 🔴 what would None mean?
def tags_for(post_id: int) -> list[str]: ...          # ✅ [] is already "nothing"
```

An empty list is the correct representation of "nothing found" and it composes: the caller
can iterate, `len`, or truth-test it with no guard at all. Returning `None` instead forces
every call site to write `for tag in (tags or []):`, which is a branch that communicates
nothing and is itself an [empty-versus-missing](../05-truthiness/02-empty-versus-missing.md)
bug waiting for the caller who needed the distinction.

Keep the union only where "no collection at all" is genuinely a different fact from "an
empty one" — a post that does not exist versus a post with no tags — and when it is,
consider whether the honest signature raises for the first and returns `[]` for the second.

## Gotchas

**★ Symptom: `if line.find(marker):` fires on lines that do not contain the marker.**
Cause: the miss sentinel is `-1`, which is truthy, while a match at position 0 is falsy — the
condition is inverted for one case and wrong for the other. Fix: ask the membership question
with `in`, exactly as the `str.find` note recommends.

```python
if marker in line:
    ...
```

**Symptom: a slice built from a `find()` result quietly returns the tail of the string.**
Cause: `-1` is a legal index, so a miss slices from the end instead of failing. Fix: compare
against `-1` explicitly, or use `index` and catch `ValueError`.

```python
start = line.find(marker)
if start == -1:
    raise MarkerMissing(marker)
body = line[start:]
```

**Symptom: a function returns `list[str] | None` and every caller writes
`for x in (tags or []):`.** Cause: a collection-returning function used `None` for "nothing",
which an empty list already expresses — so the union buys a branch and communicates nothing.
Fix: return the empty container.

```python
def tags_for(post_id: int) -> list[str]:
    return _TAGS.get(post_id, [])        # [] is already "nothing found"
```

## Interview questions

**★ Why is `str.find` returning `-1` a worse design than `re.search` returning `None`, given
that both are sentinels?**
Because `-1` is a member of the success type and `None` is not. `find` is typed `-> int`, so a
checker has nothing to complain about and cannot force anyone to test for the miss; `search`
is typed `Match[str] | None`, so `m.group(0)` without a narrowing is a static error. That
single difference is why the two classic `find` bugs exist at all: `-1` is truthy so
`if s.find(x):` is inverted, and `-1` is a legal index so a slice built from a miss silently
reads the tail of the string. The general rule is that an out-of-band sentinel is checkable
and an in-band one is not — and the standard library agrees with it in its own note, which
tells you to use the `in` operator when all you want is the membership answer.

**When should a function return an empty collection rather than `None`?**
Almost always, when the successful result is a collection. `[]` already means "nothing found",
it iterates, it has a length, and it truth-tests — so it needs no guard, while `| None` forces
`for x in (items or []):` at every call site and communicates nothing extra. Reserve the union
for the case where "there is no such collection" is genuinely a different fact from "the
collection is empty" — a post that does not exist versus a post with no tags — and even then
ask whether the honest signature raises for the first and returns `[]` for the second, which
keeps the common path free of branches entirely.

---

← Prev: [The bill every caller pays](05m-the-bill-every-caller-pays.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [The sentinel object](05o-the-sentinel-object.md)
