---
title: "The `try` statement has four clauses and one execution order — learn the order and most exception bugs stop being mysterious"
sidebar_label: "1 · The four clauses"
sidebar_position: 110
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement),
> [The `raise` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-raise-statement),
> the Tutorial
> [Errors and Exceptions](https://docs.python.org/3.14/tutorial/errors.html),
> the Library Reference
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html),
> and [PEP 8](https://peps.python.org/pep-0008/).
> Target: **CPython 3.14**.

**`try` is not one construct with optional decoration; it is four clauses with
four distinct jobs and a fixed execution order. `try` holds the code that might
fail. `except` holds a handler for one named failure. `else` holds the code that
should run only when nothing failed — and, crucially, is *not* protected by the
handlers above it. `finally` holds cleanup that runs on every route out,
including routes you did not think about. Almost every exception bug in a
codebase is one of these four clauses being asked to do another one's job:
business logic parked in `try` where it gets silently caught, or cleanup parked
after the statement where an exception skips it.**

## The grammar: three legal shapes

The reference gives three productions, and it is worth reading them as three
different statements that happen to share a keyword:

```text
try_stmt:  try1_stmt | try2_stmt | try3_stmt

try1_stmt: "try" ":" suite
           ("except" [expression ["as" identifier]] ":" suite)+
           ["else" ":" suite]
           ["finally" ":" suite]

try2_stmt: "try" ":" suite
           ("except" "*" expression ["as" identifier] ":" suite)+
           ["else" ":" suite]
           ["finally" ":" suite]

try3_stmt: "try" ":" suite
           "finally" ":" suite
```

Three facts fall straight out of the grammar, before any semantics:

- **`try`/`finally` with no `except` is a first-class form** (`try3_stmt`). It is
  not a degenerate case — it is the shape you want when you are not handling the
  error, only cleaning up after it.
- **`else` requires at least one `except`.** There is no `try`/`else`/`finally`.
  The `+` on the `except` clause in `try1_stmt` says one or more; the `else` only
  appears in the productions that have it.
- **`except` and `except*` cannot be mixed.** They are separate productions, and
  the reference states it directly: *"A `try` statement can have either `except`
  or `except*` clauses, but not both."* See
  [08 · Exception groups](08-exception-groups.md).

## The execution order, in full

For a `try` with all four clauses, exactly one of these three paths is taken:

| Path | Runs | Then |
|---|---|---|
| Nothing raised | `try` suite, then `else` suite | `finally`, then code after the statement |
| Raised, matched | `try` suite up to the raise, then the **first matching** `except` suite | `finally`, then code after the statement |
| Raised, unmatched | `try` suite up to the raise | `finally`, then the exception propagates outward |

Two things this table encodes that people get wrong:

**`else` and `except` are mutually exclusive on any single run.** If a handler
ran, `else` did not. If `else` ran, no handler did. They are the two normal
routes out of the `try` suite, one for success and one for a handled failure.

**`finally` runs on all three paths.** The reference:

> *"If `finally` is present, it specifies a 'cleanup' handler. The `try` clause
> is executed, including any `except` and `else` clauses. If an exception occurs
> in any of the clauses and is not handled, the exception is temporarily saved.
> The `finally` clause is executed. If there is a saved exception it is re-raised
> at the end of the `finally` clause."*

Note *"including any `except` and `else` clauses"* — `finally` wraps the whole
statement, not just the `try` suite. An exception raised inside a handler is
also saved, and the `finally` still runs before it propagates.

## How a handler is chosen

The search is linear and first-match-wins. The reference:

> *"This search inspects the `except` clauses in turn until one is found that
> matches the exception. An expression-less `except` clause, if present, must be
> last; it matches any exception."*

And on what "matches" means:

> *"The raised exception matches an `except` clause whose expression evaluates to
> the class or a non-virtual base class of the exception object, or to a tuple
> that contains such a class."*

So matching is `isinstance`-shaped: a clause naming a **base** class catches its
subclasses. That is why order matters and why `except Exception:` first makes
every clause below it dead code — covered in
[05 · Catching specific types](05-catching-specific-types.md).

Once a handler is found:

> *"When a matching `except` clause is found, the exception is assigned to the
> target specified after the `as` keyword in that `except` clause, if present,
> and the `except` clause's suite is executed. … When the end of this block is
> reached, execution continues normally after the entire `try` statement."*

Reaching the end of a handler means the exception is **handled** — it does not
resume the `try` suite, and it does not propagate. Execution continues after the
whole statement. There is no `resume` in Python.

## Handlers cover the whole call tree, not the visible lines

The tutorial is explicit:

> *"Exception handlers also catch exceptions occurring in functions called within
> the try clause."*

This is the single largest source of over-broad handlers. A three-line `try`
that calls `process(payload)` is protecting every line `process` runs, and
everything *it* calls. When someone later adds a `dict` lookup deep inside
`process` and it raises `KeyError`, your `except KeyError:` — written to guard a
lookup you can see — swallows it and reports the wrong thing.

## Nested `try` statements and the inner handler winning

The reference adds a parenthetical that is easy to skim:

> *"(This means that if two nested handlers exist for the same exception, and the
> exception occurs in the `try` clause of the inner handler, the outer handler
> will not handle the exception.)"*

