---
title: "`s |= t` is an assignment statement that calls a method first — so it makes the name local, mutates a class-level set before storing it on the instance, writes back to a tuple slot or a read-only property after the mutation already succeeded, and reads a dict key before doing any work"
sidebar_label: "3f · Augmented assignment is an assignment"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the language reference —
> [augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements),
> [assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)
> — the [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html) mutable-default rule,
> and the [Programming FAQ](https://docs.python.org/3.14/faq/programming.html) (the
> `a_tuple[i] += ['item']` and `UnboundLocalError` entries). Split out of
> [3e · The in-place forms](03e-the-in-place-forms.md) on a concept boundary.
> Documentation-verified — **no sandbox run, no program output**.

**[3e](03e-the-in-place-forms.md) is about the operation half of `s |= t`: on a `set` it mutates the
existing object. This page is about the other half. The reference says an augmented assignment
*"assigns the result to the original target"* — so `|=` inherits every rule of assignment, and each
rule is a bug that `s.update(t)`, a plain method call, cannot have.**

## Augmented assignment is an assignment

`s.update(t)` is a method call. `s |= t` is an assignment statement that happens to call a method
first. Four bugs follow from the second half.

**It makes the name local.** Any assignment to a name inside a function makes that name local to the
whole function:

> *"This is because when you make an assignment to a variable in a scope, that variable becomes local
> to that scope and shadows any similarly named variable in the outer scope."* —
> [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#why-am-i-getting-an-unboundlocalerror-when-the-variable-has-a-value)

So a module-level `SEEN = set()` updated with `SEEN |= batch` inside a function raises
`UnboundLocalError` at that line, while `SEEN.update(batch)` in the same place works — it only reads
the name. A closure hits the same rule one level in: a nested function that does `seen |= {x}` on
its enclosing function's `seen` makes `seen` local to itself, and `seen.add(x)` does not.

**It writes the result back to the target** — and the write can fail after the mutation succeeded.
The FAQ explains it for a list in a tuple and says the discussion *"applies in general when augmented
assignment operators are applied to elements of a tuple that point to mutable objects"*:

> *"The `__iadd__()` succeeds, and thus the list is extended, but even though `result` points to the
> same object that `a_tuple[0]` already points to, that final assignment still results in an error,
> because tuples are immutable."* — [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#why-does-a-tuple-i-item-raise-an-exception-when-the-addition-works)

With a set, `pair[0] |= {"x"}` adds `"x"` to the set inside the tuple **and** raises
`TypeError: 'tuple' object does not support item assignment`. The same shape hits a read-only
property: `post.tags |= {"python"}` calls the getter, mutates the set it returned, then tries to
assign through a property with no setter and raises `AttributeError` — with the tag already added.

**It writes to the instance, whatever it read.** Attribute targets carry the ordinary assignment
caveat — *"For targets which are attribute references, the same caveat about class and instance
attributes applies as for regular assignments"* — and that caveat is:

> *"The left-hand side target `a.x` is always set as an instance attribute, creating it if necessary.
> Thus, the two occurrences of `a.x` do not necessarily refer to the same attribute: if the
> right-hand side expression refers to a class attribute, the left-hand side creates a new instance
> attribute as the target of the assignment"* —
> [assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)

With `+=` on an integer that is harmless — the class value is read, a new int is stored on the
instance. With `|=` on a class-level set it is not: the read finds the **class's** set, `__ior__`
mutates that shared object in place, and only then is the same object stored as an instance
attribute. Every instance of the class now carries the tag:

```python
class Post:
    tags: set[str] = set()          # a class attribute: one set shared by every Post

    def tag(self, name: str) -> None:
        self.tags |= {name}         # mutates Post.tags, then binds self.tags to that same object
```

The plain spelling would have been safe by accident — `self.tags = self.tags | {name}` builds a new
set and gives this instance its own — but the fix is to stop sharing the set:

```python
class Post:
    def __init__(self) -> None:
        self.tags: set[str] = set()  # one set per instance

    def tag(self, name: str) -> None:
        self.tags.add(name)
```

A `@dataclass` refuses the class-level version outright: a `set()` default is unhashable, and the
generated class raises `ValueError` at definition time, pointing you at
`field(default_factory=set)` — the same fix, enforced.

**It reads the target first.** The reference spells out the order:

> *"Unlike normal assignments, augmented assignments evaluate the left-hand side before evaluating
> the right-hand side. For example, `a[i] += f(x)` first looks-up `a[i]`, then it evaluates `f(x)`
> and performs the addition, and lastly, it writes the result back to `a[i]`."* —
> [augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements)

So a missing key fails before any work — `index[word] |= fetch_ids(word)` raises `KeyError` for a
word not yet in the dict, and `fetch_ids` is never called. Use a container that creates the set on
demand:

```python
from collections import defaultdict

def build_index(docs: dict[int, str]) -> dict[str, set[int]]:
    index: defaultdict[str, set[int]] = defaultdict(set)
    for doc_id, text in docs.items():
        for word in text.split():
            index[word].add(doc_id)        # a method call: no write-back, no KeyError
    return dict(index)
```

## Gotchas

**★ Symptom: `UnboundLocalError` from `SEEN |= batch` inside a function, although `SEEN` is defined at
module level.** Cause: augmented assignment is an assignment, so `SEEN` is local to the function.
The same happens to a closure's variable in a nested function. Fix: call the method, which only
reads the name.

```python
SEEN: set[str] = set()

def record(batch: list[str]) -> None:
    SEEN.update(batch)
```

**★ Symptom: tagging one post tags every post.** Cause: `tags` is a class attribute holding one
set, and `self.tags |= {name}` reads the class's set, mutates it in place, and only then stores it on
the instance. Fix: give each instance its own set in `__init__` (or `field(default_factory=set)` in a
dataclass) and mutate with a method — the second `Post` above.

```python
from dataclasses import dataclass, field

@dataclass
class Post:
    title: str
    tags: set[str] = field(default_factory=set)
```

**Symptom: `TypeError: 'tuple' object does not support item assignment`, and the set inside the
tuple has changed anyway.** Cause: `pair[0] |= extra` mutates the set, then the write-back into the
tuple fails. Fix: call the method on the element.

```python
pair[0].update(extra)
```

**Symptom: `AttributeError` from `post.tags |= {"python"}`, and the tag is present afterwards.**
Cause: the getter returned the internal set, `__ior__` mutated it, and the assignment through a
setter-less property failed. Fix: mutate through the method — `post.tags.add("python")` — or give the
class an explicit mutator and stop exposing the internal set.

**Symptom: `KeyError` from `index[word] |= {doc_id}` on the first document containing a word.**
Cause: augmented assignment reads the target before it operates. Fix: `defaultdict(set)` and
`add()` — `build_index` above.

## Interview questions

**★ Why can `pair[0] |= {"x"}` both change the set and raise?**
Augmented assignment is a method call followed by an assignment to the original target. The call —
`set.__ior__` — succeeds and mutates the set in place. The assignment back into `pair[0]` then fails
because a tuple does not support item assignment. The Programming FAQ walks through exactly this
for a list and `+=`, and says it *"applies in general"* to augmented assignment on tuple elements
that point to mutable objects.

**★ A class declares `tags = set()` at class level and a method does `self.tags |= {name}`. What
happens, and why would `self.tags = self.tags | {name}` have behaved differently?**
The attribute read finds no instance attribute and falls through to the class attribute — the one set
shared by every instance. `|=` mutates that set in place, then assigns it to `self.tags`, creating an
instance attribute that points at the same shared object. Every instance sees the new tag. The
plain spelling reads the same class set but builds a new one and stores that on the instance, so
the class set is untouched. The reference's caveat is that the target *"is always set as an
instance attribute"*, while the read may find a class attribute — `|=` turns that mismatch into a
shared mutation.

**Why does `SEEN |= batch` raise `UnboundLocalError` inside a function when `SEEN.update(batch)`
does not?**
Because `|=` is an assignment, and any assignment to a name in a function makes the name local for
the whole function. The read half of the augmented assignment then finds a local with no value.
`SEEN.update(batch)` only looks the name up, so it finds the module-level set.

---

← Prev: [The in-place forms](03e-the-in-place-forms.md) · [Topic index](README.md) · Next → [Subclassing set does not intercept mutation](03g-subclassing-set-does-not-intercept-mutation.md)
