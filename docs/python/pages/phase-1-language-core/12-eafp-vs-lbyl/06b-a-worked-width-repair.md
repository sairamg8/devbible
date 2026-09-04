---
title: "One eleven-line function failing on all three width axes at once answers six distinct situations — three of them bugs — with the same plausible default, and the repair is four separate decisions rather than one narrower handler"
sidebar_label: "06b · A worked width repair"
sidebar_position: 142
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against
> [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/),
> the Python 3.14 [`json`](https://docs.python.org/3.14/library/json.html) reference
> (`JSONDecodeError` and its `ValueError` base — cited, not re-quoted; see the
> note under "The six situations"),
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict)
> (`get`), and the [Glossary](https://docs.python.org/3.14/glossary.html).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**The rule from [06](06-narrowing-the-try.md) is easy to agree with and hard to apply,
because real wide handlers do not look wide. This chunk takes one ordinary eleven-line
function — three statements, one `except`, a sensible-looking default — and enumerates
every situation its handler answers. There are six, three of them are bugs in code the
function called, and the caller sees the same string for all six. The repair is not
"narrow the handler": it is **four separate decisions**, two of which turn out to want an
`if` rather than a `try`. That is the shape of every real width repair, and it is why
narrowing raises your visible error rate before it lowers your incident count.**

## All three axes failing at once

This is the shape it actually arrives in — nobody writes it deliberately, it accretes.

```python
# 🔴 Three statements, three exception types, two of the types broad.
def user_timezone(user_id: str) -> str:
    try:
        row = db.fetch_user(user_id)
        prefs = json.loads(row["preferences"])
        return normalise_tz(prefs["timezone"])
    except (KeyError, ValueError, TypeError):
        return "UTC"
```

Try the sentence test. *"This handler exists because fetching a user, or decoding its
preferences column, or looking up a key in the result, or normalising a timezone name
may fail with a key error, or a value error, or a type error…"* — the sentence cannot be
finished, which **is** the finding.

## The six situations, and what each one deserves

| # | What happened | Raises | What `"UTC"` costs you |
|---|---|---|---|
| 1 | the user does not exist; `fetch_user` raises from its own lookup | `KeyError` | a caller asking about a deleted user gets a timezone |
| 2 | the `preferences` column is SQL `NULL` | `TypeError` | a migration gap looks like a preference |
| 3 | the column holds invalid JSON | `json.JSONDecodeError` | corrupt data never gets reported |
| 4 | the JSON decoded to a **list**, so `prefs["timezone"]` is a list subscript with a `str` | `TypeError` | a producer writing the wrong shape is never caught |
| 5 | there is genuinely no `timezone` key | `KeyError` | 🟢 the one case the default is *for* |
| 6 | `normalise_tz` got a valid name and has a bug | `ValueError` | a code defect ships silently, forever |

Row 3 is worth pausing on: the `json` reference documents `JSONDecodeError` as a
subclass of `ValueError`, so `except ValueError` catches it whether or not the author
knew that class existed. (⚠️ That relationship is documented; the exact wording of the
sentence is not re-quoted here because this chunk's research bank does not carry it.
Check `json.JSONDecodeError.__mro__` if you want it settled locally.)

Rows 1, 4 and 6 are **bugs** — in the caller, in the producer, and in `normalise_tz`
respectively — and all three are being converted into a successful return value. Only
row 5 is a situation a default answers.

One handler, six situations, one answer. The wide `except` is not "cautious"; it is a
claim that all six deserve the same response, and nobody would sign that claim if it were
written out.

## The repair, one assumption at a time

```python
def user_timezone(user_id: str) -> str:
    # Not an assumption this function makes — a missing user is the caller's problem.
    row = db.fetch_user(user_id)

    raw_prefs = row["preferences"]          # a NULL column is a schema question, not a
    if raw_prefs is None:                   # timezone question. Answer it explicitly.
        return "UTC"

    try:
        prefs = json.loads(raw_prefs)       # the assumption: this column holds valid JSON
    except json.JSONDecodeError:
        log.warning("unparseable preferences for user %s", user_id)
        return "UTC"

    if not isinstance(prefs, dict):         # the column's shape is a contract, not a guess
        log.warning("preferences for user %s is not an object", user_id)
        return "UTC"

    return normalise_tz(prefs.get("timezone", "UTC"))
```

Map it back onto the table. Row 1 now propagates. Row 2 is an explicit `if` with an
unlogged early return, because a `NULL` column is a legitimate state of a
half-migrated table. Row 3 is the only `try`, narrowed to the one class that means
"invalid JSON", and it logs. Row 4 is an explicit shape check that logs. Row 5 is
`dict.get` with a default — no look, no apology, one operation, per
[03 · Mappings, the decision table](03-mappings-the-decision-table.md). Row 6
propagates, with `normalise_tz`'s own frame in the traceback.

**Two of the four decisions are `if` statements, and that is not a retreat.** Narrowing
is making each condition explicit with whichever construct states it without a gap. A
`NULL` column and a non-object payload are facts about a value already sitting in a local
variable — there is nothing shared, so nothing to race, and an exception could tell you
nothing the `if` cannot. The styles are tools for stating conditions, not the goal; that
is [01b · Why Python leans EAFP](01b-why-python-leans-eafp.md).

## Why the third `if` is not there

Notice what the repair does **not** do: it does not guard `normalise_tz`. The wide
version did, accidentally, and someone reviewing the diff will ask whether removing that
was safe.

It was not safe. It was *correct*. `normalise_tz("Europe/Lisbon")` raising `ValueError`
is a defect in `normalise_tz` — the input was valid — and the only useful outcome is a
traceback naming `normalise_tz`. If instead you decide that *unknown timezone strings*
are a real input case, that is a different assumption, and it gets its own narrow block:

```python
    raw_tz = prefs.get("timezone", "UTC")
    try:
        return normalise_tz(raw_tz)
    except UnknownTimezone:            # the library's own class, not ValueError
        log.warning("unknown timezone %r for user %s", raw_tz, user_id)
        return "UTC"
```

`except UnknownTimezone` and `except ValueError` are both one clause and one statement.
They differ only in **breadth**, and the difference is that the first still lets a bug in
`normalise_tz` escape. Which class to name is
[06c · The breadth of one class](06c-the-breadth-of-one-class.md).

## The propagation budget

The narrow version raises where the wide version returned. That is the deliverable, and
it is also the reason narrowing gets reverted, so plan for it:

1. **Expect the error rate to rise.** The failures were already happening; they were
   being converted into plausible values. The new alerts are a backlog becoming visible,
   not a regression.
2. **Narrow the handler, then look at what escapes, then decide.** Do not decide in
   advance — you do not yet know which of rows 1, 4 and 6 actually occur in your traffic.
3. **Keep only the handlers with a real recovery.** A handler whose body is "return the
   thing the caller would have got anyway" is not a recovery; it is a mask.
4. **Log at the narrow handler you kept.** One `log.warning` with the user id and the
   offending value is worth more than the entire wide handler was, because it names the
   row of the table. Topic 11's
   [12 · Logging exceptions](../11-exceptions/12-logging-exceptions.md) is the reference
   for the call to use.

## Gotchas

**★ Symptom: narrowing the handlers made the error rate jump, and someone wants to
revert.** Cause: nothing new is failing — the wide handler was converting real failures
into plausible defaults, and the new alerts are that backlog becoming visible. Fix: do
not revert, triage. Keep the one narrow handler that has a real recovery, let the rest
propagate, and fix what appears.

```python
try:
    prefs = json.loads(raw_prefs)     # keep: a corrupt column has a real fallback
except json.JSONDecodeError:
    log.warning("unparseable preferences for user %s", user_id)
    return "UTC"
# dropped: except TypeError / except KeyError — those were bugs, not fallbacks
```

**★ Symptom: `except ValueError` catches a JSON parse failure the author never
considered.** Cause: `json.JSONDecodeError` derives from `ValueError`, so any
`except ValueError` in the same suite as a `json.loads` silently owns decode errors too.
Fix: name the subclass; it is exported from `json`.

```python
try:
    payload = json.loads(body)
except json.JSONDecodeError as exc:      # not ValueError
    raise BadRequest(f"body is not JSON: {exc}") from exc
```

**★ Symptom: a `NULL` database column is reported to users as a default preference, and
the migration that should have backfilled it is never noticed.** Cause: `json.loads(None)`
raises `TypeError`, which the wide tuple absorbed, so a schema gap became a silent
default. Fix: check the column explicitly and, if a `NULL` is not supposed to exist, make
it loud.

```python
raw_prefs = row["preferences"]
if raw_prefs is None:
    log.warning("preferences NULL for user %s — backfill incomplete", user_id)
    return "UTC"
```

**★ Symptom: a producer starts writing a JSON array where an object was agreed, and
nothing complains for a quarter.** Cause: `prefs["timezone"]` on a `list` raises
`TypeError` — subscripting a list with a `str` — which is the same class the `NULL` case
raised, so one clause covered both. Fix: validate the decoded shape once, where it is
decoded, and log it.

```python
if not isinstance(prefs, dict):
    log.warning("preferences for user %s is not an object", user_id)
    return "UTC"
```

**Symptom: the repaired function now has four `return "UTC"` statements and review calls
it repetitive.** Cause: the wide version had one exit because it had one undifferentiated
failure; the narrow version has one exit per *decision*. Fix: keep the exits, and if the
duplication genuinely bothers you, name the value — not merge the branches, which would
undo the repair.

```python
DEFAULT_TZ = "UTC"      # four returns of a named constant, four distinct reasons
```

**Symptom: `except TypeError` was kept "for safety" and now hides a signature change.**
Cause: `TypeError` is what Python raises when you call something with the wrong arguments,
so keeping it in a handler means a refactor that changes a callee's signature is reported
as a data problem. Fix: delete it. If a `TypeError` is genuinely part of a contract,
that contract should be a custom exception —
[07 · Custom exceptions](../11-exceptions/07-custom-exceptions.md).

**Symptom: the narrow repair passes every test, and the wide original did too.** Cause:
the tests exercise row 5 — the one case a default is for — and none of rows 1 to 4 or 6,
because those are the situations nobody thought of. Fix: write the table first, then a
test per row; the rows you cannot construct a test for are the ones to let propagate.

## Interview questions

**★ You are shown a function with three statements in one `try` and a tuple of three
exception classes. How do you demonstrate the problem to the author?**
Enumerate what the handler answers, in a table, one row per situation. For the
`user_timezone` example there are six rows and only one of them is the case the default
was written for; three are bugs in other code being converted into a successful return
value. The table is more persuasive than the rule because it is specific — nobody defends
"a deleted user has a timezone" once it is written down as a row.

**★ Two of the four decisions in the repaired version are `if` statements. Is that a
failure of the EAFP argument?**
No, it is the argument applied. `raw_prefs is None` and `isinstance(prefs, dict)` are
facts about a value already sitting in a local variable — there is no shared state, so
there is no gap between the look and the leap, and nothing an exception could tell you
that the `if` cannot. Narrowing means making each condition explicit with whichever
construct states it without a gap; the two styles are tools for that, not the goal.

**★ Why does `json.JSONDecodeError` make `except ValueError` more dangerous than it
looks?**
Because the `json` reference documents it as a subclass of `ValueError`, so an
`except ValueError` written for an `int()` conversion silently also owns every decode
failure in the same suite — and the two have completely different recoveries. It is a
concrete instance of the general problem: exception hierarchies mean a clause's reach is
not visible at the clause. The fix is to name the leaf class the library exports.

**★ After narrowing, your service's error rate triples. What do you tell the person who
wants the change reverted?**
That nothing new is failing. Every one of those errors was occurring before and was being
converted into a plausible return value, so the previous graph was measuring the
handler's confidence rather than the system's health. Then do the work the graph is now
making possible: triage the new errors by row, keep the handlers that have a real
recovery, and fix the code the other rows are pointing at. Reverting restores the graph
and keeps the bugs.

**How do you decide, per situation, between letting it propagate, catching it, and
checking it with an `if`?**
Three questions. Is the state shared, so a check could go stale between the look and the
leap? If yes, catch — there is no safe `if`. If no, does the condition have a recovery
this function can actually perform? If no, propagate; a handler with no recovery is a
mask. If yes, use whichever construct states the condition most directly: an `if` for a
fact about a local value, a narrow `try` for a fact about an operation.

**Why does the repaired function not guard `normalise_tz` at all, when the original
did?**
Because the original guarded it by accident. A `ValueError` out of `normalise_tz` for a
valid input is a defect in `normalise_tz`, and the only useful outcome is a traceback
naming that function. If unknown timezone *strings* are a real input case, that is a
different assumption and gets its own block with the library's own exception class —
which is one clause and one statement, exactly like `except ValueError`, and differs only
in breadth.

**The repaired version is twice as long. What did the extra lines buy?**
A log line that names the user and the offending value, for two situations that
previously produced nothing. A traceback for three situations that previously produced a
default. And a function whose contract a reader can state without opening `fetch_user`,
`json.loads` or `normalise_tz` to find out what they raise. Length is the wrong axis; the
question is how many distinct situations the code can now tell apart, which went from one
to six.

---

← Prev: [Narrowing the try](06-narrowing-the-try.md) · Index: [EAFP vs LBYL](README.md) · Next → [The breadth of one class](06c-the-breadth-of-one-class.md)
