---
title: "The REPL is a launch mode, not a scratch buffer: sys.path[0] is the empty string, there is no __file__, and every echoed result is a documented hook writing to builtins._"
sidebar_label: "6c · The REPL is not a script"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (the no-interface-option description and `-P`),
> [`sys.displayhook`](https://docs.python.org/3.14/library/sys.html#sys.displayhook)
> (including its documented pseudo-code),
> [the `sys.path` initialization page](https://docs.python.org/3.14/library/sys_path_init.html)
> and the [import system reference](https://docs.python.org/3.14/reference/import.html)
> (special considerations for `__main__`).
> Version spine: **Python 3.14.7**.

**Everything the REPL does differently from a script follows from one fact: it is
a launch mode, listed in the same table as `-c` and `-m`, with its own
`sys.argv[0]`, its own front-of-path entry and its own `__main__`. From that fall
out the empty string at `sys.path[0]` — and therefore a shadowing rule that
follows your working directory around — the missing `__file__`, and the fact that
a statement echoes nothing while an expression echoes its `repr` and binds `_`.
None of this is REPL magic; every piece of it is a documented object you can
inspect and replace.**

## The five differences, and where each is documented

| | REPL | `python script.py` |
|---|---|---|
| `sys.argv[0]` | `""` | the script name as typed |
| `sys.path[0]` | `""` — an empty string meaning the current directory | the script's own directory |
| `__name__` | `"__main__"` | `"__main__"` |
| `__main__.__spec__` | `None` | `None` |
| `__file__` | **not defined** | the script's path |

The command-line reference states the first two together:

> *"If no interface option is given, `-i` is implied, `sys.argv[0]` is an empty
> string (`""`) and the current directory will be added to the start of
> `sys.path`. Also, tab-completion and history editing is automatically enabled,
> if available on your platform."*

And `-P`'s description is where the docs say *how* the current directory is
represented:

> *"`python -c code` and `python` (REPL) command lines: Don't prepend an empty
> string, which means the current working directory."*

Note the row that is the same in both columns: `__name__` really is `"__main__"`
at the prompt, so a `if __name__ == "__main__":` block you paste in **will**
execute. What the REPL does not have is a spec, which is why relative imports are
unavailable there exactly as they are in a script
([09 · `__name__ == "__main__"`](../09-name-main/README.md)).

## Why "an empty string" and not "the current directory" matters

`sys.path[0]` in a REPL is literally `''`, and an empty path entry is resolved
against the process's current directory **at the moment of each import**, not
once at startup. So this is a real behaviour, not a curiosity:

```python
import os
os.chdir("/srv/project-b")
import settings          # comes from /srv/project-b, not from wherever you started
```

Two things follow.

**Shadowing follows you around.** Any `.py` file in the directory you are standing
in can shadow a standard-library module for the rest of the session. Starting a
REPL in a directory that contains `random.py`, `types.py`, `queue.py` or
`email.py` makes those the modules you get, and the failure arrives later, from
inside a library that expected the real one. The general rules — and the full
five-stage construction of `sys.path` — are in
[`../08-imports/02-sys-path.md`](../08-imports/02-sys-path.md); what is specific
here is that the REPL is one of the modes that puts the *cwd* in front rather
than a fixed directory.

**You can turn it off**, exactly as for any other launch mode:

```bash
python -P                                          # no empty string at the front
PYTHONSAFEPATH=1 python                            # same thing, via the environment
python -c "import sys; print(repr(sys.path[0]))"   # shows '' when -P is absent
```

## The echo, and the `_` name

The REPL prints the result of an *expression*, and it does it through a
replaceable hook. `sys.displayhook`:

> *"If value is not `None`, this function prints `repr(value)` to `sys.stdout`,
> and saves value in `builtins._`."*
>
> *"`sys.displayhook` is called on the result of evaluating an expression entered
> in an interactive Python session. The display of these values can be customized
> by assigning another one-argument function to `sys.displayhook`."*

The documented pseudo-code makes the ordering explicit — `_` is set to `None`
first *"to avoid recursion"*, then to the value after printing:

```python
def displayhook(value):
    if value is None:
        return
    # Set '_' to None to avoid recursion
    builtins._ = None
    text = repr(value)
    ...
    sys.stdout.write("\n")
    builtins._ = value
```

Three consequences that catch people:

- **A statement produces no output and does not touch `_`.** `x = compute()`
  prints nothing; so does a call whose return value is `None`. "Nothing was
  printed" therefore means either *that was a statement* or *it returned `None`* —
  two very different diagnoses.
- **`_` lives in `builtins`, so a global `_` shadows it.** Assign `_ = 3`, run
  `for _ in range(3): ...` at the prompt, or do
  `from gettext import gettext as _`, and the last-result feature is dead for the
  session, because name lookup finds the module global first. Delete it to get the
  behaviour back:

  ```python
  del _              # removes the module-global; the builtin becomes visible again
  ```
- **`_` keeps the last result alive.** Evaluate a two-gigabyte frame at the prompt
  and it cannot be collected while `_` refers to it. Assign `_ = None`, or
  evaluate any small expression, to release it.

Replacing the hook is a supported customisation — it is how alternative shells
change what echoing means:

```python
import sys
_original = sys.displayhook

def hook(value):
    if isinstance(value, bytes):
        print(f"[{len(value)} bytes]")
    else:
        _original(value)

sys.displayhook = hook
```

## Gotchas

**★ `NameError: name '__file__' is not defined` in code that works from a file.**
The REPL, `-c` and stdin have no file. Anything computing a path from `__file__`
must run from a file; pass the path in as an argument instead. (Also in
[chunk 4](04-c-and-stdin.md), because it is the same cause.)

**★ A REPL started in the wrong directory imports the wrong module.**
`sys.path[0]` is `''` — the *current* directory, re-resolved at each import — so a
`random.py` sitting next to you shadows the standard library, and an `os.chdir()`
mid-session changes where later imports come from. `python -P`, or
`PYTHONSAFEPATH=1`, removes the entry entirely.

**★ `_` stopped holding the last result.**
Something bound `_` as an ordinary name: `_ = x`, a `for _ in ...` loop at the
prompt, or `from gettext import gettext as _`. The displayhook writes to
`builtins._`, and a module-level `_` shadows it. `del _` restores the behaviour.

**★ A large object is never collected during a long REPL session.**
`_` still refers to the last expression result. History holds the *text* of what
you typed; `_` holds the *value*. `_ = None` releases it.

**★ "It printed nothing, so it did nothing."**
`sys.displayhook` returns immediately when the value is `None`, and assignments are
statements with no value at all. A silent prompt means "statement, or returned
`None`" — never "no effect".

**★ You edited a module, imported it again, and nothing changed.**
`import` is a no-op once the module is in `sys.modules`. Use
`importlib.reload(mod)` — and know its limit: `from mod import f` bound your name
to the old function object, and reload does not rebind it.

```python
import importlib, mymod
importlib.reload(mymod)
f = mymod.f            # anything imported by name must be rebound by hand
```

**★ A bug reproduces in your REPL and nowhere else.**
The session accumulates state across dozens of statements: a monkey-patched
module, a half-initialised singleton, a name you defined an hour ago. Reproduce it
in a fresh process — `python -c` or a file — before believing it.

**★ Code pasted from a module behaves differently at the prompt.**
No `__file__`, no `__spec__` (so no relative imports), a different `sys.path[0]`,
and expression results are echoed. Module-level code that reads `__file__` or uses
`from . import x` fails at the prompt for structural reasons, not because you
pasted it wrong.

## Interview questions

**★ What is `sys.path[0]` in a REPL, and why does the exact value matter?**
It is the empty string. The `-P` documentation describes suppressing *"an empty
string, which means the current working directory"*. Because it is empty rather
than an absolute path, it is resolved against the process's cwd at every import —
so `os.chdir()` inside a session silently changes where subsequent imports come
from, and any `.py` file in the directory you happen to be standing in can shadow
a standard-library module for the rest of the session.

**★ What is `_` in the REPL, and how does it get set?**
`sys.displayhook` is called on the result of every expression entered
interactively; if the value is not `None` it prints `repr(value)` and stores the
value in `builtins._`. It is a builtin, so a module-level `_` — from an
assignment, a throwaway loop variable, or gettext — shadows it and the feature
appears to break; `del _` restores it. It also keeps the last result alive, which
matters when that result is large.

**★ Why does `x = 5` print nothing while `x` prints `5`?**
Assignment is a statement; it produces no value, so the displayhook is never
invoked. `x` is an expression whose value is `5`, so the hook prints its `repr`
and binds `_`. The same silence occurs for an expression whose value *is* `None`,
because the hook returns immediately in that case — which is why "no output" is
ambiguous rather than informative.

**★ Is `__name__` equal to `"__main__"` in the REPL?**
Yes, and this surprises people who expect the REPL to be "outside" the program.
What the REPL lacks is `__main__.__spec__` (it is `None`) and `__file__` (it is
not defined at all). So a pasted `if __name__ == "__main__":` block runs, while a
relative import in the same paste fails.

**★ How do you customise what the REPL prints for a value?**
Assign a one-argument callable to `sys.displayhook`; it is documented as the hook
called on the result of every interactive expression, and replacing it is the
supported customisation point. Keep the two documented behaviours — do nothing for
`None`, and set `builtins._` — or you break the REPL's contract for everyone
downstream of your startup file.

**★ Why does the same script behave differently when its contents are pasted into
the REPL?**
Because the REPL's `__main__` has no `__file__`, no module spec, a different
`sys.path[0]`, and it echoes expression values. Module-level code that reads
`__file__`, uses `from . import x`, or relies on running under its real dotted name
will behave differently or fail. The REPL is a launch mode with its own contract,
not a scratch buffer for module source.

**★ How do you make a REPL session leave no trace and pick up nothing from the
current directory?**
`PYTHON_HISTORY=/dev/null python -P -I`. `PYTHON_HISTORY` moves the history file,
`-P` suppresses the empty `sys.path` entry so nothing in the cwd can be imported,
and `-I` (isolated mode) additionally ignores `PYTHON*` variables and the user
site directory. Note that `-I` does not take you out of a virtual environment —
see [`../05-virtual-environments/02-how-the-interpreter-finds-it.md`](../05-virtual-environments/02-how-the-interpreter-finds-it.md).

---

← Prev: [REPL colour, history, fallback](06b-repl-colour-history-and-fallback.md) · Index: [Running code](README.md) · Next → [Configuring the interactive session](06d-configuring-the-session.md)

{/* FOOTER */}
