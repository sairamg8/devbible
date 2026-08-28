---
title: "Four environment variables decide what the prompt looks like and what it remembers, and PYTHON_BASIC_REPL is the heavy switch people reach for when they only wanted to turn off colour"
sidebar_label: "6b · REPL colour, history, fallback"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`PYTHON_BASIC_REPL`, `PYTHON_HISTORY`, `PYTHON_COLORS`, and the "Controlling
> color" section),
> [`site` — Readline configuration](https://docs.python.org/3.14/library/site.html#rlcompleter-config),
> [PEP 762](https://peps.python.org/pep-0762/) (the fallback guarantee and the
> inputrc decision) and
> [What's New in Python 3.13](https://docs.python.org/3.14/whatsnew/3.13.html).
> Version spine: **Python 3.14.7**.

**PyREPL's behaviour is configured entirely from the environment, and the four
variables involved sit in a strict precedence order that is documented and worth
memorising. The mistake this chunk exists to prevent is reaching for
`PYTHON_BASIC_REPL` — which throws away multiline editing, block history, F1/F2/F3
and import completion — when the actual complaint was escape codes in a log file,
for which the answer is one much smaller switch. The second half is history: where
your session is written, what that means for secrets, and why a container gets no
completion at all.**

## Colour: four switches, one precedence order

The colour is not a REPL feature. It is interpreter-wide and also colours
tracebacks in non-interactive runs, which is why it shows up in CI logs from
programs that never opened a prompt. The documented rules:

> *"Setting the environment variable `TERM` to `dumb` will disable color."*
>
> *"If the `FORCE_COLOR` environment variable is set, then color will be enabled
> regardless of the value of TERM. This is useful on CI systems which aren't
> terminals but can still display ANSI escape sequences."*
>
> *"If the `NO_COLOR` environment variable is set, Python will disable all color
> in the output. This takes precedence over `FORCE_COLOR`."*
>
> *"All these environment variables are used also by other tools to control color
> output. To control the color output only in the Python interpreter, the
> `PYTHON_COLORS` environment variable can be used. This variable takes precedence
> over `NO_COLOR`, which in turn takes precedence over `FORCE_COLOR`."*

Highest priority first: **`PYTHON_COLORS`**, then **`NO_COLOR`**, then
**`FORCE_COLOR`**, then **`TERM=dumb`**. And `PYTHON_COLORS` itself:

> *"If this variable is set to `1`, the interpreter will colorize various kinds of
> output. Setting it to `0` deactivates this behavior."*

```bash
PYTHON_COLORS=0 python                 # Python's own output only, colour off
NO_COLOR=1 pytest                      # the ecosystem convention: every tool
FORCE_COLOR=1 python -m mytool         # a CI log viewer that does render ANSI
TERM=dumb python                       # the blunt instrument, affects everything
```

Two of these are cross-tool standards with their own specifications
(`no-color.org`, `force-color.org`) and setting them in a shell profile changes
the behaviour of ripgrep, pytest, uv and everything else. `PYTHON_COLORS` is the
scalpel: it changes Python and nothing else.

## `PYTHON_BASIC_REPL`: the fallback, and the trap in its wording

> *"`PYTHON_BASIC_REPL`: If this variable is set to any value, the interpreter
> will not attempt to load the Python-based REPL that requires `readline`, and
> will instead use the traditional parser-based REPL."*
>
> *"Added in version 3.13."*

**"Set to any value."** Not "set to a true value". `PYTHON_BASIC_REPL=0` selects
the basic REPL, because `0` is a value. There is no way to say "off" except to
remove the variable:

```bash
export PYTHON_BASIC_REPL=1     # basic REPL
export PYTHON_BASIC_REPL=0     # ALSO the basic REPL
unset PYTHON_BASIC_REPL        # the only way back to PyREPL
env | grep PYTHON              # first thing to check when a colleague's prompt differs
```

PEP 762 frames the fallback as the compatibility promise:

> *"The PyREPL implementation is designed to maintain full backward compatibility
> with existing Python code as the old basic REPL will be preserved as a
> fallback."*
>
> *"Users have the option to explicitly choose the old basic REPL by setting the
> environment variable `PYTHON_BASIC_REPL` to 1."*

### When you genuinely need the basic REPL

- **A terminal that cannot render the escape sequences.** PyREPL repaints lines
  as you edit; a serial console, a genuinely dumb terminal or a very old emulator
  turns that into visual noise rather than an editor.
- **A build without `readline`.** The variable's own wording ties PyREPL to
  `readline` being loadable. A stripped container image or an embedded build
  without it gets the traditional prompt whether you ask for it or not.
- **An expect-style automation harness.** Anything that allocates a pseudo-terminal
  and matches on exact byte sequences will break against a prompt that repaints
  and colours. Pin such a harness with `PYTHON_BASIC_REPL=1` **and**
  `PYTHON_COLORS=0` rather than trying to match the new stream.
- **Windows consoles without virtual-terminal processing.** PyREPL's Windows
  support was contributed in 3.13 (*"Windows support contributed by Dino Viehland
  and Anthony Shaw"*), but a host console with VT processing disabled is the
  classic place to fall back.
- **`.inputrc` users** — the next section, and the only case that is permanent.

## The one real regression: `.inputrc` is not read

PEP 762 states it as a design decision, not a missing feature:

> *"inputrc and editrc support is explicitly not planned in PyREPL."*

If your `~/.inputrc` contains `set editing-mode vi`, custom key bindings, or a
completion tweak, PyREPL ignores all of it. This will not be fixed on request.
The honest options:

```bash
# Option 1: readline-driven editing back, and everything 3.13 added gone
export PYTHON_BASIC_REPL=1
```

```bash
# Option 2: keep PyREPL, and use a REPL that owns its own key bindings
uv tool install ptpython      # or ipython, which has a vi mode built in
```

There is a third thing people try and regret: importing `readline` from
`PYTHONSTARTUP` and calling `parse_and_bind()`. Under PyREPL the `readline`
module is importable but is not the code driving the prompt, so bindings for keys
PyREPL handles itself do not take effect — and the ones that appear to work are
the ones PyREPL was never going to intercept anyway. That inconsistency is worse
than either option above.

## History: where it is written, and when it is not

The `site` documentation owns this, and ties completion and history together:

> *"On systems that support `readline`, this module will also import and configure
> the `rlcompleter` module, if Python is started in interactive mode and without
> the `-S` option. The default behavior is to enable tab completion and to use
> `~/.python_history` as the history save file. To disable it, delete (or
> override) the `sys.__interactivehook__` attribute in your `sitecustomize` or
> `usercustomize` module or your `PYTHONSTARTUP` file."*

The location is configurable since 3.13:

> *"`PYTHON_HISTORY`: This environment variable can be used to set the location of
> a `.python_history` file (by default, it is `.python_history` in the user's home
> directory)."*

```bash
PYTHON_HISTORY=/dev/null python                # a session that leaves no trace
PYTHON_HISTORY="$PWD/.python_history" python   # history scoped to one project
python -S                                      # no site: no completion, no history
```

Three consequences.

**The history file is a plaintext record of everything you typed**, including the
database URL you pasted and the API token you assigned to a variable "just to
test the client". Treat `~/.python_history` as a secret, and use
`PYTHON_HISTORY=/dev/null` for sessions that will contain one.

**PyREPL stores multi-line blocks as blocks.** One press of up returns the whole
suite. The old prompt stored physical lines, which is why a decade of muscle
memory says "retype the loop"; that habit is now pure waste.

**Turning history off is a documented one-liner**, and it is the same hook that
enables completion, so you lose both:

```python
# in PYTHONSTARTUP, sitecustomize.py or usercustomize.py
import sys
del sys.__interactivehook__          # no tab completion, no history file
```

## Gotchas

**★ `PYTHON_BASIC_REPL=0` gives you the basic REPL.**
The documented rule is *"set to any value"*, not "set to a true value". `0` and
the empty string both select the old prompt on most shells. `unset
PYTHON_BASIC_REPL` is the only way back. When two developers see different
prompts on the same Python, this is the first thing to check.

**★ You disabled the entire new REPL because you wanted to disable colour.**
`PYTHON_BASIC_REPL` costs you block history, multiline editing, F1/F2/F3 and
import completion as well as the colour. If the complaint is escape codes,
`PYTHON_COLORS=0` is the switch.

**★ Escape sequences appear as literal garbage in a piped log.**
Something set `FORCE_COLOR` — often a CI provider, deliberately, so that other
tools colour their output. `NO_COLOR` beats `FORCE_COLOR` and `PYTHON_COLORS`
beats both, so `PYTHON_COLORS=0` in the job's environment fixes Python's own
output without changing every other tool in the pipeline.

**★ Colour disappears in CI even though the runner renders ANSI fine.**
The runner is not a terminal, so Python's default is off, and `TERM` may be
`dumb`. `FORCE_COLOR=1` is the documented answer: *"useful on CI systems which
aren't terminals but can still display ANSI escape sequences"*.

**★ Your vi key bindings stopped working on 3.13 and no changelog entry mentions
them.**
PyREPL does not read `.inputrc`, and PEP 762 rules the support out explicitly.
Set `PYTHON_BASIC_REPL=1`, or move to `ptpython`/IPython, which manage bindings
themselves.

**★ An expect-style test that drove `python` interactively broke on upgrade.**
The prompt repaints and colours now. Pin the harness with `PYTHON_BASIC_REPL=1`
and `PYTHON_COLORS=0` in the test environment; do not try to match the new byte
stream, which is not a stable interface.

**★ No completion and no history at all in a container.**
Either `site` was skipped (`-S` or `PYTHONNOUSERSITE`-style hardening), or the
image has no `readline`. The `site` docs tie completion *and* the history file to
`rlcompleter` being importable on a system *"that supports readline"*. Install
the platform's readline package, or accept a plain prompt in that image.

**★ The history file is empty after a session you wanted to keep.**
History is flushed when the session ends. A container stopped with `SIGKILL`, a
terminal window closed with the process still running, or a hard reboot never
gets the chance. If a REPL session is producing something you care about, copy it
into a file as you go.

**★ You pasted a token into a REPL and it is now on disk.**
`~/.python_history` is plaintext. Edit the file, and use
`PYTHON_HISTORY=/dev/null python` next time.

**★ Deleting `sys.__interactivehook__` to silence history also kills tab
completion.**
It is one hook doing both jobs — that is exactly what the `site` documentation
describes. If you only want history gone, point `PYTHON_HISTORY` at `/dev/null`
and leave the hook alone.

**★ Setting `NO_COLOR=1` globally in a dotfile makes every tool monochrome.**
`NO_COLOR` and `FORCE_COLOR` are cross-ecosystem conventions, not Python
settings. Use `PYTHON_COLORS` when the intent is "Python specifically".

## Interview questions

**★ How do you get the old REPL back, and when would you want to?**
Set `PYTHON_BASIC_REPL` to any value. You want it when the terminal cannot handle
a repainting prompt, when the build has no `readline` so PyREPL cannot load, when
an automation harness matches on exact terminal output, or when you depend on
`.inputrc` — PEP 762 says inputrc support *"is explicitly not planned"*.

**★ The REPL prints escape codes into my CI log. What is the minimal fix?**
`PYTHON_COLORS=0`, which is documented to take precedence over `NO_COLOR`, which
in turn takes precedence over `FORCE_COLOR`. Do not reach for
`PYTHON_BASIC_REPL`, which changes far more than colour. If the goal is to
disable colour across every tool in the job, `NO_COLOR=1` is the ecosystem-wide
convention instead.

**★ State the colour precedence order and why it is arranged that way.**
`PYTHON_COLORS`, then `NO_COLOR`, then `FORCE_COLOR`, then `TERM=dumb`. The
ordering puts the most specific control on top: a Python-only variable overrides
the two cross-tool conventions, and of those two, the one that *removes* output
(`NO_COLOR`) wins over the one that *adds* it (`FORCE_COLOR`), so a user who has
opted out of colour everywhere is never overridden by a CI default.

**★ Where does REPL history live, and how would you keep one session out of it?**
`~/.python_history` by default, relocatable with `PYTHON_HISTORY` since 3.13, and
enabled by `site`'s readline configuration when Python starts interactively
without `-S`. To keep a session out: run with `PYTHON_HISTORY=/dev/null`, or
delete `sys.__interactivehook__` before the prompt starts — accepting that the
second also removes tab completion.

**★ A container's Python prompt has no tab completion. Where do you look?**
At `site`. Completion is configured by `site.enablerlcompleter`, which requires
that Python was started in interactive mode, without `-S`, on a system that
supports `readline`. Minimal images frequently ship without the readline library,
and hardened entrypoints frequently pass `-S`. Neither is a Python bug.

**★ Why is disabling colour a separate concern from disabling PyREPL?**
Because colour is interpreter-wide — it applies to tracebacks printed by
completely non-interactive programs — while PyREPL is only the interactive
prompt. Conflating them means a script that never opens a prompt keeps emitting
ANSI into your log while you have thrown away every editing feature of the shell
you actually use.

---

← Prev: [The REPL](06-the-repl.md) · Index: [Running code](README.md) · Next → [The REPL is not a script](06c-the-repl-as-a-tool.md)

{/* FOOTER */}
