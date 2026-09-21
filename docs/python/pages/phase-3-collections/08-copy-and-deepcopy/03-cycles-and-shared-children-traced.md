---
title: "Cycles terminate because each kind of container puts its empty copy into the memo before it copies a child — lists and dicts at once, instances after their constructor call, tuples by a retrofit — and the same rule makes the copy have the same reference shape as the original, including the shapes you built by accident"
sidebar_label: "03 · Cycles and shared children"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against the [`copy` documentation](https://docs.python.org/3.14/library/copy.html) and [`Lib/copy.py` at v3.14.7](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py). Documentation- and source-validated — **no sandbox run**; each trace is read from the source, and each `assert` states what that reading implies.

**The documentation says the memo lets `deepcopy` avoid "a recursive loop". What actually ends a loop is a timing rule in the source: a container must be *in the memo* before the recursion reaches the reference that leads back to it. `_deepcopy_list` and `_deepcopy_dict` write `memo[id(x)] = y` as their first act; `_reconstruct` writes it right after the constructor call and before the object's state is copied; `_deepcopy_tuple` cannot, because a tuple has to be built from finished elements, and gets a retrofit instead. Each timing produces the same guarantee — the copy has the same pattern of "this is that" as the original — and the same guarantee is why `deepcopy` faithfully reproduces a structure you built wrong.**

## Lists and dicts: registered first

```python
import copy

loop = [1, 2]
loop.append(loop)               # loop[2] is loop

clone = copy.deepcopy(loop)

assert clone is not loop
assert clone[2] is clone        # the cycle is reproduced, not unrolled
```

`_deepcopy_list` starts with `y = []` and `memo[id(x)] = y`. When the loop reaches `loop[2]`, which is `loop` itself, `deepcopy(loop, memo)` finds the entry and returns `y`, so `y.append(y)`. A dict works the same way (`_deepcopy_dict`: `y = {}`, then `memo[id(x)] = y`, then the items).

## Instances: registered after `func(*args)`, before the state

A cycle through objects is the common case in application code — a manager who has reports who have a manager:

```python
import copy


class Employee:
    def __init__(self, name):
        self.name = name
        self.manager = None
        self.reports = []

    def add_report(self, employee):
        employee.manager = self
        self.reports.append(employee)


lead = Employee("Grace")
lead.add_report(Employee("Ada"))
lead.add_report(Employee("Alan"))

org = copy.deepcopy(lead)

assert org is not lead
assert org.reports[0].manager is org
assert org.reports[1].manager is org
assert org.reports[0] is not lead.reports[0]
```

The order inside `_reconstruct` is what matters:

```python
    y = func(*args)
    if deep:
        memo[id(x)] = y

    if state is not None:
        if deep:
            state = deepcopy(state, memo)
```

The new, empty `Employee` (`y`) is created by `func(*args)` and recorded; only then is the instance's `__dict__` deep-copied. By the time the traversal reaches `reports[0].manager` — which is `lead` — the memo already maps `id(lead)` to `y`. If the memo write came after the state copy, that lookup would miss, start copying `lead` again, and recurse until `RecursionError`. It is the reason a hook must register the object before it copies anything (the [copy-hooks chunk in phase 1](../../phase-1-language-core/07-assignment-and-aliasing/08c-copy-hooks-and-uncopyable.md) gives the rule; this is the code it comes from).

## Tuples: a retrofit

A tuple cannot be created empty and filled later, so `_deepcopy_tuple` cannot register a placeholder. The source says so:

```python
    y = [deepcopy(a, memo) for a in x]
    # We're not going to put the tuple in the memo, but it's still important we
    # check for it, in case the tuple contains recursive mutable structures.
    try:
        return memo[id(x)]
    except KeyError:
        pass
```

The situation it handles is a tuple that is reachable from one of its own elements:

```python
import copy

holder = ([],)
holder[0].append(holder)          # the list inside the tuple contains the tuple

clone = copy.deepcopy(holder)

assert clone is not holder
assert clone[0][0] is clone
```

Reading the calls in order: `deepcopy(holder)` enters `_deepcopy_tuple`, whose comprehension copies the list; `_deepcopy_list` registers the new list and reaches the tuple again; a *second* `_deepcopy_tuple` for the same tuple runs, finds the list in the memo, builds `(new_list,)`, and the `deepcopy` wrapper records that tuple in the memo. When the first call's comprehension finishes, it checks `memo[id(x)]`, finds the tuple the inner call built, and returns *that one* — so the list points at the tuple the caller receives. Without the check the outer call would return a second, different tuple and the cycle would point at the wrong one.

## Shared children: copied once

The memo is also how a diamond keeps its shape:

```python
import copy

price_list = {"pen": 3, "ink": 7}
store_a = {"name": "A", "prices": price_list}
store_b = {"name": "B", "prices": price_list}
chain = {"stores": [store_a, store_b]}

clone = copy.deepcopy(chain)

first, second = clone["stores"]
assert first["prices"] is second["prices"]
assert first["prices"] is not price_list
```

You can count the copies with a probe. The hook returns a new object each time it runs, and the class counts the runs:

```python
import copy


class Probe:
    copies = 0

    def __deepcopy__(self, memo):
        Probe.copies += 1
        return Probe()


shared = Probe()
graph = [shared, shared, {"again": shared}]
clone = copy.deepcopy(graph)

assert Probe.copies == 1
assert clone[0] is clone[1] is clone[2]["again"]
```

`deepcopy` records the result of the hook in the memo after the hook returns, so the second and third references are memo hits and the hook runs once — the technique is useful whenever you need to prove that a structure is not being copied more often than you think.

## The copy has the same shape — including the accidental shape

Everything above is one guarantee: whatever was the same object in the original is the same object in the copy. That includes aliasing you did not mean to create:

```python
import copy

grid = [[0] * 3] * 3            # three references to ONE row

clone = copy.deepcopy(grid)

assert clone[0] is clone[1] is clone[2]     # still one row, referenced three times
clone[0][0] = 9
assert clone[2][0] == 9
```

`deepcopy` will not repair a structure built with `[row] * n`; it reproduces it faithfully. Build the rows separately (`[[0] * 3 for _ in range(3)]`) — the mechanism is in [phase 1's repetition chunk](../../phase-1-language-core/07-assignment-and-aliasing/03b-repetition-and-shared-refs.md) — and only then copy.

The other direction is equally exact: two objects that are *equal* but distinct in the original stay two objects in the copy. Sharing is preserved by identity, never inferred from equality.

## Gotchas

**★ Symptom: a deep-copied grid, table or template still has rows that change together.** Cause: the original was built with `[row] * n` or a shared `dict.fromkeys(keys, [])` value, and the memo reproduces one object referenced many times. Fix: repair the construction, not the copy.

```python
rows = [[0] * 3 for _ in range(3)]
clone = copy.deepcopy(rows)
```

**★ Symptom: `assert clone == original` fails to terminate normally, or a test that compares cyclic structures is unusable.** Cause: comparison has no memo; comparing two cyclic structures pairs the same nodes again and again. Fix: check the shape by identity along the cycle instead of comparing the whole structure.

```python
def assert_same_cycle_shape(original, clone):
    assert clone is not original
    assert clone.reports[0].manager is clone
    assert original.reports[0].manager is original
```

**Symptom: a `__deepcopy__` runs more than once for an object the graph references several times.** Cause: it does not. The wrapper memoizes the hook's result, so later references are hits — *unless* the hook returned `self` (`y is x` is never memoized) or the references reach it through different `id`s, meaning they are different objects. Fix: count with a probe before assuming.

**Symptom: `RecursionError` from a custom `__deepcopy__` on a structure that contains a cycle.** Cause: the hook copies children before registering its own new object in the memo, so the path back to it starts a second copy. Fix: `memo[id(self)] = clone` before any recursion.

```python
import copy


class Chain(list):
    def __deepcopy__(self, memo):
        clone = type(self)()
        memo[id(self)] = clone           # before any recursion
        clone.extend(copy.deepcopy(item, memo) for item in self)
        return clone
```

**Symptom: two equal-but-distinct objects were expected to become one shared object after a deep copy.** Cause: sharing follows identity; `deepcopy` preserves shape, it does not normalise it. Fix: intern explicitly (a dict keyed by value) if you want them shared.

```python
def intern_by_value(items, table=None):
    table = {} if table is None else table
    return [table.setdefault(item, item) for item in items]
```

## Interview questions

**★ How does `deepcopy` terminate on a self-referential structure? Where is the memo written for each kind of container?**
By writing the container's copy into the memo before copying any child, so the path back to it is a hit. `_deepcopy_list` and `_deepcopy_dict` do it as their first statement. `_reconstruct` does it after `func(*args)` creates the empty instance and before it deep-copies the state. Tuples cannot be created empty, so `_deepcopy_tuple` copies its elements first and then checks whether a nested call already produced a copy of this tuple.

**★ Why does `_deepcopy_tuple` re-check the memo after copying its elements?**
Because a tuple can be reachable from one of its own elements. The nested copy of that element reaches the tuple again and, finding no memo entry, builds a second copy and records it. When the outer call finishes copying its elements it looks the tuple up, finds the inner one, and returns it, so the copied element points at the tuple the caller receives rather than at an orphan.

**★ After `deepcopy`, does the copy have the same aliasing structure as the original?**
Yes, exactly: what was one shared object is one shared object, and what were separate objects stay separate. That includes accidental aliasing such as `[row] * 3`, which `deepcopy` reproduces rather than fixes.

**How would you test that a shared child is copied only once?**
Give the child a `__deepcopy__` that increments a counter and returns a new object, build a structure that references the child several times, copy it, and assert the counter is one and the copies are identical objects. The wrapper memoizes the hook's result, so only the first reference runs the hook.

**Does `deepcopy` make the copy share anything with the original?**
Only objects that copy to themselves — atomic types, enum members, `Decimal`, and anything whose hook returns `self` — and any object you pre-seeded into the memo. Everything else the graph reaches is a new object.

---

← [02b · The memo as an API](02b-the-memo-as-an-api.md) · [Topic index](README.md) · Next → [03b · Containers built from their children](03b-containers-built-from-their-children.md)
