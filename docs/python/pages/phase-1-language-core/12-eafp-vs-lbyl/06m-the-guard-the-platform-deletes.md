---
title: "The interpreter can delete your check and the filesystem can contradict it — -O removes assert statements from the program entirely, and os.access documents three separate reasons its answer may be wrong before you act on it"
sidebar_label: "06m · The guard the platform deletes"
sidebar_position: 154
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `assert` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-assert-statement),
> the [command-line options](https://docs.python.org/3.14/using/cmdline.html#cmdoption-O)
> (`-O`, `-OO`, `PYTHONOPTIMIZE`),
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access) (both notes, the
> real-vs-effective uid paragraph, `effective_ids` and `os.supports_effective_ids`), and
> [`os.path.exists`](https://docs.python.org/3.14/library/os.path.html#os.path.exists).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06j](06j-ambient-state-the-guard-cannot-see.md) covered ambient state you configure:
`decimal` contexts and warning filters. This chunk is the harder half, where the ambient
state belongs to the interpreter or the operating system and your code has no say. Under
`-O` the compiler emits *no code at all* for an `assert`, so a handler for `AssertionError`
guards a statement that is not in the program. And `os.access` documents three independent
reasons its answer may already be wrong — stale, wrong permission model, wrong identity —
with `os.path.exists` carrying a quieter version of the same problem. The chunk closes the
whole width argument with the three questions to ask of any guard.**

## `-O` and the `assert` that is not there

The most complete version of "ambient state decides whether it raises" is the one where the
statement is removed from the program entirely. The reference:

> *"In the current implementation, the built-in variable `__debug__` is `True` under normal
> circumstances, `False` when optimization is requested (command line option `-O`). **The
> current code generator emits no code for an `assert` statement when optimization is
> requested at compile time.**"*

Not "the assertion passes" — *no code is emitted*. So `except AssertionError` around a call
that validates with `assert` is a handler for something that cannot happen under `-O`, and
the invalid data proceeds:

```python
# 🔴 Under `python -O`, validate() emits nothing and this handler is unreachable.
def validate(order):
    assert order.total >= 0, "negative total"

try:
    validate(order)
except AssertionError:
    return reject(order)
```

```python
def validate(order):
    if order.total < 0:                    # a real check, in the emitted program
        raise InvalidOrder("negative total")

try:
    validate(order)
except InvalidOrder:
    return reject(order)
```

The reference's own equivalence makes the mechanism plain — `assert expression1, expression2`
is equivalent to `if __debug__: if not expression1: raise AssertionError(expression2)` — and
`__debug__` is fixed at interpreter start: *"Assignments to `__debug__` are illegal. The
value for the built-in variable is determined when the interpreter starts."* This is [05b ·
`assert` is not validation](05b-assert-is-not-validation.md)'s subject; it appears here
because it is the purest case of the pattern.

### `-OO`, `PYTHONOPTIMIZE`, and where the flag comes from

The command-line documentation is broader than the `assert` rule suggests. `-O` is described
as *"Remove assert statements and any code conditional on the value of `__debug__`"* — so a
hand-written `if __debug__:` block goes the same way — and `-OO` is *"Do `-O` and also
discard docstrings."*

🔴 And the flag does not have to appear on any command line you can see:

> *"`PYTHONOPTIMIZE` — If this is set to a non-empty string it is equivalent to specifying
> the `-O` option. If set to an integer, it is equivalent to specifying `-O` multiple
> times."*

That is how this reaches production without appearing in a diff: a base container image or a
deployment template sets `PYTHONOPTIMIZE=1`, and every `assert` in the tree stops existing.
Nothing in the application changed, the tests still pass in CI where the variable is unset,
and the validation quietly stopped running. `-OO` adds a second failure mode for anything
that reads `__doc__` at runtime — argument parsers built from docstrings, plugin registries,
some serialisation libraries — because the docstrings are gone too.

The compiled files are the one visible trace: `-O` and `-OO` each *"Augment the filename for
compiled (bytecode) files"*, adding `.opt-1` and `.opt-2` respectively before the `.pyc`
extension.

## And the check can lie: what `os.access` admits about itself

The `os.access` entry that supplied [06g](06g-width-at-a-boundary.md)'s rewrite carries a
**second** note, and it is the strongest argument in the standard library for making the
operation itself the guard:

> *"I/O operations may fail even when `access()` indicates that they would succeed,
> particularly for operations on network filesystems which may have permissions semantics
> beyond the usual POSIX permission-bit model."*

The first note says the check goes **stale** — the window between the check and the open is
exploitable, which is [02b](02b-the-filesystem-and-the-atomic-flag.md)'s subject. This one
says the check can be **wrong on arrival**, with no race required and no attacker involved:
the file's real access rules are simply not expressible in the model `access()` queries.

And a third sentence in the same entry says it may not be asking about the right principal:

