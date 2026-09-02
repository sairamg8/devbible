---
title: "Guards, OR patterns and AS patterns — and parsing a payload by shape"
sidebar_label: "3 · Guards, OR, AS"
sidebar_position: 103
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against [PEP 634 — Specification](https://peps.python.org/pep-0634/),
> [PEP 636 — Tutorial](https://peps.python.org/pep-0636/),
> the Python 3.14 Language Reference
> [The `match` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement),
> and [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html).
> Target: **CPython 3.14**.

**Three combinators finish the pattern language. A **guard** is an `if` after a
pattern, evaluated only once the pattern has already matched and bound its
names — so the guard can use them. An **OR pattern** (`|`) tries alternatives
left to right and requires every alternative to bind the same names. An **AS
pattern** binds a name to whatever a sub-pattern matched, which is how you keep
the whole thing *and* its pieces. With those, `match` becomes what the syllabus
asks for: a way to parse a webhook payload by shape rather than by a stack of
defensive `.get()` calls.**

## Guards

```python
match point:
    case Point(x=x, y=y) if x == y:
        return "on the diagonal"
    case Point(x=x, y=y) if x > 0 and y > 0:
        return "first quadrant"
    case Point():
        return "somewhere else"
```

PEP 634 is precise about the ordering, and it is the useful part: *"If a guard
is present on a case block, once the pattern or patterns in the case block
succeed, the expression in the guard is evaluated."* So bindings happen
**first** and the guard can use them — `x` and `y` are available in the `if`.

If the guard is false, the case does not match and matching continues with the
next `case`. A guard is therefore not a filter applied afterwards; it is part of
the case's matching condition.

Two consequences worth stating:

**Guards are ordinary expressions and may have side effects.** PEP 634 says so
outright: *"Since guards are expressions they are allowed to have side
effects."* Since a guard runs only after its pattern matched, and cases are
tried in order, a side-effecting guard fires an unpredictable number of times as
you edit the cases above it. Keep guards pure.

**A guard is where "compare to a bare constant" belongs.** The capture trap in
[chunk 1b](01b-capture-versus-value-patterns.md) has three fixes and this is the
third: `case s if s == OK:` is explicit, needs no dotting, and reads correctly
to someone who has never met pattern matching.

## OR patterns

```python
match command.split():
    case ["north"] | ["go", "north"] | ["n"]:
        return move(NORTH)
    case ["quit" | "exit" | "q"]:
        return QUIT
```

Alternatives are tried left to right — *"An OR pattern matches each of its
subpatterns in turn to the subject, until one succeeds"* — and the first success
wins. Note the two placements in the example: `|` between whole patterns, and
`|` between elements *inside* a sequence pattern. Both are legal; the second is
usually tidier.

The binding constraint is the one to remember:

> *"Each subpattern must bind the same set of names."*

```python
case [x] | [x, y]:          # SyntaxError — y unbound on the left
case [x] | [x, _]:          # fine — both bind only x
case Circle(r) | Square(r): # fine — both bind r
```

Without that rule a name would be conditionally unbound in the case body, and
you would get a `NameError` depending on which alternative matched. The compiler
refuses instead — one of several places where `match` fails loudly at compile
time rather than quietly at runtime.

## AS patterns

`as` binds a name to what a sub-pattern matched, so you keep both the whole and
the parts:

```python
match event:
    case {"user": {"id": int(uid)} as user}:
        audit(user)          # the whole user dict
        notify(uid)          # and the id from inside it

    case [Point() as start, *rest]:
        draw_from(start, rest)

    case ("add" | "plus") as verb:
        log.info("verb was %r", verb)
```

That last form is the common one: an OR pattern discards which alternative
matched, and `as` is how you get it back.

The reference describes it as matching the pattern on the left and then binding
the subject to the name on the right. Because a bare capture is irrefutable, an
AS pattern over one — `case x as y:` — is also irrefutable and so is subject to
the must-be-last rule.

## Putting it together: parsing by shape

This is the case the syllabus names, and it is worth seeing whole:

```python
def handle(event):
    match event:
        case {"type": "push", "repository": {"full_name": str(repo)},
              "commits": [*commits]} if commits:
            return handle_push(repo, commits)

        case {"type": "push", "commits": []}:
            return  # a push with no commits — a branch delete; ignore

        case {"type": "pull_request", "action": "opened" | "reopened",
              "number": int(number), "pull_request": {"user": {"login": str(author)}}}:
            return handle_pr_opened(number, author)

        case {"type": "pull_request", "action": str(action)}:
            log.info("ignoring pull_request action %r", action)
            return

        case {"type": str(kind)}:
            log.warning("unhandled event type %r", kind)
            return

        case _:
            raise MalformedEvent(event)
```

What that buys over `if`/`elif` and `.get()`:

- **Malformed input is a non-match, not an exception.** A payload missing
  `repository` does not raise `KeyError`; it falls through to a later case. The
  chain of nested `.get("repository", {}).get("full_name")` calls disappears.
- **Types are checked where they are read.** `int(number)` and `str(repo)` mean
  the branch cannot run with the wrong type, so `handle_pr_opened` does not need
  to defend.
- **The shapes are readable side by side.** The difference between the
  push-with-commits case and the push-with-none case is visible in one screen.
- **The fallthrough is explicit.** `case _: raise` guarantees an unrecognised
  payload is loud rather than silently ignored — the failure mode
  [chunk 1](01-what-match-is.md) warns about.

The guard `if commits:` in the first case is doing real work: it distinguishes a
push with commits from one without, which `[*commits]` alone cannot, since it
matches an empty list happily.

## When not to use `match`

- **A flat set of equality tests on a scalar.** A `dict` dispatch table is
  shorter, faster to read, and extensible at runtime. `match` also forces you to
  dot your constants.
- **Two cases.** An `if`/`else` is clearer than a four-line `match`.
- **When the branches are long.** The visual advantage of `match` is seeing the
  shapes together; if each body is twenty lines, that is gone — extract the
  bodies into functions and keep the `match` as a dispatcher.
- **When you need exhaustiveness guaranteed.** Python does not check it. A type
  checker can, for a closed union with class patterns, but the language will
  happily let a `match` fall through every case and do nothing. Always add
  `case _:`.

## Gotchas

**Symptom — a guard cannot see the names its pattern bound.** Cause: it can —
PEP 634 specifies the guard is evaluated *after* the pattern succeeds. If a name
is missing, the pattern did not bind it; check for a `_` where you meant a
capture. Fix: bind explicitly (`case Point(x=x, y=y) if x == y:`).

**Symptom — a side effect inside a guard fires a different number of times after
an unrelated case is added above it.** Cause: guards run only when their pattern
matches, and cases are tried in order, so editing earlier cases changes how
often a later guard is reached. PEP 634 permits side effects but that does not
make them wise. Fix: keep guards pure; move the effect into the case body.

**Symptom — `case [x] | [x, y]:` is a `SyntaxError`.** Cause: every alternative
of an OR pattern must bind the same set of names. Fix: use `_` for the element
you do not need (`case [x] | [x, _]:`), or split into two cases.

**Symptom — after an OR pattern matches, you cannot tell which alternative it
was.** Cause: OR patterns discard that information by design. Fix: wrap it in an
AS pattern — `case ("add" | "plus") as verb:` — which binds whatever matched.

**Symptom — `case x as y:` triggers the must-be-last `SyntaxError`.** Cause: an
AS pattern over an irrefutable pattern is itself irrefutable, and PEP 634 allows
at most one irrefutable case block, last. Fix: move it to the end, or give the
left side a refutable pattern.

**Symptom — a `match` over a payload silently does nothing for an unrecognised
shape.** Cause: no `case _:`, and an unmatched `match` completes without
executing anything. Fix: always end with `case _:` that raises or logs — this is
the single most valuable habit in the topic.

**Symptom — `case {"commits": [*commits]}:` matches a push with zero commits
that should have been ignored.** Cause: `[*x]` matches any sequence including an
empty one. Fix: add a guard (`if commits:`) or write the empty case explicitly
before it — order matters and the more specific case must come first.

**Symptom — a type checker reports the `match` is not exhaustive but the code
works.** Cause: Python performs no exhaustiveness check at all; the checker is
applying its own analysis over a union type. Fix: the checker is doing you a
favour — add the missing case or a `case _:`. Never rely on runtime behaviour to
tell you a `match` is complete, because falling through all cases is silent.

**Symptom — a long `match` is slower than the `if`/`elif` it replaced.** Cause:
patterns are tried in order and each one can involve `isinstance` checks,
`len()`, and `get()` calls; a deep pattern near the bottom pays for every
pattern above it. Fix: order cases most-likely-first where behaviour allows, or
dispatch on a cheap key (`event["type"]`) into a dict of handlers and use
`match` inside each.

## Interview questions

**★ Q: When is a guard evaluated relative to the pattern's bindings?**
After. PEP 634: *"once the pattern or patterns in the case block succeed, the
expression in the guard is evaluated"* — so the names the pattern bound are
available inside the guard. If the guard is false the case does not match and
matching continues, which makes a guard part of the matching condition rather
than a filter applied afterwards.

**★ Q: What constraint do OR patterns have, and why?**
Every alternative must bind the same set of names. Otherwise a name would be
conditionally unbound in the case body and you would get a `NameError` depending
on which alternative matched. The compiler rejects it instead — one of several
places `match` fails at compile time rather than at runtime.

**★ Q: How do you know which alternative of an OR pattern matched?**
Wrap it in an AS pattern: `case ("add" | "plus") as verb:`. OR patterns
otherwise discard that information, since all they guarantee is that one
alternative succeeded.

**Q: Can a guard have side effects?**
The specification permits it explicitly, but it is a bad idea: a guard runs only
when its pattern matched, and cases are tried in order, so adding or reordering
cases above it changes how often it runs. Keep guards pure and put effects in
the body.

**★ Q: Why is `match` better than nested `.get()` calls for parsing a JSON payload?**
Because a malformed payload becomes a **non-match** rather than an exception.
`case {"repository": {"full_name": str(repo)}}:` checks presence, nesting and
type in one expression and simply falls through if any part is wrong, where the
equivalent `event.get("repository", {}).get("full_name")` chain either raises or
silently produces `None` that flows onward. It also puts the shapes side by side
where they can be compared.

**Q: Does Python check that a `match` is exhaustive?**
No. If nothing matches, the statement completes and execution continues — no
error, no warning. A type checker can prove exhaustiveness over a closed union
with class patterns, but the language does not, so a `case _:` that raises or
logs belongs on every `match` over untrusted input.

**Q: When would you *not* use `match`?**
For a flat set of scalar equality tests (a dict dispatch table is better and
does not force you to dot your constants); for two branches (`if`/`else` is
clearer); and when the case bodies are long, since the whole visual benefit is
seeing the shapes together. Extract long bodies into functions and keep the
`match` as a dispatcher.

**Q: `case [*commits]` matched an empty list and you did not want it to. What now?**
Add a guard — `case {"commits": [*commits]} if commits:` — or write the empty
case explicitly *above* it. Cases are tried in order, so the more specific shape
must come first; a starred sequence pattern happily matches zero elements.

---

← Prev: [Sequence, mapping and class patterns](02-sequence-mapping-class-patterns.md) · Index: [`match` — structural pattern matching](README.md) · Next → **Exceptions, the working set** *(not written yet)*
