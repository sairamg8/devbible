---
title: "A warning is for the caller's next release, not for this call — which is why four categories are ignored by default and your deprecation reaches nobody"
sidebar_label: "11b · Warnings"
sidebar_position: 133
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`warnings`](https://docs.python.org/3.14/library/warnings.html)
> (`warn`, `stacklevel`, `simplefilter`, `filterwarnings`, `catch_warnings`,
> the default-ignored categories, `sys.flags.context_aware_warnings`),
> [`logging.captureWarnings`](https://docs.python.org/3.14/library/logging.html#logging.captureWarnings),
> and the [command line reference](https://docs.python.org/3.14/using/cmdline.html#cmdoption-W)
> (`-W`, `PYTHONWARNINGS`).
> Target: **CPython 3.14**.

[The previous chunk](11-suppress-and-the-explicit-ignore.md) covered the case
where nothing needs to happen. A warning is the case where something needs to
happen **later, in the caller's code** — and the machinery is built around that,
which is why so much of it is filtering rather than reporting.

## Warnings are for the caller's future, not this call

> Warning messages are typically issued in situations where it is useful to
> alert the user of some condition in a program, where that condition (normally)
> doesn't warrant raising an exception and terminating the program.

The call worked. Something about how it was called should change. That is the
whole niche, and it is why a warning is a poor substitute for either an
exception (the caller needed to stop) or a log line (nobody is going to change
the code).

```python
def connect(dsn, *, timeout=None, timeout_ms=None):
    if timeout_ms is not None:
        warnings.warn(
            "timeout_ms is deprecated; use timeout (seconds)",
            DeprecationWarning,
            stacklevel=2,
        )
        timeout = timeout_ms / 1000
    ...
```

## The two things everyone gets wrong

**1 — `stacklevel`.** The default (`1`) points the warning at your own `warn`
call, which tells the caller nothing. The docs' own example:

```python
def deprecated_api(message):
    warnings.warn(message, DeprecationWarning, stacklevel=2)
```

> This makes the warning refer to `deprecated_api`'s caller, rather than to the
> source of `deprecated_api` itself.

A warning without `stacklevel=2` cites a file the caller cannot edit. If you
wrap `warn` in your own helper, add one level per wrapper.

**2 — Four categories are ignored by default**, so most warnings reach nobody:

| Category | Default |
|---|---|
| `DeprecationWarning` | ignored — *"unless triggered by code in `__main__`"* |
| `PendingDeprecationWarning` | ignored |
| `ImportWarning` | ignored |
| `ResourceWarning` | ignored |
| `UserWarning`, `RuntimeWarning`, `SyntaxWarning`, … | shown |

That table explains the whole life cycle of a library deprecation: you add a
`DeprecationWarning`, nobody sees it, you remove the parameter a year later, and
every downstream service breaks at once. `DeprecationWarning` is aimed at
*developers*, which is why it only shows in `__main__` by default; if the
message is for the person running the program, `UserWarning` is the honest
category.

## Turning warnings into failures, from outside the code

The filter actions are `error`, `default`, `ignore`, `always` and `once`, and
`error` is the one that matters in CI:

```python
warnings.filterwarnings("error", category=ResourceWarning)
```

The same thing without touching the code, which is how you should do it in a
test job:

```bash
python -W error::DeprecationWarning -m pytest
```

`-W` and the `PYTHONWARNINGS` environment variable take the same specification.
A test suite run with `-W error` turns every upstream deprecation into a red
build the day it appears rather than the day it is removed — the cheapest
upgrade insurance available.

## `catch_warnings`, and why it is not a general tool

```python
with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    fxn()
    assert len(w) == 1
    assert issubclass(w[-1].category, DeprecationWarning)
```

That is a test helper, and the docs say why it should stay one: whether it is
safe depends on `sys.flags.context_aware_warnings`, and *if that flag is false,
the context manager modifies global attributes, which is not thread-safe*. The
flag *"defaults to true for free-threaded builds and false otherwise"*, so on a
standard build in a threaded service, `catch_warnings` in request-handling code
can silence or unsilence warnings for every other thread.

## Getting warnings into the log

`logging.captureWarnings()` routes warnings through the logging
infrastructure — which is what you want in a service, where nothing reads
stderr:

```python
logging.captureWarnings(True)      # warnings -> the 'py.warnings' logger
```

Otherwise a `ResourceWarning` about an unclosed socket goes to stderr, is
ignored by default anyway, and never reaches the aggregator. Exceptions belong in
the log for the same reason, by a different route —
[Logging exceptions](12-logging-exceptions.md).
## Gotchas

**★ Symptom — a `DeprecationWarning` you added is invisible to every user of
your library.** Cause: it is ignored by default outside `__main__`. Fix: keep
`DeprecationWarning` for the developer-facing message *and* document the
removal; if end users must see it, use `UserWarning`; and tell downstreams to
run their tests with `-W error::DeprecationWarning`.

**★ Symptom — a warning's file and line point inside the library that emitted
it.** Cause: default `stacklevel=1`. Fix: `stacklevel=2` from the public
function, plus one more level for each internal wrapper between it and `warn`.

**★ Symptom — the same warning appears once and then never again, and a later
occurrence in a different code path is missed.** Cause: the `default` action
prints the first occurrence *per location*, and `once` prints the first
occurrence overall. Fix: `always` while debugging, `error` in CI; do not draw
conclusions about frequency from a filtered stream.

**★ Symptom — warnings behave differently in a test run than in production, so
a warning-driven bug cannot be reproduced.** Cause: pytest installs its own
warning filters, and `-W`/`PYTHONWARNINGS` may be set in one environment only.
Fix: make the filter explicit where it matters rather than relying on the
default configuration of either environment.

**★ Symptom — warnings vanish, or appear where they should not, in a threaded
service.** Cause: `catch_warnings` mutating global filter state — documented as
not thread-safe when `sys.flags.context_aware_warnings` is false, which is the
default on a standard build. Fix: keep `catch_warnings` in tests; configure
filters once at startup.

**★ Symptom — a `ResourceWarning` about an unclosed file or socket never
appears anywhere.** Cause: ignored by default, and emitted to stderr even when
enabled. Fix: `python -W default::ResourceWarning` in development, and
`logging.captureWarnings(True)` so it reaches the log in production.

**★ Symptom — a library warns on every call in a hot loop and the log fills
up.** Cause: a warning where a one-time notice or an exception was appropriate.
Fix: warn once at configuration time — or raise, if continuing produces a wrong
answer.
**★ Symptom — a deprecation is removed on schedule and downstream services
break anyway, having had a year's notice.** Cause: the notice existed only as an
ignored-by-default warning; nothing in their CI turned it into a signal. Fix:
warn *and* document the removal version, and publish the one-line remedy their
CI needs.

```bash
python -W error::DeprecationWarning -m pytest
```

## Interview questions

**★ Q: When do you warn instead of raising?**
When the call succeeded and the caller should change something before some future
version — a deprecated parameter, a fallback that will be removed, a config that
still works. If the result is wrong or unusable, raise; a warning that the caller
must act on immediately is a bug, because warnings are filterable and four
categories are ignored by default.

**★ Q: Why does nobody see your `DeprecationWarning`?**
Because it is ignored by default unless it is triggered by code in `__main__` —
it is aimed at developers, not at end users. That is why deprecations need a
documented removal plan, and why downstream projects should run their tests with
`-W error::DeprecationWarning` to catch them at the moment they appear.

**Q: What does `stacklevel=2` do?**
It attributes the warning to your caller instead of to the line inside your
library that called `warn`. Without it, the file and line in the warning point
at code the caller cannot change, which makes the warning unactionable. Add one
level for every wrapper between the public function and the `warn` call.

**Q: How do you make warnings fail a build?**
`-W error` on the command line, `PYTHONWARNINGS=error` in the environment, or
`warnings.filterwarnings("error", category=...)` in code. Scoping it to a
category — `-W error::DeprecationWarning` — is usually right, since turning
every warning into an exception makes third-party noise fail your build.

**Q: Is `warnings.catch_warnings` safe in production code?**
No. The docs say that when `sys.flags.context_aware_warnings` is false — the
default on a standard build — it modifies global attributes and is not
thread-safe, so it can change the warning behaviour of other threads. It is a
testing tool.

**Q: A `ResourceWarning` says a socket was never closed. What is the fix?**
Not the warning filter — the socket. `ResourceWarning` is the signal that a
cleanup path is missing, so the fix is a `with` block or an explicit `close` in
a `finally`; see [context managers as cleanup](03d-context-managers-as-cleanup.md).
Enable it in development (`-W default::ResourceWarning`) precisely so it is not
discovered in production.

---**Q: Which category should a library use for a message aimed at the person
running the program rather than the developer?**
`UserWarning`, which is shown by default. `DeprecationWarning` is
developer-facing and ignored outside `__main__`, so using it for an operational
message means nobody reads it. Choosing the category *is* choosing the audience.

---

← Prev: [`suppress` and the explicit ignore](11-suppress-and-the-explicit-ignore.md) · Index: [Exceptions](README.md) · Next → [Logging exceptions](12-logging-exceptions.md)
