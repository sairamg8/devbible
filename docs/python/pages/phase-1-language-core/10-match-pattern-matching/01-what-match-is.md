---
title: "`match` is destructuring, not a switch — and a bare name always captures"
sidebar_label: "1 · What `match` is"
sidebar_position: 100
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `match` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement),
> [PEP 634 — Structural Pattern Matching: Specification](https://peps.python.org/pep-0634/),
> [PEP 636 — Structural Pattern Matching: Tutorial](https://peps.python.org/pep-0636/),
> and the [Glossary](https://docs.python.org/3.14/glossary.html#term-soft-keyword).
> Target: **CPython 3.14**.

**`match` looks like a `switch` and is not one. A `switch` compares a value
against constants; `match` takes a subject apart by **shape** — is it a
three-element sequence, is it a mapping with these keys, is it an instance of
this class with these attributes — and binds the pieces it finds to names as it
goes. That difference produces the one trap that catches everyone exactly once:
**a bare name in a pattern does not compare against that name's value, it
captures the subject into it.** `case OK:` does not mean "is the subject equal
to `OK`". It means "yes, whatever this is, call it `OK`" — and it matches
everything.**

## The shape of the statement

```python
match command.split():
    case ["quit"]:
        return QUIT
    case ["go", direction]:
        return move(direction)
    case ["drop", *items]:
        return drop(items)
    case _:
        raise UnknownCommand(command)
```

Four things to notice immediately:

**`match` and `case` are soft keywords.** They are keywords only in this
syntactic position, so existing code with a variable called `match` — a regex
match object, say — keeps working. `match = pattern.search(s)` is still valid on
3.14. That backwards compatibility is the reason for the awkward rule that
`match` must be followed by a subject and a colon.

**There is no fall-through.** The first `case` whose pattern matches (and whose
guard passes) runs, and then the whole `match` statement ends. There is no
`break`, and adding one is a `SyntaxError` unless you are inside a loop — in
which case it breaks the *loop*, not the match.

**`_` is the wildcard, not a variable.** PEP 634: *"A wildcard pattern always
succeeds. It binds no name."* It is the only name treated this way, and it is
how you write the default case.

**Patterns destructure.** `case ["go", direction]:` does three things at once —
checks it is a sequence, checks it has exactly two elements, checks the first is
`"go"` — and then binds the second to `direction`. Writing that as `if`/`elif`
takes four lines and a length check people forget.

## Where it earns its place

`match` is not a general replacement for `if`/`elif`. It pays off when the
subject has **structure you would otherwise unpack by hand**:

```python
# parsing a webhook payload by shape
match event:
    case {"type": "push", "commits": [*commits], "repository": {"name": repo}}:
        handle_push(repo, commits)
    case {"type": "pull_request", "action": "opened", "number": n}:
        handle_pr_opened(n)
    case {"type": str(kind)}:
        log.warning("unhandled event type %r", kind)
    case _:
        raise MalformedEvent(event)
```

Written with `if`/`elif` and `dict.get`, that is roughly thirty lines of
defensive lookups, each of which can raise `KeyError` or `TypeError` on
malformed input. The `match` version cannot: a pattern that does not fit simply
does not match, and falls through to the next case. **That is the real argument
for `match` — it makes malformed input a non-match rather than an exception.**

It does *not* pay off for a flat sequence of equality tests against a scalar. A
`dict` dispatch table is usually better for that, and an `if`/`elif` chain is
fine too.

## Gotchas

**Symptom — a `match` on a value with no `case _:` silently does nothing.**
Cause: if no pattern matches, the `match` statement completes without executing
any block — there is no error and no warning. Fix: add a `case _:` that raises
or logs. Unmatched-and-silent is the failure this construct hides best, and it
is the one to guard against on every `match` over external input.

**Symptom — adding `break` at the end of a `case` does something unexpected.**
Cause: `match` has no fall-through, so `break` is unnecessary; inside a loop it
breaks the *loop*, which is a genuine behaviour change. Fix: delete it. If you
meant to leave the loop, the `break` is correct but deserves a comment, because
every reader will first read it as a switch-style break.

**Symptom — a variable named `match` or `case` breaks after upgrading.** Cause:
it should not — both are *soft* keywords and remain valid identifiers. If
something did break, the code is in a position where the parser reads them as
keywords. Fix: rename the variable in that scope; the common real case is a
local called `match` immediately followed by a line starting with a bracket.

**Symptom — a `match` used as a flat switch is longer and less readable than the
`if`/`elif` it replaced.** Cause: `match` pays for itself on *structure*, not on
equality. A chain of scalar comparisons gains nothing and loses the ability to
use plain constants without dotting them. Fix: use a dict dispatch table or
`if`/`elif` for flat comparisons; keep `match` for shapes.

**Symptom — a `match` over a `str` subject never matches a sequence pattern.**
Cause: deliberate — `str`, `bytes` and `bytearray` are excluded from sequence
patterns, so `case [a, b]:` does not decompose `"ab"`. Fix: this is what you
want almost always; if you genuinely need to match characters, convert
(`list(s)`) or use a literal or class pattern. Covered in
[chunk 2](02-sequence-mapping-class-patterns.md).

**Symptom — a type checker does not narrow inside a `case`.** Cause: narrowing
depends on the pattern form; a class pattern narrows well, a bare capture does
not narrow at all because it matches anything. Fix: use class patterns
(`case Circle(radius=r):`) where you want narrowing, and check your checker's
docs — pattern-matching support varies between mypy and pyright versions.

**Symptom — a `match` statement is a `SyntaxError` on an older interpreter.**
Cause: `match` is 3.10+. Like any syntax feature, it cannot be guarded by a
runtime version check in the same module — the file fails to compile before the
check runs. Fix: isolate it in a module imported conditionally, or set
`requires-python` and let packaging refuse the install.

## Interview questions

**★ Q: Is `match` a switch statement?**
No. A switch compares a value against constants; `match` matches by **shape**
and destructures — it checks the subject's structure (sequence of length 3,
mapping with these keys, instance of this class) and binds the pieces. It also
has no fall-through and no `break`. The overlap with `switch` is only the flat
literal-comparison case, which is the one `match` is least useful for.

**★ Q: When would you reach for `match` over `if`/`elif`?**
When the subject has structure you would otherwise unpack by hand — parsing a
JSON payload by shape, walking an AST, handling a command split into tokens.
The win is that a malformed subject simply fails to match instead of raising a
`KeyError` or `TypeError` from a defensive lookup. For a flat set of equality
tests, a dict dispatch table or `if`/`elif` is better.

**Q: What is `_` in a pattern?**
The wildcard. PEP 634: *"A wildcard pattern always succeeds. It binds no
name."* It is the default case, and it is the one name that is not a capture
pattern — every other bare name binds.

**Q: `match` and `case` are keywords — did that break old code?**
No, they are **soft** keywords: recognised as keywords only in the syntactic
positions where a match statement can appear. `match = pattern.search(s)` is
still valid, which is exactly why the feature could ship in a minor release.

**Q: What happens if no case matches?**
Nothing. The `match` statement completes and execution continues after it — no
exception, no warning. That silence is why a `case _:` that raises or logs
belongs on every `match` over input you do not control.

**Q: Does `match` evaluate the subject once?**
The subject expression is evaluated once, but PEP 634 deliberately does not
specify how many times the *matching machinery* calls into the subject's
methods: *"This proposal intentionally leaves out any specification of what
methods are called or how many times."* So do not put side effects in
`__len__`, `__getitem__` or `__eq__` on a type you match against.

---

← Prev: [Comprehensions](../09-comprehensions/README.md) · Index: [`match` — structural pattern matching](README.md) · Next → [Capture versus value patterns](01b-capture-versus-value-patterns.md)
