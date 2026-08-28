---
title: "python -c runs a string with no file behind it, python - runs standard input and therefore consumes it, and 3.14 finally dedents -c for you"
sidebar_label: "4 · -c, stdin and pipes"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`-c`, `-`, `-i`) and
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> (the `-c` auto-dedent).
> Version spine: **Python 3.14.7**.

**Two launch modes exist for code that has no file: `-c` takes it as an argument
and `-` reads it from standard input. Both put the current directory on
`sys.path`, both leave `__main__` without a spec, and neither gives the code a
`__file__` — which is the first thing that surprises people. The stdin form has a
sharper edge: the program *is* standard input, so the program cannot then read
data from standard input, which is exactly what a shell pipeline usually wants to
do.**

## `-c`

> *"Execute the Python code in `command`. `command` can be one or more statements
> separated by newlines, with significant leading whitespace as in normal module
> code."*
>
> *"If this option is given, the first element of `sys.argv` will be `"-c"` and
> the current directory will be added to the start of `sys.path` (allowing modules
> in that directory to be imported as top level modules)."*

Everything after the command string becomes `sys.argv[1:]`:

```bash
python -c "import sys; print(sys.argv)" alpha beta
# sys.argv is ['-c', 'alpha', 'beta']
```

`-c` is the right tool for a question you want answered by a specific
interpreter, which is most of the diagnostics in this phase:

```bash
python -c "import sys; print(sys.version)"
python -c "import sys; print(sys.executable)"
python -c "import sys; print(sys.prefix != sys.base_prefix)"
python -c "import sys; print(*sys.path, sep='\n')"
python -c "import httpx; print(httpx.__file__, httpx.__version__)"
python -c "import sysconfig; print(sysconfig.get_paths()['purelib'])"
```

Note the quoting habit: **single quotes inside, double quotes outside** on POSIX
shells. It keeps the shell from touching anything and leaves the inner quotes for
Python. On Windows `cmd.exe` the outer quotes must be double and the inner ones
single, which is the same rule for the opposite reason.

### The 3.14 change: automatic dedenting

Multi-line `-c` used to fail on indentation, because the shell heredoc or YAML
block you pasted from carried leading whitespace that Python treated as an
indentation error. 3.14 fixes it:

> *"The command-line option `-c` now automatically dedents its code argument
> before execution. The auto-dedentation behavior mirrors `textwrap.dedent()`."*

So this is valid on 3.14 and an indentation error on 3.13:

```yaml
# a CI step, where the block scalar's indentation used to be fatal
- run: |
    python -c "
      import sys
      if sys.version_info < (3, 14):
          raise SystemExit('too old')
      print('ok')
    "
```

If you support older versions, keep multi-line `-c` strings flush against the
left margin, or use `python -` with a heredoc instead.

## `python -` — code from standard input

> *"Read commands from standard input (`sys.stdin`). If standard input is a
> terminal, `-i` is implied. If this option is given, the first element of
> `sys.argv` will be `"-"` and the current directory will be added to the start of
> `sys.path`."*

The heredoc form is the readable way to embed a several-line program in a shell
script:

```bash
python - <<'PY'
import json, sys
data = json.load(open("config.json"))
print(data["version"])
PY
```

