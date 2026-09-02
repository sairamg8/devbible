---
title: "The walrus operator `:=` — assign inside the condition you are already testing"
sidebar_label: "5 · The walrus operator"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against [PEP 572 — Assignment Expressions](https://peps.python.org/pep-0572/),
> the Python 3.14 Language Reference
> [Assignment expressions](https://docs.python.org/3.14/reference/expressions.html#assignment-expressions),
> and [PEP 8](https://peps.python.org/pep-0008/).
> Target: **CPython 3.14**.

**`:=` computes a value, binds it to a name, and evaluates to it — all inside an
expression. Its formal name is an **assignment expression**; PEP 572 also calls
these *named expressions*, and everyone calls it the walrus. It exists for one
recurring shape: you need a value in order to decide something, and you need the
same value inside the branch. Before 3.8 that meant either computing it twice or
restructuring the loop. It belongs in this topic because the conditions it lives
in are truthiness conditions — so `while chunk := read():` inherits every
falsy-value trap on this page, and the fix is the same `is not None` it always
was.**

## The shape it exists for

PEP 572's own motivating examples are the canonical four, and they are worth
knowing verbatim because they are the cases where the operator genuinely earns
its place.

**A regex match you need to test and then use:**

```python
if (match := pattern.search(data)) is not None:
    # Do something with match
```

Without it, you either call `search` twice or assign on a separate line and
indent the whole thing under a second `if`. This is the single most common real
use.

**The loop-and-a-half — reading until a sentinel:**

```python
while chunk := file.read(8192):
    process(chunk)
```

Before 3.8 this was `while True:` with a `break`, or a duplicated `read` before
and inside the loop. Both are worse.

**Reusing a value inside a comprehension's condition:**

```python
filtered_data = [y for x in data if (y := f(x)) is not None]
```

`f` is called once per element rather than twice — once for the condition and
once for the output expression — which is the whole point when `f` is expensive.

**A dispatch chain**, taken from CPython's own `copy.py`:

```python
if reductor := dispatch_table.get(cls):
    rv = reductor(x)
elif reductor := getattr(x, "__reduce_ex__", None):
    rv = reductor(4)
```

Each branch needs the value it just looked up. Without the walrus this is a
staircase of nested `if`s or four lookups.

## The truthiness trap it inherits

`while chunk := file.read(8192):` works because `read` returns `b""` **only** at
end of file, and `b""` is falsy. That is a property of `read`, not of the
walrus, and the idiom breaks the moment the source can legitimately produce a
falsy value:

```python
while item := queue.get():         # BUG: stops on a legitimate 0 or ""
    process(item)

while line := f.readline():        # fine — a blank line is "\n", truthy;
    ...                            # only EOF gives "", so this one is correct

while n := sock.recv_into(buf):    # fine — 0 means the peer closed
    ...
```

The queue case is the bug, and it is the [empty-versus-missing](02-empty-versus-missing.md)
problem again with an operator in front of it. The fix is the one this topic
keeps returning to — say the question you mean:

```python
while (item := queue.get()) is not None:      # a None sentinel ends the loop
    process(item)
```

Note the parentheses: `:=` binds **less tightly than every other operator**, so
`while item := queue.get() is not None:` parses as
`while item := (queue.get() is not None):` and binds a *boolean* to `item`. That
is a genuinely nasty one, because the loop still terminates correctly and only
the body is wrong.

The same applies to the regex form. `re.Match` objects are always truthy — a
zero-width match is still a match — so `if m := pattern.search(s):` is safe.
PEP 572 nonetheless writes the example with `is not None`, and that is the habit
worth copying: it survives the day someone swaps `search` for a function that
can legitimately return `0`.

## Where it genuinely helps, and where it does not

Good uses share one property: **the value is needed twice, and the second use is
inside the branch the first use decides.**

```python
# a good one: avoid computing len twice, and name the thing you are reporting
if (n := len(items)) > 100:
    warn(f"too many items: {n}")

# a good one: read-and-test in a comprehension
results = [parsed for line in lines if (parsed := parse(line)) is not None]

# a good one: the "did anything change" pattern
if (new_etag := response.headers.get("ETag")) != cached_etag:
    store(new_etag, response.body)
```

Bad uses share the opposite property — the name is used once, or the expression
was already clear:

```python
# pointless: y is used once
if (y := f(x)) > 0:
    return y            # ... fine, actually. But:

# bad: nothing is reused, and the line now does two things
print(total := a + b)

# bad: a chain nobody can read
if (a := f()) and (b := g(a)) and (c := h(b)):
    ...
```

That last shape is where the walrus earns its reputation. Three assignments and
three short-circuits in one condition means three names that may or may not be
bound depending on where the chain stopped — and referring to `b` after the
`if` is then a live `NameError` risk that no linter will catch for you.

**The test:** if removing the walrus would need a `while True:` / `break`, a
duplicated expensive call, or an extra level of indentation, it is earning its
place. If removing it would just mean one ordinary assignment on the line above,
write the ordinary assignment.

## Style

PEP 8 has nothing walrus-specific beyond the general spacing rule, but PEP 572
does, and it is unambiguous: **always put spaces around `:=`**. `x := f()`, never
`x:=f()`.

Two more conventions worth adopting, both from how the stdlib uses it:

- **Parenthesise it whenever it is not the whole expression.** Required in many
  positions (see [the rules chunk](05b-walrus-rules-and-scope.md)) and clarifying
  in the rest.
- **Bind a name you will actually use.** A walrus whose name is never read again
  is a statement wearing an expression's clothes.

## Gotchas

**Symptom — `while item := queue.get():` exits early on a legitimate `0` or
`""`.** Cause: the loop condition is a truthiness test, so any falsy item ends
it. Fix: `while (item := queue.get()) is not None:` — and use a `None` sentinel
to signal the end of the queue. This is the empty-versus-missing bug with an
operator in front of it.

**Symptom — a walrus binds `True`/`False` instead of the value.** Cause: `:=`
groups less tightly than every other operator, so
`while item := queue.get() is not None:` assigns the *comparison's* result. Fix:
parenthesise the assignment: `while (item := queue.get()) is not None:`. The loop
still terminates correctly, so only the body misbehaves — which makes this hard
to spot.

**Symptom — `SyntaxError` on a bare `y := f(x)` at the start of a line.** Cause:
an unparenthesised assignment expression is not valid as a statement — PEP 572
disallows it deliberately, so that `=` and `:=` cannot be confused at statement
level. Fix: use `y = f(x)`, which is what you meant, or `(y := f(x))` if you
genuinely want the expression form.

**Symptom — a `NameError` for a name that is clearly assigned in the `if` above
it.** Cause: the walrus was in a short-circuited operand — `if a() and (b :=
g()):` never binds `b` when `a()` is falsy. Fix: do not rely on names bound
inside a chain of `and`/`or`; assign on their own line, or restructure.

**Symptom — a comprehension using `:=` leaks a name into the enclosing
function.** Cause: this is the documented behaviour — an assignment expression
in a comprehension *"binds the target in the containing scope"*, unlike the
`for` target, which does not. Fix: it is intentional and often useful; just do
not reuse a name you care about. [The rules chunk](05b-walrus-rules-and-scope.md)
has the details.

**Symptom — code using `:=` fails to run on an older interpreter with a
`SyntaxError` that points at the operator.** Cause: assignment expressions are
3.8+. A `SyntaxError` cannot be caught by a version check inside the same file,
because the whole module fails to compile. Fix: gate on the module boundary —
put the new-syntax code in a separate module imported conditionally — or set the
project's `requires-python` and let the installer refuse.

**Symptom — `if (n := len(items)) > 100:` reads fine but a reviewer objects that
`n` is used only in the message.** Cause: it is a legitimate use — the value is
needed twice, once for the comparison and once for the report. Fix: none needed;
this is the shape the operator was added for. The objectionable form is the one
where the bound name is never read again.

**Symptom — a long `if` chain of walruses becomes unmaintainable.** Cause:
`if (a := f()) and (b := g(a)) and (c := h(b)):` puts three assignments, three
short-circuits and one condition on one line, and which names are bound depends
on where it stopped. Fix: ordinary statements. The walrus is for one value, not
for a pipeline.

## Interview questions

**★ Q: What is the walrus operator and what problem does it solve?**
`:=` is an assignment expression (PEP 572, Python 3.8): it binds a name and
evaluates to the value, inside an expression. It solves the shape where a value
is needed to *decide* something and needed again *inside* the branch — a regex
match you test then use, a read-until-sentinel loop, a comprehension whose
condition and output share an expensive call. Without it you compute twice or
restructure.

**★ Q: What is wrong with `while chunk := queue.get():`?**
It is a truthiness test, so a legitimately falsy item — `0`, `""`, an empty list
— ends the loop early. It happens to be correct for `file.read()`, because
`read` returns an empty bytes object only at EOF. Write
`while (chunk := queue.get()) is not None:` and use a `None` sentinel.

**★ Q: Why do the PEP's own examples parenthesise the walrus?**
Because `:=` groups **less tightly than every other operator**, including
comparisons. `x := a is not None` binds the boolean to `x`, not `a`. It is also
required outright in several positions — as a bare statement, as a keyword
argument value, in a function default — so parenthesising always is the habit
that never bites.

**Q: Is `if m := pattern.search(s):` safe, or must it be `is not None`?**
Safe, because `re.Match` objects are always truthy — a zero-width match is still
a match. PEP 572 nonetheless writes it with `is not None`, and copying that is
worth it: the truthiness form silently breaks the day the call is replaced with
something that can return `0` or `""`.

**Q: When should you *not* use it?**
When the bound name is used only once, when an ordinary assignment on the
previous line would do, and in chains — `if (a := f()) and (b := g(a)):` leaves
`b` conditionally unbound and is unreadable. The test: if removing the walrus
would force a `while True:`/`break`, a duplicated expensive call, or an extra
indent level, keep it. Otherwise write the plain assignment.

**Q: What version introduced it, and can you feature-detect it?**
Python 3.8. You cannot feature-detect it at runtime in the same module, because
a `SyntaxError` happens at compile time — the whole file fails to load before
any version check runs. Isolate the syntax in a separate module imported
conditionally, or declare `requires-python` and let packaging enforce it.

**Q: What is the official name?**
Assignment expression. PEP 572 notes they may also be called named expressions;
"walrus" is the informal name for the `:=` token's resemblance to a walrus's
eyes and tusks.

---

← Prev: [`any` and `all` in practice](04b-any-all-in-practice.md) · Index: [Truthiness](README.md) · Next → [Walrus rules and scope](05b-walrus-rules-and-scope.md)
