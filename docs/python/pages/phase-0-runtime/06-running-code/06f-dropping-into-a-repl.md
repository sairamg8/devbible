---
title: "python -i turns any crash into a live session standing in the script's own globals, and pdb.pm recovers the frame locals that -i alone cannot reach"
sidebar_label: "6f · python -i and post-mortem"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`-i` and `PYTHONINSPECT`),
> [`pdb`](https://docs.python.org/3.14/library/pdb.html) (`pm()`,
> `post_mortem()`) and
> [`sys.last_exc`](https://docs.python.org/3.14/library/sys.html#sys.last_exc)
> (added 3.12; `last_type`/`last_value`/`last_traceback` deprecated).
> Version spine: **Python 3.14.7**.

**Most people know the REPL as a thing you type `python` to get. Its far more
valuable use is as an *exit path from a program that has already run*: `python -i`
leaves you standing in the script's own module globals after it finishes or
crashes, and `pdb.pm()` recovers the frame locals from the traceback that just
propagated. Between them, "add a print statement and run it again" stops being
the default move. Opening a prompt from *inside* a still-running program —
`code.interact()`, `breakpoint()`, and 3.14's `pdb -p PID` — is
[chunk 6g](06g-prompts-from-inside-a-program.md).**

## `python -i` — the REPL as a post-mortem

> *"Enter interactive mode after execution. Using the `-i` option will enter
> interactive mode in any of the following circumstances: when a script is passed
> as first argument; when the `-c` option is used; when the `-m` option is used.
> Interactive mode will start even when `sys.stdin` does not appear to be a
> terminal. The `PYTHONSTARTUP` file is not read. This can be useful to inspect
> global variables or a stack trace when a script raises an exception."*

```bash
python -i script.py             # finishes or crashes, then you are in its globals
python -i -m mypkg.cli --flag   # same, for a module entry point
python -i -c "import app; s = app.build()"   # build some state, then poke at it
```

The crash case is the one worth building a habit around. If the script raises, the
traceback prints and **you are left at a prompt inside the module's own globals**
— every top-level name the script bound before it died is still there, with the
real objects, not a repr of them.

Two documented details matter. *"Interactive mode will start even when `sys.stdin`
does not appear to be a terminal"* means `-i` works in places a bare `python`
would not open a prompt at all. And *"the `PYTHONSTARTUP` file is not read"*,
which is exactly the session in which people miss their helpers — see
[chunk 6d](06d-configuring-the-session.md).

## `pdb.pm()` — the half `-i` does not give you

`-i` shows module **globals**. The variables that actually caused the failure are
usually **locals** of a frame several levels down, and those are still reachable,
because the traceback object holds every frame:

```python
import pdb
pdb.pm()        # post-mortem: opens pdb on the exception that just propagated
```

`pm()` is documented as entering *"post-mortem debugging of the exception found in
`sys.last_exc`"*, and `sys.last_exc` is set by the interpreter itself:

> *"This variable is not always defined; it is set to the exception instance when
> an exception is not handled and the interpreter prints an error message and a
> stack traceback. Its intended use is to allow an interactive user to import a
> debugger module and engage in post-mortem debugging without having to re-execute
> the command that caused the error. (Typical use is `import pdb; pdb.pm()` to
> enter the post-mortem debugger.)"*
>
> *"Added in version 3.12."*

The older names are on their way out — *"`last_type`, `last_value`,
`last_traceback`: These three variables are deprecated; use `sys.last_exc`
instead."* Code that reaches for `sys.last_traceback` is code written before 3.12.

From the `(Pdb)` prompt the ordinary commands apply: `u`/`d` to move up and down
the stack, `l` to list source, `p`/`pp` to print, `args` for the frame's
arguments, `interact` to open a full Python prompt in the current frame. `-i` plus
`pdb.pm()` together cover the whole state; either alone covers half.

When your own code caught the exception, nothing was written to `sys.last_exc`, so
`pm()` has nothing to open. Use `post_mortem` instead:

> *"`post_mortem(t=None)`: Enter post-mortem debugging of the given exception or
> traceback object. If no value is given, it uses the exception that is currently
> being handled, or raises `ValueError` if there isn't one."*
>
> *"Changed in version 3.13: Support for exception objects was added."*

```python
try:
    run()
except Exception:
    import pdb
    pdb.post_mortem()          # 3.13+: the exception currently being handled
```

## `PYTHONINSPECT` — `-i` decided at runtime

> *"If this is set to a non-empty string it is equivalent to specifying the `-i`
> option."*
>
> *"This variable can also be modified by Python code using `os.environ` to force
> inspect mode on program termination."*

The second sentence is a real technique, not a footnote: a program can decide
*while running* that it wants to hand you a prompt when it finishes.

```python
import os
if os.environ.get("APP_DEBUG"):
    os.environ["PYTHONINSPECT"] = "1"   # drop to a REPL when this process ends
```

There is also a documented behavioural difference from the flag. `PYTHONINSPECT`
carries a `Changed in version 3.13` note — *"Uses PyREPL if possible, in which
case `PYTHONSTARTUP` is also executed"* — whereas `-i` states flatly that
`PYTHONSTARTUP` is not read. If your startup file is part of how you debug, prefer
the environment variable.

## Gotchas

**★ `python -i` gives you globals but not the locals you needed.**
`-i` drops you into the module namespace after the traceback; the frame locals
live on the traceback object. `import pdb; pdb.pm()` walks it. Running `-i` and
then complaining that the interesting variable "does not exist" is the classic
misuse.

**★ `python -i script.py` did not read your `PYTHONSTARTUP`.**
Documented: *"The `PYTHONSTARTUP` file is not read."* If you need it, use
`PYTHONINSPECT=1 python script.py`, which since 3.13 *"Uses PyREPL if possible, in
which case `PYTHONSTARTUP` is also executed."*

**★ `pdb.pm()` reports that there is no exception to inspect.**
It works from `sys.last_exc` / `sys.last_traceback`, which are set when an
exception propagates out to the interactive interpreter. If your code caught the
exception, nothing was set — call `pdb.post_mortem(tb)` with the traceback you
have instead.

**★ `-i` in a Dockerfile `CMD` appears to do nothing.**
`-i` starts interactive mode even without a terminal, but the container needs a
terminal attached for you to type into it (`docker run -it`). Without it you get a
prompt reading from a closed stdin and the process exits immediately.

**★ `pdb.post_mortem()` with no argument raises `ValueError`.**
Documented: with no value it *"uses the exception that is currently being handled,
or raises `ValueError` if there isn't one"*. Called outside an `except` block
there is nothing being handled. Pass the traceback or exception explicitly, or
move the call inside the handler.

**★ Code written against `sys.last_traceback` stops being the right idiom.**
`last_type`, `last_value` and `last_traceback` are documented as deprecated in
favour of `sys.last_exc` (3.12+). They still hold the legacy representation, but
new code should read `sys.last_exc`.

**★ `python -i` on a script that consumed stdin gets an immediate EOF.**
If the script read `sys.stdin` to exhaustion — or the program itself came from
stdin ([chunk 4](04-c-and-stdin.md)) — the prompt has nothing left to read and
exits at once. Feed data through a file argument rather than a pipe when you plan
to inspect afterwards.

**★ `-i` inspects a *finished* program, so anything closed is closed.**
Files, sockets and database sessions the script closed in a `finally` block are
gone by the time you get the prompt; you are looking at the objects, not at live
resources. If you need the resource open, you needed `breakpoint()` before the
teardown, not `-i` after it.

## Interview questions

**★ A script crashes and you want the state. What do you run?**
`python -i script.py`, documented as useful *"to inspect global variables or a
stack trace when a script raises an exception"*: the traceback prints and you are
left at a prompt in the module's globals. Then `import pdb; pdb.pm()` to reach the
frame locals held by the traceback. If the process is already running and cannot
be restarted, 3.14's `python -m pdb -p PID` attaches to it.

**★ What is the difference between `-i` and `PYTHONINSPECT`?**
They are equivalent as switches — `PYTHONINSPECT` is documented as *"equivalent
to specifying the `-i` option"* — but differ in two ways. `PYTHONINSPECT` can be
set from inside the running program via `os.environ` to force inspect mode on
termination, and since 3.13 it uses PyREPL where possible *"in which case
`PYTHONSTARTUP` is also executed"*, whereas `-i` explicitly does not read
`PYTHONSTARTUP`.

**★ Why is `python -i` not sufficient on its own for a post-mortem?**
Because it hands you the module's globals, and the values that explain a failure
are usually locals of a frame deeper in the call stack. Those locals are still
alive on the traceback object, which the interpreter stores in `sys.last_exc`, so
`import pdb; pdb.pm()` reaches them. `-i` answers "what did the module end up
with"; `pdb.pm()` answers "what was the failing frame holding".

**★ What is `sys.last_exc` and when is it set?**
An exception instance, set by the interpreter *"when an exception is not handled
and the interpreter prints an error message and a stack traceback"* — added in
3.12, superseding the deprecated `last_type`/`last_value`/`last_traceback` trio.
Its documented purpose is exactly post-mortem debugging *"without having to
re-execute the command that caused the error"*, which is what `pdb.pm()` reads.

**★ Your exception is caught and logged, so `pdb.pm()` finds nothing. Now what?**
`sys.last_exc` is only set for *unhandled* exceptions. Inside the handler, call
`pdb.post_mortem()` — documented as using *"the exception that is currently being
handled"* — or pass the traceback or (3.13+) the exception object explicitly. If
the failure is intermittent, log `traceback.format_exc()` and reproduce with the
handler removed.

---

← Prev: [sitecustomize and .pth](06e-sitecustomize-and-usercustomize.md) · Index: [Running code](README.md) · Next → [Prompts from inside a program](06g-prompts-from-inside-a-program.md)

{/* FOOTER */}
