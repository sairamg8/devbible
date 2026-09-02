---
title: "`break`, `continue`, and the list you must not modify while iterating it"
sidebar_label: "4 · `break`, `continue`, mutation"
sidebar_position: 85
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [`break`](https://docs.python.org/3.14/reference/simple_stmts.html#the-break-statement)
> and [`continue`](https://docs.python.org/3.14/reference/simple_stmts.html#the-continue-statement),
> and the Library Reference
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> and [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects).
> Target: **CPython 3.14**.

**`break` and `continue` are the easy half of this chunk. The hard half is what
happens when you change a collection while a loop is walking it — and the two
answers are different in a way that matters. A `dict` or `set` notices and
raises. A **list does not**: its iterator holds an index that, in the docs' own
words, *"will continue to march forward … even if the underlying sequence is
mutated"*, so deleting the item you are standing on shifts everything left and
the loop skips the next one. No error, half the work done, and a bug that only
shows up when two removable items happen to be adjacent.**

## `break` and `continue`

`break` terminates the innermost enclosing loop and skips its `else`.
`continue` skips the rest of the body and moves to the next item — or, per the
reference, *"with the `else` clause if there is no next item"*.

The style question they raise is nesting. `continue` as a guard clause flattens
a loop the same way an early `return` flattens a function:

```python
# nested
for row in rows:
    if row.valid:
        if row.amount > 0:
            process(row)

# flat — each rejection stated once, at the top
for row in rows:
    if not row.valid:
        continue
    if row.amount <= 0:
        continue
    process(row)
```

The flat form scales: a fourth condition adds one line rather than one
indentation level, and each `continue` reads as "this row is not our business,
and here is why". The counter-argument is that a long run of `continue`s hides
the loop's actual subject — if there are more guards than work, the guards
probably belong in a generator or a filter:

```python
def eligible(rows):
    for row in rows:
        if row.valid and row.amount > 0:
            yield row

for row in eligible(rows):
    process(row)
```

`break` has one style rule worth stating: **the loop-and-a-half.** When the exit
condition is only knowable in the middle of the body, `while True:` with a
`break` is the honest structure, not a defeat:

```python
while True:
    line = f.readline()
    if not line:
        break
    process(line)
```

That said, most instances of this shape have a better spelling — `for line in
f:`, `for block in iter(lambda: f.read(4096), b""):`, or a
[walrus](../05-truthiness/05-the-walrus-operator.md). Reach for `while True:`
when none of them fit, and make sure the `break` is unmissable.

## Mutating while iterating: two different failures

### A `dict` or `set` raises

> *"The view objects are dynamic and reflect changes to the underlying
> dictionary. When a dictionary is modified while iterating over a view,
> `RuntimeError` is raised or the iteration fails to cover all entries."*

```python
for key in cache:
    if is_stale(cache[key]):
        del cache[key]        # RuntimeError: dictionary changed size during iteration
```

Note the docs say *"or the iteration fails to cover all entries"* — the
`RuntimeError` is the common case, not a guarantee. A change that leaves the
size the same (replacing a value) does not raise, and a delete-then-insert pair
may slip through. **Do not rely on the exception to catch the mistake.**

Sets behave the same way, with `RuntimeError: Set changed size during
iteration`.

### A `list` does not raise — it silently skips

This is the dangerous one, and the docs explain exactly why:

> *"Forward and reversed iterators over mutable sequences access values using an
> index. That index will continue to march forward (or backward) even if the
> underlying sequence is mutated. The iterator terminates only when an
> `IndexError` or a `StopIteration` is encountered (or when the index drops
> below zero)."*

So the iterator is really "give me element 0, then 1, then 2…". Remove element
1 and everything shifts left; the iterator asks for element 2, which is now what
used to be element 3. The old element 2 is never seen.

```python
items = ["a", "REMOVE", "REMOVE", "b"]
for item in items:
    if item == "REMOVE":
        items.remove(item)
# items is now ["a", "REMOVE", "b"] — the second REMOVE was skipped
```

The loop looks correct, runs without error, and does half the job. It is
correct-looking enough to pass review, and it only misbehaves when two removable
items are **adjacent** — which no small test fixture contains.

Appending while iterating is the mirror image: the index keeps marching into the
items you just added, and the loop never terminates.

## The four safe patterns

```python
# 1. build a new list — usually the clearest, and the one to reach for first
items = [x for x in items if not should_remove(x)]

# 2. iterate over a copy, mutate the original
for x in list(items):          # or items[:] — the copy is what is iterated
    if should_remove(x):
        items.remove(x)

# 3. iterate backwards by index, so removals shift only what you have passed
for i in range(len(items) - 1, -1, -1):
    if should_remove(items[i]):
        del items[i]

# 4. collect first, act after
doomed = [k for k, v in cache.items() if is_stale(v)]
for k in doomed:
    del cache[k]
```

Pattern 1 is right almost every time. Note that it **rebinds** rather than
mutating, so any other name aliasing the same list still sees the old contents —
if that matters, use slice assignment to mutate in place:
`items[:] = [x for x in items if not should_remove(x)]`. That distinction
belongs to **Assignment semantics and aliasing** *(not written yet)*, and it is
the one thing pattern 1 can get wrong.

Pattern 2 has a second flaw worth knowing: `list.remove` scans from the start
and removes the **first** equal element, which is O(n) and is not necessarily
the element you are looking at. With duplicates, it removes the wrong one.

Pattern 4 is the only one that works on a `dict`, and it is the standard
spelling for dict pruning.

## `while` conditions and recomputation

A `for` evaluates its iterable once. A `while` evaluates its condition **every
time round**:

```python
while i < len(expensive()):     # calls expensive() on every iteration
while i < n:                    # hoist it
```

That is not a subtlety of the language so much as a consequence of it, but it is
the most common `while`-specific performance bug. The other is forgetting to
advance: a `while` whose body can `continue` before the increment is an infinite
loop, which is why the increment belongs at the top or the loop belongs in a
`for`.

## Gotchas

**Symptom — a loop that removes items from a list only removes about half of
them, with no error.** Cause: the list iterator holds an index that keeps
marching forward while removals shift elements left, so the item after each
removal is skipped. Fix: build a new list with a comprehension, or iterate over
a copy, or walk backwards by index. It only misbehaves for *adjacent* removable
items, which is why small fixtures do not catch it.

**Symptom — `RuntimeError: dictionary changed size during iteration`.** Cause:
adding or deleting keys while iterating a view. Fix: collect the keys first
(`doomed = [k for k, v in d.items() if …]`) and delete afterwards.

**Symptom — a dict-mutating loop does *not* raise, and the results are wrong
anyway.** Cause: the docs say `RuntimeError` is raised **or** the iteration
fails to cover all entries — the exception is not a guarantee, and a
size-preserving change does not trip it at all. Fix: never rely on the error;
use the collect-then-delete pattern.

**Symptom — a loop that appends to the list it is iterating never terminates.**
Cause: the marching index keeps reaching the newly-added items. Fix: iterate a
snapshot (`for x in list(items):`) and append to the original, or use an
explicit worklist/queue if the loop is meant to process what it produces.

**Symptom — removing by value removes the wrong duplicate.** Cause:
`list.remove(x)` removes the **first** element equal to `x`, not the one you are
standing on, and scans from the start to find it. Fix: remove by index (`del
items[i]`) or rebuild the list.

**Symptom — after `items = [x for x in items if …]`, another part of the program
still sees the old items.** Cause: the comprehension **rebinds** the name; it
does not mutate the list other references point at. Fix:
`items[:] = [x for x in items if …]` to mutate in place.

**Symptom — a `while` loop is unexpectedly slow.** Cause: the condition
recomputes something expensive on every iteration — `while i < len(query()):`.
Fix: hoist it into a variable before the loop; a `for` does this for you, which
is one more reason to prefer it.

**Symptom — a `while` loop hangs after someone adds a `continue`.** Cause: the
`continue` jumps back to the condition, skipping the increment at the bottom of
the body. Fix: increment at the top, use `for … in range(...)`, or use an
iterator — this class of bug is why `while` with a manual counter is worth
avoiding.

**Symptom — a `break` inside a `finally` makes an exception vanish.** Cause:
transferring control out of a `finally` discards any in-flight exception. Fix:
never `break`, `continue` or `return` from a `finally`. Do the cleanup there and
nothing else.

**Symptom — a loop over `dict.keys()` still raises even though you only changed
values.** Cause: you probably assigned a *new* key, not just a value — `d[k] =
v` for an absent `k` changes the size. Fix: check whether the key exists first,
or collect the insertions and apply them after the loop.

## Interview questions

**★ Q: What happens if you remove items from a list while iterating over it?**
It silently skips elements. The list iterator holds an index that, per the docs,
*"will continue to march forward … even if the underlying sequence is
mutated"* — so a removal shifts everything left and the next element is never
visited. No exception is raised. It only goes wrong when removable items are
adjacent, which is why it survives testing.

**★ Q: And if you do the same to a dict?**
`RuntimeError: dictionary changed size during iteration` — usually. The docs say
`RuntimeError` is raised *"or the iteration fails to cover all entries"*, so the
exception is not guaranteed, and a change that preserves the size does not raise
at all. Collect the keys to delete first, then delete in a second loop.

**★ Q: What is the safest way to filter a list in place?**
`items[:] = [x for x in items if keep(x)]`. The comprehension builds the new
contents without mutating during iteration, and the slice assignment mutates the
original object so other references see the change. Plain `items = [...]` is
also correct but rebinds the name, which is a different thing and a real source
of aliasing bugs.

**Q: When is `while True:` with a `break` the right structure?**
When the exit condition is only knowable partway through the body — the
"loop-and-a-half". It is honest, not a defeat. But check first whether `for x in
xs:`, `for block in iter(callable, sentinel):` or a walrus condition expresses
it, because usually one of them does.

**Q: Is `continue` bad style?**
No — as a guard clause it flattens a loop the way an early `return` flattens a
function, and it scales better than nesting. It becomes a smell when the guards
outnumber the work, at which point the filtering belongs in a generator function
or a comprehension and the loop should just do its job.

**Q: Does `continue` skip a loop's `else` clause?**
No, only `break` does. The reference says `continue` proceeds to the next item
*"or with the `else` clause if there is no next item"* — so a `continue` on the
final iteration lands in the `else`.

**Q: Why is `while i < len(rows):` worse than `for row in rows:` beyond style?**
Three reasons: the condition re-evaluates `len` every iteration; the increment
is manual and a `continue` can skip it, hanging the loop; and it requires a
sized, indexable object, so it cannot walk a generator or a file. The `for`
evaluates its iterable exactly once and cannot lose track of its position.

**Q: `list.remove(x)` inside a loop — what is wrong with it besides the skipping?**
It is O(n) per call, because it scans from the start, and it removes the *first*
element equal to `x` rather than the one you are looking at — so with duplicates
it removes the wrong object. Remove by index, or rebuild the list.

---

← Prev: [Nested loops](03b-nested-loops.md) · Index: [Control flow](README.md) · Next → **Comprehensions** *(not written yet)*
