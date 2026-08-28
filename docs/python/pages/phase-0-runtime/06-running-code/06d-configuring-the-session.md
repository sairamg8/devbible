---
title: "Three documented hooks configure an interactive session — PYTHONSTARTUP, sys.ps1/ps2 and sys.__interactivehook__ — and each one runs in a namespace or at a moment that surprises people"
sidebar_label: "6d · Configuring the session"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`PYTHONSTARTUP`, `PYTHONINSPECT`, `-i`),
> [`sys.ps1` / `sys.ps2` / `sys.__interactivehook__`](https://docs.python.org/3.14/library/sys.html),
> [`site`](https://docs.python.org/3.14/library/site.html)
> (Readline configuration) and
> [the tutorial appendix](https://docs.python.org/3.14/tutorial/appendix.html)
> (the interactive startup file).
> Version spine: **Python 3.14.7**.

**A Python prompt is configurable at four documented points, and they fire in a
fixed order: `sitecustomize` and `usercustomize` during interpreter startup, then
`PYTHONSTARTUP` before the first prompt, then `sys.__interactivehook__`. This
chunk is the interactive trio — the last three. Each has a scope rule that catches
people: `PYTHONSTARTUP` executes *in your session's own namespace*, so everything
it defines looks like a builtin until the code leaves the REPL; `sys.ps1` only
exists in interactive mode, so reading it is a test rather than a setting; and
`sys.__interactivehook__` already has something in it, so assigning to it throws
away tab completion and history without saying so.**

## The order things run in

1. **`sitecustomize`** — imported by `site` during startup, after the path
   manipulations. Machine-wide, usually an administrator's file.
2. **`usercustomize`** — same, but from the user site directory, and only if the
   user site is enabled.
3. **`PYTHONSTARTUP`** — executed *"before the first prompt is displayed in
   interactive mode"*, in the interactive namespace.
4. **`sys.__interactivehook__`** — called *"after the `PYTHONSTARTUP` file is
   read, so that you can set this hook there"*. This is where `site` installed tab
   completion and history.

Only steps 1 and 2 run for a non-interactive script, and they are a different
problem with a different failure mode —
[chunk 6e](06e-sitecustomize-and-usercustomize.md) covers them. Steps 3 and 4 are
the interactive-only pair, and are the subject of this chunk.

## `PYTHONSTARTUP` — the file that runs before the first prompt

> *"If this is the name of a readable file, the Python commands in that file are
> executed before the first prompt is displayed in interactive mode. The file is
> executed in the same namespace where interactive commands are executed so that
> objects defined or imported in it can be used without qualification in the
> interactive session. You can also change the prompts `sys.ps1` and `sys.ps2`
> and the hook `sys.__interactivehook__` in this file."*

The tutorial adds the scope limit:

> *"This file is only read in interactive sessions, not when Python reads commands
> from a script, and not when `/dev/tty` is given as the explicit source of
> commands."*

Because it runs **in the interactive namespace**, everything it defines is a name
in your session. That is both the feature and the hazard: a helper called `pp` or
`dt` feels like part of the language until you paste working code into a file and
it stops resolving. A good startup file is short and its names are obvious
imports:

```python
# ~/.pythonrc.py     (export PYTHONSTARTUP="$HOME/.pythonrc.py")
import sys, os, json, datetime as dt          # noqa: F401
from pprint import pp                          # noqa: F401

sys.ps1 = ">>> "
sys.ps2 = "... "
```

The file is also an audited event — the docs note it *"Raises an auditing event
`cpython.run_startup` with the filename as the argument when called on startup"*
— which is worth knowing if you are writing an audit hook and wondering why an
unexpected file executed.

There is one gap that matters for debugging: `-i` explicitly does **not** read it
(*"The `PYTHONSTARTUP` file is not read"*), while `PYTHONINSPECT` since 3.13
*"Uses PyREPL if possible, in which case `PYTHONSTARTUP` is also executed."*
Prefer the environment variable when your startup file is part of the workflow —
see [chunk 6f](06f-dropping-into-a-repl.md).

## `sys.ps1` and `sys.ps2`

> *"Strings specifying the primary and secondary prompt of the interpreter. These
> are only defined if the interpreter is in interactive mode. Their initial values
> in this case are `'>>> '` and `'... '`. If a non-string object is assigned to
> either variable, its `str()` is re-evaluated each time the interpreter prepares
> to read a new interactive command; this can be used to implement a dynamic
> prompt."*

Two usable facts in one paragraph.

**"Only defined if the interpreter is in interactive mode"** makes `sys.ps1` the
standard interactivity test — but it must be a `hasattr` check, because the
attribute genuinely does not exist otherwise:

```python
import sys
if hasattr(sys, "ps1"):
    ...        # we are at an interactive prompt
```

**"Its `str()` is re-evaluated each time"** means the prompt can report live
state, which is how project-aware prompts are built:

```python
# in PYTHONSTARTUP: show the current directory's name in the prompt
import os, sys

class Prompt:
    def __str__(self):
        return f"{os.path.basename(os.getcwd())} >>> "

sys.ps1 = Prompt()
```

Keep `__str__` cheap and exception-free. It runs before *every* prompt, and an
exception raised there fires while the interpreter is preparing to read input —
the worst possible place to debug.

## `sys.__interactivehook__`

> *"When this attribute exists, its value is automatically called (with no
> arguments) when the interpreter is launched in interactive mode. This is done
> after the `PYTHONSTARTUP` file is read, so that you can set this hook there. The
> `site` module sets this."*

"After `PYTHONSTARTUP`" is the ordering that lets a startup file replace
completion and history wholesale. What `site` puts there is `enablerlcompleter`,
described in [chunk 6b](06b-repl-colour-history-and-fallback.md):

```python
# PYTHONSTARTUP: keep site's completion, and add a session banner after it
import sys
_site_hook = getattr(sys, "__interactivehook__", None)

def hook():
    if _site_hook:
        _site_hook()
    print(f"python {sys.version.split()[0]} · {sys.prefix}")

sys.__interactivehook__ = hook
```

```python
# PYTHONSTARTUP: opt out of completion and the history file entirely
import sys
del sys.__interactivehook__
```

## Gotchas

**★ A `PYTHONSTARTUP` that imports heavy packages makes every session slow.**
It runs before the first prompt of *every* interactive session, including the one
you opened to evaluate a single expression. Keep it to imports you always want,
and defer anything expensive into a function you call on demand.

**★ A name defined in `PYTHONSTARTUP` gets used in code you then move into a
file.**
The startup file executes *"in the same namespace where interactive commands are
executed"*, so `pp` or `dt` looks like a builtin until the code leaves the prompt.
Prefix such helpers, or accept that everything leaving the REPL needs its imports
written out.

**★ `sys.ps1` read in a non-interactive script raises `AttributeError`.**
The docs say these *"are only defined if the interpreter is in interactive
mode"*. Use `hasattr(sys, "ps1")` — never `sys.ps1 == ...`.

**★ A dynamic `sys.ps1` raises, and the prompt becomes unusable.**
`__str__` is re-evaluated before every command, so an exception there fires at the
one moment you cannot type a fix. Wrap the body:

```python
class Prompt:
    def __str__(self):
        try:
            return f"{os.path.basename(os.getcwd())} >>> "
        except Exception:
            return ">>> "
```

**★ Replacing `sys.__interactivehook__` silently removes tab completion and
history.**
`site` installed the hook you just overwrote. Call the old one first if you only
meant to add something, as in the banner example above.

**★ `PYTHONSTARTUP` does not run under `python -i script.py`.**
Documented, and easy to lose an hour to when your startup file is what defines
`pp`. Use `PYTHONINSPECT=1 python script.py`, which since 3.13 does execute it.

**★ A `PYTHONSTARTUP` on a shared or root account.**
It executes arbitrary code before your first prompt with your privileges, and the
variable is inherited by subprocesses. Treat it exactly like a shell rc file, and
be suspicious of finding one you did not write.

## Interview questions

**★ What is `PYTHONSTARTUP` and what is unusual about how it runs?**
It names a file whose Python commands run *"before the first prompt is displayed
in interactive mode"*, and it is executed *"in the same namespace where
interactive commands are executed"* — not in a module of its own. So the names it
defines are your session's globals: convenient, and the reason code developed at
the prompt can stop working when it is moved into a file. It is interactive-only,
and it is explicitly not read under `-i`.

**★ In what order do the interactive configuration hooks run?**
`sitecustomize` and then `usercustomize` during interpreter startup (both from
`site`, both for every process, not just interactive ones), then `PYTHONSTARTUP`
before the first prompt, then `sys.__interactivehook__` — which the docs specify
runs *"after the `PYTHONSTARTUP` file is read, so that you can set this hook
there"*.

**★ How would you build a prompt that shows the current git branch or directory?**
Assign a non-string object to `sys.ps1`. The documentation states that if a
non-string is assigned, *"its `str()` is re-evaluated each time the interpreter
prepares to read a new interactive command; this can be used to implement a
dynamic prompt"*. Put the class in `PYTHONSTARTUP`, keep `__str__` cheap, and
wrap it in a `try` so a failure cannot make the prompt unusable.

**★ How do you check whether code is running interactively?**
`hasattr(sys, "ps1")`. The prompts are documented as *"only defined if the
interpreter is in interactive mode"*, so the attribute's existence is the signal.
Do not test `sys.stdin.isatty()` for this — that answers a different question, and
`-i` is documented to start interactive mode *"even when `sys.stdin` does not
appear to be a terminal"*.

**★ Why would you deliberately delete `sys.__interactivehook__`?**
To turn off tab completion and the `~/.python_history` file in one step — the
`site` documentation names that attribute as the supported way to disable its
readline configuration. It is a blunt instrument: if you only want history gone,
point `PYTHON_HISTORY` at `/dev/null` and leave completion alone.

---

← Prev: [The REPL is not a script](06c-the-repl-as-a-tool.md) · Index: [Running code](README.md) · Next → [sitecustomize and usercustomize](06e-sitecustomize-and-usercustomize.md)

{/* FOOTER */}
