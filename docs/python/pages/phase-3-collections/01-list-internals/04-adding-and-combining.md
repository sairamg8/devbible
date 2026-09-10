---
title: "`append`, `extend`, `+` and `+=` are four different operations, and the two that look most alike — `+` and `+=` — differ in what they accept and in who sees the result"
sidebar_label: "04 · Adding and combining"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types)
> and [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> the tutorial [More on Lists](https://docs.python.org/3.14/tutorial/datastructures.html#more-on-lists),
> and CPython's
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_inplace_concat`, `list_concat`, `list_extend_fast`).
> Documentation-validated; **no sandbox run, no timings**.
> Target: **CPython 3.14** (3.14.7).

**`append` adds one object. `extend` iterates its argument and adds each item. `+`
builds a brand-new list and demands that both operands be lists. `+=` is `extend`
wearing an operator's clothes: it mutates in place and accepts any iterable at all.
The last two are the pair that hurts, because `xs = xs + ys` and `xs += ys` look
like the same statement and differ in two ways that both surface as production
bugs — what they accept, and whether everyone else holding that list sees the
change.**

## The four operations, precisely

```python
xs = [1, 2]
xs.append([3, 4])     # xs is [1, 2, [3, 4]]  — ONE new element, which is a list

xs = [1, 2]
xs.extend([3, 4])     # xs is [1, 2, 3, 4]    — iterated, two new elements

xs = [1, 2]
ys = xs + [3, 4]      # ys is a NEW list; xs is untouched

xs = [1, 2]
xs += [3, 4]          # xs is [1, 2, 3, 4]    — the SAME list object, mutated
```

The documentation defines the methods in terms of slice assignment, which is a
useful way to hold them in your head:

> *"`sequence.append(value, /)` — Append value to the end of the sequence. This is
> equivalent to writing `seq[len(seq):len(seq)] = [value]`."*

> *"`sequence.extend(iterable, /)` — Extend sequence with the contents of iterable.
> For the most part, this is the same as writing
> `seq[len(seq):len(seq)] = iterable`."*

Note the brackets in the first one and their absence in the second. `append` wraps;
`extend` splices.

## `+=` is `extend`, not `+`

This is not an analogy; it is the implementation. `list.__iadd__` is
`list_inplace_concat`, and its whole body is:

```c
list_inplace_concat(PyObject *_self, PyObject *other)
{
    PyListObject *self = (PyListObject *)_self;
    if (_list_extend(self, other) < 0) {
        return NULL;
    }
    return Py_NewRef(self);
}
```

Two consequences follow immediately, and both are visible in the documentation's own
wording.

### 1 · `+=` accepts any iterable; `+` does not

The mutable-sequence table says *"In the table `s` is an instance of a mutable
sequence type, **`t` is any iterable object**"* and then gives:

> *"`s += t` — extends s with the contents of t (for the most part the same as
> `s[len(s):len(s)] = t`)"*

The common-sequence table, where `+` lives, says *"`s` and `t` are **sequences of
the same type**"*. So:

```python
xs = [1, 2]
xs += (3, 4)          # fine — a tuple is an iterable
xs += {5, 6}          # fine — a set is an iterable (order unspecified)
xs += "ab"            # fine, and almost never what you meant: adds 'a', 'b'

ys = [1, 2] + (3, 4)  # TypeError: can only concatenate list (not "tuple") to list
```

That last message is the literal C format string in `list_concat`:
`can only concatenate list (not "%.200s") to list`.

🔴 **`xs += "ab"` is the trap.** A string is an iterable of one-character strings, so
`+=` splices the characters in. `xs.append("ab")` adds the string; `xs += ["ab"]`
adds the string. Nothing raises.

### 2 · `+=` mutates the object every holder can see

```python
def add_defaults(options):
    options += ["--verbose"]        # mutates the CALLER's list
    return options

def add_defaults_safely(options):
    return options + ["--verbose"]  # builds a new list; caller untouched
```

The first function has a side effect that its signature does not advertise. If the
caller passed a list held elsewhere — a config, a cached value, a class attribute —
that list now has an extra element forever. Phase 1's
[Augmented assignment](../../phase-1-language-core/07-assignment-and-aliasing/04-augmented-assignment.md)
owns the general rule; the list-specific half is that `list` implements `__iadd__`,
so `+=` never rebinds to a new object.

⚠️ A subtlety worth stating exactly: `xs += ys` *does* also perform an assignment —
but to the same object `__iadd__` returned, which is `xs` itself, so the rebinding
is invisible. It becomes visible when the target is not a plain name:

```python
config = {"flags": ["-O"]}
config["flags"] += ["-g"]     # mutates the list AND re-stores it into the dict
```

For a *tuple* target that store fails, which produces the famous "raises and
mutates" behaviour Phase 1 documents in
[Raises and mutates](../../phase-1-language-core/07-assignment-and-aliasing/04b-tuple-item-raises-and-mutates.md).

## `extend` takes an iterable, and consumes it

```python
rows = []
rows.extend(cursor)              # a database cursor: iterated to exhaustion
rows.extend(x for x in source)   # a generator: consumed, and now empty
rows.extend({"a": 1})            # a dict: iterated, so this adds the KEY "a"
```

That third line is a recurring surprise. Iterating a mapping yields keys, so
`extend`ing a list with a dict appends its keys, silently. If you wanted the pairs,
say so: `rows.extend(d.items())`.

`extend` also handles the self-referencing case, and CPython comments on it in
`list_extend_fast`:

```c
    // note that we may still have self == iterable here for the
    // situation a.extend(a), but the following code works
    // in that case too.  Just make sure to resize self
    // before calling PySequence_Fast_ITEMS.
```

So `a.extend(a)` doubles `a` and terminates — it does not loop forever.

## Gotchas

### `xs += "some string"` splices characters
**Symptom.** A list of flags suddenly contains `'-'`, `'v'`, `'e'`… instead of
`'--verbose'`.
**Cause.** `+=` is `extend`, and a `str` is an iterable of one-character strings.
Nothing raises because the operation is entirely valid.
**Fix.** Wrap the string, or use `append`:

```python
flags.append("--verbose")     # clearest
flags += ["--verbose"]        # also correct — the brackets are load-bearing
```

### `append` where `extend` was meant
**Symptom.** A "flat" result list contains nested lists; downstream code raises
`TypeError` on an element that is a list.
**Cause.** `append` adds its argument as one element regardless of what it is.
**Fix.** Pick by intent, and let the plural in the variable name guide you:

```python
results.append(single_row)      # one object
results.extend(page_of_rows)    # many objects
```

### A helper that "adds defaults" mutates the caller's list
**Symptom.** A second call produces duplicated defaults; a cached config grows on
every request.
**Cause.** `options += [...]` calls `__iadd__`, which extends the caller's object.
The function signature says nothing about mutation.
**Fix.** Return a new list, and make the non-mutation explicit:

```python
def with_defaults(options):
    return [*options, "--verbose"]   # new list; caller's is untouched
```

### `extend`ing with a dict and getting the keys
**Symptom.** A list of "records" turns out to be a list of strings.
**Cause.** Iterating a mapping yields keys — that is the documented protocol, and
`extend` just iterates.
**Fix.** Say what you want:

```python
rows.extend(d.items())    # (key, value) tuples
rows.extend(d.values())   # values only
rows.append(d)            # the dict itself, as one element
```

### `extend`ing from a generator and reusing the generator
**Symptom.** The second `extend` adds nothing, with no error.
**Cause.** `extend` iterates to exhaustion, and a generator is one-shot.
**Fix.** Materialise once if you need it twice:

```python
items = list(source_generator)   # now reusable
a.extend(items)
b.extend(items)
```

### `[1, 2] + (3, 4)` raising while `xs += (3, 4)` works
**Symptom.** A refactor from `+=` to `= … + …` starts raising
`TypeError: can only concatenate list (not "tuple") to list`.
**Cause.** `+` requires *"sequences of the same type"*; `+=` is `extend` and accepts
*"any iterable object"*. They are genuinely different operations.
**Fix.** Convert explicitly, or unpack:

```python
ys = [1, 2] + list((3, 4))
ys = [*[1, 2], *(3, 4)]        # unpacking accepts any iterables
```

### `xs += set_of_things` and expecting a stable order
**Symptom.** Two runs of the same code produce lists in different orders.
**Cause.** `+=` is `extend`, which iterates — and a set has no defined order. The
Sorting HOWTO states the general fact: *"the elements contained in set types do not
have a deterministic order."*
**Fix.** Impose the order you want at the point of extension:

```python
xs.extend(sorted(set_of_things))
```

## Interview questions

**★ What is the difference between `xs = xs + ys` and `xs += ys`?**
Three differences. `+` builds a new list and rebinds the name, so nobody else's view
changes; `+=` calls `list.__iadd__`, which is literally `extend`, so the original
object is mutated and every other holder of it sees the new elements. `+` requires
both operands to be lists — the docs scope it to *"sequences of the same type"* —
while `+=` accepts *"any iterable object"*. And `+` is O(len(a) + len(b)) with a
fresh allocation, while `+=` is amortised O(len(b)) into existing capacity.

**★ Why does `xs += "abc"` not raise, and what does it do?**
Because `+=` is `extend` and a string is an iterable of one-character strings, so it
appends `'a'`, `'b'` and `'c'` as three separate elements. It is valid Python doing
exactly what it says; the mistake is in the reader's model, not the interpreter's.
The safe habit is `append` for one item and explicit brackets when using `+=`.

**When does `append` do something different from `extend`?**
Always, unless the argument is a one-element iterable of the thing you wanted.
`append` adds its argument as a single element without iterating it; `extend`
iterates and adds each item. `xs.append([1, 2])` gives one new element that is a
list; `xs.extend([1, 2])` gives two new integers.

**A function takes a list and does `items += extras`. Is that a bug?**
It is a side effect the signature does not declare, so it is at least a design
smell, and in practice it is usually a bug: the caller's list — which may be a
module-level default, a cached config or a class attribute — is permanently longer.
Return a new list (`[*items, *extras]`) unless in-place mutation is the documented
contract of the function, in which case name it that way (`extend_options`) and
return `None`.

**Does `a.extend(a)` loop forever?**
No. CPython resizes `a` first and then copies from the original item block, and its
comment names the case explicitly: *"we may still have self == iterable here for the
situation a.extend(a), but the following code works in that case too."* The result
is `a` doubled.

**Why is `config["flags"] += ["-g"]` different from `flags += ["-g"]`?**
Both call `list.__iadd__` and mutate the same list. The difference is what happens
afterwards: an augmented assignment always performs a store into its target, so the
subscript form also executes `config["flags"] = <result>`. For a dict that store
succeeds and is a harmless no-op. For a tuple or a frozen dataclass it raises —
*after* the list has already been mutated, which is why Phase 1 calls that case
"raises and mutates".

**Given a function that must not modify its argument, how do you enforce that?**
You cannot enforce it in the type system — a `Sequence[str]` annotation is not
checked at runtime and does not prevent mutation. What you can do is take a copy at
the boundary (`items = list(items)`), or make the contract structural by accepting a
tuple. Phase 1's
[Saying "don't touch mine"](../../phase-1-language-core/07-assignment-and-aliasing/05b-dont-touch-mine.md)
works through the options and what each one actually guarantees.

---

← [Partial sorts and counting](03d-partial-sorts-and-counting.md) · [Topic index](README.md) · Next → [Repetition, unpacking and lazy combination](04b-repetition-and-lazy-combination.md)