The nearest enclosing matching handler wins, and once it completes normally the
exception is gone. If you want the outer handler to see it too, the inner one
must re-raise — see [06 · The `raise` statement](06-the-raise-statement.md).

## An exception in the `except` *header*

A subtle one, straight from the reference:

> *"If the evaluation of an expression in the header of an `except` clause raises
> an exception, the original search for a handler is canceled and a search starts
> for the new exception in the surrounding code and on the call stack (it is
> treated as if the entire `try` statement raised the exception)."*

The header is an expression, so this is reachable:

```python
except errors.RETRYABLE:        # if `errors` is None, this raises AttributeError
    ...
```

The original exception is not lost — it becomes the new one's `__context__` — but
the handler search restarts from *outside* the `try` statement, so none of your
sibling handlers get a chance. Keep `except` headers to plain names and tuples.

## The exception is reachable without `as`

Before the handler body runs, the interpreter parks the exception where
`sys.exception()` can find it:

> *"Before an `except` clause's suite is executed, the exception is stored in the
> `sys` module, where it can be accessed from within the body of the `except`
> clause by calling `sys.exception()`. When leaving an exception handler, the
> exception stored in the `sys` module is reset to its previous value."*

That is what makes `logger.exception(...)` and a bare `raise` work with no name
bound — both read the active exception rather than a local variable. It is also
why `logging`'s `exc_info=True` only means anything *inside* a handler.

## The canonical four-clause example

The tutorial's version, which is worth memorising because it labels each clause
by what belongs there:

```python
def divide(x, y):
    try:
        result = x / y
    except ZeroDivisionError:
        print("division by zero!")
    else:
        print("result is", result)
    finally:
        print("executing finally clause")
```

Read it as four sentences: *the risky call*, *what to do about the one failure I
understand*, *the work that only makes sense if it succeeded*, *what must happen
either way*. Any code that does not fit one of those four sentences belongs
outside the statement entirely.

## Gotchas

**★ Symptom — a handler catches an error raised by a function three frames down
that you never intended to guard.** Cause: the tutorial's *"Exception handlers
also catch exceptions occurring in functions called within the try clause"* — the
`try` suite is a dynamic extent, not a set of lines. Fix: PEP 8's rule —
*"limit the `try` clause to the absolute minimum amount of code necessary"* —
usually one call — and move the rest into `else`.

**★ Symptom — `else` never runs even though nothing raised.** Cause: the `try`
suite exited via `return`, `break` or `continue`. The reference: *"The optional
`else` clause is executed if the control flow leaves the `try` suite, no
exception was raised, and no `return`, `continue`, or `break` statement was
executed."* Fix: if the success path returns, it does not need an `else`; put the
return *in* the `else` instead.

