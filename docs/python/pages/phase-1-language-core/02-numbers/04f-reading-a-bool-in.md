---
title: "bool() is a truth test, not a parser — which is why --verbose False turns verbose on and DEBUG=0 enables debug mode"
sidebar_label: "4f · Reading a bool in"
sidebar_position: 45
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference
> ([`argparse`](https://docs.python.org/3.14/library/argparse.html),
> [`bool()`](https://docs.python.org/3.14/library/functions.html#bool),
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth),
> [`os.environ`](https://docs.python.org/3.14/library/os.html#os.environ)).
> Version spine: **Python 3.14.7**.

**Everything arriving from outside the process is a string, and `bool` is the wrong
thing to convert it with. `bool("False")` is `True`, because the string is non-empty
and `bool()` runs a truth test rather than a parse — the `argparse` docs warn about
exactly this and show `--verbose False` producing a namespace where `verbose` is
`True`. The identical trap needs no argument parser: `bool(os.environ.get("DEBUG"))`
is `True` for `DEBUG=0`, `DEBUG=false` and `DEBUG=no`. The fix is the same
everywhere and it is not `bool()` — parse the string against a vocabulary you wrote
down, and decide deliberately whether an unrecognised value is false or an error,
because that decision is the difference between `DEBUG=ture` being a typo you catch
and a config change you do not.**

## The command line: `type=bool` is always wrong

The `argparse` docs carry an explicit warning, worth quoting because the failure is
so counter-intuitive:

> *"The `bool()` function is not recommended as a type converter. All it does is
> convert empty strings to `False` and non-empty strings to `True`. This is usually
> not what is desired"*

The docs' own example shows `--verbose False` parsing to a namespace where `verbose`
is `True`, because `"False"` is a non-empty string and therefore truthy. The
recommendation, verbatim: *"See `BooleanOptionalAction` or `action='store_true'` for
common alternatives."*

```python
parser.add_argument("--verbose", action="store_true")
parser.add_argument("--color", action=argparse.BooleanOptionalAction, default=True)
```

`store_true` gives a flag that is off unless present. `BooleanOptionalAction` gives
the `--color` / `--no-color` pair, which is the right shape whenever the default is
`True` and the user needs a way to say no.

If you genuinely must accept a value — because a wrapper script passes
`--verbose=$SETTING` — write the converter, and make it reject what it does not
understand rather than defaulting:

```python
def strtobool(v: str) -> bool:
    v = v.strip().lower()
    if v in {"1", "true", "yes", "on"}:
        return True
    if v in {"0", "false", "no", "off"}:
        return False
    raise argparse.ArgumentTypeError(f"expected a boolean, got {v!r}")
```

Raising on the third case is the whole point. A converter that silently treats
anything unrecognised as `False` turns a typo into a config change.

## The environment: `DEBUG=0` must not enable debug mode

`os.environ` values are always strings, so the identical trap appears with no
argument parser in sight:

```python
DEBUG = bool(os.environ.get("DEBUG"))     # True for "0", "false", "no"
```

Every one of those strings is non-empty and therefore truthy. Parse instead:

```python
TRUE_VALUES = {"1", "true", "yes", "on"}

def env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in TRUE_VALUES
```

Note what this function does with an unrecognised value: it returns `False`, which is
a deliberate and different choice from the argparse converter above. For a *flag*
with a safe-off default that is defensible; for anything where an unrecognised value
should be loud, raise instead. Make the choice consciously, because the two
behaviours look identical in a config file and diverge only when someone typos
`DEBUG=ture`.

The same applies to every string-shaped configuration source: `.env` files, YAML
loaded with a permissive parser, query strings, form fields, CSV columns, HTTP
headers. `"false"` is truthy in all of them.

## A note on non-stdlib booleans

Everything on this page is a guarantee about the built-in `bool`. Third-party numeric
and array libraries define their own scalar boolean types, and the standard library
says nothing about whether those are `bool` instances. If a value arrives from such a
library, check with `isinstance(x, bool)` at the boundary rather than assuming — an
object that prints as `True` and compares equal to `True` can still fail `x is True`,
and that identity check is what the tri-state pattern in
[the tri-state pattern](04c-is-true-and-the-type-system.md) depends on. Convert once, at
the edge, and let the rest of the code work with a real `bool`.

## The rule that covers all of them

Convert **explicitly, at the edge, in both directions**, and never let a truthiness
test stand in for parsing:

- **Coming in** — from `argv`, the environment, a config file, a query string, a CSV
  cell, a database column — the value is a string or an integer. Parse it into a
  `bool` with a function that knows the vocabulary and rejects what it does not
  recognise. `bool(x)` is not a parser.
- **Going out** — to JSON, a database, a log line, a template — decide whether the
  destination has a boolean type. If it does, pass a real `bool`. If it does not,
  choose the representation deliberately (`1`/`0`, `"true"`/`"false"`) and write it
  down, rather than letting `bool`-is-`int` choose for you.
- **Never key anything on a boolean** that will cross a serialisation boundary.

## Gotchas

### `--flag False` turns the flag on

**Symptom.** Passing the literal string `False` on the command line enables the
feature.
**Cause.** `type=bool` runs `bool("False")`, and a non-empty string is truthy. The
`argparse` docs warn about exactly this.
**Fix.** `action="store_true"`, or `action=argparse.BooleanOptionalAction` when an
explicit `--no-flag` is needed. If a value must be accepted, write a converter that
raises on anything it does not recognise.

### `DEBUG=0` enables debug mode

**Symptom.** Setting the environment variable to `0` or `false` does not disable
anything.
**Cause.** `bool(os.environ["DEBUG"])` tests the *string*, which is non-empty.
**Fix.** Parse against an explicit set of true values. Decide deliberately whether an
unrecognised value should be false or should raise.

### A typo silently flips a setting

**Symptom.** `DEBUG=ture` behaves exactly like `DEBUG=false`, and nothing says so.
**Cause.** A parser that treats "not in the true set" as false cannot distinguish a
deliberate no from a typo.
**Fix.** For anything that is not a safe-off flag, raise on an unrecognised value.
Log the parsed configuration at startup so the effective value is visible.

### A value from an array library fails `is True`

**Symptom.** A tri-state check falls through to the `None` branch for a value that
prints as `True`.
**Cause.** The value is a third-party scalar boolean, not the `bool` singleton. The
standard library guarantees nothing about such types.
**Fix.** Convert at the boundary with `bool(x)`, and check `isinstance(x, bool)` if
you need to know which you have.

## Interview questions

**Why does `--verbose False` set `verbose` to `True` when the argument uses
`type=bool`?**
Because the converter runs on the *string* `"False"`, which is non-empty and
therefore truthy — `bool()` is a truth test, not a parser. The `argparse` docs warn
about this and point to `action='store_true'` or `BooleanOptionalAction`.

**How would you read a boolean from an environment variable?**
Against an explicit allow-list of true values, after `strip().lower()`, with a
documented decision about what an unrecognised value does. `bool(os.environ.get(...))`
is wrong for every value except the empty string and an unset variable.

**Should an unrecognised boolean string be `False`, or an error?**
It depends on the blast radius. For a safe-off feature flag, `False` is defensible.
For anything that changes behaviour meaningfully, raise — otherwise a typo like
`DEBUG=ture` is indistinguishable from a deliberate `DEBUG=false`, and nothing in the
system can tell you which happened.

**What is the general rule for booleans at a boundary?**
Convert explicitly in both directions. Coming in, parse the string or integer with a
function that knows the vocabulary; `bool(x)` is not a parser. Going out, decide
whether the destination has a real boolean type and pick the representation on
purpose rather than letting `bool`-is-`int` pick for you.

---

← Prev: [Writing a bool out](04e-booleans-at-a-boundary.md) · Index: [Numbers](README.md) · Next → [Float and IEEE-754](05-float-and-ieee-754.md)
