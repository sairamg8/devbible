---
title: "Capture versus value patterns: why `case OK:` matches everything"
sidebar_label: "1b · Capture vs value patterns"
sidebar_position: 101
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `match` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement),
> [PEP 634 — Specification](https://peps.python.org/pep-0634/),
> [PEP 636 — Tutorial](https://peps.python.org/pep-0636/),
> and [`enum`](https://docs.python.org/3.14/library/enum.html).
> Target: **CPython 3.14**.

**This is the one rule that makes `match` dangerous to people who read it as a
switch, and it is purely syntactic: **a name with a dot in it is compared; a
name without a dot is bound.** `case Status.OK:` asks "is the subject equal to
`Status.OK`". `case OK:` asks nothing at all — it succeeds unconditionally and
assigns the subject to `OK`, clobbering whatever that name held. Nothing warns
you, and if the case is last it is perfectly legal. Every codebase that adopts
`match` hits this once; the fix is a habit, not a linter.**

## The trap

From the reference, a capture pattern is a bare name, and it *"always succeeds
and always binds"*.

```python
OK = 200
NOT_FOUND = 404

match status:
    case OK:            # BUG — this matches EVERY status and binds it to OK
        print("fine")
    case NOT_FOUND:     # unreachable
        print("missing")
```

The first case matches anything at all. Worse, it rebinds the module-level `OK`
to whatever `status` was, so the constant is wrong for the rest of the program.
Nothing raises, and the code reads exactly like a switch.

Two things make it survive review. First, it is *right* for the common case that
the subject really was `200` — the branch does the correct thing, by accident,
for the value the developer tested. Second, the rebinding damage happens
somewhere else entirely, so the bug report is "this constant is wrong" and never
mentions `match`.

## The three correct forms

```python
# 1. a literal pattern — compare against the value directly
match status:
    case 200: ...
    case 404: ...

# 2. a VALUE pattern — a DOTTED name is compared, not captured
match status:
    case http.HTTPStatus.OK: ...
    case http.HTTPStatus.NOT_FOUND: ...

# 3. a guard — an explicit condition after the pattern
match status:
    case s if s == OK: ...
```

Option 2 is the one to internalise. The reference is explicit that value
patterns *"use standard Python name resolution"* and compare using `==`, and the
rule for which is which is entirely about the dot:

| Pattern | Kind | Behaviour |
|---|---|---|
| `case 200:` | literal | compares with `==` |
| `case "quit":` | literal | compares with `==` |
| `case None:` / `True` / `False` | literal | compares with **`is`** |
| `case OK:` | **capture** | **always matches, binds `OK`** |
| `case Status.OK:` | value | compares with `==` |
| `case mod.CONST:` | value | compares with `==` |
| `case _:` | wildcard | always matches, binds nothing |

## The practical consequence: use enums

Because only dotted names compare, constants used in patterns must live on
something:

```python
from enum import Enum

class Status(Enum):
    OK = 200
    NOT_FOUND = 404

match status:
    case Status.OK: ...          # dotted → compared. Correct.
    case Status.NOT_FOUND: ...
```

This is a genuine argument for enums over bare module constants in any codebase
that uses `match`, and it is worth saying out loud in a code review. A class
holding class attributes works identically if an `Enum` is too heavy:

```python
class Status:
    OK = 200
    NOT_FOUND = 404
```

Either way the dot is what does the work.

:::caution
`from http import HTTPStatus` then `case HTTPStatus.OK:` is fine — the dot is in
the *pattern*, not in the import. But `from http.HTTPStatus import OK` then
`case OK:` is the bug again: what matters is how the name is spelled at the
point of use.
:::

## Irrefutable patterns must come last

PEP 634: *"A match statement may have at most one irrefutable case block, and it
must be last."*

An **irrefutable** pattern cannot fail — a bare capture name, `_`, or an AS
pattern over one. Putting it anywhere but last is a `SyntaxError` rather than
merely dead code:

```python
match status:
    case code:          # SyntaxError: name capture 'code' makes remaining
        ...             # patterns unreachable
    case 404:
        ...
```

That error message is worth recognising, because it is the **good** outcome of
the capture trap — the language catching it for you. The bad outcome is when the
accidental capture is your *last* case, where it is legal, and simply swallows
everything that reached it.

So the rule of thumb that actually protects you: **if a `case` is a single bare
name, it is a default case.** If you did not mean a default case, you wrote a
bug. There is no warning for a capture pattern that shadows a constant, because
the language genuinely cannot tell which you meant.

## Literal patterns and the `is` exception

Literal patterns compare with `==` — except `None`, `True` and `False`, which
compare with **`is`**. That is a deliberate specification choice and it matters,
because `1 == True`:

```python
match value:
    case True:
        print("the True singleton, not 1")
```

A subject of `1` does **not** match `case True:`. This is one of the few places
where the language declines to blur the `bool`-is-an-`int` overlap that
[topic 02](../02-numbers/04-bool-is-an-int.md) documents everywhere else, and it
is the behaviour you want: a pattern that says `True` means the boolean.

## Binding rules that follow from all this

**A name can be bound only once per pattern.** `case [x, x]:` is a
`SyntaxError`, not a "two equal elements" test. To express that, capture both
and use a guard: `case [a, b] if a == b:`.

**Bindings escape the `case` block.** A name bound by a pattern is an ordinary
local — it is still there after the `match` statement, exactly like a `for`
loop's target and unlike a comprehension's. That is what makes the destructuring
useful, and it also means a binding from a *failed* partial match may linger:
PEP 634 does not guarantee that a pattern which ultimately fails leaves no
bindings behind. **Do not read a name after a `case` that did not run.**

**OR patterns must bind the same names.** PEP 634: *"Each subpattern must bind
the same set of names."* So `case [x] | [x, y]:` is a `SyntaxError` — `y` would
be unbound on the left branch. Cover it with a wildcard or split the cases.

## Gotchas

**Symptom — the first `case` matches everything and later cases are dead.**
Cause: the pattern is a bare name, which is a *capture* pattern — it always
succeeds and binds. Fix: use a literal (`case 404:`), a dotted value pattern
(`case Status.NOT_FOUND:`), or a guard (`case s if s == NOT_FOUND:`).

**Symptom — a module-level constant has the wrong value after a `match` runs.**
Cause: a capture pattern rebound it. `case OK:` assigns the subject to `OK` in
the enclosing scope, permanently. The bug surfaces far from the `match`, as
"this constant is wrong". Fix: put constants on an `Enum`, a class or a module
so they are dotted and therefore compared.

**Symptom — `SyntaxError: name capture 'x' makes remaining patterns
unreachable`.** Cause: an irrefutable pattern appears before other cases;
PEP 634 allows at most one and it must be last. Fix: move it to the end — but
first check whether you meant a value pattern, because this error is usually the
capture trap being caught for you.

**Symptom — an accidental capture as the LAST case is not a `SyntaxError` and
swallows every unmatched subject.** Cause: an irrefutable pattern in last
position is legal — that is where a default belongs. Fix: there is no tooling
for this; adopt the rule that a bare-name `case` is always a deliberate default,
and prefer `case _:` so the intent is unmistakable.

**Symptom — `case True:` does not match a subject of `1`.** Cause: `None`,
`True` and `False` are compared with `is`, not `==`, unlike every other literal
pattern. Fix: none needed — this is correct and desirable. If you genuinely want
"truthy" or "equals 1", say so with a guard.

**Symptom — `case [x, x]:` is a `SyntaxError`.** Cause: a name may be bound only
once within a pattern; it is not an equality test. Fix:
`case [a, b] if a == b:`.

**Symptom — `case [x] | [x, y]:` is a `SyntaxError`.** Cause: PEP 634 requires
every alternative of an OR pattern to bind the same set of names, and `y` would
be unbound on the left. Fix: split into two cases, or pad the shorter
alternative so both bind the same names.

**Symptom — a name read after the `match` holds a value from a case that did not
run.** Cause: a pattern that partially matched before failing may have bound
names, and the specification does not promise otherwise. Fix: only read names
bound by the branch you are inside. Treat pattern bindings as local to the case
even though the language does not enforce that.

**Symptom — `from http.HTTPStatus import OK` then `case OK:` is the capture bug
again.** Cause: what matters is the spelling at the point of use, not where the
name came from. An imported constant is still a bare name. Fix: import the
enclosing namespace and dot it — `from http import HTTPStatus`, then
`case HTTPStatus.OK:`.

## Interview questions

**★ Q: What does `case OK:` do, where `OK = 200` is a module constant?**
It matches **everything** and rebinds `OK` to the subject. A bare name is a
capture pattern: it always succeeds and always binds. To compare, use a literal
(`case 200:`), a dotted value pattern (`case Status.OK:`), or a guard. This is
the single most common `match` bug, and it is silent unless the case happens not
to be last — in which case you get a `SyntaxError` instead, which is the lucky
outcome.

**★ Q: How do you match against a named constant?**
Make the name dotted. The rule is purely syntactic: a name containing a dot is a
*value* pattern and is compared with `==`; a bare name is a *capture* pattern
and is bound. So put constants on an `Enum`, a class, or a module and write
`case Status.OK:`. It is a real reason to prefer enums over bare module
constants in a codebase that uses `match`.

**★ Q: Why must an irrefutable pattern be last?**
Because everything after it is unreachable. PEP 634 allows at most one
irrefutable case block and requires it to be last; violating that is a
`SyntaxError`. The rule exists precisely to catch accidental capture patterns
before they silently swallow the cases below them — though it cannot help when
the accidental capture is already in last position.

**Q: Are `None`, `True` and `False` compared with `==` in a pattern?**
No — with `is`. Every other literal pattern uses `==`. The consequence is that a
subject of `1` does not match `case True:`, despite `1 == True`, which is one of
the few places the language declines to blur `bool` and `int`.

**Q: Why is `case [x, x]:` a `SyntaxError`?**
Because a name may be bound only once in a pattern — patterns bind, they do not
compare bound names. "Two equal elements" is `case [a, b] if a == b:`, using a
guard for the equality.

**Q: What restriction do OR patterns have?**
Every alternative must bind the same set of names — PEP 634 states it directly.
Otherwise a name would be conditionally unbound in the case body. So
`case [x] | [x, y]:` is rejected at compile time.

**Q: Do names bound by a pattern survive the `match` statement?**
Yes — they are ordinary locals, like a `for` loop's target and unlike a
comprehension's. That is what makes destructuring useful. The caveat is that a
pattern which partially matched and then failed may also have left bindings
behind, and the specification does not promise otherwise, so only read names
bound by the branch you are actually in.

---

← Prev: [What `match` is](01-what-match-is.md) · Index: [`match` — structural pattern matching](README.md) · Next → [Sequence, mapping and class patterns](02-sequence-mapping-class-patterns.md)
