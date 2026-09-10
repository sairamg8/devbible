---
title: "The function an entry point names is called with no arguments and its return value goes straight to sys.exit — so the contract is argv from sys.argv, an int from 0 to 127, exceptions mapped to exit codes on purpose, and a closed pipe handled before Python's own shutdown turns it into a traceback"
sidebar_label: "03 · The function contract"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the PyPA *Entry points specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)), the Python 3.14 documentation — [`sys.exit`](https://docs.python.org/3.14/library/sys.html), [`SystemExit`](https://docs.python.org/3.14/library/exceptions.html), [`__main__` → Packaging considerations](https://docs.python.org/3.14/library/__main__.html), [`Py_RunMain`](https://docs.python.org/3.14/c-api/interp-lifecycle.html), [Note on SIGPIPE](https://docs.python.org/3.14/library/signal.html#note-on-sigpipe), [`argparse`](https://docs.python.org/3.14/library/argparse.html), [What's New in 3.8](https://docs.python.org/3.14/whatsnew/3.8.html) — and two real entry points read at named tags: flake8 **7.3.0** [`main/cli.py`](https://github.com/PyCQA/flake8/blob/7.3.0/src/flake8/main/cli.py) and pytest **9.1.1** [`_pytest/config/__init__.py`](https://github.com/pytest-dev/pytest/blob/9.1.1/src/_pytest/config/__init__.py).
> Target: **Python 3.14.7** · uv 0.12.12 · ruff 0.16.6 · pre-commit 4.6.2. Documentation-validated — **no sandbox run, no program output**.

**Every installer's wrapper ends in `sys.exit(your_function())` ([01](01-what-the-installer-writes.md)), and that one expression is the whole interface between your code and everything that runs it — shells, CI, `make`, cron, a parent process waiting on a status. It fixes four things. Your function receives nothing, so arguments come from `sys.argv`. Its return value *is* the exit status, so `None` means success and a string means failure with a message. An exception that escapes it is a traceback and status 1, whether or not that was meant. And the interpreter's shutdown still runs after it returns, which is where a reader that closed the pipe early turns into a `BrokenPipeError` you never see in testing. A CLI is correct when each of those is decided on purpose.**

## What the specification promises

> *"The object reference points to a function which will be called with no arguments when this command is run. The function may return an integer to be used as a process exit code, and returning `None` is equivalent to returning `0`."*
> — [entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/)

The Python documentation says the same thing from the side of `__main__`:

> *"`main` functions are often used to create command-line tools by specifying them as entry points for console scripts. When this is done, pip inserts the function call into a template script, where the return value of `main` is passed into `sys.exit()`."*
> — [`__main__`](https://docs.python.org/3.14/library/__main__.html)

"Called with no arguments" is literal: the wrapper evaluates `main()`. Anything the function needs from the command line it reads from `sys.argv`, whose first element the wrapper has already cleaned of any `.exe` suffix.

## What `sys.exit` does with each kind of return value

> *"If it is an integer, zero is considered "successful termination" and any nonzero value is considered "abnormal termination" by shells and the like. Most systems require it to be in the range 0–127, and produce undefined results otherwise. Some systems have a convention for assigning specific meanings to specific exit codes, but these are generally underdeveloped; Unix programs generally use 2 for command line syntax errors and 1 for all other kinds of errors. If another type of object is passed, `None` is equivalent to passing zero, and any other object is printed to `stderr` and results in an exit code of 1."*
> — [`sys.exit`](https://docs.python.org/3.14/library/sys.html)

And for what escapes the function instead of being returned, the C API documents the interpreter's own exit status: *"the return value will be `0` if the interpreter exits normally (that is, without raising an exception), the exit status of an unhandled `SystemExit`, or `1` for any other unhandled exception"* ([`Py_RunMain`](https://docs.python.org/3.14/c-api/interp-lifecycle.html)).

| Your function… | Exit status | What the caller sees |
|---|---:|---|
| returns `0` or `None`, or falls off the end | 0 | success |
| returns `1`, `2`, … up to 127 | that number | failure, with your chosen meaning |
| returns a string | 1 | the string on stderr — a failure |
| returns any other object (a list, a coroutine) | 1 | that object's text on stderr |
| raises `SystemExit(n)` anywhere | `n` | no traceback — *"When it is not handled, the Python interpreter exits; no stack traceback is printed"* ([exceptions](https://docs.python.org/3.14/library/exceptions.html)) |
| lets any other exception escape | 1 | a traceback |
| is interrupted by Ctrl-C and does not catch it | killed by SIGINT | since 3.8 *"the Python process now exits via a SIGINT signal or with the correct exit code such that the calling process can detect that it died due to a Ctrl-C"* ([What's New 3.8](https://docs.python.org/3.14/whatsnew/3.8.html)) |

The `__main__` documentation singles out the string case because it looks harmless:

> *"In particular, be careful about returning strings from your `main` function. `sys.exit()` will interpret a string argument as a failure message, so your program will have an exit code of `1`, indicating failure, and the string will be written to `sys.stderr`."*

## The shape that satisfies the contract

flake8 7.3.0's console script target, `src/flake8/main/cli.py`, verbatim:

```python
def main(argv: Sequence[str] | None = None) -> int:
    """Execute the main bit of the application.

    This handles the creation of an instance of :class:`Application`, runs it,
    and then exits the application.

    :param argv:
        The arguments to be passed to the application for parsing.
    """
    if argv is None:
        argv = sys.argv[1:]

    app = application.Application()
    app.run(argv)
    return app.exit_code()
```

Three properties to copy. The parameter is optional, so the wrapper's no-argument call works while a test can pass a list. It returns an `int` on every path. And it does not call `sys.exit` itself — the wrapper does that — so a test can call `main([...])` and assert on the return value without catching `SystemExit`.

The same shape with `argparse`, and with the exception-to-status mapping made explicit:

```python
# src/invoice_service/cli.py
import argparse
import logging
import sys
from collections.abc import Sequence

from invoice_service.errors import CustomerNotFound, InvoiceError

EXIT_OK = 0
EXIT_FAILURE = 1
EXIT_USAGE = 2          # argparse's own code for a bad command line


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Issue invoices.")
    parser.add_argument("--customer", required=True)
    parser.add_argument("--verbose", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)        # None → sys.argv[1:]
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING)
    try:
        from invoice_service.issue import issue_invoice
        issue_invoice(args.customer)
    except CustomerNotFound as exc:
        print(f"invoice: {exc}", file=sys.stderr)
        return EXIT_USAGE
    except InvoiceError as exc:
        print(f"invoice: {exc}", file=sys.stderr)
        return EXIT_FAILURE
    return EXIT_OK
```

`parse_args(argv)` with `None` falls back to the process arguments — the `argparse` documentation says of `args`, *"The default is taken from `sys.argv`."* Two behaviours of `argparse` belong to the contract: `error()` *"prints a usage message, including the message, to `sys.stderr` and terminates the program with a status code of 2"*, and `--help` exits too. Both leave by raising `SystemExit`, not by returning — which the tests below have to allow for. Logging is configured inside `main`, not at import, so importing the module in a test or a plugin host has no side effects.

## The closed pipe: handle it in the entry point

`invoice list | head -n 5` is a normal thing to type, and it breaks a naive CLI:

> *"Piping output of your program to tools like head(1) will cause a `SIGPIPE` signal to be sent to your process when the receiver of its standard output closes early. This results in an exception like `BrokenPipeError: [Errno 32] Broken pipe`. To handle this case, wrap your entry point to catch this exception as follows:"*
> — [Note on SIGPIPE](https://docs.python.org/3.14/library/signal.html#note-on-sigpipe)

pytest 9.1.1 does exactly that in its real console-script target, `_console_main` — and its comment links the same note:

```python
def _console_main() -> int:
    """The CLI entry point of pytest (internal).

    This is the real implementation used by entry points and ``__main__.py``.
    """
    # https://docs.python.org/3/library/signal.html#note-on-sigpipe
    try:
        code = _main(prog=_get_prog_name(sys.argv))
        sys.stdout.flush()
        return code
    except BrokenPipeError:
        # Python flushes standard streams on exit; redirect remaining output
        # to devnull to avoid another BrokenPipeError at shutdown
        devnull = os.open(os.devnull, os.O_WRONLY)
        os.dup2(devnull, sys.stdout.fileno())
        return 1  # Python exits with error code 1 on EPIPE
```

Two details carry the fix. The explicit `sys.stdout.flush()` forces the failure to happen *inside* the `try`, where it can be caught, rather than during shutdown. And pointing file descriptor 1 at `os.devnull` stops the interpreter's final flush from failing again — which, per `sys.exit`, would otherwise change the status: *"If an error occurs in the cleanup after the Python interpreter has caught `SystemExit` (such as an error flushing buffered data in the standard streams), the exit status is changed to 120."* The note also rules out the shortcut: *"Do not set `SIGPIPE`'s disposition to `SIG_DFL` in order to avoid `BrokenPipeError`. Doing that would cause your program to exit unexpectedly whenever any socket connection is interrupted while your program is still writing to it."*

The same wrapper applied to `invoice`, splitting the handling from the work:

```python
import os


def main(argv: Sequence[str] | None = None) -> int:
    try:
        code = _run(argv)
        sys.stdout.flush()
        return code
    except BrokenPipeError:
        devnull = os.open(os.devnull, os.O_WRONLY)
        os.dup2(devnull, sys.stdout.fileno())
        return EXIT_FAILURE
```

pytest's history adds one more lesson about the target itself: in 9.1 its public `pytest.console_main` became deprecated — *"It was never intended for programmatic use; use pytest.main() instead"* — and the console script now points at the private `_pytest.config:_console_main`. The function an entry point names is a public name the moment someone imports it; keeping it private, and offering a separate programmatic API, keeps you free to change it.

## Testing the contract without a subprocess

```python
# tests/test_cli.py
import pytest

from invoice_service.cli import EXIT_OK, EXIT_USAGE, main


def test_success_returns_zero(capsys):
    assert main(["--customer", "acme"]) == EXIT_OK


def test_missing_argument_exits_with_usage_status():
    with pytest.raises(SystemExit) as excinfo:
        main([])
    assert excinfo.value.code == EXIT_USAGE


def test_help_exits_zero():
    with pytest.raises(SystemExit) as excinfo:
        main(["--help"])
    assert excinfo.value.code == 0
```

These test the function. They do not test that the wrapper exists, that its shebang is valid, or that the installed package contains `invoice_service.cli` — that needs the installed command itself (**12** *(not written yet)*).

## Gotchas

**★ Symptom: the command prints an error and CI still goes green.** Cause: the function printed and returned `None`, and `sys.exit(None)` is status 0. Fix: return a non-zero `int` on every failure path.

```python
if not config_path.exists():
    print(f"invoice: no config at {config_path}", file=sys.stderr)
    return EXIT_FAILURE
```

**★ Symptom: a successful run exits with status 1 and prints its own result on stderr.** Cause: `main` returns a string — for example a summary — and *"`sys.exit()` will interpret a string argument as a failure message."* Fix: print the result and return an int.

```python
print(summary)
return EXIT_OK
```

**★ Symptom: `invoice list | head` ends with a `BrokenPipeError` traceback, or exits 120.** Cause: `head` closed the pipe; the next write raised, and if it escaped or happened during the final flush, shutdown reported it — the 120 is the documented status for a flush failure after `SystemExit`. Fix: flush inside the entry point and redirect stdout to `os.devnull` on `BrokenPipeError`, as the signal documentation and pytest's `_console_main` do.

```python
except BrokenPipeError:
    devnull = os.open(os.devnull, os.O_WRONLY)
    os.dup2(devnull, sys.stdout.fileno())
    return EXIT_FAILURE
```

**★ Symptom: `TypeError: main() missing 1 required positional argument: 'argv'`.** Cause: the wrapper calls the target with no arguments. Fix: make every parameter optional.

```python
def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return run(args)
```

**★ Symptom: the entry point is `async def main()`, and the command does nothing except print the coroutine object's representation on stderr and exit 1.** Cause: calling a coroutine function returns a coroutine object without running it, and `sys.exit` treats any non-int object as a failure message. Fix: keep the entry point synchronous and start the event loop inside it.

```python
import asyncio


def main() -> int:
    return asyncio.run(_main_async())


async def _main_async() -> int:
    await sync_invoices()
    return 0
```

**Symptom: a command that returns the number of failed items occasionally reports success when many items failed.** Cause: exit statuses outside 0–127 *"produce undefined results"* per the `sys.exit` documentation, so a count is not a status. Fix: map the count to a fixed code.

```python
return EXIT_FAILURE if failed else EXIT_OK
```

**Symptom: a library function deep in the package calls `sys.exit(1)`, and a web worker that imported it dies with no traceback.** Cause: `sys.exit` raises `SystemExit`, which is not caught by `except Exception` and ends the process wherever it escapes. Fix: raise a domain exception in library code and choose the exit status only in the entry point.

```python
class InvoiceError(Exception):
    """Raised by library code; mapped to an exit status only in cli.main."""
```

**Symptom: calling `sys.exit(2)` from a worker thread does not stop the command.** Cause: *"it will only exit the process when called from the main thread"* — in any other thread it ends that thread only. Fix: report the failure back to the main thread and return the status from `main`.

```python
from concurrent.futures import ThreadPoolExecutor


def main() -> int:
    with ThreadPoolExecutor() as pool:
        results = list(pool.map(sync_one, customers()))
    return EXIT_OK if all(results) else EXIT_FAILURE
```

**Symptom: tests that call `main(["--help"])` abort the test session or report an unexpected `SystemExit`.** Cause: `argparse` leaves through `SystemExit` for `--help` and for usage errors (status 2) rather than returning. Fix: assert on the exception, as in `test_help_exits_zero` above.

```python
with pytest.raises(SystemExit) as excinfo:
    main(["--help"])
assert excinfo.value.code == 0
```

**Symptom: the program name in help text changed between Python versions for `python -m invoice_service`.** Cause: since 3.14, *"The default `prog` value now reflects how `__main__` was actually executed"* — `-m` gives the interpreter name, `-m` and the module. A console script on POSIX, which passes the wrapper file as the script, still shows the base name of `sys.argv[0]`. Fix: pass `prog` explicitly when the text matters, such as in snapshot tests.

```python
parser = argparse.ArgumentParser(prog="invoice")
```

## Interview questions

**★ What does the specification promise about the function an entry point names?**
That it is *"called with no arguments when this command is run"* and that it *"may return an integer to be used as a process exit code, and returning `None` is equivalent to returning `0`"*. Everything else follows from the wrapper being `sys.exit(func())`: arguments come from `sys.argv`, the return value is the status, and whatever `sys.exit` does with a non-integer — print it and exit 1 — is what your command does if you return one.

**★ Why is `def main(argv=None) -> int` the standard signature?**
Because it satisfies two callers at once. The wrapper calls `main()` with nothing, so `argv` falls back to `sys.argv[1:]` and the function behaves as the installed command. A test calls `main(["--customer", "acme"])` with an explicit list and asserts on the returned int, with no subprocess and no patching of `sys.argv`. Returning instead of calling `sys.exit` inside keeps the exit decision in one place — the wrapper — and keeps the function usable from other Python code. flake8's console script is exactly this shape.

**★ Why must a CLI handle `BrokenPipeError` specially, and why not just restore the default `SIGPIPE` behaviour?**
Because piping into `head` or `less` closes the read end early, the next write to stdout raises `BrokenPipeError`, and if that happens during the interpreter's final flush it is reported after your code has finished — the documented exit status for a flush failure after `SystemExit` is 120. The documented fix flushes inside a `try` in the entry point and, on `BrokenPipeError`, points stdout at `os.devnull` so the final flush succeeds. Restoring the default disposition is explicitly discouraged, because it would kill the process whenever any socket it writes to is interrupted, not just stdout.

**What exit status does an uncaught exception produce, and why does it matter?**
One — the C API documents `1` *"for any other unhandled exception"*, after `0` for normal exit and the code of an unhandled `SystemExit`. So a crash is indistinguishable, by status alone, from a deliberate `return 1`. A CLI that wants callers to tell usage errors, expected failures and bugs apart has to map its own exceptions to distinct codes in the entry point — conventionally 2 for command-line errors, as the `sys.exit` documentation and `argparse` both do — and leave only genuine bugs to become tracebacks.

**Why should library code never call `sys.exit`?**
Because `SystemExit` inherits from `BaseException` so that `except Exception` does not catch it, which means a `sys.exit` deep inside a library ends whatever process imported it — a web server worker, a test run, a plugin host — with no traceback. The exit status is a property of the command, not of the library, so the library raises a domain exception and the entry point decides what status that becomes.

**Why did pytest point its console script at a private function?**
Because the object an entry point names becomes importable public API whether you intended it or not. pytest 9.1 deprecated `pytest.console_main` with the message that it *"was never intended for programmatic use; use pytest.main() instead"*, and its `[project.scripts]` now name `_pytest.config:_console_main`. Separating the command's target — which may print, handle `BrokenPipeError` and return statuses — from a documented programmatic API lets each change independently.

---

← Prev: [02 · Windows launchers and GUI scripts](02-windows-launchers-and-gui-scripts.md) · [Topic index](README.md) · Next → [04 · `python -m` and `__main__.py`](04-python-m-and-dunder-main.md)