> *"Use the real uid/gid to test for access to path. Note that most operations will use the
> effective uid/gid, therefore this routine can be used in a suid/sgid environment to test if
> the invoking user has the specified access to path."*

That is a deliberate feature with one narrow use — asking "may the *invoking* user do this?"
in a setuid program — and a trap everywhere else, because `open()` will act as the effective
user. The parameter that switches it is not portable:

> *"If `effective_ids` is `True`, `access()` will perform its access checks using the
> effective uid/gid instead of the real uid/gid. `effective_ids` may not be supported on your
> platform; you can check whether or not it is available using `os.supports_effective_ids`.
> If it is unavailable, using it will raise a `NotImplementedError`."*

Three independent failure modes — stale, wrong model, wrong identity — plus a fix for the
third that raises on some platforms. None of them apply to a `try` around `open()`, because
it *is* the operation whose result you wanted.

### `os.path.exists` lies too, and more quietly

`os.access` at least documents its problems under a **Note** heading. The function people
actually reach for buries the same class of caveat in its one-paragraph description:

> *"Return `True` if path refers to an existing path or an open file descriptor. Returns
> `False` for broken symbolic links. On some platforms, this function may return `False` if
> permission is not granted to execute `os.stat()` on the requested file, even if the path
> physically exists."*

Two distinct falsehoods in one sentence. A broken symlink *exists* as a directory entry and
`exists()` says `False` — use `os.path.lexists`, which is documented to *"Return `True` if
path refers to an existing path, including broken symbolic links"*, if that distinction
matters. And a file you cannot `stat` reports as absent, so an `exists()` check on a
permission-restricted directory produces "no such file" for a file that is right there,
after which your code creates it, or reports a 404, or skips a migration.

```python
# 🔴 Reports "config not found" for a config that exists but is not stat-able,
#    and for a symlink whose target moved.
if not os.path.exists(path):
    return DEFAULTS
with open(path) as fp:
    return json.load(fp)
```

```python
try:
    fp = open(path)
except FileNotFoundError:          # the real, specific answer, from the real operation
    return DEFAULTS
else:
    with fp:
        return json.load(fp)       # PermissionError is now distinct, and escapes
```

The EAFP version distinguishes three outcomes the LBYL version collapses into one: the file
is absent, the file is unreadable, the file is unparseable.

## The three questions to ask of any guard

The topic collapses to this. Before trusting a `try`, ask in order:

1. **Does the class match?** Is it what the callee documents, and is it the leaf rather than
   a base? — [06c](06c-the-breadth-of-one-class.md)
2. **Does the scope match?** Is the guarded suite the one expression that can fail, with the
   consumer in `else`? — [06g](06g-width-at-a-boundary.md)
3. **Does this process make it raise at all?** Contexts, warning filters, `-O`, platform. —
   [06j](06j-ambient-state-the-guard-cannot-see.md) and this page

Questions 1 and 2 are answerable by reading the file. Question 3 is not, which is why it is
the one that survives review and reaches production.

## Gotchas

**★ Symptom: `os.access(path, os.R_OK)` returned `True` and the `open()` on the next line
raised anyway.** Cause: the documented one — *"I/O operations may fail even when `access()`
indicates that they would succeed, particularly for operations on network filesystems"* — and
`access()` tests the real uid/gid while the open will use the effective one. Fix: delete the
check; the operation is the only reliable test.

```python
try:
    fp = open(path)
except PermissionError:
    return "some default data"
else:
    with fp:
        return fp.read()
```

**★ Symptom: validation stopped rejecting bad input after a deployment change, and nothing
in the diff touched validation.** Cause: the deployment added `-O`, and *"the current code
generator emits no code for an `assert` statement when optimization is requested at compile
time"* — so the `assert` is not in the program and `except AssertionError` guards nothing.
Fix: assertions are for programmer errors; a check that must run is an `if` and a `raise`.

```python
if order.total < 0:
    raise InvalidOrder("negative total")
```

**★ Symptom: the same image behaves differently in two clusters and no command line
differs.** Cause: `PYTHONOPTIMIZE` — *"If this is set to a non-empty string it is equivalent
to specifying the `-O` option"* — so a base image or a deployment template can delete every
`assert` in the tree with an environment variable. Fix: assert the interpreter's own state at
startup, where you can see it, rather than discovering it from behaviour.

```python
if not __debug__:
    logger.warning("running under -O: assert statements are not compiled in")
```

**★ Symptom: `os.path.exists()` says a file is missing and `ls` says it is there.** Cause:
*"this function may return `False` if permission is not granted to execute `os.stat()` on the
requested file, even if the path physically exists"* — and it also returns `False` for a
broken symlink. Fix: open the file; if you truly need the existence question and nothing
else, `lexists` at least answers the symlink half honestly.

```python
try:
    fp = open(path)
except FileNotFoundError:
    return DEFAULTS                # absent
except PermissionError:
    raise ConfigUnreadable(path)   # present but not readable — a different problem
else:
    with fp:
        return json.load(fp)
```

