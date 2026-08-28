---
title: "code.interact opens a REPL at a chosen point, breakpoint opens a debugger there, and 3.14's pdb -p attaches to a process you cannot restart — three different answers to 'I need a prompt inside this program'"
sidebar_label: "6g · Prompts from inside a program"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`code`](https://docs.python.org/3.14/library/code.html) (`interact`,
> `InteractiveConsole`, `InteractiveInterpreter`),
> [`breakpoint()`](https://docs.python.org/3.14/library/functions.html#breakpoint)
> and `PYTHONBREAKPOINT`,
> [`pdb`](https://docs.python.org/3.14/library/pdb.html),
> [`locals()`](https://docs.python.org/3.14/library/functions.html#locals)
> (optimized scopes) and
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> (PEP 768, `sys.remote_exec()`, `pdb -p PID`, the pdb improvements).
> Version spine: **Python 3.14.7**.

**[Chunk 6f](06f-dropping-into-a-repl.md) covered getting a prompt *after* a
program ran. This one is about getting one *while* it runs, and the three tools
are not interchangeable. `code.interact()` gives you a REPL in a namespace you
choose and does not stop control flow. `breakpoint()` gives you a debugger at that
exact frame, with its locals live and the stack walkable. `python -m pdb -p PID`,
new in 3.14 on top of PEP 768, attaches to a process that is already running and
that you cannot restart. Choosing wrongly is the difference between inspecting a
set of objects and inspecting a moment in time.**

## `code.interact()` — a prompt in the middle of the program

> *"`code.interact(banner=None, readfunc=None, local=None, exitmsg=None,
> local_exit=False)`: Convenience function to run a read-eval-print loop. This
> creates a new instance of `InteractiveConsole` and sets readfunc to be used as
> the `InteractiveConsole.raw_input()` method, if provided. If local is provided,
> it is passed to the `InteractiveConsole` constructor for use as the default
> namespace for the interpreter loop. […] The console object is discarded after
> use."*

```python
def handle(request, session):
    import code
    code.interact(
        banner="inspect: request, session",
        local={**globals(), **locals()},   # both, or you will miss one of them
        local_exit=True,                   # exit() returns here, not SystemExit
    )
```

`local_exit` is what makes this safe inside a long-running process:

> *"If `local_exit` is true, `exit()` and `quit()` in the console will not raise
> `SystemExit`, but instead return to the calling code."*

Three limits worth knowing before you rely on it.

**The namespace is a dict you built.** Assignments made at the embedded prompt land
in that dict, not back in the enclosing function's locals — Python function locals
are not a live mapping you can write through. Read results out afterwards:

```python
ns = {**globals(), **locals()}
code.interact(local=ns, local_exit=True)
result = ns.get("result")
```

**It is a console, not PyREPL.** `code.InteractiveConsole` is documented as a
class that *"closely emulate[s] the behavior of the interactive Python
interpreter"*, building on `InteractiveInterpreter` and adding *"prompting using
the familiar `sys.ps1` and `sys.ps2`, and input buffering"*. Do not assume it
brings the 3.13 editing features, block history and function keys with it.

**The layer below has a different `__name__`.**

> *"`class code.InteractiveInterpreter(locals=None)`: This class deals with parsing
> and interpreter state (the user's namespace); it does not deal with input
> buffering or prompting or input file naming (the filename is always passed in
> explicitly). The optional locals argument specifies a mapping to use as the
> namespace in which code will be executed; it defaults to a newly created
> dictionary with key `'__name__'` set to `'__console__'` and key `'__doc__'` set
> to `None`."*

`'__console__'`, not `'__main__'`. Code with a `if __name__ == "__main__":` guard
will not run its guarded block there, unlike in the real REPL where `__name__`
genuinely is `"__main__"` ([chunk 6c](06c-the-repl-as-a-tool.md)).

## `breakpoint()` — when you want the frame, not the namespace

> *"This function drops you into the debugger at the call site. Specifically, it
> calls `sys.breakpointhook()`, passing args and kws straight through. By default,
> `sys.breakpointhook()` calls `pdb.set_trace()` expecting no arguments. In this
> case, it is purely a convenience function so you don't have to explicitly import
> `pdb` or type as much code to enter the debugger. However,
> `sys.breakpointhook()` can be set to some other function and `breakpoint()` will
> automatically call that, allowing you to drop into the debugger of choice."*

> *"By default, the behavior of `breakpoint()` can be changed with the
> `PYTHONBREAKPOINT` environment variable."*

```python
breakpoint()            # pdb, at this exact frame, with its locals live
```

```bash
PYTHONBREAKPOINT=0 python app.py     # every breakpoint() call becomes a no-op
PYTHONBREAKPOINT=IPython.terminal.debugger.set_trace python app.py
PYTHONBREAKPOINT=web_pdb.set_trace python app.py
```

The indirection through `sys.breakpointhook()` is the whole design: every
breakpoint in a codebase can be redirected — or switched off — from the
environment, without editing a line. That is what `pdb.set_trace()` written by
hand does not give you.

3.14 also improved pdb's own prompt, including that *"`<tab>` at line beginning
fills 4-space indentation instead of inserting `\t`"* and that *"auto-indent is
introduced for multi-line input"*, so typing a small block at `(Pdb)` is no longer
hopeless. It also notes that *"hardcoded breakpoints now reuse the most recent
`Pdb` instance, preserving instance-specific data like `display` and `commands`
across breakpoints"* — your watch expressions survive from one breakpoint to the
next.

## `pdb -p PID` — the process you cannot restart

New in 3.14, built on PEP 768:

> *"The `pdb` module now supports remote attaching to a running Python process
> using a new `-p PID` command-line option […] This will connect to the Python
> process with the given PID and allow you to debug it interactively. Notice that
> due to how the Python interpreter works attaching to a remote process that is
> blocked in a system call or waiting for I/O will only work once the next
> bytecode instruction is executed or when the process receives a signal."*

```bash
python -m pdb -p 1234
```

The mechanism is `sys.remote_exec()`, described as part of *"a zero-overhead
debugging interface that allows debuggers and profilers to safely attach to
running Python processes without stopping or restarting them"*, and the release
notes are explicit that this matters *"for high-availability systems and
production environments"*.

Because it lets another process execute code in yours, it is also an attack
surface, and there are three documented ways to disable it: the
`PYTHON_DISABLE_REMOTE_DEBUG` environment variable, the `-X disable-remote-debug`
option, and the `--without-remote-debug` configure flag at build time. A hardened
production image should pick one deliberately rather than discovering the
behaviour by accident.

## Choosing between them

| You want… | Use |
|---|---|
| The state a script left behind, after it ran or crashed | `python -i script.py` ([6f](06f-dropping-into-a-repl.md)) |
| The locals of the frame that raised | `pdb.pm()` / `pdb.post_mortem()` ([6f](06f-dropping-into-a-repl.md)) |
| A prompt at a chosen point, with objects you name | `code.interact(local=..., local_exit=True)` |
| To step through code from a chosen point | `breakpoint()` |
| To inspect a process that is already running | `python -m pdb -p PID` (3.14+) |
| To redirect or disable every breakpoint from outside | `PYTHONBREAKPOINT=…` |

## Gotchas

**★ `code.interact()` inside a server kills the process when you type `exit()`.**
`SystemExit` propagates out of the console and out of your request handler. Pass
`local_exit=True`, documented as making `exit()` and `quit()` *"return to the
calling code"* instead.

**★ Assignments made inside `code.interact(local=...)` vanish.**
You passed a dict; the console mutates that dict, not the caller's local scope.
Function locals are not a writable mapping, so there is no version of this that
"just works" — read the value back out of the dict you passed.

**★ `code.interact(local=locals())` cannot see your imports.**
Module-level imports are globals, not locals. Pass `{**globals(), **locals()}`, or
you will spend the session re-importing modules the process already has loaded.

**★ Code run under `code.InteractiveInterpreter` sees `__name__ == '__console__'`.**
Documented: the default namespace has `'__name__'` set to `'__console__'`. A
`if __name__ == "__main__":` block will therefore *not* run there — unlike the
real REPL, where `__name__` is `"__main__"`.

**★ `code.interact()` in a process with no terminal blocks forever.**
It reads from stdin. In a daemon, a container without `-it`, or a worker whose
stdin is `/dev/null`, the call either returns immediately on EOF or hangs
depending on what stdin is attached to. Guard it behind a flag that is only ever
set in an interactive run.

**★ `code.interact()` inside a request handler blocks the whole worker.**
It is a synchronous loop in that thread. Under a single-worker server, every other
request queues behind your prompt; under an async framework the event loop stops
entirely. Use it in a development process, not in anything serving traffic.

**★ A committed `breakpoint()` hangs a production worker.**
`PYTHONBREAKPOINT=0` in the deployment environment turns every call into a no-op
and buys the outage back. The permanent fix is a lint rule (`ruff` `T100`,
`flake8-debugger`) so it never lands on a release branch.

**★ `PYTHONBREAKPOINT` pointing at a debugger that is not installed.**
The variable names an importable callable; if the import fails you do not silently
fall back to pdb — the failure surfaces at the call site. Set it per command, not
in a shared shell profile.

**★ `breakpoint()` inside a thread or a subprocess produces interleaved chaos.**
Every thread that hits it competes for the same stdin. In multi-process code the
child may not even have a terminal. Use a conditional breakpoint on the state you
care about, or a remote-debugging front end via `PYTHONBREAKPOINT`.

**★ `python -m pdb -p PID` attaches but nothing happens.**
Documented: a process *"blocked in a system call or waiting for I/O will only work
once the next bytecode instruction is executed or when the process receives a
signal"*. A worker asleep on a socket read stays asleep until traffic arrives or a
harmless signal wakes it.

**★ `python -m pdb -p PID` refuses to attach in production.**
Someone hardened the image with `PYTHON_DISABLE_REMOTE_DEBUG`,
`-X disable-remote-debug`, or a build configured `--without-remote-debug`. That is
the correct posture for production; the point is to recognise it as a deliberate
setting rather than a broken pdb.

**★ Remote attach is left enabled on a shared host.**
`sys.remote_exec()` executes a file in another process. On a multi-tenant box that
is a privilege boundary you have decided not to have. Decide explicitly, and
document which of the three switches you used.

## Interview questions

**★ When would you use `code.interact()` rather than `breakpoint()`?**
`breakpoint()` stops execution at the call site with that frame's locals live and
gives you a debugger — stepping, continuing, walking the stack. `code.interact()`
does not stop anything: it runs a full REPL in whatever namespace you hand it,
which is what you want when the interesting thing is a set of objects rather than
a point in control flow, or when you are building a shell-like feature into your
own program. Pass `local_exit=True` in anything long-running so `exit()` returns
instead of raising `SystemExit`.

**★ How does `breakpoint()` differ from `import pdb; pdb.set_trace()`?**
`breakpoint()` calls `sys.breakpointhook()`, which by default calls
`pdb.set_trace()`. The indirection is the point: the hook is replaceable, and
`PYTHONBREAKPOINT` lets you redirect every breakpoint in a codebase to another
debugger — or to nothing at all with `PYTHONBREAKPOINT=0` — without editing the
code. A hand-written `pdb.set_trace()` has none of that.

**★ How do you disable every `breakpoint()` in a deployed application without
touching the source?**
`PYTHONBREAKPOINT=0` in the process environment. The variable is documented as
the way to change `breakpoint()`'s behaviour, and `0` makes it a no-op. It is a
mitigation, not a fix — the real answer is a lint rule so debugger calls never
land on a release branch.

**★ What did PEP 768 change, and what is the security consideration?**
It added a safe external debugger interface — *"a zero-overhead debugging
interface that allows debuggers and profilers to safely attach to running Python
processes without stopping or restarting them"* — surfaced as `sys.remote_exec()`
and as `python -m pdb -p PID`. Because it lets another process execute code in
yours, it is disableable three ways: `PYTHON_DISABLE_REMOTE_DEBUG`,
`-X disable-remote-debug`, and `--without-remote-debug` at build time. Production
images should choose one deliberately.

**★ Why does `python -m pdb -p PID` sometimes appear to hang on attach?**
Because attachment happens at a safe point in the interpreter's execution. The
release notes state that attaching to a process *"blocked in a system call or
waiting for I/O will only work once the next bytecode instruction is executed or
when the process receives a signal"*. An idle worker parked on a socket read has
no next bytecode instruction until something arrives.

**★ You have a long-running service and want to inspect it without a debugger
attached. What do you build in?**
A `code.interact()` entry point guarded by a flag or a signal handler, with an
explicit namespace (`{**globals(), **locals()}` or a curated dict) and
`local_exit=True` so exiting the console returns to the caller rather than killing
the process — and never on a path that serves traffic, because the console blocks
the thread it runs in. On 3.14 the alternative is to build nothing and use
`pdb -p PID`, accepting that this must then not be disabled in that environment.

**★ Why can you not just assign to the caller's locals from an embedded console?**
Because in a function, `locals()` is not a live view. The documentation states
that *"in an optimized scope (including functions, generators, and coroutines),
each call to `locals()` instead returns a fresh dictionary containing the current
bindings of the function's local variables"*, and that *"name binding changes made
via the returned dict are not written back to the corresponding local variables"*.
So you pass a dict to `code.interact()`, the console mutates that dict, and the
enclosing function never sees it. The workable pattern is to keep the dict and
read values out of it after the console returns — which is also why the same
limitation does not apply at module scope, where `locals()` *is* the module's
namespace.

---

← Prev: [python -i and post-mortem](06f-dropping-into-a-repl.md) · Index: [Running code](README.md) · Next → [Shebangs and launchers](07-shebangs-and-launchers.md)

{/* FOOTER */}
