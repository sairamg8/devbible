---
title: "Every in-process way to change the warnings filter inserts at the front of the list, which is how a library silences your CI — and catch_warnings, the one that scopes properly, mutates module globals on a stock 3.14 build and is documented as unsafe under threads"
sidebar_label: "06u · Changing the filter in-process"
sidebar_position: 167
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against
> [`warnings`](https://docs.python.org/3.14/library/warnings.html) — `simplefilter`,
> `resetwarnings`, *Overriding the default filter*, `catch_warnings`, *Testing Warnings*,
> and *Concurrent safety of Context Managers* (the
> `sys.flags.context_aware_warnings` and `thread_inherit_context` flags, new in 3.14); and
> pytest's
> [*How to capture warnings*](https://docs.pytest.org/en/stable/how-to/capture-warnings.html).
> Target: **Python 3.14** (docs build 3.14.7) · **pytest 9** docs. **No sandbox run.**

**[06t](06t-warning-filters.md) established that the filter is process state, that the list is
scanned until the first match, and that `-W error` can make a narrow `try` start firing in CI.
This chunk is everything that edits that list from inside the running program — `simplefilter`,
`resetwarnings`, `catch_warnings` — plus the test runner, which keeps its own copy with its own
precedence. Four things bite here and all four are documented: an in-process filter is inserted
at the **front**, so any library's `simplefilter("ignore")` outranks the operator's `-W error`;
`resetwarnings()` discards the command line as well as your own calls; `catch_warnings` on a
stock 3.14 build mutates module globals and is explicitly *not* safe under threads or asyncio;
and the per-location warnings registry can suppress the very warning your test asserts on, so
it passes alone and fails in the suite.**

## `simplefilter`, `resetwarnings`, and the library that overrules your CI

`simplefilter` is not a reset. It inserts, exactly like `filterwarnings`, and differs only in
matching:

> *"Insert a simple entry into the list of warnings filter specifications. The meaning of the
> function parameters is as for `filterwarnings()`, but regular expressions are not needed as
> the filter inserted always matches any message in any module as long as the category and line
> number match."*

Since it inserts **at the front**, a library that calls `warnings.simplefilter("ignore")` at
import time silently overrules the `-W error` you passed on the command line, for every
warning in the process. The reset is a different function, and it is heavier than people
expect:

> `resetwarnings()` — *"Reset the warnings filter. This discards the effect of all previous
> calls to `filterwarnings()`, including that of the `-W` command line options and calls to
> `simplefilter()`."*

The documented, polite pattern for an application that wants to hide warnings from end users
is to check whether the operator already asked for something:

```python
import sys

if not sys.warnoptions:          # nobody passed -W or PYTHONWARNINGS
    import warnings
    warnings.simplefilter("ignore")
```

…and the mirror image for a test runner, which the docs also ship:

```python
import sys

if not sys.warnoptions:
    import os, warnings
    warnings.simplefilter("default")            # change the filter in this process
    os.environ["PYTHONWARNINGS"] = "default"    # also affect subprocesses
```

## `catch_warnings`: what it restores, and when it is not safe

> *"A context manager that copies and, upon exit, restores the warnings filter and the
> `showwarning()` function."*

With `record=True` it also collects, which is how you assert that a deprecation *was* emitted
rather than merely tolerating it — the entries are *"guaranteed to have"* `message`,
`category`, `filename`, `lineno`, `file`, `line` and `source`:

```python
import warnings

with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter("always")
    legacy_parse(payload)

assert any(issubclass(w.category, DeprecationWarning) for w in caught)
```

🔴 **Concurrency.** In 3.14 the behaviour is governed by a flag: *"The behavior of
`catch_warnings` context manager depends on the `sys.flags.context_aware_warnings` flag. If
the flag is true, the context manager behaves in a concurrent-safe fashion and otherwise not.
… The flag defaults to true for free-threaded builds and false otherwise."* When it is false,
*"`catch_warnings` will modify the global attributes of the `warnings` module. This is not
safe if used within a concurrent program (using multiple threads or using asyncio coroutines).
For example, if two or more threads use the `catch_warnings` class at the same time, the
behavior is undefined."* On a stock (GIL-enabled) 3.14 build that is the default you have.

⚠️ Even with the flag true there is a second gotcha the docs name: a thread does not inherit
the context unless you ask. *"That flag causes threads created by `threading.Thread` to start
with a copy of the context variables from the thread starting it. … If false, new threads will
start with an empty warnings context variable, meaning that any filtering that was established
by a `catch_warnings` context manager will no longer be active."*

## The test runner has its own copy of all of this

pytest reimplements the filter rather than inheriting yours, so the rules above apply *and*
pytest's ordering does:

> *"When a warning matches more than one option in the list, the action for the last matching
> option is performed."*

```ini
[pytest]
filterwarnings =
    error
    ignore::UserWarning
    ignore:function ham\(\) is deprecated:DeprecationWarning
```

Two behaviours follow that surprise people. pytest shows what CPython hides — *"By default
pytest will display `DeprecationWarning` and `PendingDeprecationWarning` warnings from user
code and third-party libraries, as recommended by PEP 565"* — so a deprecation visible in the
test log and invisible in the app is expected, not a bug. And a `@pytest.mark.filterwarnings`
mark beats the config file: *"Filters applied using a mark take precedence over filters passed
on the command line or configured by the `filterwarnings` configuration option."* The
`unittest` runner does the same job by a different route; the `warnings` docs note that its
test runner implicitly enables all warnings when running tests.

## Gotchas

**★ Symptom: a library import makes your `-W error` stop working, process-wide.** Cause:
`simplefilter` *"Insert[s] a simple entry into the list"* at the front by default, and
*"Entries closer to the front of the list override entries later in the list"* — so a
third-party `warnings.simplefilter("ignore")` at import time outranks the command line. Fix:
re-assert your filter after imports, or use `catch_warnings` around the import so the library's
mutation is discarded on exit.

```python
with warnings.catch_warnings():
    import chatty_library            # its simplefilter call dies with the context
warnings.simplefilter("error")       # your policy, re-asserted at the front
```

**Symptom: `resetwarnings()` in a conftest made every `-W` flag in the CI command line
disappear.** Cause: it is documented to do exactly that — *"This discards the effect of all
previous calls to `filterwarnings()`, including that of the `-W` command line options and calls
to `simplefilter()`."* Fix: use `catch_warnings` for a scoped change; keep `resetwarnings()`
for the one case where you genuinely want an empty list and are about to rebuild it.

**★ Symptom: `filterwarnings("ignore", category=SyntaxWarning)` at the top of a module does
not silence the `SyntaxWarning` that module produces.** Cause: the category table says why —
`SyntaxWarning` is *"Base category for warnings about dubious syntactic features (typically
emitted when compiling Python source code, and hence may not be suppressed by runtime
filters)"*. By the time your `filterwarnings` call executes, compilation is over. This is not
academic in 3.14: a `return` in a `finally` block now emits one (see
[06i](06i-when-cleanup-raises-and-the-grammar-refuses.md)), and it is emitted at compile time.
Fix: set the filter before the code is compiled — a `-W` flag or `PYTHONWARNINGS` on the
process that imports it — and treat the warning as something to remove from the source rather
than to filter.

```bash
python -W error::SyntaxWarning -m compileall -q src/   # compile first, with the filter in place
```

**Symptom: a test asserts a warning is emitted, passes alone, and fails in the full run.**
Cause: the per-location registry, not the filter — *"if a warning has already been raised
because of a once/default rule, then no matter what filters are set the warning will not be
seen again unless the warnings registry related to the warning has been cleared."* An earlier
test consumed the first occurrence. Fix: set `"always"` inside the recording block so no
once/default rule applies.

```python
with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter("always")      # not "default": defeats the registry suppression
    api_v1()
assert len(caught) == 1
```

**Symptom: a custom `showwarning` you installed survives a `catch_warnings(record=True)`
block on one interpreter and not another.** Cause: 3.14 made the mechanism conditional.
*"When record is true and the flag is false, the context manager works by replacing and then
later restoring the module's `showwarning()` function. That is not concurrent-safe."* But
*"When record is true and the flag is true, the `showwarning()` function is not replaced. …
In this case, the `showwarning()` function will not be restored when exiting the context
handler."* Same code, two different treatments of your hook, decided by
`sys.flags.context_aware_warnings`. Fix: do not rely on `catch_warnings` to restore a
`showwarning` you installed yourself — save and restore it explicitly, or route warnings
through `logging.captureWarnings()` instead of replacing the hook.

**Symptom: `catch_warnings` in a threaded test run produced flaky, order-dependent results.**
Cause: the documented caveat — *"If the `context_aware_warnings` flag is false, then
`catch_warnings` will modify the global attributes of the `warnings` module. This is not safe
if used within a concurrent program"*, and the flag *"defaults to true for free-threaded
builds and false otherwise"*. One test's filter leaks into another's thread. Fix: set the
filter once for the process (`-W`, or `filterwarnings` in the test configuration) rather than
per-test inside concurrent code; on 3.14 you may additionally opt in with
`-X context_aware_warnings` — but note the docs' companion advice that you *"will also want to
set the `thread_inherit_context` flag to true"*, or new threads start with an empty warnings
context.

**Symptom: the mark and the ini file disagree and the mark wins, or two stacked marks apply in
the wrong order.** Cause: pytest documents both — *"Filters applied using a mark take
precedence over filters passed on the command line or configured by the `filterwarnings`
configuration option"*, and decorators evaluate bottom-up, so *"filters from earlier
`@pytest.mark.filterwarnings` decorators take precedence over filters from later decorators"* —
the reverse of `warnings.filterwarnings()` ordering. Fix: pass several filters to one mark,
where the familiar rule applies again: *"Later arguments take precedence, matching
`warnings.filterwarnings` behavior."*

```python
@pytest.mark.filterwarnings("error", "ignore:api v1")
def test_one():
    assert api_v1() == 1
```

## Interview questions

**★ What is the difference between `simplefilter`, `filterwarnings` and `resetwarnings`?**
`filterwarnings` inserts a full entry and compiles `message` and `module` as regular
expressions. `simplefilter` inserts an entry too — it is not a reset, despite how it reads —
but *"regular expressions are not needed as the filter inserted always matches any message in
any module as long as the category and line number match"*. Both insert at the front unless you
pass `append=True`, and *"Entries closer to the front of the list override entries later in the
list"*. `resetwarnings` is the destructive one: it *"discards the effect of all previous calls
to `filterwarnings()`, including that of the `-W` command line options"* — so calling it in a
conftest quietly deletes the CI operator's policy.

**★ How do you write a test that a function still emits its deprecation, rather than one that
merely tolerates it?** `catch_warnings(record=True)` with `simplefilter("always")` inside, then
assert on the collected list — the entries are guaranteed to carry `message`, `category`,
`filename` and `lineno`. `"always"` rather than `"default"` matters because of the per-location
registry: *"if a warning has already been raised because of a once/default rule, then no matter
what filters are set the warning will not be seen again unless the warnings registry related to
the warning has been cleared"*, which is how a test that passes alone fails in a full suite. In
pytest, `pytest.warns()` or `pytest.deprecated_call()` is the idiomatic form — with the caveat
that using them *"in the specific case where users capture any type of warnings in their
test"* means *"no warning will be displayed at all"* in the summary.

**★ What exactly does `catch_warnings` restore, and what does it not?**
It restores two things and is documented as *"A context manager that copies and, upon exit,
restores the warnings filter and the `showwarning()` function"* — with the 3.14 caveat that
under `context_aware_warnings` and `record=True` the hook *"will not be restored when exiting
the context handler"* because it was never replaced. What it does not touch is the
per-location registry that the `"once"`, `"default"` and `"module"` actions consult: a warning
already reported *"will not be seen again unless the warnings registry related to the warning
has been cleared"*, and exiting the block does not clear it. So `catch_warnings` gives you a
scoped **policy**, not a scoped **history** — which is why the recording idiom sets
`"always"` rather than trusting the restore.

**Is `catch_warnings` thread-safe?**
Not by default on a stock 3.14 build, and the documentation is unusually blunt about it. The
behaviour depends on `sys.flags.context_aware_warnings`, which *"defaults to true for
free-threaded builds and false otherwise"*. With the flag false, `catch_warnings` *"will modify
the global attributes of the `warnings` module"*, and *"if two or more threads use the
`catch_warnings` class at the same time, the behavior is undefined"* — that covers asyncio
coroutines as well as threads. With the flag true it stores the state in a `ContextVar`
instead, which is thread-local; and if you rely on that, the docs advise also setting
`thread_inherit_context`, because otherwise *"new threads will start with an empty warnings
context variable"* and your filtering will not apply inside them. In practice: configure
warnings once for the process, and keep `catch_warnings` for single-threaded test code.

---

← Prev: [Warning filters](06t-warning-filters.md) · Index: [EAFP vs LBYL](README.md) · Next → [The guard the platform deletes](06m-the-guard-the-platform-deletes.md)