**Quote the heredoc delimiter.** `<<'PY'` passes the body through untouched;
`<<PY` lets the shell expand `$variables`, backticks and `\` escapes inside your
Python source first. A `$` in a regex or an f-string is enough to turn a working
program into a broken one, silently.

Arguments still work, and the `-` must be present so the shell's arguments are
not mistaken for a script name:

```bash
python - alpha beta <<'PY'
import sys
print(sys.argv)      # ['-', 'alpha', 'beta']
PY
```

### The trap: your program cannot read stdin

Because the program came from standard input, standard input is already consumed
by the time the program runs. This does not work:

```bash
cat data.txt | python - <<'PY'
import sys
print(sys.stdin.read())     # not data.txt — stdin was the program
PY
```

The `-c` form of the same idea *does* work, because the program arrives as an
argument and standard input is left alone:

```bash
curl -s https://example.com/data.json | python -c "import sys, json; print(json.load(sys.stdin)['version'])"
```

The rule is simple once stated:

| Form | Program comes from | Can the program read stdin? |
|---|---|---|
| `python -c "…"` | an argument | **Yes** |
| `python script.py` | a file | **Yes** |
| `python - <<'PY' … PY` | stdin | **No** |
| `cat prog.py \| python` | stdin | **No** |

When you need both a multi-line program and piped data, write the program to a
file, or use a shell that supports process substitution:

```bash
python <(cat <<'PY'
import sys
print(sys.stdin.read())
PY
) < data.txt
```

## `curl | python` deserves its own paragraph

Piping a downloaded script straight into an interpreter executes code that has
not been read, that has no checksum, and — because the interpreter starts running
as bytes arrive — that may execute a *partial* file if the connection drops
mid-transfer. The failure mode is not hypothetical for installer scripts, where a
truncated download can leave a half-configured system.

Download, read, then run:

```bash
curl -fsSL -o install.py https://example.com/install.py
less install.py
python install.py
```

`-f` makes curl fail on an HTTP error instead of piping an error page into your
interpreter, which is the other half of the problem.

## What code without a file does not have

Both `-c` and `-` (and the REPL) run code that never existed on disk, so:

- **`__file__` is not defined.** A `NameError` on `__file__` is the signature of
  code that was pasted into a REPL or run with `-c`. Anything that computes a path
  from `__file__` must run from a file.
- **Tracebacks cannot show source lines**, because there is no file to read them
  from — the frame's filename is a placeholder, conventionally `<string>`.
- **`inspect.getsource()` fails** for the same reason.
- **`__main__.__spec__` is `None`**, so relative imports are unavailable.

## Gotchas

**Symptom:** a multi-line `python -c` in a CI YAML file fails with an indentation error on one runner and works on another
**Cause:** the runners have different Python versions, and 3.14 auto-dedents the `-c` argument while earlier versions do not
**Fix:** left-align the code inside the string, or switch to `python - <<'PY'`, which has never had the problem

**Symptom:** a heredoc program behaves strangely, with variables replaced or backslashes eaten
**Cause:** an unquoted heredoc delimiter, so the shell expanded the Python source before the interpreter saw it
**Fix:** always `<<'PY'` with quotes for code. Use the unquoted form only when you deliberately want the shell to interpolate

**Symptom:** a script run as `cat prog.py | python` cannot read piped input
**Cause:** stdin was the program; there is nothing left on it
**Fix:** run the program from a file, or move the program into `-c`, which leaves stdin free for data

**Symptom:** `NameError: name '__file__' is not defined` in code that works when saved to a file
**Cause:** it is being run with `-c`, from stdin, or in the REPL, none of which have a file
**Fix:** pass the path in as an argument or resolve it from the current directory. If the code fundamentally needs to know where it lives, it belongs in a file

**Symptom:** a traceback from a `-c` invocation shows no source lines
**Cause:** there is no file to read the lines from
**Fix:** for anything you might have to debug, write it to a file first. `-c` is for one-liners

**Symptom:** `python -c` on Windows fails with quoting errors copied from a Linux example
**Cause:** `cmd.exe` and PowerShell have different quoting rules from POSIX shells, and PowerShell additionally re-parses arguments
**Fix:** double quotes outside, single quotes inside, on `cmd.exe`. In PowerShell prefer a here-string piped to `python -`, or a temporary file

**Symptom:** an installer piped from `curl` half-executes and leaves the machine in a broken state
**Cause:** the interpreter begins executing before the download completes, so a dropped connection executes a truncated program
**Fix:** download to a file, inspect it, then run it. Use `curl -f` so an HTTP error page is never piped anywhere

**Symptom:** `python -` in a terminal drops into an interactive session instead of waiting for a program
**Cause:** the documented behaviour — *"If standard input is a terminal, `-i` is implied"*
**Fix:** that is what you asked for. Redirect a file or a heredoc into it if you meant to supply a program

## Interview questions

**★ What is the difference between `python -c` and `python -`?**
`-c` takes the program as a command-line argument, so standard input stays free
for the program to read. `-` takes the program from standard input, which means
the program cannot then read data from it. Both set `sys.argv[0]` to the
respective marker (`"-c"` or `"-"`), both prepend the current directory to
`sys.path`, and neither provides `__file__` or a module spec.

**★ Why does `cat data.txt | python - <<'PY' … PY` fail to see the data?**
Because the heredoc and the pipe both target standard input, and the program won
that race — stdin *is* the program text. The program then finds nothing to read.
Use `-c` for the program, or put the program in a file, so that stdin carries
only data.

**★ What changed about `-c` in Python 3.14?**
It now dedents its argument automatically, mirroring `textwrap.dedent()`. That
removes the class of failure where a multi-line `-c` inside an indented YAML
block or a shell function raised an indentation error. On 3.13 and earlier the
code has to be left-aligned inside the string.

**★ Why is `curl … | python` a bad habit even for trusted sources?**
Because nothing verifies what is executed: you cannot read it first, there is no
checksum, an HTTP error page becomes a program unless `curl -f` is used, and a
connection dropped mid-transfer executes a truncated script. Downloading to a
file, inspecting it and then running it costs one extra command.

**★ Why does `__file__` not exist under `-c`?**
Because there is no file. `__file__` is set on a module when it is loaded from a
source file; code compiled from a string has no path, which is also why
tracebacks from `-c` show a placeholder filename with no source lines and why
`inspect.getsource` cannot retrieve the code.

---

← Prev: [Packages and `__main__.py`](03-m-packages-and-main-py.md) · Index: [Running code](README.md) · Next → [Options worth knowing](05-options-worth-knowing.md)
