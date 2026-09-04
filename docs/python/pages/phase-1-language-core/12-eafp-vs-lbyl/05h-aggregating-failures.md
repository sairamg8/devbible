---
title: "A form that reports one error at a time and an importer that dies on row 4,000 have the same defect: a raise is control flow and a condition is data, and only data composes into a report"
sidebar_label: "05h · Reports, not first casualties"
sidebar_position: 138
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`enumerate`](https://docs.python.org/3.14/library/functions.html#enumerate) (`start`),
> [`int()`](https://docs.python.org/3.14/library/functions.html#int),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html) (`frozen`),
> [`sqlite3` — `executemany` and transaction control](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.Cursor.executemany).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**Ask a user to fix their CSV one row per upload and they will hate you; ask them to fix
one form field per submit and they will leave. Both are the same programming mistake: a
`raise` transfers control, so the first failure ends the loop, and there is no list at the
end because nothing was ever collected. A condition is different in kind — it evaluates to
a value you can append. That is why validation that must produce a *report* is written as
`if`s, and it is the case for LBYL that survives every objection in this topic: the checks
run against locals, nothing races them, and the point was never to avoid an exception at
all — it was to produce data.**

## Why a raise cannot produce a list

```python
# 🔴 One error per upload. The user fixes row 12 and discovers row 19 tomorrow.
def import_rows(rows: list[dict[str, str]]) -> list[Contact]:
    return [parse_contact(row) for row in rows]        # first raise ends everything
```

The comprehension is correct code with the wrong shape: `parse_contact` reports by raising,
and raising unwinds. To get all the failures you must stop the exception from unwinding —
which means a `try` *inside* the loop that appends the exception to a list, at which point
you have re-implemented "collect conditions into data" with more machinery.

The honest position is not "EAFP cannot aggregate" — since 3.11 an `ExceptionGroup` does
exactly that, and [05i](05i-the-check-is-the-rule.md) shows the same importer written that
way. The difference is that with conditions the aggregation is the natural shape, while with
exceptions you must build the container, remember to continue the loop, and be careful about
which types you catch.

## The collecting pattern

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class RowError:
    row_number: int
    field: str
    message: str


@dataclass(frozen=True)
class Contact:
    row_number: int
    email: str
    age: int
    country: str


VALID_COUNTRIES = frozenset({"GB", "US", "DE", "FR", "JP"})


def parse_row(row_number: int, row: dict[str, str]) -> tuple[Contact | None, list[RowError]]:
    """Return the contact if the row is wholly valid, plus every problem found."""
    errors: list[RowError] = []

    email = row.get("email", "").strip()
    if "@" not in email:
        errors.append(RowError(row_number, "email", "must contain @"))

    raw_age = row.get("age", "").strip()
    age = 0
    try:
        age = int(raw_age)                       # int() is the exact test; isdigit is not
    except ValueError:
        errors.append(RowError(row_number, "age", f"not an integer: {raw_age!r}"))
    else:
        if not 0 < age < 150:
            errors.append(RowError(row_number, "age", f"out of range: {age}"))

    country = row.get("country", "").strip().upper()
    if country not in VALID_COUNTRIES:
        errors.append(RowError(row_number, "country", f"unknown country code: {country!r}"))

    if errors:
        return None, errors
    return Contact(row_number, email, age, country), []


def import_contacts(rows: list[dict[str, str]]) -> tuple[list[Contact], list[RowError]]:
    contacts: list[Contact] = []
    problems: list[RowError] = []
    for row_number, row in enumerate(rows, start=2):     # start=2: row 1 is the header
        contact, errors = parse_row(row_number, row)
        if errors:
            problems.extend(errors)
        else:
            contacts.append(contact)                      # never None when errors is empty
    return contacts, problems
```

Four things this does that a first-failure design cannot:

- **Every field of every row is reported**, so one upload produces one complete list of
  corrections. `parse_row` does not return early on the first bad field either — the same
  argument applies within a row.
- **`start=2` puts the spreadsheet's own row number in the message.** The index a
  programmer wants and the number the user sees differ by the header, and that off-by-one
  is the difference between a usable report and an argument.
- **The one genuinely EAFP check sits inside**, because "is this text an integer" has
  exactly one correct test and it is `int()`. Mixing is right; why `isdigit()` is not that
  test is [05i](05i-the-check-is-the-rule.md).
- **The invalid rows do not stop the valid ones being parsed**, which is what makes the
  two-phase write below possible.

## Then decide what to do with a partly-valid file

Collecting the errors is half the design; the other half is transactional policy, and it
must be a decision rather than an accident.

```python
def import_file(conn, rows: list[dict[str, str]], *, all_or_nothing: bool) -> list[RowError]:
    contacts, problems = import_contacts(rows)
    if problems and all_or_nothing:
        return problems                       # nothing written: the user fixes and retries
    with conn:                                # one transaction for everything we accept
        conn.executemany(
            "INSERT INTO contacts (email, age, country) VALUES (?, ?, ?)",
            [(c.email, c.age, c.country) for c in contacts],
        )
    return problems
```

Validating **all** rows before writing **any** is what makes both policies available. The
streaming alternative — validate and write each row as you go — cannot offer all-or-nothing
without holding a transaction open across the whole file, and it produces the worst
possible failure mode: a partially imported file plus an error list that only covers the
rows reached before the first fatal one.

## The same shape in a form

A web form is a batch import with one row. The identical structure, and the reason
`field` is a machine-readable key rather than a sentence:

```python
def validate_signup(payload: dict[str, object]) -> dict[str, str]:
    """Field name -> message. Empty dict means valid."""
    errors: dict[str, str] = {}

    email = payload.get("email")
    if not isinstance(email, str) or "@" not in email:
        errors["email"] = "Enter a valid email address."

    password = payload.get("password")
    if not isinstance(password, str) or len(password) < 12:
        errors["password"] = "Use at least 12 characters."

    accepted = payload.get("accepted_terms")
    if accepted is not True:
        errors["accepted_terms"] = "You must accept the terms."

    return errors
```

The keys map onto the form's inputs, so the client renders each message beside the field it
belongs to. An exception cannot do that without carrying the same dictionary inside it —
which is a legitimate design, and one [05i](05i-the-check-is-the-rule.md) writes out in
full.

The failures this collects are all decidable from the row itself. What the report should
*contain* — a domain error with domain fields, rather than a built-in exception's message —
and who consumes it are [05i](05i-the-check-is-the-rule.md).

## Gotchas

**★ Symptom: users report that fixing the error the form shows just reveals the next one.**
Cause: the validator returns or raises on the first failure, so the response describes one
problem out of five. Fix: collect into a `dict` keyed by field and return them all —
`validate_signup` above; the early `return` is the bug, not the `if`.

**★ Symptom: an import writes 3,999 rows and dies on row 4,000, leaving the file half
applied.** Cause: validation and writing interleaved, with no transaction spanning them.
Fix: two phases — validate everything into `(contacts, problems)`, then write the accepted
rows in one transaction, as `import_file` does.

**★ Symptom: the error report says "row 11" and the user is looking at row 12.** Cause:
`enumerate(rows)` counts from zero and the header line was consumed before the loop. Fix:
`enumerate(rows, start=2)` and say in the message which numbering you mean.

```python
for row_number, row in enumerate(rows, start=2):   # 1 = header, so data starts at 2
    ...
```

**Symptom: the collected error list is empty and the import failed anyway.** Cause: the
loop's `except` names one type and something else escaped — an `IntegrityError` at flush, a
`KeyError` from a column the header lacked. Fix: catch exactly the types your per-row
validation can produce, let the rest propagate as the bugs or infrastructure failures they
are, and report those separately from row errors.

```python
try:
    contact, errors = parse_row(row_number, row)
except (KeyError, TypeError) as exc:               # a malformed file, not a bad row
    raise MalformedImportFile(f"row {row_number}: {exc}") from exc
```

**Symptom: two different messages for the same rule, one in the form and one in the
importer.** Cause: the rule was written twice because the two call sites collect
differently. Fix: put the rule in one function that returns an optional message, and let
each caller decide how to collect it.

```python
def country_error(value: str) -> str | None:
    if value.upper() not in VALID_COUNTRIES:
        return f"unknown country code: {value!r}"
    return None
```

**Symptom: the report is complete but unusable — three thousand lines, all the same
message.** Cause: no aggregation *of the aggregation*; one malformed header produced one
error per row. Fix: detect file-level problems before the row loop and fail those
separately, and cap or group per-message counts in the report.

```python
missing = {"email", "age", "country"} - set(rows[0]) if rows else set()
if missing:
    raise MalformedImportFile(f"missing columns: {', '.join(sorted(missing))}")
```

**Symptom: a validator collects errors and the caller ignores the returned list.** Cause: a
function that *returns* problems has no way to insist they are looked at, unlike a raise.
Fix: make the successful value and the errors mutually exclusive in the type — return
`Contact | None` alongside the list, so the caller cannot get a usable object without
having handled the failure branch.

## Interview questions

**★ Why can a batch importer not simply use EAFP and let the exception propagate?**
Because propagation is the whole problem: the first bad row ends the loop, so the user
learns about one of their eleven mistakes. To report all of them the exception must be
prevented from unwinding — a `try` inside the loop appending to a list — which is the
collecting pattern with extra steps. Conditions have the property you need natively: an `if`
evaluates to a value you can append, and the loop keeps running. That is the case for LBYL
that no race objection touches, because every check runs against a local row that nothing
else can mutate.

**Should a batch importer validate everything before writing anything, or write as it
goes?**
Validate everything first, unless the file is too large to hold. Two-phase gives you the
complete report *and* a real choice of transactional policy: reject the whole file, or write
the valid rows in one transaction and return the problems. Streaming forfeits both — the
report covers only the rows reached before the first fatal error, and "all-or-nothing" would
require holding a transaction open for the length of the file. If the data genuinely does
not fit, the shape that survives is to validate in a first pass, keep only the errors and
the accepted row identifiers, and write in a second.

**Where does the aggregation argument stop applying?**
The moment the checks stop being about locals. Aggregating "does this username already
exist" across a hundred rows produces a hundred pre-checks whose answers are stale before
the transaction opens — the duplicate can appear between the check and the insert, which is
[databases, queues, and when LBYL clears](02c-databases-queues-and-when-lbyl-clears.md).
The workable split is to aggregate everything decidable from the row itself, then perform
the writes and translate constraint violations into the same `RowError` type, so the report
has one shape even though it came from two mechanisms.

**Why is `enumerate(rows, start=2)` more than a cosmetic detail?**
Because the report is the product, and a report whose line numbers are off by one is worse
than no report — the user edits the wrong row, re-uploads, and gets the same complaint about
a line that now looks fine to them. The header consumes line 1 of the file, so data starts at
2, and the number in your message has to be the number in their spreadsheet rather than the
index in your list. The same reasoning governs quoting the offending value with `!r` and
naming the column: everything in a `RowError` exists so somebody can find the cell without
guessing.

---

← Prev: [Closing the gap with a lock](05g-closing-the-gap-with-a-lock.md) · Index: [EAFP vs LBYL](README.md) · Next → [The check is the rule](05i-the-check-is-the-rule.md)
