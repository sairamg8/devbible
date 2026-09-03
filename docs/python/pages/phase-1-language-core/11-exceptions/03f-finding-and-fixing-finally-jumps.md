---
title: "PEP 765 made the `finally` jump findable in 3.14 — treat every warning as a bug, because 73% of them were"
sidebar_label: "3f · Finding `finally` jumps"
sidebar_position: 117
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against [PEP 765](https://peps.python.org/pep-0765/),
> the Python 3.14 Language Reference
> [The `try` statement — `finally` clause](https://docs.python.org/3.14/reference/compound_stmts.html#finally-clause),
> and [PEP 654](https://peps.python.org/pep-0654/).
> The `SyntaxWarning` and `SyntaxError` message texts quoted below were produced
> by compiling the corresponding snippets with the CPython 3.14.4 that ships this
> repository's toolchain.
> Target: **CPython 3.14**.

**For twenty-five years the exception-eating `finally` jump described in
[03e](03e-return-break-continue-in-finally.md) was legal, silent and undetectable
without a linter. Python 3.14 changed that: the compiler now warns. This chunk
is what the warning says, when it fires, why it is a warning rather than an
error, and how to sweep an existing codebase for the construct — including the
one shape that looks like the bug and is not.**

## What 3.14 does about it

> *"Changed in version 3.14: The compiler emits a `SyntaxWarning` when a
> `return`, `break` or `continue` appears in a `finally` block (see PEP 765)."*

PEP 765's own specification is broader than "appears in":

> *"The change is to specify as part of the language spec that Python's compiler
> may emit a `SyntaxWarning` or `SyntaxError` when a `return`, `break` or
> `continue` would transfer control flow from within a `finally` block to a
> location outside of it."*

The distinction matters: a `break` inside a loop that is *itself* inside the
`finally` block does not transfer control out of the `finally`, and is fine.

Compiling `def f():` / `try: return 1` / `finally: return 2` under CPython 3.14.4
produces a `SyntaxWarning` whose message is `'return' in a 'finally' block`. It
is emitted at **compile time**, during AST construction — so it fires when the
module is imported, not when the function is called, and a module imported from a
`.pyc` that was compiled earlier will not re-emit it.

PEP 765 leaves the future open:

> *"The specification permits a `SyntaxError` in future versions"* — with no
> concrete CPython commitment to a version.

Treat the warning as an error today:

```bash
python -W error::SyntaxWarning -c "import yourpackage"
```

Linters have flagged it for years — `ruff` `B012` (*jump statements in `finally`
blocks cause exceptions to be silenced*) and `pylint` `lost-exception`.

## Version history, because old code compiles differently

- **Before 3.8**, `continue` was *illegal* in a `finally` clause: *"Prior to
  Python 3.8, a `continue` statement was illegal in the `finally` clause due to a
  problem with the implementation."* So a codebase that runs on 3.7 cannot
  contain this particular form.
- **3.8 through 3.13**: all three are legal and silent.
- **3.14**: legal, but the compiler warns.

## `except*` is the version that got it right

PEP 654 made the same construct a hard error in the new syntax:

> *"`break`, `continue` and `return` cannot appear in an `except*` clause."*

Compiling one under CPython 3.14.4 reports `'break', 'continue' and 'return'
cannot appear in an except* block`. The PEP's reason is different from the
`finally` reason but points the same way — *"the exceptions in an
`ExceptionGroup` are assumed to be independent, and the presence or absence of
one of them should not impact handling of the others"* — and it shows what the
designers do when they get to choose freely. See
[08c · `except*` semantics](08c-except-star-semantics.md).

## Sweeping a codebase

Three independent methods, because each misses something the others catch:

**1 · Compile everything with the warning fatal.**

```bash
python -W error::SyntaxWarning -c "import yourpackage"
find src -name '*.py' -exec python -W error::SyntaxWarning -m py_compile {} +
```

The second form is the reliable one: `py_compile` compiles the file whether or
not something already imported it, and the `find` walks modules that nothing
imports at all.

**2 · Clear the bytecode cache first.** The warning is emitted during
compilation, so a warm `__pycache__` skips it entirely:

```bash
find . -name '__pycache__' -type d -exec rm -rf {} +
```

**3 · Lint, which does not care about caching or import success.** `ruff` `B012`
— *jump statements in `finally` blocks cause exceptions to be silenced* — and
`pylint`'s `lost-exception` both flag it statically, in files that do not even
import cleanly.

## Two shapes that are *not* the bug

**A loop wholly inside the `finally`.** PEP 765's rule is about transferring
control *out* of the `finally` block:

```python
try:
    work()
finally:
    for handle in handles:
        if handle.closed:
            continue          # stays inside the finally — harmless
        handle.close()
```

Nothing leaves the `finally` here, so the parked exception is still re-raised at
the end. A linter that pattern-matches on the keyword rather than on the control
transfer will flag this; that is a legitimate suppression.

**A `return` in the `try` or in an `except`.** Only the `finally` clause has this
behaviour. `return` inside `try` is completely normal and the `finally` still
runs on the way out — the reference calls it running *'on the way out'*.

## Why a warning and not an error

PEP 765 chose the conservative path because the construct is legal today and
some of it is deliberate. Its specification is permissive about which diagnostic
an implementation emits:

> *"The change is to specify as part of the language spec that Python's compiler
> may emit a `SyntaxWarning` or `SyntaxError` when a `return`, `break` or
> `continue` would transfer control flow from within a `finally` block to a
> location outside of it."*

That wording is aimed at other implementations as much as at CPython — it lets
an alternative Python make it an error immediately. CPython chose the warning for
3.14 and made no commitment to a version in which it becomes an error.

## Gotchas

**★ Symptom — the `SyntaxWarning` does not appear even on 3.14.** Cause: it is a
compile-time warning, so it fires on the compile that produces the `.pyc`; a warm
bytecode cache skips it, and warnings are non-fatal by default. Fix: clear
`__pycache__`, compile fresh with `-W error::SyntaxWarning`, or use `ruff` `B012`
which does not depend on compilation at all.

**★ Symptom — an upgrade to 3.14 fills CI logs with `'return' in a 'finally'
block`.** Cause: PEP 765 landed. Fix: treat each hit as a bug, not as noise —
PEP 765's survey put the incorrect rate at 73%. Fix the wrong ones and
restructure the rest; suppressing the warning wholesale throws away the only
signal you will ever get for this class of bug.

**★ Symptom — a `break` inside a `for` loop written *inside* a `finally` block
gets flagged.** Cause: a linter matching on the keyword rather than on the
control transfer. Fix: PEP 765's rule is *transfers control flow out of the
`finally`*; a loop wholly contained in the `finally` is safe, and this is one of
the few legitimate `noqa` suppressions in this area.

**Symptom — `SyntaxError` for `continue` in a `finally` on an old runtime.**
Cause: it was outright illegal before Python 3.8 — *"Prior to Python 3.8, a
`continue` statement was illegal in the `finally` clause due to a problem with
the implementation."* Fix: nothing to do on 3.8+, but note when backporting that
this construct simply does not compile on 3.7.

**Symptom — the warning fires on a file that is never executed.** Cause: it is a
compile-time diagnostic, so dead modules warn too. Fix: this is a feature — dead
code with this bug is code that will bite the day someone revives it.

**Symptom — `-W error::SyntaxWarning` turns unrelated warnings fatal too.**
Cause: `SyntaxWarning` covers other compiler diagnostics, notably the
`assert (x, "msg")` always-true tuple warning and invalid escape sequences in
string literals. Fix: none needed — every one of those is also a real bug. See
**10 · `assert`** *(not written yet)*.

## Interview questions

**★ Q: What changed in Python 3.14 regarding `finally`?**
PEP 765. The compiler now emits a `SyntaxWarning` when a `return`, `break` or
`continue` *"would transfer control flow from within a `finally` block to a
location outside of it"* — on 3.14.4 the message for the `return` case is
`'return' in a 'finally' block`. It is a compile-time diagnostic, and the PEP
explicitly leaves room for it to become a `SyntaxError` in a future version
without committing CPython to one.

**★ Q: How do you find every occurrence in an existing codebase?**
Clear `__pycache__`, then compile every file with `-W error::SyntaxWarning`
(`py_compile` over a `find`, not just an import, so unimported modules are
covered). Independently, run `ruff` with `B012` or `pylint`'s `lost-exception`,
which work statically and do not depend on the file being importable.

**Q: Is `break` ever legal and safe inside a `finally` block?**
Yes — if it belongs to a loop that is itself entirely inside the `finally`. Then
it does not transfer control out of the `finally` and the parked exception is
still re-raised. The dangerous case is a `break` targeting a loop that *encloses*
the `try` statement.

**Q: Why did PEP 765 choose a warning rather than an error?**
Because the construct is legal in every released Python and a minority of uses
are deliberate; a hard error would break working code on upgrade. The PEP's
wording deliberately permits either diagnostic so that other implementations can
be stricter, and CPython picked the warning for 3.14.

**Q: What does `except*` do about jump statements?**
Forbids them outright — `break`, `continue` and `return` in an `except*` clause
are a `SyntaxError`, reported on 3.14.4 as `'break', 'continue' and 'return'
cannot appear in an except* block`. PEP 654's reason is the independence of
exceptions in a group rather than swallowing, but the outcome shows what the
designers do when they are free to choose.

**Q: Why does the warning sometimes not fire in CI but does locally?**
Bytecode caching. CI often restores a `__pycache__` or installs a wheel
containing pre-compiled `.pyc` files; nothing is compiled, so nothing warns. A
static linter is the more reliable gate for this reason.

---

← Prev: [Jumping out of `finally`](03e-return-break-continue-in-finally.md) · Index: [Exceptions](README.md) · Next → [When `finally` does not run](03g-when-finally-does-not-run.md)
