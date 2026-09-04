---
title: "A guard that raises InsufficientFunds is not avoiding an exception, it is manufacturing one — the distinction between a check that duplicates a failure the operation already reports and a check that produces information nothing else would"
sidebar_label: "05i · The check is the rule"
sidebar_position: 139
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`str.isdigit` / `isdecimal` / `isnumeric`](https://docs.python.org/3.14/library/stdtypes.html#str.isdigit)
> (the *"Numeric_Type=Digit or Numeric_Type=Decimal"* definition and the docs' own `'²'`
> example), [`int()`](https://docs.python.org/3.14/library/functions.html#int),
> [`ExceptionGroup`](https://docs.python.org/3.14/library/exceptions.html#ExceptionGroup),
> [`sqlite3` exceptions](https://docs.python.org/3.14/library/sqlite3.html#exceptions).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**There are two kinds of `if` in front of an operation and they get argued about as though
they were one. The first duplicates a failure the operation already reports — `if
os.path.exists(p)` before `open(p)`, `if key in d` before `d[key]` — and it is the LBYL this
topic spends four chunks dismantling. The second produces a failure that **nothing else
would ever report**: subtracting from a balance does not raise, so `if amount >
account.balance: raise InsufficientFunds(...)` is not dodging an exception, it is creating
the only one that will ever describe this rule. Telling the two apart is the whole skill, and
the test is one question: if I delete this check, what raises, and what does it say?**

## The two kinds of `if`

| The check | Delete it and… | Verdict |
|---|---|---|
| `if key in d:` before `d[key]` | `KeyError`, naming the key | delete it — the operation is the better test |
| `if p.exists():` before `open(p)` | `FileNotFoundError` with `errno` and `filename` | delete it — and the docs call the `os.access` version a security hole |
| `if isinstance(x, Iterable):` before a `for` | `TypeError` from `iter()` | delete it — `iter()` is the only reliable test |
| `if amount > balance:` before a debit | **nothing** — the balance goes negative | keep it: the check is the rule |
| `if order.status is not AUTHORIZED:` before a capture | the gateway's own error, in its vocabulary, after the call | keep it: your words, before the leap |
| `if country not in VALID_COUNTRIES:` | nothing — a bad code is stored | keep it: the set membership is the rule |
| `if len(password) < 12:` | nothing — a weak password is hashed and saved | keep it: policy has no natural exception |

The right-hand column is the entire distinction. A rule with no natural failure channel
*must* be a check, because there is nothing to catch; a rule the runtime already enforces
should not be checked twice.

## The guard exists to carry data, so give it data

A domain exception raised by a domain check should carry the fields the caller needs to
render, log or decide with. This is what "the check is the rule" buys you over an
after-the-fact built-in error.

```python
class InsufficientFunds(Exception):
    def __init__(self, account_id: str, requested: int, available: int) -> None:
        super().__init__(
            f"account {account_id}: requested {requested}, available {available}"
        )
        self.account_id = account_id
        self.requested = requested
        self.available = available
        self.shortfall = requested - available


def withdraw(account, amount: int) -> int:
    if amount <= 0:
        raise ValueError(f"amount must be positive, got {amount}")
    if amount > account.balance:
        raise InsufficientFunds(account.id, amount, account.balance)
    account.balance -= amount
    return account.balance
```

`shortfall` is the tell that this is a domain error rather than a translated built-in: the
handler can offer "add £4.20 to continue" without re-deriving anything. Naming, hierarchy
and when to define your own type at all are
[topic 11's](../11-exceptions/07-custom-exceptions.md); what belongs here is the reason the
`if` is not a smell — it is the only place that fact exists.

⚠️ **Ownership audit, as every LBYL example in this topic owes you.** `amount` is a local:
race-free. `account.balance` is *not* — it came from a store, and the same check inside a
transaction (`WHERE balance >= ?`) is what makes the debit safe under concurrency, per
[closing the gap with a lock](05g-closing-the-gap-with-a-lock.md). The check earns its place
for the error it produces; it does not earn safety.

## When the exception cannot tell you what you need

Sometimes the operation *does* raise and the exception still is not good enough — it
describes the value and not the context. `int(raw)` raises `ValueError` mentioning the
string; it cannot know the string came from column `age` of row 412.

There are two repairs and only one of them is usually right.

```python
# ✅ Right: keep the exact test, add the context on the way out.
try:
    age = int(raw_age)
except ValueError as exc:
    raise FieldError("age", row_number, f"not an integer: {raw_age!r}") from exc

# 🔴 Wrong: replace the exact test with an approximate one.
if raw_age.isdigit():
    age = int(raw_age)
else:
    raise FieldError("age", row_number, "not an integer")
```

The second is wrong in **both** directions, and the string documentation says why. `isdigit`
is defined over a Unicode property:

> *"Return `True` if all characters in the string are digits and there is at least one
> character, `False` otherwise. Digits include decimal characters and digits that need
> special handling, such as the compatibility superscript digits. This covers digits which
> cannot be used to form numbers in base 10, like the Kharosthi numbers. Formally, a digit is
> a character that has the property value Numeric_Type=Digit or Numeric_Type=Decimal."*

The docs' own example is the counter-example you need: `'²'.isdigit()` is `True`, and
`int('²')` raises — the guard passes and the leap fails anyway. In the other direction
`'-1'.isdigit()` is `False`, because no sign character is a digit, while `int('-1')` is fine.
**`isdigit` answers a Unicode property question and `int()` answers a parsing question, and
they are not the same question** — which is the general form of the failure: a pre-check is
an approximation of the operation, and every gap between the two is a bug that presents as
"but I checked".

So the pre-check earns its place on message quality only where the check is *exact*:
membership in a set you defined, a length, a numeric range, a regex you also apply as the
parser. Where the operation is the only exact test, keep it and translate.

## Can EAFP aggregate? Yes — with `ExceptionGroup`

Since 3.11 the language has a first-class way to raise several exceptions at once, so
"exceptions cannot aggregate" would be false. The honest claim is narrower: **conditions
aggregate into data, and exceptions aggregate into control flow**, and a report is data.

```python
def parse_row_strict(row_number: int, row: dict[str, str]) -> Contact:
    """Same checks, raising a group so nothing is lost and nothing is hidden."""
    failures: list[Exception] = []

    email = row.get("email", "").strip()
    if "@" not in email:
        failures.append(ValueError(f"row {row_number}: email must contain @"))

    try:
        age = int(row.get("age", "").strip())
    except ValueError as exc:
        failures.append(exc)
        age = 0

    if failures:
        raise ExceptionGroup(f"row {row_number} is invalid", failures)
    return Contact(row_number, email, age, row.get("country", "").upper())
```

That is a real option and it composes with `except*`. It is the better choice when the
caller is *code* that should not proceed — a library boundary, a strict parser — and the
worse choice when the caller is a template rendering messages next to inputs, because the
renderer then has to walk the group and re-derive which field each exception was about.
Choose by asking who consumes the failure. `ExceptionGroup`, `except*` and the splitting
rules are [topic 11's](../11-exceptions/08-exception-groups.md).

## Gotchas

**★ Symptom: a validator using `isdigit()` rejects `-1` and accepts `'²'`, and the import
still crashes.** Cause: `isdigit` answers a **Unicode property** question — the docs define
a digit as *"a character that has the property value Numeric_Type=Digit or
Numeric_Type=Decimal"* and note that this *"covers digits which cannot be used to form
numbers in base 10, like the Kharosthi numbers"* — while `int()` answers a **parsing**
question. The docs' own example shows `'²'.isdigit()` is `True`, and `int('²')` raises. Fix:
let `int()` be the test and translate its `ValueError` into your row error.

```python
try:
    age = int(raw_age)
except ValueError:
    errors.append(RowError(row_number, "age", f"not an integer: {raw_age!r}"))
```

**★ Symptom: the API returns `{"error": "invalid literal for int() with base 10"}` to a
customer.** Cause: a built-in exception's message reached the response because nothing
translated it. Fix: catch at the layer that knows the context and re-raise a domain type
carrying fields, with `from exc` so the original survives in the log.

```python
try:
    quantity = int(payload["quantity"])
except (KeyError, ValueError) as exc:
    raise BadRequest("quantity", "must be an integer") from exc
```

**★ Symptom: a domain exception is raised with a formatted string and the handler
re-parses the message to get the numbers back.** Cause: the data went into the message
instead of onto the object. Fix: attributes first, message derived from them.

```python
class InsufficientFunds(Exception):
    def __init__(self, account_id: str, requested: int, available: int) -> None:
        super().__init__(f"{account_id}: need {requested - available} more")
        self.account_id, self.requested, self.available = account_id, requested, available
```

**Symptom: the domain check and a database `CHECK` constraint disagree, and rows exist that
the application says are impossible.** Cause: the rule was written twice in two languages and
one copy was updated. Fix: keep both — the constraint is the enforcement, the check is the
message — and make the application translate the constraint violation into the *same*
exception type, so there is one class to handle and one place to change the wording.

```python
try:
    conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, id_))
except sqlite3.IntegrityError as exc:            # CHECK (balance >= 0) fired
    raise InsufficientFunds(id_, amount, current_balance(conn, id_)) from exc
```

**Symptom: a validation helper returns `False` and the caller raises a generic
`ValueError`, losing which rule failed.** Cause: the boolean threw away everything the check
knew. Fix: return the message (or `None`), or raise from inside the helper — never reduce a
diagnosis to one bit and then try to reconstruct it.

```python
def password_error(value: str) -> str | None:
    if len(value) < 12:
        return "Use at least 12 characters."
    if value.isdigit():
        return "Use more than digits."
    return None
```

**Symptom: a "guard" was deleted in review as unpythonic and a negative balance appeared in
production.** Cause: the reviewer applied the `if key in d` rule to a check with no
underlying exception — the delete-it test was never run. Fix: answer the question in the
review comment: *"if I remove this, what raises?"* If the answer is "nothing", the check is
the rule and stays.

## Interview questions

**★ Is `if amount > account.balance: raise InsufficientFunds(...)` LBYL, and is it wrong?**
It is LBYL in shape and it is correct, because the guard is not there to dodge an exception
— it is there to *create* one. Nothing downstream raises "insufficient funds"; subtracting
from a number succeeds and leaves a negative balance. The check **is** the business rule,
and the exception it raises carries the domain data a caller needs: which account, how much
was asked, how much was available. The distinction to draw in an interview is between a
check that duplicates a failure the operation already reports (delete it, catch instead) and
a check that produces a failure nothing else would report (keep it — it is the only source
of that information).

**★ When does a pre-check earn its place purely on the quality of its message?**
When the exception the operation raises does not carry what the caller must report.
`int(raw)` raises `ValueError` and the message describes the string, not which column of
which row it came from, and not what the acceptable range is. You have two repairs and
only one of them is usually right: catch the `ValueError` and re-raise or record it *with*
the field and row (right, because `int()` remains the exact test), or pre-check with
something like `isdigit()` (wrong, because it answers a different question and both
over- and under-accepts). Use a pre-check for the message only where the check is exact —
membership in a known set, a length, a range.

**★ Can EAFP aggregate failures?**
Yes, since 3.11: collect the exceptions and `raise ExceptionGroup(msg, failures)`, which
callers destructure with `except*`. So the accurate statement is not that exceptions cannot
aggregate but that they aggregate into *control flow* while conditions aggregate into
*data*. Pick by consumer: a strict library boundary that must stop its caller is well served
by a group; a form renderer that needs `field -> message` is better served by the dictionary,
because a group forces the renderer to walk the tree and re-derive which input each failure
belongs to.

**★ How do you decide, in one question, whether an `if` before an operation should be
deleted?**
Ask what happens if you delete it. If the operation raises an exception that names the same
problem with equal or better data — `KeyError` naming the key, `FileNotFoundError` carrying
`errno` and the filename, `TypeError` from `iter()` — the check is a duplicate, it can be
wrong about its own subject, and it opens a gap; delete it and handle the exception. If
nothing raises, or what raises is a third party's vocabulary arriving after an irreversible
act, the check is the only source of that information and it stays. The question is
mechanical, it takes ten seconds, and it settles almost every EAFP-versus-LBYL review
argument without anyone saying "Pythonic".

**Why is `isdigit()` the wrong pre-check for an integer field?**
Because it is not testing what you think. The docs define it over Unicode properties —
*"a digit is a character that has the property value Numeric_Type=Digit or
Numeric_Type=Decimal"* — and note it *"covers digits which cannot be used to form numbers in
base 10"*. Their own example, `'²'.isdigit()`, is `True`, while `int('²')` raises; and
`'-1'.isdigit()` is `False` although `int('-1')` succeeds, because a sign is not a digit. So
it both accepts strings `int()` rejects and rejects strings `int()` accepts. The general
lesson is bigger than one method: a pre-check is an approximation of the operation, and the
places where the approximation and the operation disagree are exactly the bugs that produce
"but I checked".

**Should a domain rule live in the application or in the database?**
In both, doing different jobs, and this is the answer that separates people who have run
this in production. The database constraint is the *enforcement*: it is the only thing that
holds under concurrency, and it holds against every writer including the psql session
someone opened at 2am. The application check is the *message*: it produces
`InsufficientFunds` with the shortfall, in the user's language, before an attempt is made.
The failure mode to avoid is having the two disagree, so the application translates the
constraint violation into the same exception type it raises itself — one class for the
caller to handle, one wording to maintain.

---

← Prev: [Reports, not first casualties](05h-aggregating-failures.md) · Index: [EAFP vs LBYL](README.md) · Next → **Type checkers and silent APIs** *(not written yet)*
