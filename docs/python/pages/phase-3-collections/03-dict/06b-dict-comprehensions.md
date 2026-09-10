---
title: "A dict comprehension evaluates the key before the value, keeps the last duplicate without a word, runs in its own scope, and is the documented cure for fromkeys — and inverting a dict with one is the commonest way to lose data silently"
sidebar_label: "18 · Dict comprehensions"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Dictionary displays](https://docs.python.org/3.14/reference/expressions.html#dictionary-displays), [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries), [Resolution of names](https://docs.python.org/3.14/reference/executionmodel.html#resolution-of-names), [Mapping Types — dict (`fromkeys`)](https://docs.python.org/3.14/library/stdtypes.html#dict.fromkeys) — plus [PEP 572](https://peps.python.org/pep-0572/) on evaluation order and assignment expressions. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**`{k: v for k, v in pairs}` is the most expressive way to build a dict and the easiest to get quietly wrong. Its semantics are four sentences in the language reference: entries are inserted in the order produced, a duplicate key keeps the last value without complaint, the key expression runs before the value expression (since 3.8), and the body runs in its own nested scope. Each sentence has a production bug attached — the inverted index that lost half its entries, the "per-key default" that was one shared list, the comprehension in a class body that raises `NameError`. This chunk is those four rules and the bugs they explain.**

## The semantics, verbatim

> *"When the comprehension is run, the resulting key and value elements are inserted in the new dictionary in the order they are produced."*

> *"Clashes between duplicate keys are not detected; the last value (textually rightmost in the display) stored for a given key value prevails."*

> *"Changed in version 3.8: Prior to Python 3.8, in dict comprehensions, the evaluation order of key and value was not well-defined. In CPython, the value was evaluated before the key. Starting with 3.8, the key is evaluated before the value, as proposed by PEP 572."*

> *"However, aside from the iterable expression in the leftmost `for` clause, the comprehension is executed in a separate implicitly nested scope. This ensures that names assigned to in the target list don't "leak" into the enclosing scope."*

A comprehension is therefore equivalent to a loop that assigns `result[key] = value` in iteration order — with the loop variables kept out of your namespace. PEP 572 records why the evaluation order was fixed: the display `{X: Y}` and `dict((X, Y) for ...)` already evaluated `X` first, and the comprehension *"should clearly be equivalent"*.

## The shapes

```python
users = [User(id=7, email="a@example.com", active=True), User(id=9, email="b@example.com", active=False)]

by_id = {user.id: user for user in users}                                  # index
emails = {user.id: user.email for user in users if user.active}            # filter
normalised = {key.strip().lower(): value for key, value in raw.items()}    # transform keys
rounded = {name: round(price, 2) for name, price in prices.items()}        # transform values
```

**Filter versus conditional value.** The `if` at the end filters *entries*; a conditional *expression* inside the value transforms them. They live in different places, and swapping them is a `SyntaxError`:

```python
# keep only positive balances
positive = {acct: bal for acct, bal in balances.items() if bal > 0}

# keep every account, clamp negatives to zero
clamped = {acct: (bal if bal > 0 else 0) for acct, bal in balances.items()}

# SyntaxError: an `else` cannot follow the filter clause
# broken = {acct: bal for acct, bal in balances.items() if bal > 0 else 0}
```

**Nested `for` clauses** read left to right, outermost first — the same order as the equivalent nested loops:

```python
# {tenant: {user: role}} -> {(tenant, user): role}
flat = {
    (tenant, user): role
    for tenant, members in memberships.items()
    for user, role in members.items()
}
```

## Inverting a dict: where data disappears

The classic comprehension bug. Swapping keys and values is one line — and if two keys share a value, the inverted dict keeps only the last:

```python
owner_of = {"invoice-1": "alice", "invoice-2": "bob", "invoice-3": "alice"}

by_owner = {owner: invoice for invoice, owner in owner_of.items()}
# {'alice': 'invoice-3', 'bob': 'invoice-2'} — invoice-1 is gone, silently
```

That is the documented *"Clashes between duplicate keys are not detected"* rule, applied to data you did not think of as having duplicates. Two correct answers, depending on what the inversion is for:

```python
# 1. the inverse is one-to-many: group instead of overwrite
by_owner: dict[str, list[str]] = {}
for invoice, owner in owner_of.items():
    by_owner.setdefault(owner, []).append(invoice)

# 2. the mapping is supposed to be one-to-one: prove it
def invert_unique(mapping: dict[str, str]) -> dict[str, str]:
    inverse = {value: key for key, value in mapping.items()}
    if len(inverse) != len(mapping):
        raise ValueError("mapping is not one-to-one; inversion would lose entries")
    return inverse
```

The length check is exact, not heuristic: an inversion loses entries if and only if two keys share a value, and that is precisely when the inverse is shorter. The same silent collapse happens when a comprehension *normalises* keys — `{k.lower(): v for k, v in headers.items()}` merges `Content-Type` and `content-type` into one entry, and which value survives depends on insertion order.

## The comprehension is the fix for `fromkeys` — when the value is an expression

The `fromkeys` documentation ends by pointing here:

> *"All of the values refer to just a single instance, so it generally doesn't make sense for value to be a mutable object such as an empty list. To get distinct values, use a dict comprehension instead."*

It works because the value expression is **re-evaluated for every entry**:

```python
buckets = {region: [] for region in REGIONS}       # a new list per region
```

🔴 It only works if the value is an *expression that builds something*. A comprehension whose value is a *name* bound to one object shares that object exactly as `fromkeys` does:

```python
empty: list[str] = []
buckets = {region: empty for region in REGIONS}    # 🔴 every region holds the SAME list

DEFAULT_LIMITS = {"rpm": 60, "burst": 10}
limits = {tenant: DEFAULT_LIMITS for tenant in tenants}          # 🔴 one shared dict
limits = {tenant: dict(DEFAULT_LIMITS) for tenant in tenants}    # a copy per tenant
```

## Key before value, and why it can matter

Since 3.8 the key expression runs first. That is observable whenever the two expressions share state — most often through an assignment expression, which in a comprehension binds in the *containing* scope. PEP 572:

> *"an assignment expression occurring in a list, set or dict comprehension or in a generator expression … binds the target in the containing scope, honoring a `nonlocal` or `global` declaration for the target in that scope, if one exists."*

```python
# parse once, use the parsed object for both key and value
index = {(parsed := parse(line)).id: parsed for line in lines}
```

That line relies on the key running first: `parsed` is assigned while computing the key and read while computing the value. The order was fixed in 3.8, the same release that introduced `:=`, so this form never ran on a runtime with the old order — but code that shares state between key and value *without* a walrus did, and changed meaning. It also leaves `parsed` bound after the comprehension — the documented containing-scope rule — which is rarely what anyone wants in a long function. The version that needs no ordering argument at all:

```python
index = {record.id: record for record in map(parse, lines)}
```

## Scope: the class-body trap

The comprehension body runs in a nested scope, and the execution model is explicit that class scopes do not extend into nested scopes:

> *"The scope of names defined in a class block is limited to the class block; it does not extend to the code blocks of methods. This includes comprehensions and generator expressions"*

The only part evaluated in the class scope is the leftmost iterable — *"The iterable expression in the leftmost `for` clause is evaluated directly in the enclosing scope."* So a lookup table built in a class body from another class attribute works or fails depending on *where* in the comprehension the name appears:

```python
class Currency:
    CODES = ["EUR", "USD", "GBP"]
    SYMBOLS = {"EUR": "€", "USD": "$", "GBP": "£"}

    ORDER = {code: position for position, code in enumerate(CODES)}   # fine: CODES is the leftmost iterable
    # LABELS = {code: SYMBOLS[code] for code in CODES}                # NameError: SYMBOLS is in the body


LABELS = {code: Currency.SYMBOLS[code] for code in Currency.CODES}     # build it after the class
```

## Comprehension, `dict(generator)`, or a loop

All three produce the same dictionary. The comprehension is the idiomatic spelling; `dict((k, v) for ...)` is equivalent and exists mostly in older code; a plain loop is the right answer the moment the body needs a `try`, a log line, a second output, or a duplicate check — anything that is a statement rather than an expression.

```python
by_email: dict[str, User] = {}
for user in users:
    if user.email in by_email:
        raise ValueError(f"duplicate email {user.email}")
    by_email[user.email] = user
```

## Gotchas

**★ Symptom: an inverted index has fewer entries than the original and nothing raised.** Cause: two keys shared a value; the inversion overwrote — *"Clashes between duplicate keys are not detected."* Fix: group into lists, or assert the mapping is one-to-one.

```python
inverse = {value: key for key, value in mapping.items()}
if len(inverse) != len(mapping):
    raise ValueError("not one-to-one")
```

**★ Symptom: appending to one tenant's list in a comprehension-built dict changes every tenant's list.** Cause: the value was a *name* referring to one list, not an expression that builds a list; the comprehension re-evaluates the name, which yields the same object each time. Fix: build the value inside the comprehension.

```python
queues = {tenant: [] for tenant in tenants}
limits = {tenant: dict(DEFAULT_LIMITS) for tenant in tenants}
```

**★ Symptom: `NameError` for a class attribute inside a comprehension in the class body.** Cause: the body runs in a nested scope that cannot see class-level names; only the leftmost iterable is evaluated in the class scope. Fix: build the table after the class, or in a classmethod, or pass the attribute as the leftmost iterable.

```python
LABELS = {code: Currency.SYMBOLS[code] for code in Currency.CODES}
```

**★ Symptom: normalising header names drops one of two headers.** Cause: `{k.lower(): v ...}` maps `Content-Type` and `content-type` to one key; the later one wins. Fix: detect collisions when the input is supposed to have unique names, or combine values when it is not.

```python
combined: dict[str, list[str]] = {}
for name, value in headers.items():
    combined.setdefault(name.lower(), []).append(value)
```

**Symptom: `SyntaxError` on `{k: v for k, v in d.items() if v else 0}`.** Cause: the trailing `if` is a filter clause and takes no `else`. Fix: move the conditional into the value.

```python
clamped = {k: (v if v else 0) for k, v in d.items()}
```

**Symptom: an expensive function is called twice per entry.** Cause: it is used in both the filter and the value. Fix: compute once — a nested generator keeps the loop variable scoped, an assignment expression does it inline but leaks the name.

```python
scores = {name: s for name, s in ((n, score(n)) for n in names) if s > 0.5}
```

**Symptom: a comprehension-built dict iterates in a different order on each run.** Cause: the source was a `set`, and the comprehension inherits its unspecified order — *"inserted in the new dictionary in the order they are produced."* Fix: sort the source.

```python
columns = {name: coerce(name) for name in sorted(required_columns)}
```

**Symptom: after a comprehension using `:=`, a variable in the enclosing function has an unexpected value.** Cause: an assignment expression in a comprehension *"binds the target in the containing scope"*. Fix: avoid the walrus when a plain generator does the job, or pick a name that cannot collide.

```python
index = {record.id: record for record in map(parse, lines)}
```

**Symptom: `{next(tokens): next(tokens) for _ in range(n)}` pairs tokens the wrong way round on an old runtime.** Cause: both expressions consume one shared iterator, so the result depends on which runs first — the value, in CPython before 3.8; the key, since. Fix: never make the key and value depend on each other's side effects; `zip` over one iterator twice has a *documented* left-to-right order — *"The left-to-right evaluation order of the iterables is guaranteed."*

```python
it = iter(tokens)
pairs = dict(zip(it, it, strict=True))      # (t0, t1), (t2, t3), ... on every version
```

**Symptom: a comprehension over two zipped lists silently drops trailing entries.** Cause: `zip` truncates to the shorter input. Fix: `strict=True`.

```python
lookup = {k: v for k, v in zip(keys, values, strict=True)}
```

## Interview questions

**★ What happens when a dict comprehension produces the same key twice?**
The later value overwrites the earlier one and the key keeps the position it was first inserted at; nothing is raised. The reference states it — *"Clashes between duplicate keys are not detected; the last value … stored for a given key value prevails."* The practical consequence is that any comprehension whose key expression is not injective — inverting a mapping, lower-casing names, truncating timestamps to a day — can drop data without a trace. Compare lengths, or group into lists, whenever the input is not known to be unique under the key function.

**★ Why does the `fromkeys` documentation recommend a comprehension, and when does that advice not help?**
Because `fromkeys` evaluates its value argument once and stores that one object under every key, while a comprehension evaluates its value expression once *per entry*. `{k: [] for k in keys}` therefore gives every key its own list. The advice stops helping when the value expression is merely a name — `{k: shared for k in keys}` re-evaluates the name each time and gets the same object each time. What makes values distinct is an expression that *constructs*, not the comprehension syntax itself.

**★ In what order are the key and the value evaluated?**
Key first, since 3.8. Before that the order was *"not well-defined"* and CPython evaluated the value first; PEP 572 fixed it to match `{X: Y}` displays and `dict((X, Y) for ...)`. It only matters when the two expressions interact — typically through an assignment expression set in the key and read in the value — and code that depends on it is usually better rewritten so both come from the loop variable.

**Why can't a comprehension in a class body see the other class attributes?**
Because the comprehension body is its own nested scope, and the execution model says the class block's scope *"does not extend to the code blocks of methods. This includes comprehensions and generator expressions."* The one exception is the leftmost iterable, which is evaluated in the enclosing — here, class — scope before the nested scope starts. So `{c: i for i, c in enumerate(CODES)}` works in a class body and `{c: SYMBOLS[c] for c in CODES}` raises `NameError` on `SYMBOLS`.

**When should you write a loop instead of a comprehension?**
When the body needs a statement: raising on a duplicate, logging, a `try`/`except` around a conversion, updating two dictionaries at once, or anything longer than a readable expression. A comprehension is an expression that builds one dictionary; stretching it with nested conditionals and walrus assignments trades a four-line loop for an unreadable line with the same complexity.

**Does a comprehension's loop variable leak?**
No — *"names assigned to in the target list don't 'leak' into the enclosing scope."* An assignment expression inside the comprehension is the deliberate exception: it binds in the containing scope, which PEP 572 designed so you could capture a witness from `any()`. In a dict comprehension that is more often a surprise than a feature.

**What does `{k: v for k, v in zip(keys, values)}` do if `keys` contains duplicates?**
It keeps the last value for each repeated key, at the position of its first occurrence, and says nothing — the documented *"Clashes between duplicate keys are not detected."* It also silently truncates to the shorter of the two inputs unless `strict=True` is passed to `zip`. So the result can have fewer entries than either input for two different reasons, neither of which raises; a `len` check against the input catches both.

---

← [17 · Building a dict](06-building-a-dict.md) · [Topic index](README.md) · Next → [19 · Merging](07-merging.md)
