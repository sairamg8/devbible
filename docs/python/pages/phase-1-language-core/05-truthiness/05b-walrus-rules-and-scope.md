---
title: "Walrus rules and scope: where `:=` is banned, and why a comprehension leaks its name"
sidebar_label: "5b · Walrus rules and scope"
sidebar_position: 61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against [PEP 572 — Assignment Expressions](https://peps.python.org/pep-0572/)
> and the Python 3.14 Language Reference
> [Assignment expressions](https://docs.python.org/3.14/reference/expressions.html#assignment-expressions).
> Target: **CPython 3.14**.

**`:=` has more syntactic restrictions than any other operator in the language,
and they are not arbitrary: nearly every one exists to stop `:=` being confused
with `=`, or to stop a name binding appearing somewhere a reader would not look
for one. There is also one deliberate scoping decision that surprises everybody
the first time — inside a comprehension, a walrus binds in the *containing*
scope, not in the comprehension's. That is the opposite of what the `for` target
does, and it is on purpose.**

## Where it is disallowed

PEP 572 lists the positions where an unparenthesised assignment expression is
invalid. In every case the parenthesised form is legal, so the rule is really
"parenthesise it":

| Position | Invalid | Valid |
|---|---|---|
| As a statement | `y := f(x)` | `(y := f(x))` — but write `y = f(x)` |
| Right of an assignment | `y0 = y1 := f(x)` | `y0 = (y1 := f(x))` |
| Keyword argument value | `foo(x=y := f(x))` | `foo(x=(y := f(x)))` |
| Function default | `def foo(answer=p := 42)` | `def foo(answer=(p := 42))` |
| Lambda body | `(lambda: x := 1)` | `lambda: (x := 1)` |
| Annotation | any position | parenthesised |
| F-string expression | unparenthesised | parenthesised |

The statement-level ban is the interesting one. It is there so that `=` and
`:=` cannot be swapped by accident at the place where a typo is most likely and
least visible — the language deliberately refuses to let you write `x := 1` as a
line of code, because you meant `x = 1` and it wants to say so.

Then there are two positions where **no amount of parenthesising helps**:

**Inside a comprehension's iterable expression.** PEP 572 states that *"named
expressions are disallowed entirely as part of comprehension iterable
expressions"*:

```python
[x for x in (data := get())]        # SyntaxError — the iterable expression
[(y := f(x)) for x in data]         # fine — the value expression
[x for x in data if (y := f(x))]    # fine — the condition
```

**In a class-scope comprehension.** An assignment expression in a comprehension
whose containing scope is a class body is *"expressly invalid"* and raises
`SyntaxError`. Class bodies already have unusual scoping rules for
comprehensions; the walrus's containing-scope binding would have made them
worse, so it is simply banned.

## Precedence: looser than everything

PEP 572 is precise about this, and it is the rule that produces the most bugs:

> *"The `:=` operator groups more tightly than a comma in all syntactic
> positions where it is legal, but less tightly than all other operators,
> including `or`, `and`, `not`, and conditional expressions."*

So an unparenthesised walrus swallows the entire rest of the expression:

```python
x := a is not None          # binds the BOOLEAN to x
(x := a) is not None        # binds a to x, then compares

y := n + 1 > 10             # binds the boolean
(y := n + 1) > 10           # binds n+1, then compares

if flag := check() and ready():   # binds `check() and ready()` to flag
if (flag := check()) and ready(): # binds check()'s result, then ands
```

Every line in the left column runs. None of them raises. The name is simply
bound to something other than what the author meant, and the surrounding logic
usually still terminates — which is why these are found by a wrong *result*
rather than by a traceback.

**The habit: parenthesise the assignment, always.** It is required in half the
legal positions anyway, and it never costs anything.

## The name-collision `SyntaxError`

An assignment expression's target cannot be the same name as a `for` target in
any comprehension containing it:

```python
[(i := i + 1) for i in range(5)]        # SyntaxError
[i for i in (i := range(5))]            # SyntaxError (also the iterable rule)
```

PEP 572 emphasises that this *"applies even if the assignment expression is
never executed"* — it is a compile-time rule, not a runtime one, so a branch
that can never run still fails to compile. The reason is the scoping decision
below: the `for` target is comprehension-local and the walrus target is not, so
the same name would have to be two different variables in one expression.

## The scoping rule: a comprehension's walrus leaks, on purpose

Here is the rule, in the PEP's own words:

> *"an assignment expression occurring in a list, set or dict comprehension or
> in a generator expression […] binds the target in the containing scope."*

This is the **opposite** of the `for` target's behaviour. A comprehension gets
its own scope in Python 3, so `[x for x in data]` does not leak `x`. A walrus
inside the same comprehension does leak:

```python
def f(data):
    squares = [y for x in data if (y := x * x) > 10]
    print(x)    # NameError — the for target is comprehension-local
    print(y)    # works — the walrus target bound in f's scope
```

It looks like an inconsistency and it is a deliberate design decision. The
motivating use is capturing something *out* of a comprehension that you would
otherwise need a second pass for:

```python
# the last value that passed the filter, without a second loop
matches = [y for x in data if (y := transform(x)) is not None]
if matches:
    log.debug("last transformed value was %s", y)

# a running total computed during the comprehension
total = 0
running = [total := total + n for n in numbers]     # `total` ends up correct
```

That second one is a genuine idiom for cumulative sums, though
`itertools.accumulate(numbers)` says it more clearly and does not depend on
evaluation order.

:::caution
The leak is a real hazard in long functions: a walrus inside a comprehension can
silently rebind a name you were using twenty lines earlier. Choose names for
comprehension walruses as deliberately as you would for any other assignment —
`y`, `tmp` and `val` are exactly the names most likely to collide.
:::

The corollary that catches people: because the binding is in the containing
scope, a walrus in a comprehension **at module level binds a module global**,
and inside a function it binds a function local — with all the usual
consequences, including that a later `global`/`nonlocal` declaration for the same
name is a `SyntaxError`.

## Gotchas

**Symptom — `SyntaxError` on a bare `y := f(x)` as a line of code.** Cause: an
unparenthesised assignment expression is invalid as a statement, deliberately, so
that `:=` and `=` cannot be confused where a typo is least visible. Fix: write
`y = f(x)`.

**Symptom — a walrus binds a boolean instead of the value.** Cause: `:=` groups
less tightly than every other operator, so `x := a is not None` assigns the
comparison's result. Fix: parenthesise the assignment — `(x := a) is not None`.
Nothing raises, so this is found by a wrong result rather than a traceback.

**Symptom — `SyntaxError` from a comprehension line that "cannot even run".**
Cause: the walrus target has the same name as a `for` target somewhere in the
same comprehension. The rule is compile-time and PEP 572 states it applies even
when the expression is never executed. Fix: rename one of them.

**Symptom — `SyntaxError` for a walrus inside a comprehension in a class
body.** Cause: assignment expressions in class-scope comprehensions are
expressly invalid — class bodies already scope comprehensions unusually. Fix:
move the computation into a method, a module-level function, or an ordinary
loop in the class body.

**Symptom — `SyntaxError` for `[x for x in (data := get())]`.** Cause: named
expressions are banned outright in a comprehension's *iterable* expression, and
parentheses do not help. Fix: assign on the line before —
`data = get()` — then comprehend over it.

**Symptom — a variable changes value unexpectedly after a comprehension runs.**
Cause: a walrus inside the comprehension binds in the **containing** scope, so
it overwrote a name the enclosing function was already using. Fix: this is
documented behaviour, not a bug — rename the walrus target. Short generic names
(`y`, `val`, `tmp`) are the ones that collide.

**Symptom — `print(x)` after a comprehension raises `NameError` while `print(y)`
works, in the same comprehension.** Cause: the `for` target is
comprehension-local; the walrus target is not. Fix: nothing to fix — this is the
designed asymmetry, and it is the reason the name-collision rule exists.

**Symptom — a `global x` declaration after a comprehension that walruses `x` is
a `SyntaxError`.** Cause: the walrus already bound `x` in the containing scope,
so the later declaration contradicts an established binding. Fix: declare
`global` before, or rename the walrus target.

**Symptom — a cumulative-sum comprehension gives the right list but a surprising
final total on a second run.** Cause: `[total := total + n for n in numbers]`
depends on `total` being reset before each run, and the walrus leaves it bound
afterwards. Fix: use `itertools.accumulate(numbers)`, which carries no external
state and reads as what it is.

## Interview questions

**★ Q: Why does a walrus inside a comprehension leak its name, when the `for` target does not?**
By design. PEP 572 specifies that an assignment expression in a comprehension or
generator expression *binds the target in the containing scope*, whereas the
`for` target is comprehension-local. The point is to let a comprehension capture
a value out to the surrounding code — the last matching transform, a running
total — without a second pass.

**★ Q: Where can `:=` not be used at all?**
Two places, and parentheses do not help: in a comprehension's **iterable
expression** (`[x for x in (data := get())]`), and in a comprehension inside a
**class body**. Everywhere else the restriction is only on the *unparenthesised*
form — as a statement, on the right of `=`, as a keyword argument value, as a
function default, in a lambda body, in an annotation, in an f-string expression.

**★ Q: What is the precedence of `:=`?**
Looser than every other operator — PEP 572 says it groups more tightly than a
comma but less tightly than everything else, including `or`, `and`, `not` and
conditional expressions. So `x := a is not None` binds the boolean. Parenthesise
the assignment every time; it is required in half the legal positions anyway.

**Q: Why is `[(i := i + 1) for i in range(5)]` a `SyntaxError`?**
Because an assignment expression's target cannot share a name with a `for`
target in any enclosing comprehension. It is a compile-time rule that applies
even when the expression could never execute, and it exists because the two
targets live in different scopes — comprehension-local for `for`, containing
scope for the walrus — so one name would have to be two variables.

**Q: Why is `y := f(x)` on its own line a `SyntaxError` when `(y := f(x))` is fine?**
To keep `=` and `:=` from being confused at statement level. Allowing the bare
form would mean a mistyped `:` silently produced valid code with the same
meaning, at exactly the place where such a typo is hardest to see. The language
refuses and tells you to write `y = f(x)`.

**Q: Does a walrus at module level inside a comprehension create a global?**
Yes — the containing scope at module level *is* the module globals. The same
rule that makes it a function local inside a function makes it a global at module
level, with the usual consequences, including a `SyntaxError` if a later
`global` declaration for that name contradicts it.

**Q: Is `[total := total + n for n in numbers]` a good way to do a running sum?**
It works, and the leaked `total` ends up correct, which is a nice demonstration
of the scoping rule. But it depends on `total` being initialised outside and left
bound afterwards, and it hides mutation inside a comprehension.
`itertools.accumulate(numbers)` is the clear form.

---

← Prev: [The walrus operator](05-the-walrus-operator.md) · Index: [Truthiness](README.md) · Next → **Comparisons** *(not written yet)*
