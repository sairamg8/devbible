---
name: research-python-11-exceptions
description: Banked primary-source research for devbible Python phase 1 topic 11 (exceptions) — chaining, custom exceptions, exception groups, except*, assert, suppress/warnings, tracebacks and logging. Verbatim quotes with URLs, gathered 2026-09-03.
metadata:
  type: project
---

# Research bank — Python topic 11 · Exceptions (2026-09-03)

One research pass for the whole topic, per `.agents/references/verification.md`.
Every chunk of 11 was written from this file rather than re-fetching. Target
**CPython 3.14**. Quotes are verbatim; the URL above each block is the source.

## `raise` — reference/simple_stmts.html#the-raise-statement

- Bare `raise`: *"If no expressions are present, `raise` re-raises the exception
  that is currently being handled, which is also known as the active exception.
  If there isn't currently an active exception, a `RuntimeError` exception is
  raised indicating that this is an error."*
- `from`: *"The `from` clause is used for exception chaining: if given, the
  second expression must be another exception class or instance. If the second
  expression is an exception instance, it will be attached to the raised
  exception as the `__cause__` attribute (which is writable). If the expression
  is an exception class, the class will be instantiated and the resulting
  exception instance will be attached to the raised exception as the `__cause__`
  attribute."*
- Implicit chaining: *"A similar mechanism works implicitly if a new exception is
  raised when an exception is already being handled. An exception may be handled
  when an `except` or `finally` clause, or a `with` statement, is used. The
  previous exception is then attached as the new exception's `__context__`
  attribute"*.
- *"Exception chaining can be explicitly suppressed by specifying `None` in the
  `from` clause"*. `__suppress_context__` added in 3.3.

## `BaseException` — library/exceptions.html

- `__cause__`: *"Set explicitly using `raise new_exc from original_exc`… Setting
  `__cause__` also implicitly sets the `__suppress_context__` attribute to
  `True`."*
- `__suppress_context__`: *"When `True`, the implicit exception context is
  suppressed from display. Using `raise new_exc from None` effectively replaces
  the old exception with the new one for display purposes … while leaving the old
  exception available in `__context__` for introspection when debugging."*
  🔴 **`from None` hides it from the display, it does not erase it.**
- `__traceback__`: *"A writable field that holds the traceback object associated
  with this exception."*
- `with_traceback(tb)`: *"was more commonly used before the exception chaining
  features of PEP 3134 became available."*
- `add_note(note)` / `__notes__`: **added 3.11**; *"A `TypeError` is raised if
  `note` is not a string."*
- User-defined: *"programmers are encouraged to derive new exceptions from the
  `Exception` class or one of its subclasses, and not from `BaseException`."*
  Also: *"It's recommended to only subclass one exception type at a time to
  avoid any possible conflicts between how the bases handle the `args`
  attribute, as well as due to possible memory layout incompatibilities."*
- `args`: *"The tuple of arguments given to the exception constructor."*

## Exception groups — library/exceptions.html + PEP 654

- *"The difference between the two classes is that `BaseExceptionGroup` extends
  `BaseException` and it can wrap any exception, while `ExceptionGroup` extends
  `Exception` and it can only wrap subclasses of `Exception`. This design is so
  that `except Exception` catches an `ExceptionGroup` but not
  `BaseExceptionGroup`."*
- *"The `BaseExceptionGroup` constructor returns an `ExceptionGroup` rather than
  a `BaseExceptionGroup` if all contained exceptions are `Exception` instances"*;
  the `ExceptionGroup` constructor *"raises a `TypeError` if any contained
  exception is not an `Exception` subclass."*
- `message` and `exceptions` are **read-only**.
- `subgroup(condition)` / `split(condition)`: *"The nesting structure of the
  current exception is preserved in the result, as are the values of its
  `message`, `__traceback__`, `__cause__`, `__context__` and `__notes__`
  fields. Empty nested groups are omitted from the result."* 3.13 allows any
  callable as the condition.
- `derive(excs)`: subclasses override it *"in order to make `subgroup()` and
  `split()` return instances of the subclass rather than `ExceptionGroup`."*
  🔴 *"`BaseExceptionGroup` defines `__new__()`, so subclasses that need a
  different constructor signature need to override that rather than
  `__init__()`."*
- PEP 654 (**3.11**): *"a single exception group can cause several `except*`
  clauses to execute, but each such clause executes at most once (for all
  matching exceptions from the group) and each exception is either handled by
  exactly one clause (the first one that matches its type) or is reraised at the
  end."* Clauses are evaluated in order by calling `split` on the shrinking
  `unhandled` group.
- *"It is not possible to use both traditional `except` blocks and the new
  `except*` clauses in the same `try` statement."*
- *"It is possible to catch the `ExceptionGroup` and `BaseExceptionGroup` types
  with `except`, but not with `except*`"*.
- *"`continue`, `break`, and `return` are disallowed in `except*` clauses,
  causing a `SyntaxError`"*.
- A naked (non-group) exception matching an `except*` clause is wrapped in an
  `ExceptionGroup` with an empty message.
- Tutorial 8.9 note: *"the exceptions nested in an exception group must be
  instances, not types."*

## `assert` — reference/simple_stmts.html#the-assert-statement

