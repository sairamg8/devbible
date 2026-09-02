---
title: "Tri-states and the API boundary: absent, null and empty are three different instructions"
sidebar_label: "2c · Tri-states and the API boundary"
sidebar_position: 55
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against
> [RFC 7386 — JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7386),
> [RFC 6902 — JSON Patch](https://www.rfc-editor.org/rfc/rfc6902),
> the Python 3.14 Library Reference
> [`json`](https://docs.python.org/3.14/library/json.html)
> and [`typing.Optional`](https://docs.python.org/3.14/library/typing.html#typing.Optional).
> Target: **CPython 3.14**.

**Two of the five places the gap opens are not really about Python at all —
they are about a three-valued model somewhere else leaking into two-valued
Python code. A nullable database column is three-valued. A JSON payload is
three-valued: a field can be absent, present as `null`, or present and empty.
Both models are more expressive than `if x:` and both are silently flattened by
it, which is how you ship an endpoint where users cannot clear a field and a
consent prompt that never appears.**

## 4. A tri-state that got flattened into a bool

Consent, feature flags, moderation decisions and survey answers are frequently
three-valued: yes, no, and *not answered yet*. `None` is the natural third
state, and truthiness collapses it into "no":

```python
if user.accepted_terms:      # None (never asked) and False (declined) both here
    ...
```

The two need different handling — one is a prompt, the other is a rejection —
so test explicitly, most-specific first:

```python
if user.accepted_terms is None:
    return prompt_for_consent()
if not user.accepted_terms:
    return show_declined_notice()
return proceed()
```

Annotate it: `accepted_terms: bool | None`. A checker will then refuse
`if user.accepted_terms:` in code paths that claimed to handle all three, and
the annotation is documentation that survives refactoring.

### The SQL connection, which is the real source

This is the same shape as SQL's three-valued logic, where `NULL` is neither true
nor false. The consequences are concrete:

```sql
SELECT * FROM users WHERE accepted_terms = FALSE;   -- does NOT match NULL rows
SELECT * FROM users WHERE accepted_terms IS NULL;   -- the other two-thirds
SELECT * FROM users WHERE accepted_terms IS NOT TRUE; -- FALSE *and* NULL
```

**If your column is nullable, your Python has three states whether you modelled
them or not** — and the database is the one being careful. The mismatch is
usually discovered as a reporting discrepancy: a count of "declined" from the
application disagrees with a count from the database, because the application
counted `NULL` as declined and SQL did not.

The clean fixes are the obvious ones and worth stating: make the column `NOT
NULL` with an explicit default when there really are only two states, or keep it
nullable and handle three states everywhere. What does not work is a nullable
column and two-valued code.

### When three states become four

Once you have "unknown", check whether you also have "not applicable". A
moderation flag on a post might be approved, rejected, pending, *or* not
required (the post is from a trusted author). Four states in `bool | None` do
not fit, and the usual outcome is a second boolean that must be kept consistent
with the first. An `enum` is the honest model:

```python
from enum import Enum

class Moderation(Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    PENDING = "pending"
    NOT_REQUIRED = "not_required"
```

Every member of an `Enum` is truthy by default — including one named `NONE` or
`ZERO` — which is a feature here: `if post.moderation:` cannot accidentally mean
anything, so readers are forced to compare against a member.

## 5. The API boundary: absent, null, and empty are three things

Over HTTP and JSON, a field can be **absent from the payload**, **present as
`null`**, or **present as an empty value** — and for a `PATCH` endpoint all
three mean something different:

| Payload | Meaning for PATCH |
|---|---|
| `{}` — key absent | Leave the field alone |
| `{"bio": null}` | Clear the field |
| `{"bio": ""}` | Set it to the empty string |

A handler written as `if payload.get("bio"):` treats all three as "leave it
alone", so users can never clear their bio and the bug report reads "the save
button does nothing".

That distinction is exactly what
[JSON Merge Patch (RFC 7386)](https://www.rfc-editor.org/rfc/rfc7386)
formalises: `null` means delete the member, absent means leave it. The RFC is
worth reading once for this alone — it also states the consequence, that merge
patch **cannot set a member to null**, since `null` is spent on "delete". That
limitation is why APIs that genuinely need to store a null reach for
[JSON Patch (RFC 6902)](https://www.rfc-editor.org/rfc/rfc6902) instead, whose
explicit `{"op": "replace", "path": "/bio", "value": null}` says which of the
two it means.

### Handling it in Python

Three approaches, in increasing order of how much the library does for you:

```python
# 1. ask the raw payload — works with plain json.loads()
if "bio" in payload:
    user.bio = payload["bio"]        # may be None, meaning clear

# 2. a sentinel default, when you have already parsed into a function call
_UNSET = object()
def update(user, bio=_UNSET):
    if bio is not _UNSET:
        user.bio = bio

# 3. a model that records what the client actually sent
changes = payload_model.model_dump(exclude_unset=True)   # pydantic
for field, value in changes.items():
    setattr(user, field, value)                          # value may be None
```

Pydantic's `model_fields_set` and `model_dump(exclude_unset=True)` exist for
precisely this reason: after validation, the information about *which keys were
in the JSON* is otherwise lost, because every unset field has been filled in
with its default.

:::caution
Do not try to recover this distinction after the fact by comparing the parsed
object against a freshly-constructed default. A field the client explicitly set
to the default value is indistinguishable from one it omitted, and you have
recreated the original bug one layer down.
:::

### The same three-way split elsewhere

- **Query strings.** `?tags=` (present and empty) and no `tags` at all (absent)
  are different requests. Most frameworks expose both — a `get` that returns
  `None` for absent and `""` for empty, or a multi-dict whose `in` you can test.
  `urllib.parse.parse_qs` **drops** empty values by default; pass
  `keep_blank_values=True` to keep them, which is exactly this distinction as a
  keyword argument.
- **Environment variables.** Unset (`"VAR" not in os.environ`) and set-to-empty
  (`VAR=`) are different, and `os.environ.get("VAR", default)` returns `""` for
  the second, not the default. If empty means "explicitly disabled", you must
  test membership.
- **Form submissions.** An unchecked checkbox is absent from the form body
  entirely; a cleared text input is present and empty. A handler that reads both
  through `.get(name, "")` sees them identically.
- **CSV and spreadsheets.** An empty cell and a missing column are different
  failures, and `csv.DictReader` gives `""` for the first and `None` (via
  `restval`) for the second — a distinction worth preserving into your parsing
  errors.

## Gotchas

**Symptom — a user cannot clear a text field; the save silently does nothing.**
Cause: the PATCH handler uses `if payload.get("bio"):`, so `""` and `null` are
indistinguishable from an absent key. Fix: use `"bio" in payload`, a sentinel
default, or `model_dump(exclude_unset=True)`. Absent, `null` and `""` are three
distinct instructions.

**Symptom — a consent prompt never appears for users who have not answered.**
Cause: `if user.accepted_terms:` collapses `None` (not asked) into the same
branch as `False` (declined). Fix: test `is None` first. Any nullable boolean
column is a tri-state in Python whether or not you modelled it as one.

**Symptom — a feature flag that was explicitly turned off behaves like one that
was never configured.** Cause: `if settings.get("dark_mode"):` puts `False` and
absent in the same branch. Fix: fetch with a sentinel and branch on three
states, or store the tri-state explicitly and annotate it `bool | None`.

**Symptom — the application's count of "declined" users does not match the
database's.** Cause: the application counted `NULL` as declined via truthiness;
SQL's `= FALSE` does not match `NULL`. Fix: decide which is right and make both
sides agree — usually by making the column `NOT NULL` with a default, or by
counting `IS NOT TRUE` when `NULL` really should be grouped with false.

**Symptom — `?tags=` and no `tags` parameter behave identically, and one of your
users wants "clear all tags".** Cause: the handler reads
`request.args.get("tags", "")` and truth-tests it, and `parse_qs` drops blank
values by default. Fix: check presence separately, and pass
`keep_blank_values=True` if you are parsing the query string yourself.

**Symptom — `VAR=` in the environment behaves like `VAR` being unset.** Cause:
`os.environ.get("VAR", "default")` returns `""` for a set-but-empty variable,
and `""` is falsy, so a truthiness test falls through to the default. Fix:
`"VAR" in os.environ` when set-to-empty is meaningful — it commonly means
"explicitly disabled".

**Symptom — an unchecked checkbox and a cleared field are handled by the same
branch and one of them is wrong.** Cause: an unchecked checkbox is *absent* from
the form body; a cleared input is present and empty. `.get(name, "")` erases the
difference. Fix: test membership in the form data for the checkbox and value for
the text field — they are different questions with different HTML semantics.

**Symptom — a PATCH implemented as merge patch cannot store an explicit null.**
Cause: RFC 7386 spends `null` on "delete this member", so there is no way to say
"set it to null". Fix: this is a documented limitation of the format, not a bug
in your code — use JSON Patch (RFC 6902) or a bespoke envelope if storing null
is genuinely required.

**Symptom — you recovered "which fields were set" by diffing against a default
instance, and a client that explicitly sent the default value gets ignored.**
Cause: an explicitly-supplied default is identical to an omitted field once
validation has filled the gaps. Fix: capture the set of keys at parse time —
`model_fields_set`, or the raw payload's keys — before defaults are applied.

**Symptom — an `Enum` member you named `NONE` is truthy and a branch treats it
as present.** Cause: enum members are objects and truthy by default regardless
of name or value. Fix: this is usually what you want — compare against the
member explicitly (`if state is Moderation.NOT_REQUIRED:`) rather than
truth-testing the enum at all.

## Interview questions

**★ Q: A PATCH endpoint must support clearing a field. How do you model it?**
Three states: key absent means "leave alone", `null` means "clear", and an empty
value means "set to empty". Truthiness collapses all three. Use `in` on the raw
payload, a sentinel default, or a validation library that records which fields
were set (`model_fields_set` / `exclude_unset=True` in pydantic). RFC 7386's
JSON Merge Patch is that distinction written down as a standard — and it states
its own limitation, that merge patch cannot set a member *to* null.

**★ Q: How does SQL's `NULL` relate to Python truthiness?**
Directly. A nullable column is a three-valued field, and `WHERE flag = FALSE`
does not match `NULL` rows — SQL refuses to collapse "unknown" into "false".
Python's truthiness *does* collapse it, so the model your database enforces and
the model your `if` statement implies disagree unless you test `is None`
explicitly. The mismatch usually surfaces as two counts of the same thing that
do not agree.

**Q: Is `VAR=` the same as `VAR` being unset?**
No. `"VAR" in os.environ` is `True` for the first and `False` for the second,
while `os.environ.get("VAR", "default")` returns `""` for the first — which is
falsy, so a truthiness test treats them identically. Set-to-empty very often
means "explicitly disabled" and deserves its own branch.

**Q: Why can't you recover "which fields the client sent" after validation?**
Because validation fills every unset field with its default, so an omitted field
and a field explicitly set to the default value become identical. The
information has to be captured at parse time — the raw payload's keys, or
`model_fields_set` — which is exactly why validation libraries expose it.

**Q: What is the difference between JSON Merge Patch and JSON Patch here?**
Merge Patch (RFC 7386) uses the document's own shape and spends `null` on
"delete this member", so it cannot express "set this to null". JSON Patch (RFC
6902) uses explicit operations — `{"op": "replace", "path": "/bio", "value":
null}` — so it can. The choice is exactly about whether your domain needs to
store a null.

**Q: When should a tri-state become an enum instead of `bool | None`?**
As soon as there is a fourth state, or as soon as the third state has a name
that is not "unknown". `bool | None` works while the states are yes/no/unasked;
the moment you add "not applicable" or "expired", two booleans start needing to
be kept consistent and an `Enum` is the honest model. Enum members are truthy,
which usefully forces callers to compare against a member rather than
truth-test.

**Q: `parse_qs` dropped my empty parameter. Why?**
Because `keep_blank_values` defaults to `False`, so `?tags=` is discarded rather
than reported as an empty value. That default is itself a decision about this
topic — pass `keep_blank_values=True` when present-and-empty is meaningful in
your API.

---

← Prev: [Where the gap opens](02b-where-the-gap-opens.md) · Index: [Truthiness](README.md) · Next → [`and` and `or` return operands](03-and-or-return-operands.md)
