---
title: "sys.exit(main()) is a contract with pip's console-script wrapper, not boilerplate: main returns a status and the guard is the only place it reaches the OS"
sidebar_label: "1c · The entry-point contract"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`__main__` — Top-level code environment](https://docs.python.org/3.14/library/__main__.html)
> (Packaging Considerations),
> [`sys.exit`](https://docs.python.org/3.14/library/sys.html#sys.exit) and
> [`SystemExit`](https://docs.python.org/3.14/library/exceptions.html#SystemExit).
> Version spine: **CPython 3.14.7**.

**`if __name__ == "__main__": sys.exit(main())` looks like boilerplate and is
actually an interface definition. It fixes three things at once: that the
program's behaviour lives in a callable named `main`, that `main` *returns* an
exit status rather than raising one, and that the guard is the only place the
status reaches the operating system. Follow it and the file behaves identically
run as a file, run with `-m`, and installed as a console script — because pip's
generated wrapper calls exactly the same function the same way.**

## The convention, and where it comes from

> *"`main` functions are often used to create command-line tools by specifying
> them as entry points for console scripts. When this is done, pip inserts the
> function call into a template script, where the return value of `main` is
> passed into `sys.exit()`."*

> *"By proactively following this convention ourselves, our module will have the
> same behavior when run directly (i.e. `python echo.py`) as it will have if we
> later package it as a console script entry-point in a pip-installable
> package."*

So the shape is fixed by what the packaging tooling will do to your code later:

```python
def main(argv: list[str] | None = None) -> int:
    ...
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

`raise SystemExit(main())` is identical in effect — `sys.exit` is documented as
raising `SystemExit` — and saves importing `sys` in a module that otherwise does
not need it.

## What `main()` may return

`sys.exit` accepts three shapes, and only two of them are what you usually want:

| `main()` returns | Process exit status | Where it goes |
|---|---|---|
| `None` | 0 | — |
| `0` | 0 | — |
| a non-zero `int` | that integer | — |
| a string | **1** | the string, to stderr |
| anything else | 1 | its `repr`, to stderr |

The docs flag the string case specifically:

> *"In particular, be careful about returning strings from your `main` function.
> `sys.exit()` will interpret a string argument as a failure message, so your
> program will have an exit code of 1, indicating failure, and the string will
> be written to `sys.stderr`."*

That is genuinely useful when you *mean* it — `return "config file not found"`
is a one-line error path with the right exit code and the right stream — and a
silent failure when `main` returns a report it expected to be printed.

Exit codes worth being deliberate about: `0` success, `1` generic failure, `2`
by convention a usage error (which is what `argparse` uses), and `130` for
"interrupted by `Ctrl-C`" if you catch `KeyboardInterrupt` yourself.

## `SystemExit` is a `BaseException` on purpose

```
BaseException
 ├── SystemExit
 ├── KeyboardInterrupt
 ├── GeneratorExit
 └── Exception
      └── everything you normally catch
```

`SystemExit` sits outside `Exception` so a program can wrap its work in
`except Exception:` for error reporting without accidentally converting a
requested exit into a caught error. The standard entry-point error handler:

```python
def main(argv: list[str] | None = None) -> int:
    try:
        return run(argv)
    except KeyboardInterrupt:
        return 130
    except Exception as exc:          # not BaseException, not bare except:
        logger.exception("unhandled error")
        print(f"error: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
```

A bare `except:` here swallows `Ctrl-C` and turns every deliberate `sys.exit(2)`
raised further down into exit code 1. That is the strongest practical argument
against ever writing one.

## Gotchas

### Returning a string from `main()`

**Symptom.** The program exits 1 and prints your success message to stderr.
**Cause.** `sys.exit(str)` is documented to treat a string argument as an error
message.
**Fix.** Return `0`/`None` for success and a non-zero `int` for failure, and
print anything the user should read yourself:

```python
def main() -> int:
    print(build_report())        # to stdout, deliberately
    return 0
```

### `main()` calling `sys.exit()` itself

**Symptom.** A test that calls `main([...])` fails with `SystemExit` instead of
returning a value, and every test needs `pytest.raises(SystemExit)`.
**Cause.** `main` is raising instead of returning, so the exit decision has
moved out of the guard and into business logic.
**Fix.** `return 1` instead of `sys.exit(1)`, everywhere below `main`. Reserve
the raise for the guard:

```python
def run(args) -> int:
    if not args.path.exists():
        print(f"no such file: {args.path}", file=sys.stderr)
        return 2                      # not sys.exit(2)
    ...
    return 0
```

The one raise you cannot avoid is `argparse`'s: it exits on a usage error by
design, so a test for that path does legitimately need
`pytest.raises(SystemExit)`.

### A bare `except:` around the entry point

**Symptom.** `Ctrl-C` stops working; a deliberate `sys.exit(2)` deep in the
program becomes exit code 1 or 0.
**Cause.** `SystemExit` and `KeyboardInterrupt` derive from `BaseException`, so
`except:` and `except BaseException:` catch them.
**Fix.** Catch `Exception`, and catch `KeyboardInterrupt` explicitly if you want
a clean interrupt message, as in the handler above.

### An `async def main` handed straight to `sys.exit`

**Symptom.** The program exits 1 immediately, prints something resembling a
coroutine object's repr to stderr, and emits a `RuntimeWarning` that the
coroutine was never awaited.
**Cause.** Calling a coroutine function returns a coroutine object without
running it. `sys.exit` receives a non-`int`, non-`None` object and treats it as
an error message.
**Fix.** `raise SystemExit(asyncio.run(main()))`.

### Swallowing the exit code by catching too late

**Symptom.** A failing job reports success to the scheduler and nobody notices
for a week.
**Cause.** `main()` returns `None` on a path that logged an error, because the
error handler logged and fell through without a `return 1`.
**Fix.** Give `main` an explicit `-> int` annotation and turn on the type
checker's "missing return" rule; `mypy --warn-no-return` and pyright both flag a
path that falls off the end of an `int`-returning function.

### `os._exit()` in an entry point

**Symptom.** Output is truncated, files are half-written, `atexit` handlers do
not run, and `finally` blocks are skipped.
**Cause.** `os._exit()` terminates immediately without unwinding the stack,
flushing buffers or running cleanup. It exists for the child of a `fork` that
must not run the parent's cleanup.
**Fix.** `sys.exit()` / `raise SystemExit(...)` everywhere else.

## Interview questions

**★ What should `main()` return, and why does it matter?**
An exit status: `None` or `0` for success, a non-zero `int` for failure. The
guard passes it to `sys.exit()`, which matches what pip's generated
console-script wrapper does, so `python echo.py` and the installed `echo`
command behave identically — same exit codes, same shell scripting around them.
Returning a string is a trap: `sys.exit()` treats a string as a failure message,
writes it to stderr and exits 1.

**★ Why does `except Exception` not catch `sys.exit()`?**
Because `sys.exit()` raises `SystemExit`, which inherits from `BaseException`
rather than `Exception`. That is deliberate: it lets a program wrap its work in
`except Exception` for error reporting without accidentally converting a
requested exit into a caught error. `KeyboardInterrupt` and `GeneratorExit` sit
in the same position for the same reason, which is the strongest argument
against ever writing a bare `except:`.

**★ Why should `main` return an exit code rather than call `sys.exit` itself?**
Because raising from inside the logic makes the function hard to call from
anywhere except a shell. A test has to wrap every call in
`pytest.raises(SystemExit)` and dig the code out of the exception; another
Python program cannot reuse `main` at all. Returning keeps `main` an ordinary
function and confines the process-terminating behaviour to one line under the
guard — the same line pip generates for the console script.

**What is the difference between `sys.exit(1)` and `raise SystemExit(1)`?**
None that matters at runtime. `sys.exit` is documented as raising `SystemExit`;
the function exists mostly for readability and for the `site`-injected `exit()`
convenience at the prompt. `raise SystemExit(...)` avoids importing `sys` in a
module that needs it for nothing else, which is why small entry points often use
it.

**And `os._exit()`?**
Completely different. `os._exit()` calls the OS primitive directly: no stack
unwinding, no `finally` blocks, no `atexit` handlers, no buffer flushes. It
exists for the child side of a `fork()` that must not run the parent's cleanup
code, and for a process that has decided its own state is too corrupt to unwind.
Using it in an entry point truncates output.

**What exit codes should a CLI use?**
`0` for success and non-zero for failure is the only part the shell cares about.
Beyond that, `2` for a usage error is the convention `argparse` already follows,
`1` is the generic failure, and `130` (128 + SIGINT) is the conventional code
for "the user pressed `Ctrl-C`". Whatever you pick, document it, because
somebody's CI job will branch on it.

---

← Prev: [What belongs inside the guard](01b-what-belongs-in-the-guard.md) · Index: [if __name__ == "__main__"](README.md) · Next → [sys.argv and a testable main](01d-sys-argv-and-a-testable-main.md)
