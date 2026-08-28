---
title: "The prompt you get from bare python in 3.13 and later is a different program — PyREPL, ported from PyPy — and it changed multiline editing, history, paste handling and the meaning of bare exit all at once"
sidebar_label: "6 · The REPL"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [What's New in Python 3.13](https://docs.python.org/3.14/whatsnew/3.13.html)
> ("A better interactive interpreter"),
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> (syntax highlighting, import auto-completion),
> [PEP 762 — REPL-acing the default REPL](https://peps.python.org/pep-0762/) and
> [Built-in Constants — constants added by the `site` module](https://docs.python.org/3.14/library/constants.html).
> Version spine: **Python 3.14.7**.

**Between 3.12 and 3.13 the interactive prompt was replaced wholesale. The old
one was a thin C loop that delegated line editing to GNU readline; the new one,
PyREPL, is written in Python, lives in the `_pyrepl` package and came from the
PyPy project. Everything you notice about the prompt changed with it: history is
recalled a block at a time instead of a line at a time, editing works across
lines, tracebacks and prompts are coloured, pasting a block no longer terminates
early on a blank line, and `exit` works without parentheses. This chunk is the
editor half — what the new prompt does. [Chunk 6b](06b-repl-colour-history-and-fallback.md)
is the configuration half, including how to turn it back off.**

## What was replaced, and why

PEP 762 is the primary source and it is blunt about the motivation:

> *"Many features that users have come to expect from modern REPLs were absent in
> the previous version. Some examples of these features include multi-line
> editing and history, custom commands, syntax highlighting, or ergonomic
> handling of copy and paste."*

The abstract states what the new one is:

> *"One of Python's core strengths is its interactive mode, also known as the
> Read-Eval-Print Loop (REPL), or the Python console, or the Python shell. This
> PEP describes the new implementation of this functionality written in Python."*

"Written in Python" is the load-bearing detail. The prompt is now ordinary Python
code shipped in the standard library, which is why features arrived quickly in
3.13 and 3.14 — and also why a failure inside the prompt itself can surface as a
Python traceback naming a module you have never heard of.

## The 3.13 feature list, verbatim

> *"Python now uses a new interactive shell by default, based on code from the
> PyPy project. When the user starts the REPL from an interactive terminal, the
> following new features are now supported:*
>
> - *Multiline editing with history preservation.*
> - *Direct support for REPL-specific commands like `help`, `exit`, and `quit`,
>   without the need to call them as functions.*
> - *Prompts and tracebacks with color enabled by default.*
> - *Interactive help browsing using F1 with a separate command history.*
> - *History browsing using F2 that skips output as well as the `>>>` and `...`
>   prompts.*
> - *"Paste mode" with F3 that makes pasting larger blocks of code easier (press
>   F3 again to return to the regular prompt).*"

Read the first clause of the first sentence again: **"When the user starts the
REPL from an interactive terminal."** None of this applies to `python - < file`,
to `python -c`, or to a prompt spawned inside a harness whose stdin is a pipe.
Those are different launch modes with their own rules
([chunk 1](01-the-launch-modes.md), [chunk 4](04-c-and-stdin.md)).

### Multiline history is the feature that changes your habits

In the old prompt each *physical line* was a history entry, so recalling a
four-line `for` loop meant pressing up four times and re-assembling it in the
right order — in practice everybody retyped it. PyREPL preserves the block: one
press of up returns the whole suite, the cursor moves inside it, and you edit
line three in place. Any workflow built around "the REPL cannot edit blocks, so
put it in a file" is now optional rather than forced.

### The function keys

| Key | What it does | Why it matters |
|---|---|---|
| **F1** | Opens the interactive help browser, with *"a separate command history"* | Look something up without pushing your real commands out of reach |
| **F2** | History browsing that *"skips output as well as the `>>>` and `...` prompts"* | You get back the *input*, clean, not the transcript you would have to strip by hand |
| **F3** | Paste mode. PEP 762: *"enter manual paste mode by hitting the F3 key. The prompt changes from `>>>` to `(paste)` where users can paste contents from their clipboard"* | Blank lines inside a pasted block stop terminating the block early |
| **Ctrl-L** | Clears the screen — the same thing the `clear` command does | |

## The commands that are not functions

PEP 762 lists them:

> *"Custom Commands: Support for `exit`, `quit`, `copyright`, `help`, and `clear`
> commands."*

and for help specifically:

> *"Access to the standard Help module is accessible via a Custom Command `help`
> (see below) or via the F1 key."*

There is a second, older mechanism underneath, and confusing the two costs people
an evening. The `site` module has always injected objects into the built-in
namespace:

> *"The `site` module (which is imported automatically during startup, except if
> the `-S` command-line option is given) adds several constants to the built-in
> namespace. They are useful for the interactive interpreter shell and should not
> be used in programs."*
>
> *"`quit(code=None)` / `exit(code=None)`: Objects that when printed, print a
> message like "Use `quit()` or Ctrl-D (i.e. EOF) to exit", and when accessed
> directly in the interactive interpreter or called as functions, raise
> `SystemExit` with the specified exit code."*

Note the phrase **"should not be used in programs"**. `exit` and `quit` exist
only because `site` ran; a program started with `-S`, an embedded interpreter or
a frozen application may not have them at all. In a script the correct call is
always:

```python
import sys
sys.exit(1)
```

The same reasoning applies to `help`, `copyright`, `credits` and `license`: they
are interactive conveniences, not API.

## What 3.14 added on top

Two things, both quoted from the 3.14 release notes.

**Syntax highlighting:**

> *"The default interactive shell now highlights Python syntax. The feature is
> enabled by default, save if `PYTHON_BASIC_REPL` or any other environment
> variable that disables colour is set."*
>
> *"The default color theme for syntax highlighting strives for good contrast and
> exclusively uses the 4-bit VGA standard ANSI color codes for maximum
> compatibility. The theme can be customized using an experimental API
> `_colorize.set_theme()`. This can be called interactively or in the
> `PYTHONSTARTUP` script. Note that this function has no stability guarantees,
> and may change or be removed."*

The leading underscore and the explicit "no stability guarantees" are the whole
warning: put `_colorize.set_theme()` in your own `PYTHONSTARTUP` if you like,
never in anything shipped to another machine.

**Import auto-completion:**

> *"The default interactive shell now supports import auto-completion. This means
> that typing `import co` and pressing `<Tab>` will suggest modules starting with
> `co`. Similarly, typing `from concurrent import i` will suggest submodules of
> `concurrent` starting with `i`. Note that autocompletion of module attributes is
> not currently supported."*

That last sentence is the limit worth remembering. Completion inside an `import`
statement is a new, filesystem-driven feature; completion of
`concurrent.futures.Thread…` is `rlcompleter`, which only completes attributes of
objects **that already exist in the namespace**. If you have not imported the
module yet, there is nothing for `rlcompleter` to inspect.

## Gotchas

**★ Pasting a function into the REPL loses the tail, or a blank line ends the
definition early.**
A blank line terminates a compound statement at the ordinary prompt, and pasted
code is full of blank lines between methods. Press **F3** first — the prompt
becomes `(paste)` — paste, then press F3 again to execute. On the basic REPL
there is no paste mode at all, so write to a file and run it.

**★ Tab at the start of a line indents instead of completing.**
That is correct behaviour: there is no prefix to complete. Completion needs a
partial name, and for attributes it needs the object to already exist — so
`json.<Tab>` completes only after `import json` has actually run.

**★ `import req` + Tab completes but `requests.get` + Tab does not.**
Two different features. Import completion (3.14) scans module names; attribute
completion is `rlcompleter` and the release notes state that *"autocompletion of
module attributes is not currently supported"* by the new import feature.

**★ `exit` works at the prompt, so it goes into a script — and then breaks.**
`exit` and `quit` come from `site`, whose own documentation says these constants
*"should not be used in programs"*. Under `python -S`, inside an embedded
interpreter, or in some frozen builds, the names do not exist. Write
`sys.exit(code)`.

**★ `exit` at the prompt does not kill a `try`/`except` you are standing in.**
It raises `SystemExit`, which is an exception. A bare `except:` or an
`except BaseException:` in code you are currently executing will swallow it. In
the REPL, Ctrl-D (Ctrl-Z then Enter on Windows) sends EOF, which is not
catchable code.

**★ `_colorize.set_theme()` in a shared dotfile breaks on the next release.**
The name begins with an underscore and the release notes say it *"has no
stability guarantees, and may change or be removed"*. Guard it:

```python
# PYTHONSTARTUP
try:
    import _colorize
    _colorize.set_theme(_colorize.default_theme)
except Exception:
    pass
```

**★ You expect the new REPL features in a piped session and get none of them.**
The 3.13 notes scope every feature to *"when the user starts the REPL from an
interactive terminal"*. `echo 'print(1)' | python` is the stdin launch mode, not
a REPL; `python -i < file` is not a terminal either. Nothing is broken — you are
in a different mode.

**★ A traceback appears to come from `_pyrepl` rather than your code.**
The prompt is Python now, so its own failures are Python failures. Frames naming
`_pyrepl` above your frames mean the prompt machinery is involved; rerun the
same code non-interactively (`python -c` or a file) to get a clean traceback
before you report it as a bug in your library.

## Interview questions

**★ What actually changed about the Python REPL in 3.13?**
The implementation was replaced. Up to 3.12 the interactive prompt was C code
using GNU readline for line editing; from 3.13 it is PyREPL, a Python
implementation ported from PyPy and shipped as `_pyrepl`. The visible results are
multiline editing with history preserved as blocks, REPL commands (`help`,
`exit`, `quit`, `clear`, `copyright`) that work without parentheses, colour on
prompts and tracebacks by default, an F1 help browser with its own history, F2
history browsing that strips prompts and output, and F3 paste mode.

**★ Why does `exit` work at the prompt but is wrong in a script?**
`exit` and `quit` are objects the `site` module adds to builtins, and 3.13 also
made them REPL commands. The `site` documentation states directly that these
constants *"should not be used in programs"*: they are absent under `-S`, absent
in some embedded and frozen interpreters, and they hide the fact that what you
actually want is to raise `SystemExit`. `sys.exit(code)` is the portable
spelling.

**★ What is the difference between `help` and `help()` in 3.13+?**
`help()` is the built-in help function `site` installs. Bare `help` — no
parentheses — is a PyREPL command that opens the interactive help browser, which
PEP 762 notes has *"a separate command history"*; F1 does the same thing. Outside
an interactive PyREPL session, bare `help` is just an object whose `repr` tells
you to call it.

**★ What does 3.14's import auto-completion do, and what does it not do?**
Typing `import co` and pressing Tab suggests modules beginning with `co`, and
`from concurrent import i` suggests matching submodules. The release notes state
that *"autocompletion of module attributes is not currently supported"* — it
completes the import statement, not `module.attribute` afterwards. Attribute
completion remains `rlcompleter`'s job and only works on objects that already
exist in the namespace.

**★ Why was the REPL rewritten in Python rather than kept in C?**
The C implementation was hard to extend and tied to readline, which limited both
contributions and features — PEP 762 names multiline editing, custom commands,
syntax highlighting and paste handling as the concrete things that were missing.
Writing it in Python made those tractable, at the cost of a slightly heavier
interactive startup and of the prompt being able to raise Python-level errors.
The basic REPL is preserved as a fallback so nothing that depended on the old
behaviour is stranded.

**★ Someone says "the REPL swallowed my pasted class definition". What do you
tell them?**
That a blank line ends a compound statement at the normal prompt, so the first
blank line between methods terminated the class body and the rest was executed at
module level. F3 enters paste mode where blank lines are literal; press F3 again
to run the block. It is not a clipboard or terminal bug.

---

← Prev: [Options worth knowing](05-options-worth-knowing.md) · Index: [Running code](README.md) · Next → [Colour, history and the fallback REPL](06b-repl-colour-history-and-fallback.md)

{/* FOOTER */}
