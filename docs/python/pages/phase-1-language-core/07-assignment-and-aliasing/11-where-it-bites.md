---
title: "The production version of this bug is always the same: one object, many owners, one of whom writes — and the write happens a long way from the symptom"
sidebar_label: "11 · Where it bites in real code"
sidebar_position: 92
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#why-did-changing-list-y-also-change-list-x),
> [`copy`](https://docs.python.org/3.14/library/copy.html),
> [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType),
> and [Built-in Types — dict](https://docs.python.org/3.14/library/stdtypes.html#dict).
> Target: **CPython 3.14**.

**Everything so far has been mechanism. This chunk is the shapes those
mechanisms take in a real codebase, and the reason the topic is tiered Master:
the mutation and the symptom are separated by modules, by requests, sometimes
by hours, and the traceback — when there is one — points at the reader, not the
writer. Each pattern below is a real failure shape, with the diagnostic that
finds it and the fix that removes it rather than moving it.**

## 1 — The config dict handed to twenty modules

```python
# settings.py
CONFIG = load_yaml("config.yaml")          # a plain dict

# a.py
from settings import CONFIG
def setup(): client = Client(**CONFIG["db"])

# somewhere in b.py, three months later
def use_replica():
    CONFIG["db"]["host"] = REPLICA_HOST     # "just for this call"
```

Nothing is wrong until `use_replica` runs once, after which every module that
reads `CONFIG["db"]["host"]` — including ones that ran before and cached the
value, and ones that run in a different request — sees the replica. The
symptom is "writes go to the replica sometimes", and the cause is in a file
nobody suspects.

**Diagnose.** Wrap the dict in `types.MappingProxyType` temporarily and run the
test suite: every writer raises `TypeError` with a traceback pointing at the
exact line. This is the single most effective five-minute diagnostic in this
whole topic.

**Fix.** Freeze it for real — a frozen dataclass built at startup, or nested
`MappingProxyType` over immutable values — and give the legitimate variation
case an explicit derivation:

```python
db_config = dataclasses.replace(CONFIG.db, host=REPLICA_HOST)
```

## 2 — The template dict reused in a loop

```python
row = {"order_id": None, "status": "new"}
rows = []
for order in orders:
    row["order_id"] = order.id             # mutating the SAME dict
    rows.append(row)                        # appending it again
```

`rows` is `n` references to one dict, all showing the last order. The repr
during debugging shows `n` identical entries, which reads as "the loop is
broken" rather than "there is one object".

**Diagnose.** `len({id(r) for r in rows})`. If it is 1, this is your bug.

**Fix.** Construct inside the loop: `rows.append({"order_id": order.id,
"status": "new"})`, or `rows.append(row | {"order_id": order.id})`, or a
dataclass per row. See
[Repetition and shared references](03b-repetition-and-shared-refs.md).

## 3 — The test fixture that leaks between tests

```python
SAMPLE_ORDER = {"id": 1, "lines": [{"sku": "A", "qty": 1}]}

def test_discount():
    order = SAMPLE_ORDER                     # or SAMPLE_ORDER.copy()
    order["lines"][0]["qty"] = 5
    ...
```

Each test passes alone. Run in a suite and the second test sees `qty=5`.
Ordering-dependent failures, a suite that passes locally and fails on CI
because `pytest-randomly` reordered it, and the classic "it only fails when I
run the whole file".

**Diagnose.** Run the suite with `-p no:randomly` versus with random ordering;
if the outcome changes, look for shared module-level fixture data.

**Fix.** A factory, not a constant:

```python
@pytest.fixture
def sample_order():
    return {"id": 1, "lines": [{"sku": "A", "qty": 1}]}   # built per test
```

A `pytest` fixture with the default function scope constructs per test, which
is exactly the `default_factory` idea again. If you must keep a module-level
constant, `copy.deepcopy` it in the fixture.

## 4 — Middleware that mutates the request context

```python
async def add_user(request, call_next):
    request.state.ctx["user"] = user        # a dict created... where?
    return await call_next(request)
```

If `ctx` is created per request, this is fine. If it is a module-level default,
a `ContextVar` default, or a mutable default argument, it is a **cross-request
data leak**: user A's identity is visible to user B's handler. This is the
severe form of the mutable-default bug because the consequence is a security
incident, not a wrong number.

**Diagnose.** Log `id(ctx)` at the start of each request. If the id repeats
across requests, the object is shared.

**Fix.** Create the context per request explicitly, and if you use a
`ContextVar`, `default=None` plus an explicit `set()` at the top of the request
— never `default={}`. See
[Linting the whole family](06d-linting-mutable-defaults.md).

## 5 — The retry loop that mutates the payload

```python
for attempt in range(3):
    payload["attempt"] = attempt
    payload["headers"].append(("X-Retry", str(attempt)))    # accumulates!
    send(payload)
```

Attempt 3 sends three `X-Retry` headers. Worse, if `send` mutates `payload` on
failure — adding an error field, popping a key — the retry sends something
different from the original, and "retry" quietly becomes "send a different
request". The
[raises-and-mutates](04b-tuple-item-raises-and-mutates.md) case makes
this concrete: an augmented assignment that threw still performed its mutation,
so a retry after an exception can double-apply it.

**Fix.** Build the request per attempt from an immutable base:

```python
base = frozen_payload
for attempt in range(3):
    send(dataclasses.replace(base, attempt=attempt))
```

## 6 — The test that edits global config and does not restore it

```python
def test_feature_on():
    settings.FLAGS["new_checkout"] = True     # no teardown
    assert checkout(...) == ...
```

Every test that runs afterwards in the same process has the flag on. The suite
is green today because no other test exercises that path, and red in six weeks
when someone adds one — with a failure that has nothing to do with their change.

**Diagnose.** Run the suspect test first, then alone, then last. If the outcome
of *other* tests depends on where it ran, it is mutating shared state.

**Fix.** `monkeypatch.setitem(settings.FLAGS, "new_checkout", True)`, which
records the old value and restores it at teardown, or a fixture that
deep-copies and restores. The structural fix is a frozen settings object plus a
dependency-injected override, so a test cannot reach in at all.

## Gotchas

### The traceback points at the reader, not the writer
**Symptom.** An exception or a wrong value in module A, whose code is correct.
**Cause.** Module B mutated a shared object earlier, possibly in an earlier
request.
**Fix.** Stop reading A. Make the object un-writable (proxy, tuple, frozen
dataclass) and re-run; the traceback then lands on B.

### "It works in dev" because dev is single-request
**Symptom.** Cross-contamination that only appears under load or with a
warm process.
**Cause.** Process-lifetime shared state — mutable defaults, class attributes,
module globals — needs a second request to be visible.
**Fix.** Test with a warm worker and more than one request; assert on `id()`
where per-request objects are expected.

### A fixture that is "read-only by convention"
**Symptom.** One test in a hundred mutates the shared fixture and every
subsequent test in that file is subtly wrong.
**Cause.** The convention was not enforced.
**Fix.** Function-scoped fixtures that construct fresh data, or frozen
structures that cannot be mutated at all.

### Global state edited in a test with no teardown
**Symptom.** Test outcomes depend on execution order; a test that passes alone
fails after another test has run.
**Cause.** A test wrote to a module-level dict, list or class attribute and left
it that way. The process is shared across the whole suite.
**Fix.** `monkeypatch.setitem`/`setattr`, which restore automatically, or a
fixture that snapshots and restores. Never a bare assignment to global state
inside a test body.

### A per-request object that turns out to be per-process
**Symptom.** Load testing shows request data bleeding between concurrent users;
a single-user smoke test is clean.
**Cause.** Something in the request path — a default argument, a module global,
a class attribute, a `ContextVar` default — is created once per process rather
than once per request.
**Fix.** Log `id()` of the object at the start of two requests. If it matches,
find the creation site and move it into the request path.

### `dict.update()` used to apply overrides onto the defaults
**Symptom.** After one request with overrides, every later request gets those
overrides.
**Cause.** `DEFAULTS.update(overrides)` mutates the defaults object in place;
the merge direction is backwards.
**Fix.** `merged = DEFAULTS | overrides` or `{**DEFAULTS, **overrides}` —
both build a new dict and leave `DEFAULTS` alone.

## Interview questions

**★ Q: Tell me about an aliasing bug you have seen in production.**
The useful answer has a shape: one object, several owners, one writer, and a
symptom far from the write. A shared config dict mutated by one module; a
template dict appended to a list in a loop; a module-level default list handed
out as "a fresh default" and then appended to. Name the diagnostic you used —
`id()` at three points, or wrapping the object in `MappingProxyType` so every
writer raises — because that is what distinguishes experience from having read
about it.


**★ Q: Why is a mutable default argument a security issue in a web service and
not just a bug?**
Because the default object lives for the life of the process, so data written
during one request is present during the next. In an authentication or context
dictionary that means one user's identity or permissions leak into another
user's request. It is the same mechanism as the toy `f(items=[])` example, with
a consequence that is reportable.


**Q: A test suite passes file by file and fails when run together. What is your
first hypothesis?**
Shared mutable state at module scope: a fixture constant that a test mutates, a
class attribute, a mutable default, a cache that is not cleared between tests.
Confirm by randomising test order — if the outcome changes with ordering, it is
shared state, not a logic bug.


**Q: You find `CONFIG["db"]["host"] = x` in a codebase. What is the fix, and
what is the fix that does not work?**
The fix that does not work is adding `.copy()` where the config is read —
shallow, downstream, and it hides the write without removing it. The fix is to
make the config immutable at construction (frozen dataclass, or nested
`MappingProxyType` over immutable values) and to express the variation as a
derived value, so the code that wanted a different host gets its own object.


**Q: A test mutates a global settings dict. Why is `monkeypatch` better than
setting it back at the end of the test?**
Because a bare restore at the end of the test body does not run if the test
fails or raises part-way through, so one failing test poisons every test after
it — turning one red into a cascade. `monkeypatch.setitem` registers the undo
with the fixture teardown, which runs regardless of outcome.

**Q: Where is the right place to put the single freeze in a web service?**
At deserialisation and at configuration load — the two points where external
data becomes internal data. After that, the object graph is immutable and every
downstream layer can share it freely with no copies, no conventions and no
defensive programming. Anything that needs a variation derives one with
`replace`.

---

← Prev: [Read-only views and boundary types](10b-read-only-views-and-boundaries.md) · Index: [Assignment and aliasing](README.md) · Next → [Publishing state, and the diagnostic toolkit](11b-publishing-state-and-diagnostics.md)
