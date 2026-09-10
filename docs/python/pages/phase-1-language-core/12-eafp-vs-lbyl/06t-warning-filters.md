---
title: "A warning is not an exception until a filter says it is, which is why a narrow try that is correct in production starts firing in CI — the warnings filter is process state, and its default is tuned to hide exactly the warnings that will one day break you"
sidebar_label: "06t · Warning filters"
sidebar_position: 166
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against
> [`warnings`](https://docs.python.org/3.14/library/warnings.html) — the two stages, the
> action table, the filter tuple, the default filter list, and the precedence rules for
> `filterwarnings`; the `action:message:category:module:line` spec and
> [`-W` / `PYTHONWARNINGS`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-W);
> [Python Development Mode](https://docs.python.org/3.14/library/devmode.html).
> Target: **Python 3.14** (docs build 3.14.7). Documentation-validated; **no sandbox run**.

**[06j](06j-ambient-state-the-guard-cannot-see.md) showed the first ambient switch: a `decimal`
context that decides whether `Decimal(raw)` raises or hands back `NaN`. This is the second, and it
is the one that actually reaches most teams, because CI turns it on for you. A `warnings.warn()`
call is a print statement until a filter promotes it, and the filter is a process-wide ordered list
configured from the command line, the environment, the test runner and any library that felt like
calling `simplefilter`. Under `-W error` a dependency's `DeprecationWarning` becomes a raise inside
a `try` that names something else entirely — same source, same version, different disposition. And
the default filter list is built to hide precisely the warnings that will do this to you, which is
why the first time you meet one is in a red pipeline. This chunk is the filter itself — what it is,
what its defaults hide, how a filter is spelled, and which end of the list wins. Changing it from
inside the program — `simplefilter`, `resetwarnings`, `catch_warnings` — and what your test runner
does to all of it are [06u](06u-catch-warnings-and-the-test-runner.md).**

## The mechanism: two stages, and only the first one is ambient

> *"There are two stages in warning control: first, each time a warning is issued, a
> determination is made whether a message should be issued or not; next, if a message is to be
> issued, it is formatted and printed using a user-settable hook."*

Stage one is the filter, and it is where `raise` can be substituted for `print`:

> *"The warnings filter controls whether warnings are ignored, displayed, or turned into
> errors (raising an exception)."*

> `warnings.warn(...)` — *"This function raises an exception if the particular warning issued
> is changed into an error by the warnings filter."*

And the promotion is not a special path in the interpreter; it is an ordinary `raise` of the
category class, which is why an `except Exception` swallows it and an `except ValueError` does not:

> *"Since the `Warning` class is derived from the built-in `Exception` class, to turn a
> warning into an error we simply raise `category(message)`."*

So the shape you meet in a pull request review is this:

```python
# 🔴 Fine locally. In CI under `-W error`, the DeprecationWarning is raised at the call and
#    nothing here catches it — the handler names the wrong thing because it was written
#    against a process where warnings did not raise.
try:
    parsed = legacy_parse(payload)        # emits DeprecationWarning internally
except ValueError:
    return None
```

The repair is not to widen the clause. Widening means "absorb whatever the environment decides to
raise", which is the exact defect the rest of this topic is about. The repair is to decide,
deliberately and in a named scope, what warnings mean in this process:

```python
import warnings

with warnings.catch_warnings():
    warnings.simplefilter("ignore", DeprecationWarning)   # scoped, explicit, documented
    parsed = legacy_parse(payload)
```

## The filter is an ordered list and the first match wins

> *"Conceptually, the warnings filter maintains an ordered list of filter specifications; any
> specific warning is matched against each filter specification in the list in turn until a
> match is found; the filter determines the disposition of the match."*

Each entry is a five-tuple `(action, message, category, module, lineno)`. The actions:

| Action | Disposition (verbatim) |
|---|---|
| `"default"` | *"print the first occurrence of matching warnings for each location (module + line number) where the warning is issued"* |
| `"error"` | *"turn matching warnings into exceptions"* |
| `"ignore"` | *"never print matching warnings"* |
| `"always"` | *"always print matching warnings"* |
| `"all"` | *"alias to 'always'"* |
| `"module"` | *"print the first occurrence of matching warnings for each module where the warning is issued (regardless of line number)"* |
| `"once"` | *"print only the first occurrence of matching warnings, regardless of location"* |

And the fallback, which is where the action's name comes from:

> *"If a warning is reported and doesn't match any registered filter then the 'default' action
> is applied (hence its name)."*

## The default list, and why your dependencies' deprecations are invisible

> *"In regular release builds, the default warning filter has the following entries (in order
> of precedence):"*

```text
default::DeprecationWarning:__main__
ignore::DeprecationWarning
ignore::PendingDeprecationWarning
ignore::ImportWarning
ignore::ResourceWarning
```

🔴 Read the first two lines together: a `DeprecationWarning` is shown **only when it is triggered in
`__main__`**, and ignored everywhere else. The category table says the same thing in one clause —
`DeprecationWarning` is *"ignored by default, unless triggered by code in `__main__`"*. Nearly
every deprecation you care about is triggered inside library code, so it is silent during ordinary
development and becomes an exception the moment CI adds `-W error`. That is the whole mechanism
behind "it works on my machine and fails in the pipeline", and it is a default rather than a
misconfiguration.

The docs are explicit that this is your problem to solve, not theirs:

> *"Notably, this 'ignored by default' list includes `DeprecationWarning` (for every module
> except `__main__`), which means developers should make sure to test their code with
> typically ignored warnings made visible in order to receive timely notifications of future
> breaking API changes."*