**Symptom: `os.access(path, os.R_OK, effective_ids=True)` raised `NotImplementedError` in
production and not on the developer's laptop.** Cause: *"`effective_ids` may not be supported
on your platform; you can check whether or not it is available using
`os.supports_effective_ids`. If it is unavailable, using it will raise a
`NotImplementedError`."* Fix: do not repair the check — remove it. If you genuinely need the
pre-flight for a user-facing message rather than for control flow, gate it on the capability
set and say which identity you asked about.

```python
if "effective_ids" in os.supports_effective_ids:
    readable = os.access(path, os.R_OK, effective_ids=True)
else:
    readable = os.access(path, os.R_OK)     # answers about the real uid; say so in the UI
```

**Symptom: a CLI's help text is empty in production.** Cause: `-OO` is documented as *"Do
`-O` and also discard docstrings"*, and the tool builds its help from `__doc__`. It is the
same class of defect as the missing `assert` — the interpreter removed something the code
depends on existing. Fix: never derive runtime behaviour from docstrings; keep help text in
a string constant the optimiser does not touch.

## Interview questions

**★ The `os.access` entry has a second note, about network filesystems. Why does it matter to
the width argument?** Because it removes the last defence of the check-first shape. The first
note is the race — the check goes stale between checking and opening, and an attacker can
exploit the window. The second says the check can be wrong with no race and no attacker at
all: *"I/O operations may fail even when `access()` indicates that they would succeed,
particularly for operations on network filesystems which may have permissions semantics
beyond the usual POSIX permission-bit model."* And a third sentence says it may not be asking
about the right principal: it *"Use[s] the real uid/gid"* while *"most operations will use
the effective uid/gid"*. Stale, wrong model, wrong identity — the `try` around `open()` has
none of the three, because it is the operation whose result you wanted in the first place.

**★ Why is `except AssertionError` never a real guard?**
Because the statement it is guarding may not be in the program. The reference is unambiguous:
*"The current code generator emits no code for an `assert` statement when optimization is
requested at compile time."* Not "the check passes" — the check is absent, so the invalid
data flows on and the handler is unreachable. `__debug__` is also fixed at startup —
*"Assignments to `__debug__` are illegal. The value for the built-in variable is determined
when the interpreter starts"* — so nothing at runtime can restore it. Worse, `-O` can arrive
from `PYTHONOPTIMIZE` rather than a command line, so the change is invisible in the
application's own configuration. Assertions state what you believe is already true, for the
benefit of a developer; anything a caller can cause is an `if` and a `raise`. That is
[05b](05b-assert-is-not-validation.md)'s argument, and the `except AssertionError` clause is
the tell that the distinction was missed.

**★ Name the kinds of ambient state that decide whether a call raises at all.**
Four appear in the standard library and cover most real cases. A library-level context
object, `decimal` being the model — per-thread, with a `traps` list that decides whether a
signal becomes an exception. The warning filter, where the `"error"` action turns any
`warn()` call into a raise. The interpreter's optimisation flag, where `-O` deletes `assert`
statements and any `if __debug__:` block outright, and can be set from `PYTHONOPTIMIZE`
rather than the command line. And the platform, where `os.access` may report success on a
filesystem whose permission semantics it cannot express, and `os.path.exists` may report
`False` for a file it merely cannot `stat`. What they have in common is that none of them are
visible in the file containing the `try`, which is why "read the handler and the suite" is a
necessary but not sufficient review.

**★ `os.path.exists()` returned `False` for a file that is definitely there. Give two
documented reasons.**
Broken symlink and unreadable parent. The docs cover both in the same paragraph: it *"Returns
`False` for broken symbolic links"*, and *"On some platforms, this function may return `False`
if permission is not granted to execute `os.stat()` on the requested file, even if the path
physically exists."* The second is the operationally nastier one, because it converts a
permissions problem into a "not found" and sends whoever is debugging in the wrong direction
entirely — they go looking for a missing deployment artefact. `os.path.lexists` fixes the
symlink half by design; nothing fixes the permissions half, which is the argument for opening
the file and letting `FileNotFoundError` and `PermissionError` stay distinct.

**`os.access` has an `effective_ids` parameter. Does using it fix the security note?**
No, and reaching for it usually means the first note was not read. `effective_ids` fixes only
the *identity* mismatch — *"`access()` will perform its access checks using the effective
uid/gid instead of the real uid/gid"* — and it does not exist everywhere: *"`effective_ids`
may not be supported on your platform … If it is unavailable, using it will raise a
`NotImplementedError`."* The race is untouched, and so is the network-filesystem note. You
would have swapped one wrong answer for a more precisely wrong answer, on the platforms that
support it. The documented recommendation is to stop asking and open the file.

---

← Prev: [Ambient state](06j-ambient-state-the-guard-cannot-see.md) · Index: [EAFP vs LBYL](README.md) · Next → [The cost argument](07-the-cost-argument.md)
