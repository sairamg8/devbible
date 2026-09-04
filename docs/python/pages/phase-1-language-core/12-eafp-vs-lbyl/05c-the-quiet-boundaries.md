---
title: "The boundary that gets missed is never the HTTP handler: an environment variable, a client's declared Content-Length and a JSON column written by last quarter's schema are all foreign input arriving with no invariants attached"
sidebar_label: "05c · The quiet boundaries"
sidebar_position: 133
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`os.environ`](https://docs.python.org/3.14/library/os.html#os.environ),
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict)
> (`get` — *"never raises a `KeyError`"*),
> [`Path.unlink(missing_ok=True)`](https://docs.python.org/3.14/library/pathlib.html#pathlib.Path.unlink)
> and [`Path.replace`](https://docs.python.org/3.14/library/pathlib.html#pathlib.Path.replace),
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**A request handler gets a validation library pointed at it because it is visibly an edge.
The boundaries that ship unvalidated are the ones that do not look like edges: an
environment variable read with a default, a `Content-Length` the client chose, a pickled
cache entry written by the previous release, a JSONB column from a schema two migrations
ago. Every one of them is foreign input with no invariant attached, and every one of them
has its own correct shape — validate all configuration at startup and refuse to boot,
treat a declared size as a filter and the byte counter as the enforcement, and treat a
version mismatch in your own store as a miss rather than an error to log and continue
past.**

## The boundaries that do not look like boundaries

An HTTP handler is the obvious edge, and it is the one that gets a validation library
pointed at it. These are the ones that get missed, and each has its own correct shape.

### Environment variables and CLI arguments

Validate them **at startup, all of them, and refuse to start**. Not at first use, forty
minutes into a nightly job, when the traceback is a `ValueError` from inside an HTTP
client. `os.environ` is a mapping, so `os.environ["DATABASE_URL"]` raises `KeyError` for a
missing variable while `os.environ.get("DATABASE_URL")` hands you `None` to carry around —
and the second is how a service ends up quietly pointed at a default host.

```python
import os
from dataclasses import dataclass


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class Settings:
    database_url: str
    secret_key: str
    request_timeout_seconds: int
    debug: bool


TRUE_WORDS = frozenset({"1", "true", "yes", "on"})
FALSE_WORDS = frozenset({"0", "false", "no", "off", ""})


def load_settings(env: dict[str, str] | None = None) -> Settings:
    env = os.environ if env is None else env

    missing = [name for name in ("DATABASE_URL", "SECRET_KEY") if name not in env]
    if missing:
        raise ConfigError(f"missing required environment variables: {', '.join(missing)}")

    raw_timeout = env.get("REQUEST_TIMEOUT_SECONDS", "30")
    try:
        timeout = int(raw_timeout)          # EAFP: int() is the exact test
    except ValueError as exc:
        raise ConfigError(
            f"REQUEST_TIMEOUT_SECONDS must be an integer, got {raw_timeout!r}"
        ) from exc
    if timeout <= 0:                        # LBYL: nothing downstream objects to -5
        raise ConfigError(f"REQUEST_TIMEOUT_SECONDS must be positive, got {timeout}")

    raw_debug = env.get("DEBUG", "false").strip().lower()
    if raw_debug not in TRUE_WORDS | FALSE_WORDS:
        raise ConfigError(f"DEBUG must be a boolean word, got {raw_debug!r}")

    return Settings(
        database_url=env["DATABASE_URL"],
        secret_key=env["SECRET_KEY"],
        request_timeout_seconds=timeout,
        debug=raw_debug in TRUE_WORDS,
    )
```

Four deliberate decisions in that function:

- It collects **all** missing variables before raising, rather than failing on the first —
  the aggregation argument in miniature, and [05e](05e-aggregating-failures.md)'s subject.
- It mixes a `try` with three `if`s, because the questions have three different exact
  tests. "Is this text an integer" is answered only by `int()`; "is it positive" is
  answered only by a comparison; "is it a boolean word" is answered only by a set.
- It **never** uses `bool(env.get("DEBUG"))`. Every non-empty string is truthy, so
  `DEBUG=false` would enable debugging — see the gotchas, and
  [what falsy means](../05-truthiness/01-what-falsy-means.md).
- It takes `env` as a parameter, so the boundary is testable without mutating the process
  environment.

### A client's declared size or content type

`Content-Length`, `Content-Type` and a multipart filename are **claims by the caller**,
not facts. Checking them is still worth doing — it rejects the obvious cases before you
stream gigabytes — but the check is a cheap filter, not the enforcement. The enforcement
has to be a running count while you write.

```python
from pathlib import Path

MAX_UPLOAD_BYTES = 8 * 1024 * 1024


def save_upload(stream, declared_length: int | None, target: Path) -> int:
    # The look: reject the honest-but-oversized client before reading a byte.
    if declared_length is not None and declared_length > MAX_UPLOAD_BYTES:
        raise BadRequest("body", f"upload exceeds {MAX_UPLOAD_BYTES} bytes")

    written = 0
    partial = target.with_suffix(target.suffix + ".part")
    try:
        with partial.open("wb") as fp:
            while chunk := stream.read(64 * 1024):
                written += len(chunk)
                # The enforcement: the bytes, not the header, decide.
                if written > MAX_UPLOAD_BYTES:
                    raise BadRequest("body", f"upload exceeds {MAX_UPLOAD_BYTES} bytes")
                fp.write(chunk)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    partial.replace(target)
    return written
```

Note the two halves working together rather than competing: LBYL for the declaration,
EAFP-with-cleanup for the reality, and `Path.replace` publishing the file only once it is
complete — the atomic-publication pattern from
[the filesystem and the atomic flag](02b-the-filesystem-and-the-atomic-flag.md).

### Data read back from your own store

A JSON or JSONB column, a pickled or msgpack cache entry, a message body, a CSV export
you re-import — every one of these lost its type guarantees on the way out and does not
get them back on the way in. The row was written by code you no longer run.

```python
CACHE_SCHEMA_VERSION = 3


def read_cached_profile(raw: dict[str, object]) -> Profile | None:
    """Treat a cache hit as untrusted input: a mismatch is a miss, not an error."""
    if raw.get("v") != CACHE_SCHEMA_VERSION:
        return None
    name = raw.get("name")
    tier = raw.get("tier")
    if not isinstance(name, str) or tier not in ("free", "pro", "enterprise"):
        return None
    return Profile(name=name, tier=tier)
```

The difference from an HTTP boundary is only in the **response**: bad client input is a
400, a bad *cache* entry is a miss, and a bad *durable* row is an alert — because
something already persisted a value your code cannot represent.

## Gotchas

**★ Symptom: a service silently talks to `localhost` in staging.** Cause:
`os.environ.get("DATABASE_URL", "postgres://localhost/dev")` — a look that can never fail,
so a typo in the variable *name* is indistinguishable from not setting it. Fix: require it
explicitly at startup and let the absence be loud; keep a default only where the default
is genuinely correct.

```python
try:
    database_url = os.environ["DATABASE_URL"]
except KeyError as exc:
    raise ConfigError("DATABASE_URL is required") from exc
```

**★ Symptom: `DEBUG=false` enables debug mode, and `FEATURE_X=0` enables the feature.**
Cause: `bool("false")` and `bool("0")` are both `True` — every non-empty string is truthy,
so an environment variable read through `bool()` is on unless it is absent or empty. Fix:
parse the word against an explicit set and reject anything else.

```python
def env_flag(env: dict[str, str], name: str, default: bool = False) -> bool:
    raw = env.get(name)
    if raw is None:
        return default
    word = raw.strip().lower()
    if word in TRUE_WORDS:
        return True
    if word in FALSE_WORDS:
        return False
    raise ConfigError(f"{name} must be a boolean word, got {raw!r}")
```

**★ Symptom: an upload fills the disk despite a maximum-size check.** Cause: the check read
`Content-Length`, which is a number the client chose; a chunked or lying request never has
to honour it. Fix: keep the header check as a cheap early reject and enforce with a running
byte count while streaming, deleting the partial file on the way out — the `save_upload`
function above.

**Symptom: a nightly job dies forty minutes in with `ValueError: invalid literal` from
inside an HTTP client.** Cause: configuration parsed lazily at the point of use, so a bad
value is discovered after the expensive work. Fix: build one frozen `Settings` at startup
and let the process refuse to boot; every later reader takes the typed object.

```python
SETTINGS = load_settings()      # at import/boot time: fail before any work happens


def fetch(url: str) -> bytes:
    return client.get(url, timeout=SETTINGS.request_timeout_seconds).content
```

**Symptom: `AttributeError` on a cache read, only for users who were active before the
last deploy.** Cause: a pickled or JSON payload written by an older schema, read as if it
were trusted. Fix: version the payload and treat a version mismatch as a cache miss, as in
`read_cached_profile` — never as an error to log and continue past.

**Symptom: a test passes `DEBUG` by mutating `os.environ` and leaks it into unrelated
tests.** Cause: the boundary reads the process environment directly, so it can only be
exercised by mutating global state. Fix: accept the mapping as a parameter defaulting to
`os.environ`, as `load_settings(env=...)` does above — the boundary becomes a pure function
of its input, which is what makes exhaustive validation tests cheap.

**Symptom: a message consumer crashes on a field an older producer never sent, and the
message is redelivered forever.** Cause: the broker body was parsed as if the producer and
consumer shipped together, so a validation failure looks like a transient error and the
message is retried until it poisons the queue. Fix: parse at the consume boundary and route
an unparseable message to a dead-letter destination — a permanent failure must not use the
retry path.

```python
def consume(raw: bytes, dead_letter) -> None:
    try:
        cmd = parse_refund(json.loads(raw))
    except (json.JSONDecodeError, BadRequest) as exc:
        dead_letter.publish(raw, reason=str(exc))   # permanent: never retry
        return
    refund(cmd, gateway, conn)                       # transient failures may raise
```

## Interview questions

**★ Is a row read back from your own database trusted input?**
No, and treating it as trusted is how a `TypeError` deep in a report generator gets traced
to a JSON column written by a schema two releases old. Anything that crossed a
serialisation boundary lost its type guarantees on the way out and does not regain them on
the way in: JSON/JSONB columns, pickled or msgpack cache entries, message bodies, CSVs you
re-import. The read is a boundary and should parse. What differs from an HTTP boundary is
only the response — bad client input is a 400, a bad cache entry is a miss, and a bad
durable row is an alert, because something already persisted a value your types cannot
represent.

**★ Why validate configuration at startup rather than where it is used?**
Because the cost of the failure is completely different at the two points. At startup a bad
value is a process that refuses to boot, before it has taken traffic, written rows or sent
mail — the orchestrator keeps the previous version running and nobody is affected. At first
use it is a partially-completed job, a half-drained queue, or an error surfaced to whichever
user happened to hit the code path first. Validating early also puts every rule about
configuration in one function, which is the only way anyone can answer "what does this
service require to run" without grepping.

**A client sends `Content-Length: 100`. Is that a look you can trust?**
No — it is a claim, and every claim in a request is part of the untrusted input, headers
included. It is still worth checking, because rejecting an honest oversized upload before
reading it saves the bandwidth and the disk. But the enforcement has to be a fact you
observe: a byte counter while you stream, checked on every chunk, writing to a temporary
path so a rejected upload leaves nothing behind. The general shape recurs everywhere in
this chunk — the look is a filter for the common case, and the operation is what actually
enforces the rule.

**Why does `os.environ.get` with a default make a config bug harder to find than
`os.environ[...]`?**
Because it erases the difference between three distinct situations: the variable was
deliberately left unset, the deployment forgot it, and someone misspelled it. All three
produce the default, silently, and the service starts successfully while pointing at the
wrong thing. `os.environ["DATABASE_URL"]` raises `KeyError` and names the variable, which
is a five-second diagnosis. The rule that falls out: a default is only legitimate when the
default value is *correct in production*, not merely convenient in development.

**Which boundary do teams most often forget, and what does the failure look like?**
The read side of their own storage. Inbound HTTP gets a schema library within a week of the
project starting; nobody validates the JSON column they wrote themselves, because at the
time of writing it was valid. The failure arrives months later as a `TypeError` or
`KeyError` deep in a report, for one tenant, from a row written by a schema that no longer
exists — and the traceback points at the reader, which is the one component that is not at
fault. The tell that you have this problem: any code path that does
`json.loads(row["payload"])["some_key"]` without a parse step in between.

---

← Prev: [`assert` is not validation](05b-assert-is-not-validation.md) · Index: [EAFP vs LBYL](README.md) · Next → [Irreversible leaps](05d-irreversible-leaps.md)