Two more environments change the list underneath you. *"In a debug build, the list of default
warning filters is empty"* — so a debug interpreter shows everything. And Python Development Mode
*"behaves as if the `-W default` command line option is used"*, adding `DeprecationWarning`,
`ImportWarning`, `PendingDeprecationWarning` and `ResourceWarning` to what you see. Both are third
behaviours, neither is your code changing.

## The spec format, and the trap in the `module` field

> *"Individual warnings filters are specified as a sequence of fields separated by colons:
> `action:message:category:module:line`"*

Five fields, trailing ones omittable, empty ones matching everything. The documented examples are
worth memorising because you will type them into a CI file:

```bash
python -W default                      # show all warnings, even those ignored by default
python -W error::ResourceWarning       # treat ResourceWarning messages as errors
python -W default::DeprecationWarning  # show DeprecationWarning messages
python -W error:::mymodule             # convert warnings to errors in "mymodule"
```

🔴 **The same field name does not mean the same thing in `-W` as in `filterwarnings()`.** This is
the single most common reason a "working" filter matches nothing:

> *"`module` is a string containing a regular expression that the start of the fully qualified
> module name must match, case-sensitively. In `-W` and `PYTHONWARNINGS`, `module` is a
> literal string that the fully qualified module name must be **equal to**
> (case-sensitively), ignoring any whitespace at the start or end of `module`."*

So `-W ignore::DeprecationWarning:legacy_pkg` silences warnings issued from the module named
exactly `legacy_pkg` — **not** from `legacy_pkg.client`, which is where a real library issues them.
In `filterwarnings()` the same string is an anchored regex and does cover the subpackage:

```python
# Covers legacy_pkg and every submodule: an anchored regex, not an equality test.
warnings.filterwarnings("ignore", category=DeprecationWarning, module=r"legacy_pkg")
```

⚠️ **The two doc pages disagree about the `message` field for `-W`, and I could not settle it.**
`warnings` says *"In `-W` and `PYTHONWARNINGS`, `message` is a literal string that the start of the
warning message must contain (case-insensitively)"*; the command-line reference says *"The message
field must match the whole warning message; this match is case-insensitive."* pytest's
documentation agrees with the `warnings` page. Treat partial-message matching in `-W` as unreliable
and put message-matching filters in `filterwarnings()` or a pytest config, where the regex
semantics are unambiguous.

## Precedence: two rules that sound opposite and are the same rule

The list is scanned front to back and the first match wins. Everything else follows from where a
new entry is inserted:

> `filterwarnings(action, message='', category=Warning, module='', lineno=0, append=False)` —
> *"Insert an entry into the list of warnings filter specifications. The entry is inserted at
> the front by default; if append is true, it is inserted at the end. … Entries closer to the
> front of the list override entries later in the list, if both match a particular warning."*

> `-W` — *"Multiple `-W` options can be given; when a warning matches more than one option, the
> action for the last matching option is performed."*

> `PYTHONWARNINGS` — *"If set to a comma separated string, it is equivalent to specifying `-W`
> multiple times, with filters later in the list taking precedence over those earlier in the
> list"* … *"(as they're applied left-to-right, and the most recently applied filters take
> precedence over earlier ones)."*

"First in the list wins" and "the last one you wrote wins" are the same statement: applying a
filter pushes it to the front. So the CI line you actually want reads as a general rule followed by
its exceptions:

```bash
# everything is an error, except the one dependency that is not migrated yet
python -W error -W "default::DeprecationWarning:legacy_pkg" -m pytest
```

That keeps the guarantee — any *new* deprecation fails the build — while parking the known one
somewhere a reader can see and delete. `append=True` exists for the opposite case: a default you
want only if nothing else matched.

## Gotchas

**★ Symptom: a test suite fails with an exception the production code has no handler for, and the
source is identical.** Cause: the suite runs under `-W error`, a `filterwarnings = error` config,
or a `simplefilter("error")` fixture, and `"error"` is documented as *"turn matching warnings into
exceptions"* — so a `DeprecationWarning` from a dependency is a raise in CI and a log line in
production. Fix: decide what the warning means and scope the decision, rather than widening a
handler to absorb it.

```python
with warnings.catch_warnings():
    warnings.simplefilter("ignore", DeprecationWarning)
    parsed = legacy_parse(payload)
```

**★ Symptom: a deprecation you have never seen locally breaks the build the week the dependency
ships it.** Cause: the default filter list is `default::DeprecationWarning:__main__` followed by
`ignore::DeprecationWarning` — shown only when triggered in `__main__`, so every deprecation
originating inside a library is silent during development. Fix: turn them on where you can act on
them, and keep the escape hatch narrow.

