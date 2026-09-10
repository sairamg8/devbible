---
title: "`except*` is a second grammar rather than a second clause — it cannot share a statement with `except`, its clauses match by splitting the group so more than one of them can run, and that is exactly why you cannot jump out of any of them"
sidebar_label: "06r · `except*` does not mix"
sidebar_position: 163
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 Language Reference —
> [The `try` statement · `except*` clause](https://docs.python.org/3.14/reference/compound_stmts.html#except-star)
> (the `try2_stmt` grammar, the splitting rule, the `break`/`continue`/`return`
> restriction),
> [Built-in Exceptions — `BaseExceptionGroup.split()`](https://docs.python.org/3.14/library/exceptions.html#BaseExceptionGroup.split),
> and [PEP 654 — Exception Groups and `except*`](https://peps.python.org/pep-0654/)
> for the two rationales.
> Target: **Python 3.14**; `except*` is **new in 3.11**. Documentation-validated;
> **no sandbox run**.

**[06l](06l-the-else-you-cannot-write.md) is about the narrowing tool the grammar will not
give you. `except*` is the other half of that story, and it is stranger: it is not an extra
clause you can bolt onto a `try` you already have, it is a *different production* —
`try2_stmt` — and a statement is one grammar or the other. Its clauses do not match an
exception, they *split a tree*, which means more than one clause can run for a single raise;
and that single fact is the reason `break`, `continue` and `return` are banned outright
inside them. Every restriction on this page is the language refusing to answer a question
that has no good answer once handling is plural. What the statement then lets past you, and
what it binds to your `as` target, is [06y](06y-what-escapes-an-except-star.md).**

## Two grammars, and a statement is one or the other

The reference gives `except*` its own production. The shape is identical to `try1_stmt`
except that the exception expression is mandatory:

```text
try2_stmt ::= "try" ":" suite
              ("except" "*" expression ["as" identifier] ":" suite)+
              ["else" ":" suite]
              ["finally" ":" suite]
```

> *"The `except*` clause(s) specify one or more handlers for groups of exceptions
> (`BaseExceptionGroup` instances). A `try` statement can have either `except` or `except*`
> clauses, but not both."*

PEP 654 states the same prohibition from the design side:

> *"It is not possible to use both traditional `except` blocks and the new `except*` clauses
> in the same `try` statement."*

So the natural narrowing move — keep the handler you already have, bolt on a group handler
for the new concurrent call — is simply not available:

```python
# 🔴 SyntaxError — one statement cannot have both kinds of clause.
try:
    results = gather_all(tasks)
except ValueError:
    return []
except* ValueError:
    return []
```

`else` and `finally` are both still permitted, in their usual positions — the grammar above
shows them optional and last. It is only the two *handler* kinds that cannot share a
statement. And because the choice is made per statement, "which shape do I expect here"
becomes a question you answer at every boundary rather than per clause:

```python
# Two statements, and the nesting says which shape you expect where.
try:
    results = gather_all(tasks)       # documented to raise an ExceptionGroup
except* ValueError as eg:
    logger.warning("%d bad inputs", len(eg.exceptions))
    results = []
return post_process(results)          # its own flat ValueError, its own statement
```

## The clause matches by splitting the group, not by matching the exception

An ordinary `except` asks one question of one object. An `except*` clause asks the same
question of every leaf in a tree, and the answer is two trees:

> *"The type is interpreted as in the case of `except`, but matching is performed on the
> exceptions contained in the group that is being handled."*

> *"When an exception group is raised in the try block, each `except*` clause splits (see
> `split()`) it into the subgroups of matching and non-matching exceptions. If the matching
> subgroup is not empty, it becomes the handled exception (the value returned from
> `sys.exception()`) and assigned to the target of the `except*` clause (if there is one).
> Then, the body of the `except*` clause executes. If the non-matching subgroup is not empty,
> it is processed by the next `except*` in the same manner. This continues until all
> exceptions in the group have been matched, or the last `except*` clause has run."*

Three consequences, stated flatly, because each one inverts a reflex that `except` built:

- **More than one clause can run.** Not "first match wins" — every clause whose matching
  subgroup is non-empty runs its body, in source order.
- **Each clause runs at most once**, on the whole matching subgroup, never once per leaf.
- **A leaf matched by two clauses goes to the first**, because the second only ever sees the
  non-matching residual the first handed on. Ordering still matters, but for a different
  reason than in `except`: it decides *ownership*, not *reachability*.

`split()` is the documented mechanism, and its contract is worth reading directly, since it
is what "matching" now means:

> *"Like `subgroup()`, but returns the pair `(match, rest)` where `match` is
> `subgroup(condition)` and `rest` is the remaining non-matching part."*

The clause-level semantics in full — binding, traceback shape, re-raise rules — are
[11 · 08c `except*` semantics](../11-exceptions/08c-except-star-semantics.md). What matters
here is that handling has become plural, which is what the rest of this page is about.

## No `break`, `continue` or `return`

> *"`break`, `continue` and `return` cannot appear in an `except*` clause."*

PEP 654 gives the reason, and it follows directly from the splitting rule above:

> *"`continue`, `break`, and `return` are disallowed in `except*` clauses, causing a
> `SyntaxError`. This is because the exceptions in an `ExceptionGroup` are assumed to be
> independent, and the presence or absence of one of them should not impact handling of the
> others, as could happen if we allow an `except*` clause to change the way control flows
> through other clauses."*

Since several clauses may run, a `return` in one of them would decide the fate of the others
— and *which* clause got to decide would depend on which unrelated task happened to fail
first. The language removes the question rather than answering it. This is the same
diagnosis [06k](06k-the-jump-that-discards.md) makes about jumps out of a handler, promoted
from a code-review argument to a syntax error. The shape that works: assign inside the
clause, jump after the statement.

```python
def load_all(sources):
    try:
        records = fetch_every(sources)
    except* TimeoutError:
        records = []                     # assign here
    return records                       # jump here, outside the statement
```

The restriction is per clause, not per statement: a `return` in the `try` suite, in an
`else` clause, or after the whole statement is all still legal. Only the `except*` bodies are
closed to jumps — which makes every rewrite mechanical, since the jump does not have to be
deleted, only moved past the end of the statement with a variable carrying the decision.

## Gotchas

**★ Symptom: adding an `except*` clause beside an existing `except` clause will not
compile.** Cause: *"A `try` statement can have either `except` or `except*` clauses, but not
both."* Fix: two statements, nested or sequential so the shapes are separated — the group
handler around the call documented to raise a group, the flat handler around the call
documented to raise a flat exception.

```python
try:
    results = gather_all(tasks)
except* ValueError as eg:
    logger.warning("%d bad inputs", len(eg.exceptions))
    results = []
return post_process(results)       # flat ValueError handled by its own statement
```

**★ Symptom: `SyntaxError` on a `return` inside an `except*` clause.** Cause: *"`break`,
`continue` and `return` cannot appear in an `except*` clause"* — several clauses may run, so
a jump out of one would decide the others' fate. Fix: assign in the clause, jump after the
statement.

```python
try:
    results = gather_all(tasks)
except* TimeoutError:
    results = []                   # assign here
return results                     # return here
```

**★ Symptom: a `continue` that used to skip a failed item refuses to compile once the loop
body moved to `except*`.** Cause: the same rule — the ban covers `continue` and `break` as
well as `return`, so the "log it and move on" loop shape has to be rewritten. Fix: set a flag
in the clause and branch on it after the statement, which is the only place a jump is legal.

```python
for source in sources:
    failed = False
    try:
        ingest(source)
    except* ConnectionError as eg:
        logger.warning("%s: %d links down", source, len(eg.exceptions))
        failed = True              # no `continue` here
    if failed:
        continue                   # here instead
```

**Symptom: the second `except*` clause never sees an exception it clearly matches.** Cause:
splitting is sequential — the first clause takes its matching subgroup, and *"if the
non-matching subgroup is not empty, it is processed by the next `except*` in the same
manner"*, so the second clause only ever sees the residual. Fix: order the clauses narrowest
first, exactly as with `except`; the difference is that a broad clause placed first silently
starves the narrow one of leaves rather than making it unreachable code.

```python
try:
    run_all(jobs)
except* TimeoutError as eg:        # narrowest first
    retry_later(eg.exceptions)
except* OSError as eg:             # sees only the leaves the clause above did not take
    logger.error("%d io failures", len(eg.exceptions))
```

**Symptom: a `SyntaxWarning` or `SyntaxError` you cannot explain when converting a
`try`/`except`/`else` to `except*`.** Cause: the conversion is not clause-by-clause. Anything
the old handler bodies did with `return`, `break` or `continue` becomes illegal in the new
ones, while `else` and `finally` carry over untouched — so the diff that looks like a
one-character change (`except` → `except*`) is a control-flow rewrite of every handler body.
Fix: convert the whole statement deliberately, hoisting every jump out of the handlers first,
then adding the `*`.

```python
try:
    results = gather_all(tasks)
except* ValueError:
    results = []                   # every handler body: assignment only
else:
    audit.record(len(results))     # `else` is unchanged by the conversion
finally:
    release(tasks)                 # so is `finally`
return results
```

**★ Symptom: `except*:` is a `SyntaxError` where `except:` was fine.** Cause: *"The exception
type for matching is mandatory in the case of `except*`, so `except*:` is a syntax error"*,
and PEP 654 explains it as *"An empty \"match anything\" `except*` block is not supported as
its meaning may be confusing"*. Fix: name the widest class you are actually prepared to own —
usually `Exception`, which by construction is also the boundary that leaves
`BaseExceptionGroup` alone.

```python
try:
    run_all(jobs)
except* Exception as eg:           # not `except*:`
    logger.exception("%d failed", len(eg.exceptions))
```

## Interview questions

**★ Can a single `try` statement mix `except` and `except*`?**
No: *"A `try` statement can have either `except` or `except*` clauses, but not both."* The
restriction is not cosmetic — the two clause kinds have different matching semantics, one
against an exception and one against the leaves of a group, and a statement that mixed them
would need a rule for which applies to a bare exception that is also groupable. PEP 654
states the same prohibition and points at nesting as the answer. If a region of code can
produce both shapes, that is two statements, and choosing the nesting is a real design
decision: the group handler goes around the call that is documented to raise a group.

**★ Why are `break`, `continue` and `return` forbidden inside an `except*` clause?**
Because more than one clause can run. Each clause splits the group, handles its matching
subgroup, and passes the non-matching residual to the next clause, so a statement with three
`except*` clauses may execute all three bodies. A `return` in the first would silently cancel
the second and third — and which clause got to decide would depend on which unrelated task
happened to fail. PEP 654 puts it as the leaves being *"assumed to be independent, and the
presence or absence of one of them should not impact handling of the others, as could happen
if we allow an `except*` clause to change the way control flows through other clauses."* The
language removes the question rather than inventing an answer for it. The working shape is to
assign in the clause and jump after the statement — the same discipline
[06k](06k-the-jump-that-discards.md) argues for with ordinary handlers, here enforced by the
compiler.

**★ Does clause order matter for `except*`, and for the same reason it does for `except`?**
It matters, for a different reason. With `except`, order decides *reachability* — a broad
clause first makes the narrow one dead code, because the search stops at the first match.
With `except*`, nothing is unreachable: every clause is offered the residual of the one
before it, so a broad clause placed first does not disable the narrow clause, it *starves*
it, taking leaves the narrower handler was written to deal with. The symptom is therefore
softer and much harder to spot — no dead code, just a generic handler quietly doing a
specific handler's job — and the remedy is the same: narrowest first.

**Is the jump restriction a property of the clause or of the whole statement?**
The clause only. `break`, `continue` and `return` are all still legal in the `try` suite, in
an `else` clause, and after the statement; `finally` has its own, unrelated problem with them
that has nothing to do with groups ([06h](06h-finally-and-the-widest-handler.md) and PEP
765). Knowing that boundary is what makes the rewrite mechanical: the jump is not deleted, it
is moved down past the end of the statement, with a variable carrying the decision across.

**What does "handling is plural" change about how you read a `try`/`except*` statement in
review?**
Three habits stop working. You can no longer read the clause list as a decision tree, because
several branches may fire for one raise. You can no longer read a clause body as "the
statement is finished", because the residual keeps going
([06y](06y-what-escapes-an-except-star.md)). And you can no longer read the `as`
target as an exception — it is a group, always. In review, the useful question is not "does
this clause catch the error" but "which leaves does this clause claim, and who owns the
ones it does not".

---

← Prev: [The `else` you cannot write](06l-the-else-you-cannot-write.md) · Index: [EAFP vs LBYL](README.md) · Next → [What escapes and what you are handed](06y-what-escapes-an-except-star.md)
