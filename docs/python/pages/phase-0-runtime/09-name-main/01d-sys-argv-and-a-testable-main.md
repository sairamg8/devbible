---
title: "sys.argv[0] holds five different things depending on how you launched, which is why main should take argv as a parameter"
sidebar_label: "1d · sys.argv and a testable main"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`sys.argv`](https://docs.python.org/3.14/library/sys.html#sys.argv),
> [`sys.orig_argv`](https://docs.python.org/3.14/library/sys.html#sys.orig_argv),
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (the `-m` and `-c` options) and
> [`argparse`](https://docs.python.org/3.14/library/argparse.html).
> Version spine: **CPython 3.14.7**.

**Command-line arguments do not arrive as parameters; they sit in a global list
that the interpreter fills differently for each way of starting a program. That
global is why so much CLI code is hard to test — it is read at import time, from
a variable no caller controls. The fix is one parameter with one default:
`def main(argv=None)`, reading `sys.argv[1:]` only when nobody passed anything.
Every testing pattern in this topic follows from that single signature.**

## What the interpreter puts in `sys.argv[0]`

> *"The list of command line arguments passed to a Python script. `argv[0]` is
> the script name (it is operating system dependent whether this is a full
> pathname or not). If the command was executed using the `-c` command line
> option to the interpreter, `argv[0]` is set to the string `'-c'`. If no script
> name was passed to the Python interpreter, `argv[0]` is the empty string."*

And for `-m`, from the command-line docs:

> *"If this option is given, the first element of `sys.argv` will be the full
> path to the module file (while the module file is being located, the first
> element will be set to `"-m"`). As with the `-c` option, the current directory
> will be added to the start of `sys.path`."*

| Launch | `sys.argv[0]` |
|---|---|
| `python tool.py --flag` | `tool.py` (as written; OS-dependent whether absolute) |
| `python -m mypkg --flag` | the full path to `mypkg/__main__.py` |
| *during* `-m` module lookup | the literal `"-m"` |
| `python -c "..."` | `"-c"` |
| `python` with code on stdin | the empty string |
| an installed console script | the path to the generated wrapper |

Six values for one variable. Anything that reads it to decide *what program this
is* will be wrong under at least one of them — which is why usage messages
generated from `sys.argv[0]` say `__main__.py` when the tool is invoked with
`-m`.

```python
parser = argparse.ArgumentParser(prog="mytool")   # a constant, not sys.argv[0]
```

`sys.orig_argv` exists for the rare case where you genuinely need the process's
original command line including the interpreter and its options; `sys.argv` has
already had those stripped.

## The one signature that makes an entry point testable

```python
import sys

def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(sys.argv[1:] if argv is None else argv)
    if args.dry_run:
        print(plan(args))
        return 0
    return execute(args)

if __name__ == "__main__":
    raise SystemExit(main())
```

Two properties, both load-bearing:

- **`argv=None` default.** pip's console-script wrapper calls `main()` with no
  arguments, and so does the guard. Neither has to know about the parameter.
- **`sys.argv[1:]`, not `sys.argv`.** `argparse` expects the arguments *after*
  the program name; passing the whole list makes `argparse` treat the script
  path as a positional argument.

A test now reads:

```python
def test_dry_run_prints_a_plan(capsys):
    assert main(["--dry-run", "input.csv"]) == 0
    assert "would upload" in capsys.readouterr().out
```

No subprocess, no `monkeypatch.setattr(sys, "argv", ...)`, and a real integer to
assert on.

## Generalising: every ambient input becomes a defaulted parameter

`sys.argv` is only the most visible global an entry point reads. The others are
`os.environ`, `sys.stdin`/`sys.stdout`, the clock, and the working directory.
The same trick works on all of them:

```python
def main(
    argv: list[str] | None = None,
    *,
    env: Mapping[str, str] | None = None,
    stdout: TextIO | None = None,
) -> int:
    argv = sys.argv[1:] if argv is None else argv
    env = os.environ if env is None else env
    out = sys.stdout if stdout is None else stdout
    ...
```

This is not over-engineering. It is the difference between a CLI you can call
in-process from a test — or from another Python program, or from a plugin — and
one you can only exercise by launching subprocesses and parsing their output.
The production call sites all pass nothing and get the ambient behaviour.

## `argparse`: parser construction versus parsing

Splitting these two is what lets the parser be introspected without the parse
happening:

```python
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="mytool")
    p.add_argument("path", type=pathlib.Path)
    p.add_argument("--dry-run", action="store_true")
    return p

def main(argv=None) -> int:
    args = build_parser().parse_args(argv)     # argv=None → sys.argv[1:]
    ...
```

`build_parser` at module scope is fine and sometimes required — documentation
extensions and shell-completion generators want a parser object without running
the program. `parse_args()` at module scope never is: it reads whichever
process's `sys.argv` is current at import time, and on a usage error it calls
`sys.exit(2)`.

Note that `parse_args(None)` already means "use `sys.argv[1:]`", so passing
`argv` straight through is enough; the explicit `sys.argv[1:]` in the earlier
example matters when you are not using `argparse`.

## Gotchas

### `argparse.parse_args()` at module level

**Symptom.** Importing your module in another program makes that program reject
its own command-line arguments with `unrecognized arguments`, or `pytest`
collection exits 2 with a usage message and no test names.
**Cause.** `parse_args()` at module scope reads `sys.argv` at import time. It
has no idea whose `sys.argv` it is reading, and on failure `argparse` calls
`sys.exit(2)` — which during collection surfaces as a collection error rather
than an argument problem.
**Fix.** Split construction from parsing, as above: `build_parser()` may live at
module level; `parse_args()` goes inside `main`.

### Passing `sys.argv` instead of `sys.argv[1:]`

**Symptom.** `error: unrecognized arguments: input.csv`, or the script path
lands in a positional argument.
**Cause.** `sys.argv[0]` is the program name, not an argument. `argparse`
strips it only when you let it read `sys.argv` itself.
**Fix.** `parse_args(sys.argv[1:])`, or better, `parse_args(argv)` with
`argv=None` and let `argparse` do it.

### Deriving the program name from `sys.argv[0]`

**Symptom.** Usage messages say `__main__.py`, or an absolute path, or `-c`,
depending on how the program was started.
**Cause.** `sys.argv[0]` reflects the launch mode, not the program.
**Fix.** `argparse.ArgumentParser(prog="mytool")` with a literal, and the same
literal in log lines and error messages.

### Mutating `sys.argv` in a test and not restoring it

**Symptom.** One test passes alone and fails in a full run, or a later test sees
the previous test's flags.
**Cause.** `sys.argv` is process-global state and a plain assignment survives the
test.
**Fix.** Stop touching it — call `main(["--flag"])`. If you must, use
`monkeypatch.setattr(sys, "argv", [...])`, which restores automatically.

### Reading `sys.argv` inside a worker function

**Symptom.** A `multiprocessing` worker parses arguments differently from its
parent, or re-runs the CLI.
**Cause.** `multiprocessing`'s spawn machinery ships the parent's `sys.argv` to
the child and restores it there — see
[chunk 4](04-multiprocessing-and-the-guard.md) — so any argument parsing outside
the guard runs again in every child.
**Fix.** Parse once, in `main`, under the guard, and pass the resulting values
to workers as ordinary picklable function arguments.

### Bytes, encodings and non-UTF-8 filenames

**Symptom.** A filename with a broken encoding round-trips through your tool and
comes out mangled, or raises `UnicodeEncodeError` on the way to `open()`.
**Cause.** The docs note that on Unix arguments arrive as bytes and Python
decodes them with the filesystem encoding and the `surrogateescape` error
handler:

> *"On Unix, command line arguments are passed by bytes from OS. Python decodes
> them with filesystem encoding and 'surrogateescape' error handler. When you
> need original bytes, you can get it by `[os.fsencode(arg) for arg in
> sys.argv]`."*

**Fix.** Keep path arguments as `str` and hand them to `pathlib`/`open`, which
re-encode with the same error handler and round-trip correctly. Only reach for
`os.fsencode` when you must hand raw bytes to something else.

### Assuming an installed console script has the same `argv[0]`

**Symptom.** Log lines or `prog` strings differ between `python -m mypkg` and
the installed `mytool` command.
**Cause.** The console script is a generated wrapper file, so `sys.argv[0]` is
its path, not your module's.
**Fix.** As always: a constant. This is one more reason the two launch routes
should converge on the same `main`.

## Interview questions

**★ How do you make a CLI entry point unit-testable?**
Give `main` an `argv` parameter defaulting to `None`, and read `sys.argv[1:]`
only when it is `None`. The console-script wrapper still calls `main()` with no
arguments, and a test calls `main(["--flag", "value"])` directly, asserting on
the returned exit code and on captured stdout. Extend the same idea to anything
else the entry point reads from the ambient environment — the config source, the
output stream, the clock — and the whole program becomes callable in-process
with no subprocess and no monkeypatching of globals.

**★ What is `sys.argv[0]` under each launch mode?**
The script path for a file argument (absolute or relative is OS-dependent), the
full path to the module file for `-m` — and the literal `"-m"` while the module
is still being located — the string `"-c"` for `-c`, and the empty string when
no script name was passed at all. An installed console script gives the path to
the generated wrapper. Because of that spread, `sys.argv[0]` is unusable as a
program identity; keep the program name in a constant.

**Should `argparse` live at module level or inside `main`?**
Build the parser wherever you like — a module-level `build_parser()` *function*
is useful for documentation and completion tooling — but call `parse_args()`
only inside `main`, and pass it the `argv` you were given. A module-level
`parse_args()` reads whichever process's `sys.argv` happens to be current at
import time and calls `sys.exit(2)` when it does not like what it finds, which
during test collection looks like an unexplained collection failure.

**Why `sys.argv[1:]` and not `sys.argv`?**
Because element zero is the program name, not an argument. `argparse` strips it
for you only when you let it read `sys.argv` itself — which is what
`parse_args(None)` does. Pass the whole list explicitly and the script path
becomes a positional argument, producing an `unrecognized arguments` error that
looks like a bug in the parser.

**What is `sys.orig_argv` for?**
The process's original command line, including the interpreter path and any
interpreter options — `-X`, `-O`, `-m` and so on — that `sys.argv` has already
had removed. It is what you want when re-executing yourself with the same
options, or when a diagnostic needs to report exactly how the process was
started. It is not a substitute for `sys.argv`.

**Why do arguments containing odd bytes survive a round trip through Python?**
Because on Unix the OS hands over bytes and CPython decodes them with the
filesystem encoding and the `surrogateescape` error handler, which maps
undecodable bytes to lone surrogates. Passing that string back to `open()` or
`pathlib` re-encodes it with the same handler, restoring the original bytes.
Printing it, or sending it to something with a different encoder, is where it
breaks — and `os.fsencode(arg)` is how you get the original bytes back
deliberately.

---

← Prev: [The entry-point contract](01c-the-entry-point-contract.md) · Index: [if __name__ == "__main__"](README.md) · Next → [__main__.py and python -m](02-main-py-and-dash-m.md)