**Symptom — `SyntaxError` on `try:` / `else:` with no `except`.** Cause: the
grammar only allows `else` alongside one or more `except` clauses. Fix: use
`try`/`finally` (the third production) or add the handler you actually meant.

**Symptom — a second handler for a subclass never fires.** Cause: an earlier
clause naming a base class matched first; the search stops at the first match.
Fix: order most-specific-first. Details in
[05 · Catching specific types](05-catching-specific-types.md).

**Symptom — an `AttributeError` or `NameError` appears from the `except` line
itself, and none of your other handlers run.** Cause: the header expression
raised, which cancels the handler search entirely and treats the whole `try` as
having raised. Fix: never call a function or attribute-chain in an `except`
header; bind the tuple to a module-level constant.

**Symptom — an exception "disappears" between two nested `try` statements.**
Cause: the inner handler matched and completed, so the exception was handled;
the outer handler is only reached by exceptions the inner one did not match. Fix:
`raise` (bare) at the end of the inner handler to let it continue outward.

**Symptom — code after `try`/`except` runs even though the operation failed.**
Cause: reaching the end of a handler body means *handled* — control resumes after
the whole statement, not after the failed line. Fix: the handler must `return`,
`raise`, or set a value the following code checks. There is no resume.

## Interview questions

**★ Q: What are the four clauses of a `try` statement and when does each run?**
`try` runs first. If it raises, the `except` clauses are searched in order and the
first matching one runs. If it does *not* raise — and does not `return`, `break`
or `continue` — the `else` clause runs, and it is not protected by the handlers
above it. `finally` runs on every route out: normal completion, handled
exception, unhandled exception, and `return`/`break`/`continue` from the `try`.

**★ Q: Why is `else` better than putting the same code at the end of the `try`
block?**
Because the tutorial's reason: *"it avoids accidentally catching an exception
that wasn't raised by the code being protected by the `try` … `except`
statement."* Code in `try` is inside the handler's blast radius; code in `else`
is outside it. If your success-path code raises the same exception type by
coincidence, the version in `try` gets swallowed by your handler and misreported.

**Q: If the `try` block succeeds, does control ever reach the `except` block?**
No. `else` and `except` are alternative routes; exactly one of them runs per
execution (or neither, if the `try` returned or if the exception was unmatched).

**Q: Can you write `try`/`finally` with no `except`?**
Yes — it is its own grammar production. It means "I am not handling this failure,
but this cleanup must happen anyway". The exception is saved, the `finally` runs,
and then the exception is re-raised and propagates.

**Q: What happens when an exception is raised inside an `except` block?**
The `finally` clause of the same statement still runs, and then the new exception
propagates — with the original attached as its `__context__`, which is what
produces the *"During handling of the above exception, another exception
occurred"* traceback. See
[06b · Exception chaining](06b-exception-chaining.md).

**Q: How does the interpreter decide which `except` clause matches?**
Linearly, first match wins, using the same check as `isinstance`: a clause
matches if its expression evaluates to the exception's class, a non-virtual base
class of it, or a tuple containing such a class. A bare `except:` matches
everything and must be last.

**Q: What is `sys.exception()` and why does it matter?**
The reference says the active exception is stored in `sys` before a handler runs
and restored to its previous value on leaving. `sys.exception()` reads it. That
is the mechanism behind a bare `raise` and behind `logging`'s `exc_info=True`
working without you passing the exception object anywhere.

**Q: A colleague wraps an entire 60-line function body in one `try`/`except
ValueError`. What is wrong with that?**
The handler now covers every function that body calls, transitively. A
`ValueError` from a completely unrelated `int()` deep in a library will be
reported as the failure the handler names. PEP 8's minimum-`try` rule exists for
exactly this; the fix is to wrap the single call that can fail and move the rest
to `else` or out of the statement.

---

← Prev: **`match` — structural pattern matching** *(not written yet)* · Index: [Exceptions](README.md) · Next → [The `else` clause](02-the-else-clause.md)
