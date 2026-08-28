---
title: "The four places an f-string is the wrong tool — logging, SQL, user templates, and anything deferred"
sidebar_label: "3b · When not to use an f-string"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [`logging`](https://docs.python.org/3.14/library/logging.html) documentation
> and its [HOWTO](https://docs.python.org/3.14/howto/logging.html#optimization),
> [`string.Template`](https://docs.python.org/3.14/library/string.html#template-strings),
> [`str.format`](https://docs.python.org/3.14/library/stdtypes.html#str.format)
> and the [Format String Syntax](https://docs.python.org/3.14/library/string.html#format-string-syntax)
> grammar (attribute and index access inside a replacement field),
> [PEP 249](https://peps.python.org/pep-0249/) parameter styles, and
> [`html.escape`](https://docs.python.org/3.14/library/html.html#html.escape).
> Target: **CPython 3.14**.

**f-strings are the right answer often enough that the exceptions have to be
learned as a list, because the code reads fine in every one of them. An
f-string in a `logging` call costs you time you did not spend and structure you
cannot get back. An f-string in SQL, a shell command or HTML is an injection
hole with no safe variant. `str.format` on a template a user supplied hands
that user your module globals. And an f-string can never render a template that
arrives at runtime, because it was compiled before that template existed.**

## Where f-strings are the wrong tool

This is the part that matters in review.

### Logging

```python
logging.info(f"user {user_id} did {action}")     # WRONG
logging.info("user %s did %s", user_id, action)  # right
```

The f-string is evaluated **before** `logging` is called, so the interpolation
cost is paid even when the level is disabled and the record is dropped. The
`%s` form defers formatting until a handler actually needs the text. Worse, the
f-string destroys the *structured* record: with `%s` arguments, `record.args`
still holds `user_id` and `action` separately, which is what a JSON formatter
or an aggregator groups on. With an f-string every message is a unique string
and grouping is impossible.

### SQL

```python
cur.execute(f"SELECT * FROM users WHERE email = '{email}'")   # SQL injection
cur.execute("SELECT * FROM users WHERE email = %s", (email,)) # right
```

There is no version of this where the f-string is acceptable. Parameter binding
is not "escaping done for you" — the value never becomes part of the SQL text
at all. The same applies to shell commands (`subprocess` with a list, never a
string), to HTML (`html.escape`, or a template engine with autoescaping) and to
LDAP, XPath and every other language you might embed. Python 3.14's
[t-strings](04-t-strings.md) exist precisely to give these cases a safe
interpolation syntax.

### Anything stored outside the source

An f-string is compiled at the point it is written, so it cannot come from a
database, a config file or a translation catalogue:

```python
template = load_from_db()            # "Hello {name}"
f"{template}"                        # just prints the braces literally
template.format(name=name)           # str.format IS the deferred version
```

`str.format` and `string.Template` are the tools for a template that arrives at
runtime. `string.Template` with `safe_substitute` is the safest of the three
for a template an end user can edit, because it supports only `$name`
substitution and cannot evaluate arbitrary attribute access.

🔴 **Never call `.format()` on a string a user supplied.** Format strings can
reach attributes: `"{0.__class__}".format(obj)` is legal, and from there a
determined attacker walks the object graph to globals and secrets. If the
template is untrusted, use `string.Template`.

## `%`-formatting, `str.format`, f-string, t-string — which one

| Form | Use it when |
|---|---|
| `f"..."` | Almost always. The template is in the source and the values are here. |
| `"...".format(...)` | The template arrives at runtime from a trusted source. |
| `"%s" % ...` | Passing a deferred template to `logging`. Legacy code. |
| `string.Template` | The template is user-editable and must not evaluate anything. |
| `t"..."` (3.14) | The result is embedded in another language — HTML, SQL, shell. |

## Gotchas

### f-string in a `logging` call
**Symptom.** Debug logging costs measurable time in production with `DEBUG`
disabled; log aggregation cannot group messages because every one is unique.
**Cause.** The f-string is evaluated eagerly at the call site, before `logging`
decides whether the record is wanted, and it collapses the arguments into one
opaque string so `record.args` is empty.
**Fix.**
```python
logging.info("user %s did %s", user_id, action)
```

### f-string in SQL, shell or HTML
**Symptom.** An apostrophe in a surname breaks a query — and the same hole lets
`'; DROP TABLE users; --` through.
**Cause.** The value is concatenated into the program text of another language,
where its characters are syntax.
**Fix.** Bind parameters; never interpolate.
```python
cur.execute("SELECT * FROM users WHERE email = %s", (email,))
subprocess.run(["git", "checkout", branch])    # list form, no shell
html.escape(user_comment)
```

### Calling `.format()` on a user-supplied template
**Symptom.** A "customisable email template" feature turns into an information
leak.
**Cause.** The format mini-language supports attribute access and indexing, so
`{0.__class__.__init__.__globals__}` is reachable from any argument passed in.
**Fix.**
```python
from string import Template
Template(user_template).safe_substitute(name=name, total=total)
```

### Expecting an f-string to defer
**Symptom.** A template loaded from the database renders as literal braces.
**Cause.** `f"{template}"` interpolates the *variable* `template`; the braces
inside its value were never seen by the compiler.
**Fix.** `template.format(**values)` — `str.format` is the deferred form.

## Interview questions

**Q: Why must you not use an f-string in a `logging` call?**
Two reasons. The interpolation happens eagerly, so you pay for messages that
are never emitted; and the arguments are collapsed into one string, so
`record.args` is empty and structured handlers and aggregators lose the ability
to group by message template. Use `logging.info("... %s ...", value)`.

**Q: How do you render a template that is stored in the database?**
`str.format` or `string.Template`. An f-string is compiled where it is written,
so it can never interpolate braces that arrive at runtime. If the template is
user-editable, use `string.Template.safe_substitute` — `str.format` on
untrusted input allows attribute traversal.

**Q: Show the attack on `.format()` with a user-supplied template.**
`"{0.__class__.__init__.__globals__}".format(some_object)` reaches module
globals through ordinary format syntax, and from there configuration and
secrets. Nothing in `str.format` restricts attribute access.

**Q: When would you still reach for `%`-formatting in new code?**
Passing a deferred template plus arguments to `logging`, which is built on it.
That is essentially the only case.

---

← Prev: [f-strings](03-f-strings.md) · Index: [Strings](README.md) · Next → [The format spec mini-language](03c-the-format-spec-mini-language.md)