```bash
python -W default::DeprecationWarning -m pytest       # see them while developing
python -X dev -m pytest                               # same, plus the rest of dev mode
```

**★ Symptom: `-W ignore::DeprecationWarning:legacy_pkg` silences nothing, and the identical string
passed to `filterwarnings()` works.** Cause: the field means two different things — *"In `-W` and
`PYTHONWARNINGS`, `module` is a literal string that the fully qualified module name must be equal
to"*, whereas in `filterwarnings()` it is *"a regular expression that the start of the fully
qualified module name must match"*. The warning is issued from `legacy_pkg.client`, which is not
equal to `legacy_pkg`. Fix: match the module the warning is actually issued from, or move the
filter into Python where the prefix regex applies.

```python
warnings.filterwarnings("ignore", category=DeprecationWarning, module=r"legacy_pkg")
```

**★ Symptom: you added a `-W` filter to the CI command, nothing changed, and nothing complained.**
Cause: a malformed filter is not an error — *"Invalid `-W` options are ignored (though, a warning
message is printed about invalid options when the first warning is issued)"*, and the `warnings`
module says the same of `sys.warnoptions`: it *"parses these when it is first imported (invalid
options are ignored, after printing a message to `sys.stderr`)."* A misspelled category or a stray
space buys you silence, and the diagnostic only appears once some warning is issued. Fix: assert
the filter took effect rather than trusting the flag — `python -c "import warnings, pprint;
pprint.pprint(warnings.filters)"` under the same flags prints the list the process actually built.

## Interview questions

**★ Your narrow `try` fires in CI and never in production, with identical source. Where do you
look?** At everything that is a property of the process rather than of the code. The warning filter
first — `"error"` is documented as *"turn matching warnings into exceptions"*, so `-W error`,
`PYTHONWARNINGS=error` or a `filterwarnings = error` block in the pytest config makes a
dependency's `DeprecationWarning` a raise. Then any library with an ambient context — `decimal`
being the standard-library example in [06j](06j-ambient-state-the-guard-cannot-see.md), where the
same call raises or returns `NaN` depending on a per-thread `traps` list. Then the interpreter
flags and the platform, which are [06m](06m-the-guard-the-platform-deletes.md) — including a debug
build, where *"the list of default warning filters is empty"*. Environment variables and the config
file are where people look first and are the least likely cause, because those usually change
*what* the code does rather than *whether it raises*.

**★ Why have you probably never seen a `DeprecationWarning` from one of your dependencies?**
Because the default filters hide it. The documented list begins
`default::DeprecationWarning:__main__` and then `ignore::DeprecationWarning`, which together mean:
show it if it was triggered in the `__main__` module, ignore it otherwise. Nearly every deprecation
you care about is triggered inside library code, so it is silenced by default. The consequence is
that deprecations arrive as a cliff rather than a slope — invisible for a year, then an exception
the day CI adds `-W error` or the day the dependency turns the warning into a removal. The fix is
to run development and tests with `-W default::DeprecationWarning` (or `-X dev`, which *"behaves as
if the `-W default` command line option is used"*) so the slope is visible, and to narrow rather
than disable when one dependency is not ready.

**★ How do you promote warnings to errors without breaking on a dependency you cannot fix today?**
Use the filter list's precedence rather than an exception handler. Filters are
`action:message:category:module:line`, scanned in order until the first match, and a newly applied
filter goes to the front — which is why *"the action for the last matching option is performed"*
for multiple `-W` options. So `-W error` followed by a narrower `-W
default::DeprecationWarning:the_module` promotes everything except that one module. That keeps the
guarantee — any *new* deprecation fails the build — while parking the known one where a reader can
see and delete it. Wrapping the call site in a wider `except` clause does the opposite: it hides
the new ones too, and it is exactly the width defect the rest of this topic is about. The one thing
to get right is the `module` field, which in `-W` must be *equal to* the fully qualified module the
warning is issued from, not a prefix of it.

**Why is `except Exception` around a call that emits warnings a worse bug under `-W error` than
without it?** Because promotion turns the warning into an ordinary exception raised from inside the
call — *"to turn a warning into an error we simply raise `category(message)`"* — and every warning
category descends from `Warning`, which descends from `Exception`. A broad handler therefore
swallows it *and* attributes it to whatever the handler thinks it is guarding. Without `-W error`
the same code prints to `sys.stderr` and continues, so the handler looks harmless in development
and is actively misleading in CI: the log says "parse failed, returning None", while what actually
happened is that a deprecated API was called. Naming the real class you expect — and letting
`Warning` subclasses reach the runner — keeps the two events distinguishable.

---

← Prev: [Ambient state the guard cannot see](06j-ambient-state-the-guard-cannot-see.md) · Index: [EAFP vs LBYL](README.md) · Next → [Changing the filter from inside the program](06u-catch-warnings-and-the-test-runner.md)
