---
title: "a = new points one name at a different object and leaves every other holder on the old one; a[:] = new rewrites the object itself, so every name, attribute, importer and caller that shares it sees the change — choose by who must see it, never by habit"
sidebar_label: "08c · Slice assignment versus rebinding"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)
> and [Augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements),
> [An Informal Introduction: Lists](https://docs.python.org/3.14/tutorial/introduction.html#lists),
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> [Thread safety guarantees](https://docs.python.org/3.14/library/threadsafety.html).
> Documentation-verified — **no sandbox run, no program output**.

**`items = fresh` and `items[:] = fresh` leave `items` holding the same values and do opposite
things. The first is a *name binding*: it changes which object one name in one namespace refers
to, and every other reference — the caller's variable, an attribute on another object, the name a
second module imported, a closure — still points at the old list. The second is a *slice
assignment*: no name moves; the one list object is rewritten in place, so every holder sees the new
contents. Most "my update did nothing" bugs are a rebinding where a mutation was meant; most "who
changed my data" bugs are the reverse. There is no default that is right — the question is always
who else holds the list and whether they should see the change. [08](08-slice-assignment.md) is
the mechanics of the slice assignment itself.**

## Two targets, two operations

The language reference defines the two targets separately. A name:

> *"If the name does not occur in a `global` or `nonlocal` statement in the current code block:
> the name is bound to the object in the current local namespace."* · *"The name is rebound if it
> was already bound."*

A slicing:

> *"If the target is a slicing: The primary expression should evaluate to a mutable sequence object
> (such as a list). The assigned object should be iterable. The slicing's lower and upper bounds
> should be integers; if they are `None` (or not present), the defaults are zero and the
> sequence's length. If either bound is negative, the sequence's length is added to it.  The
> resulting bounds are clipped to lie between zero and the sequence's length, inclusive.  Finally,
> the sequence object is asked to replace the slice with the items of the assigned sequence."* —
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)

"Bound … in the current local namespace" versus "the sequence object is asked to replace". The
tutorial states the consequence for the name form: *"Simple assignment in Python never copies
data. When you assign a list to a variable, the variable refers to the *existing list*. Any changes
you make to the list through one variable will be seen through all other variables that refer to
it."* Rebinding is not such a change — it is a variable starting to refer to a different list.

```python
original = ["a", "b"]
alias = original

alias = ["x", "y"]                  # rebinding: only `alias` moves
assert original == ["a", "b"]

alias = original
alias[:] = ["x", "y"]               # slice assignment: the shared object changes
assert original == ["x", "y"]
assert alias is original
```

The general theory of names and objects is
[What `=` actually does](../../phase-1-language-core/07-assignment-and-aliasing/01-what-assignment-does.md)
and the full list of target kinds is
[Targets, binding forms and `del`](../../phase-1-language-core/07-assignment-and-aliasing/01b-assignment-targets-and-del.md);
this page is the slice case.

## The same values, a different identity

Each pair below ends with `items` equal to the same values. Only the in-place member of each pair
keeps `id(items)`, and so only it is seen by other holders:

| Rebinds `items` | Mutates the list in place |
|---|---|
| `items = []` | `items[:] = []` · `del items[:]` · `items.clear()` |
| `items = sorted(items)` | `items.sort()` · `items[:] = sorted(items)` |
| `items = [x for x in items if keep(x)]` | `items[:] = [x for x in items if keep(x)]` |
| `items = items[::-1]` | `items.reverse()` · `items[:] = items[::-1]` |
| `items = items + more` | `items += more` · `items.extend(more)` · `items[len(items):] = more` |

The last row is the one people get wrong. The reference says of augmented assignment: *"when
possible, the actual operation is performed *in-place*, meaning that rather than creating a new
object and assigning that to the target, the old object is modified instead"* — so `items += more`
mutates a list, and `items = items + more` builds a new one
([Augmented assignment](../../phase-1-language-core/07-assignment-and-aliasing/04-augmented-assignment.md)).
But `+=` is still a binding statement: it stores the result back into the name, which matters in
the next section.

## Where the other holders are

Rebinding only ever affects one name in one namespace. Every one of these holds its own reference
and is untouched by it:

- **The caller.** A function receives the caller's object, not the caller's variable; rebinding
  the parameter changes nothing outside
  ([Function arguments](../../phase-1-language-core/07-assignment-and-aliasing/05-function-arguments.md)).
- **Another module.** `from settings import ALLOWED_HOSTS` copies the *reference* into the
  importer's namespace. Rebinding `settings.ALLOWED_HOSTS` later leaves the importer's name on the
  old list.
- **Another object.** A dispatcher constructed with `Dispatcher(handlers)` stores the list; the
  application rebinding its own `handlers` variable does not reach the dispatcher's attribute.
- **An iterator in flight.** A loop over `items` holds the list object; rebinding `items` inside
  the loop does not change what the loop walks, but a slice assignment does
  ([Mutating while iterating](../01-list-internals/11-mutating-while-iterating.md)).

A module-level list updated from inside a function shows both halves. Slice assignment binds no
name, so it needs no `global` statement and reaches every importer:

```python
# settings.py
ALLOWED_HOSTS = ["api.example.com"]


def reload_allowed_hosts(new_hosts):
    ALLOWED_HOSTS[:] = new_hosts        # no `global` needed: no name is bound
```

```python
# middleware.py
from settings import ALLOWED_HOSTS


def is_allowed(host: str) -> bool:
    return host in ALLOWED_HOSTS         # sees reloads, because the list object is the same
```

Had `reload_allowed_hosts` said `global ALLOWED_HOSTS; ALLOWED_HOSTS = list(new_hosts)`,
`middleware` would check against the startup list forever. And `ALLOWED_HOSTS += new_hosts` inside
the function *without* `global` raises `UnboundLocalError`: `+=` binds the name, which makes it
local to the function for the whole body, and the read half of `+=` then finds the local unbound.

## When rebinding is the right choice

Mutation in place is right when every holder is supposed to track one live collection. Rebinding
is right when holders are supposed to keep what they were given:

- **Snapshots handed out.** A cache that returns its list to callers must not later rewrite that
  list under them; build the new list and rebind the cache's attribute.
- **Publishing to concurrent readers.** Rebinding an attribute replaces one reference: a reader
  that already fetched the old list keeps a complete old list, and the next fetch gets a complete
  new one. The 3.14 thread-safety page does call list slice assignment safe — *"assigning to a list
  slice with `lst[i:j] = iterable` is safe to call from multiple threads, but `iterable` is only
  locked when it is also a `list` (but not its subclasses)"* — but I could not find it promising
  what a reader iterating the same list concurrently observes. Build-then-rebind needs no such
  promise ([Thread safety under free threading](../01-list-internals/11c-thread-safety-under-free-threading.md)).
- **Defaults and shared templates.** Mutating a list that came from a default argument or a
  module-level template changes it for every later user
  ([The mutable default argument](../../phase-1-language-core/07-assignment-and-aliasing/06-mutable-default-argument.md)).

```python
class HostRegistry:
    def __init__(self, hosts):
        self._hosts = list(hosts)

    def snapshot(self) -> list[str]:
        return self._hosts                   # callers get a list that will never change under them

    def replace_all(self, hosts) -> None:
        self._hosts = list(hosts)            # rebind: earlier snapshots keep their contents
```

## Gotchas

**★ Symptom: `reset(queue)` returns, and the caller's queue still holds every job.** Cause: the
function did `queue = []`, which rebinds its local parameter and leaves the caller's list alone.
Fix: mutate the object the caller passed.

```python
def reset(queue: list) -> None:
    queue.clear()                  # or: del queue[:]  /  queue[:] = []
```

**★ Symptom: after a config reload, the logs show the new allowed hosts but requests are still
checked against the old ones.** Cause: the reload rebinds `settings.ALLOWED_HOSTS`; modules that
ran `from settings import ALLOWED_HOSTS` keep a reference to the startup list. Fix: update the
shared list in place — or make readers look the attribute up at call time.

```python
ALLOWED_HOSTS[:] = new_hosts                  # in settings.py

import settings                               # or, in the reader:
allowed = host in settings.ALLOWED_HOSTS
```

**★ Symptom: a report that took a "snapshot" of the current rows changes while it is being
rendered.** Cause: the owner refreshes with `self._rows[:] = fresh`, rewriting the very list the
report is holding. Fix: rebind to a new list, so earlier holders keep theirs.

```python
self._rows = list(fresh)
```

**★ Symptom: `UnboundLocalError` from `ALLOWED_HOSTS += extra` inside a function, though
`ALLOWED_HOSTS` is a module global.** Cause: augmented assignment binds the name, so the compiler
treats it as a local for the whole function, and the read half finds nothing. Fix: mutate without
binding a name.

```python
def add_hosts(extra):
    ALLOWED_HOSTS.extend(extra)          # or: ALLOWED_HOSTS[len(ALLOWED_HOSTS):] = extra
```

**Symptom: plugins loaded after startup never receive events.** Cause: the dispatcher was built
with `Dispatcher(handlers)` and stored that list; the loader later rebinds its own `handlers`
variable to a new list. Fix: extend the list the dispatcher holds, or give the dispatcher a method
that replaces its list explicitly.

```python
handlers[:] = load_plugins()
```

**Symptom: a function with `def collect(found=[])` returns results from earlier calls.** Cause:
`found[:] = …` or `found.extend(…)` mutates the one default list created when `def` ran. Fix: use
the `None` sentinel and create the list per call.

```python
def collect(found=None):
    found = [] if found is None else found
```

**Symptom: removing items with `items[i:i + 1] = []` inside `for i, item in enumerate(items)`
skips the element after each removal.** Cause: the loop walks the very list being shrunk, by
index. Fix: compute the result, then assign it once, after the loop.

```python
items[:] = [item for item in items if not is_stale(item)]
```

## Interview questions

**★ What is the difference between `a = b`, `a = b[:]` and `a[:] = b`?**
`a = b` binds the name `a` to the same object as `b` — no copy, two names for one list. `a = b[:]`
builds a shallow copy of `b` and binds `a` to it — two lists, independent at the top level.
`a[:] = b` binds nothing: it replaces the contents of the list `a` already refers to with the items
of `b`, so `a` keeps its identity, and everyone else holding that list sees `b`'s items. The first
two change what `a` means; the third changes the object `a` means.

**★ Why doesn't `items = []` inside a function clear the caller's list, while `items.clear()`
does?**
The parameter is a local name bound to the caller's object. `items = []` rebinds that local name
to a new empty list — the caller's variable still refers to the original, unchanged. `items.clear()`,
`del items[:]` and `items[:] = []` all operate on the object itself, which the caller shares. The
rule of thumb: assignment to a bare name never affects any other name; operations on the object
affect every name bound to it.

**When would you deliberately rebind instead of mutating in place?**
When other holders should keep what they already have. A cache or registry that hands out its list
should replace its internal reference rather than rewrite a list callers may be iterating. Code
publishing new data to other threads can build the complete new list and then swap one reference, so
a reader sees either the old list or the new one — the 3.14 docs call slice assignment itself
thread-safe but do not describe what a concurrent reader of the same list observes. Mutation is
right when every holder is meant to follow one live collection, such as a shared allow-list.

**What are the ways to empty a list, and which of them do other references see?**
`a.clear()`, `del a[:]` and `a[:] = []` all empty the list object, and the documentation defines
`clear()` as *"equivalent to writing `del sequence[:]`"*; every reference to the list sees it
empty. `a = []` empties nothing: it points `a` at a new empty list and leaves the old one, with its
contents, to anyone else who holds it.

**Does `a += b` rebind `a` or mutate it?**
Both, in a sense. For a list, `+=` calls the in-place operation, which extends the existing object —
the reference says the operation is performed in place *"when possible"* — so every holder sees the
new items. It then binds the result, the same object, back to the name. That binding is why `+=` on
a global inside a function without `global` raises `UnboundLocalError`, while `a.extend(b)` or
`a[len(a):] = b` does not. For an immutable value such as a tuple or a string, `+=` creates a new
object and the binding is a real rebinding.

---

← Prev: [08b · Slice bounds and target types](08b-slice-bounds-and-types.md) · [Topic index](README.md)