- `assert expression` is equivalent to `if __debug__: if not expression: raise
  AssertionError`; the two-expression form passes the second to
  `AssertionError`.
- *"In the current implementation, the built-in variable `__debug__` is `True`
  under normal circumstances, `False` when optimization is requested (command
  line option `-O`). The current code generator emits no code for an `assert`
  statement when optimization is requested at compile time."*
- *"Assignments to `__debug__` are illegal. The value for the built-in variable
  is determined when the interpreter starts."*

## `contextlib.suppress` — library/contextlib.html

- *"Return a context manager that suppresses any of the specified exceptions if
  they occur in the body of a `with` statement and then resumes execution with
  the first statement following the end of the `with` statement."*
- *"As with any other mechanism that completely suppresses exceptions, this
  context manager should be used only to cover very specific errors where
  silently continuing with program execution is known to be the right thing to
  do."*
- Reentrant. Added 3.4. **Changed in 3.12:** supports suppressing exceptions
  raised as part of a `BaseExceptionGroup` — suppressed exceptions are removed
  from the group and the rest re-raised in a new group built with `derive()`.

## `warnings` — library/warnings.html

- *"Warning messages are typically issued in situations where it is useful to
  alert the user of some condition in a program, where that condition (normally)
  doesn't warrant raising an exception and terminating the program."*
- Ignored by default: `DeprecationWarning` (*"unless triggered by code in
  `__main__`"*), `PendingDeprecationWarning`, `ImportWarning`,
  `ResourceWarning`.
- `warnings.warn(message, category=None, stacklevel=1, source=None, *,
  skip_file_prefixes=())`; `stacklevel=2` *"makes the warning refer to
  `deprecated_api`'s caller, rather than to the source of `deprecated_api`
  itself."*
- Actions: `error`, `default`, `ignore`, `always`, `once`.
- `catch_warnings` thread-safety depends on `sys.flags.context_aware_warnings`;
  when false it modifies global state and is **not thread-safe** (the flag
  defaults true on free-threaded builds, false otherwise).
- `logging.captureWarnings()` routes warnings through logging. `-W` /
  `PYTHONWARNINGS` control filters from outside the code.

## `traceback` — library/traceback.html

- *"provides a standard interface to extract, format and print stack traces of
  Python programs."*
- `print_exc(limit=None, file=None, chain=True)` is *"shorthand for
  `print_exception(sys.exception(), limit=limit, file=file, chain=chain)`."*
- `format_exc(limit=None, chain=True)` returns a string.
- `print_exception(exc, /, [value, tb,] limit=None, file=None, chain=True)` —
  since **3.10** an exception object can be passed as the first argument
  instead of the old three-tuple.
- `chain=True`: *"chained exceptions (the `__cause__` or `__context__`
  attributes of the exception) will be printed as well, like the interpreter
  itself does when printing an unhandled exception."*
- `TracebackException.from_exception(exc, *, limit, lookup_lines,
  capture_locals, compact, max_group_width=15, max_group_depth=10)`;
  `format(*, chain=True)` returns a generator of strings.
- `max_group_width`/`max_group_depth` truncate group formatting (3.11);
  `format_exception_only(*, show_group=False)` (3.13).

## `sys` — library/sys.html

- `sys.exception()` (**3.11**): *"when called while an exception handler is
  executing (such as an `except` or `except*` clause), returns the exception
  instance that was caught by this handler. When exception handlers are nested
  within one another, only the exception handled by the innermost handler is
  accessible. If no exception handler is executing, this function returns
  `None`."*
- `sys.exc_info()`: *"returns the old-style representation of the handled
  exception … the tuple `(type(e), e, e.__traceback__)`"*; three `None`s if
  nothing is being handled. **Changed in 3.11:** type and traceback are derived
  from the value.
- `sys.excepthook(type, value, traceback)` is called for an uncaught exception
  other than `SystemExit`, *"just before the program exits"*; assign a
  three-argument function to customise.
- `sys.unraisablehook` handles exceptions with *"no way for Python to handle
  it. For example, when a destructor raises an exception or during garbage
  collection"*.

## `logging` — library/logging.html

- `Logger.exception(msg, *args, **kwargs)`: *"Logs a message with level `ERROR`
  on this logger… Exception info is added to the logging message. **This method
  should only be called from an exception handler.**"*
- `exc_info`: *"If `exc_info` does not evaluate as false, it causes exception
  information to be added to the logging message. If an exception tuple (in the
  format returned by `sys.exc_info()`) or an exception instance is provided, it
  is used; otherwise, `sys.exc_info()` is called to get the exception
  information."*
- `stack_info` is **not** the same as `exc_info`: *"the former is stack frames
  from the bottom of the stack up to the logging call in the current thread,
  whereas the latter is information about stack frames which have been unwound,
  following an exception, while searching for exception handlers."*

## Other sources used

- PEP 3134 (chained exceptions, the origin of `__cause__`/`__context__`).
- PEP 678 (`add_note`, 3.11).
- PEP 765 (`finally` jump warning, 3.14) — already used by chunk `03f`.
- Tutorial 8.6 *"Exceptions should typically be derived from the `Exception`
  class, either directly or indirectly."* and *"Most exceptions are defined with
  names that end in 'Error', similar to the naming of the standard
  exceptions."*
