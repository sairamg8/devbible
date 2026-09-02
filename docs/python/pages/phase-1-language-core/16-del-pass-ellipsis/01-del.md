---
title: "`del` unbinds a name — it does not delete an object"
sidebar_label: "1 · `del`"
sidebar_position: 160
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `del` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-del-statement),
> [The `pass` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-pass-statement),
> the Library Reference
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html),
> [`object.__del__`](https://docs.python.org/3.14/reference/datamodel.html#object.__del__),
> and [`typing`](https://docs.python.org/3.14/library/typing.html).
> Target: **CPython 3.14**.

**`del x` removes a binding from a namespace. It does **not** delete the object
`x` referred to — if anything else still refers to it, the object lives on, and
only when the last reference goes does CPython's reference counting free it.
That distinction is the whole topic: `del` is not `free()`, `del` is not
`__del__`, and "I added a `del` to save memory" is a claim that is usually
false. What `del` genuinely is, is the statement form of the delete protocols —
`__delitem__` and `__delattr__` — which is where its real uses live.**

## `del` unbinds a name

```python
x = [1, 2, 3]
y = x
del x           # x is gone as a NAME
y               # [1, 2, 3] — the LIST is untouched
```

`del x` removes the binding from the namespace. The object survives as long as
anything else refers to it; only when the last reference goes does CPython's
reference counting free it. So `del` is not `free()`, and using it to "release
memory" only works when the name you delete happens to hold the last reference.

The reference describes deletion as *"recursively deleting"* each target in a
target list, from left to right, and the statement works on more than names:

```python
del x, y, z              # several names at once
del d["key"]             # a mapping entry  → calls __delitem__
del xs[0]                # a list element   → calls __delitem__
del xs[1:3]              # a slice          → __delitem__ with a slice
del obj.attr             # an attribute     → calls __delattr__
```

Each form dispatches to a different protocol method, which is worth knowing
because that is where the customisation hooks are — and because `del d["k"]`
raises `KeyError` for a missing key, exactly like `d["k"]` does, while
`d.pop("k", None)` does not.

**`del` on an unbound name raises `NameError`** (or `UnboundLocalError` inside a
function). And deleting a name makes it local for the whole function, the same
way assigning to it does:

```python
def f():
    del x         # UnboundLocalError: cannot access local variable 'x'
x = 1             # ... even though a global x exists
```

### Where `del` is actually the right tool

Genuinely useful cases are narrower than people assume:

```python
# 1. removing a mapping entry — the common one
del cache[key]

# 2. breaking a reference cycle deliberately, in a __del__-free way
del self._parent

# 3. dropping a large intermediate in a long function, before more work
data = load()           # 2 GB
summary = summarise(data)
del data                # let it be collected before the next stage
process(summary)
```

Case 3 is real but narrower than it looks: it only helps if `data` is the last
reference and the function has a lot of work left. In a short function the name
goes out of scope moments later anyway.

### `del` versus `__del__`

They are not related. `del x` unbinds a name. `__del__` is a **finaliser** the
interpreter may call when an object is about to be destroyed — and it is called
by the garbage collector, not by the `del` statement. `del x` triggers
`x.__del__()` only incidentally, when it happened to drop the last reference.

`__del__` is best avoided: its timing is not guaranteed, exceptions raised
inside it are ignored (printed to stderr, not propagated), and it may not run at
all at interpreter shutdown. A context manager or `contextlib.closing` is the
right tool for cleanup that must happen.

## Gotchas

**Symptom — `del big_list` does not reduce memory usage.** Cause: `del` unbinds
a name, it does not free an object; another reference is keeping it alive.
Fix: find the other reference — a cache, a closure, a list you appended to, a
traceback holding a frame. `sys.getrefcount` and `gc.get_referrers` are the
tools.

**Symptom — `UnboundLocalError` for a name that clearly exists at module
level.** Cause: `del x` inside a function makes `x` local for the *whole*
function, exactly as assignment does, so the global is shadowed everywhere in
it. Fix: `global x` first if you really mean the module-level name — but usually
the `del` is unnecessary.

**Symptom — `__del__` never runs, or runs at a surprising time.** Cause: it is a
finaliser invoked by the garbage collector, not by the `del` statement; its
timing is not guaranteed, it may be skipped at interpreter shutdown, and
exceptions inside it are printed rather than raised. Fix: use a context manager
or `contextlib.closing` for cleanup that must happen.

**Symptom — `del d[key]` raises `KeyError` in a cleanup path.** Cause: `del` on
a mapping behaves like `d[key]` and raises for a missing key. Fix:
`d.pop(key, None)` when absence is acceptable, or guard with `if key in d`.

**Symptom — `del` inside a loop over the same container skips elements or
raises.** Cause: this is mutation during iteration — a list's iterator holds an
index that keeps marching, and a dict raises `RuntimeError`. Fix: collect the
keys or indices first and delete afterwards; see
[Control flow](../08-control-flow/04-break-continue-and-mutation.md).

**Symptom — `del obj.attr` raises `AttributeError` for an attribute that is
visibly there.** Cause: the attribute is on the **class**, not the instance, and
`del` on an instance only removes instance attributes. Fix: delete it from the
class if that is really what you mean — and note that this is exactly the
class-attribute aliasing shape that
[topic 07](../07-assignment-and-aliasing/README.md) warns about.

**Symptom — deleting a name inside a `for` loop's body breaks the next
iteration.** Cause: `del` on the loop target is legal but the target is rebound
from the iterator at the top of each pass, so the delete achieves nothing —
except that after the final iteration the name is genuinely gone, which breaks
code that expected the loop variable to survive. Fix: do not `del` a loop
target.

## Interview questions

**★ Q: What does `del x` actually do?**
It unbinds the name `x` from its namespace. It does **not** delete the object —
if anything else references it, the object survives. Only when the last
reference disappears does CPython's reference counting free it. `del` also works
on subscripts (`del d[k]`, dispatching to `__delitem__`) and attributes
(`del o.a` → `__delattr__`).

**★ Q: Is `del x` the same as calling `x.__del__()`?**
No, and they are unrelated. `__del__` is a finaliser the garbage collector may
call when an object is about to be destroyed. `del x` only triggers it
incidentally, by happening to drop the last reference. `__del__`'s timing is not
guaranteed, exceptions inside it are swallowed, and it may not run at shutdown —
which is why a context manager is the right tool for cleanup.

**★ Q: Does `del` free memory?**
Only when the name you deleted held the last reference, in which case CPython's
refcounting frees the object immediately. Otherwise it frees nothing. "I added a
`del` to save memory" is worth checking with `gc.get_referrers` rather than
believing — the usual culprit keeping the object alive is a cache, a closure, or
a traceback holding the frame.

**Q: Which protocol methods does `del` dispatch to?**
`__delitem__` for a subscript (`del d[k]`, `del xs[0]`, `del xs[1:3]` — the last
passing a `slice`) and `__delattr__` for an attribute (`del o.a`). A bare `del
name` is not a protocol call at all; it is a namespace operation the compiler
handles.

**Q: Why does `del x` in a function shadow a global `x` everywhere in that function?**
Because `del`, like assignment, makes the name local for the entire function
scope — locality is determined at compile time from the whole body, not
line by line. So a reference to `x` *before* the `del` raises
`UnboundLocalError` even though a module-level `x` exists. `global x` opts out.

**Q: When is `del` genuinely the right tool?**
Removing a mapping entry (`del cache[key]`) is the common one. Breaking a
reference cycle deliberately is a real second. Dropping a large intermediate
before a long stretch of further work is a real third, but narrower than people
assume — it only helps if the name held the last reference and the function has
substantial work left.

---

← Prev: **PEP 8 and idiom** *(not written yet)* · Index: [`del`, `pass`, `Ellipsis`](README.md) · Next → [`pass` and `Ellipsis`](02-pass-and-ellipsis.md)
