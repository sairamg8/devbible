---
title: "One dictionary lookup has seven correct spellings, and choosing between them is not a style question: each one encodes a different answer to what a missing key means"
sidebar_label: "03 · Mappings: the decision table"
sidebar_position: 125
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict)
> (`d[key]`, `get`, `setdefault`, `pop`, `in`),
> [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**A missing key is not an error, and it is not a default either — it is whichever of
those two your function has promised. Python gives you seven ways to spell one lookup
precisely because that promise differs case by case: `d[k]` says the key is required,
`d.get(k, x)` says it is optional with a known fallback, `k in d` says the caller wants
to branch on presence, `d.setdefault` says absence should be repaired in place, and a
`defaultdict` says absence is not a case worth mentioning. Pick the spelling that states
your contract, and the EAFP-versus-LBYL argument mostly dissolves: five of the seven are
neither, because the standard library already folded the check into the call.**

## The seven spellings, and what a miss does in each

| Spelling | Operations | On a miss | Mutates `d`? | Style |
|---|---:|---|---|---|
| `d[key]` | 1 | raises `KeyError` | no | the leap itself |
| `try: d[key]` / `except KeyError:` | 1 | your handler runs | no | **EAFP** |
| `if key in d: d[key]` | **2** | your `else` runs | no | **LBYL** 🔴 races |
| `d.get(key)` | 1 | returns `None` | no | neither |
| `d.get(key, default)` | 1 | returns `default` | no | neither |
| `d.pop(key, default)` | 1 | returns `default` | yes, on a hit | neither |
| `d.setdefault(key, default)` | 1 | inserts and returns `default` | **yes, on a miss** | neither |
| `defaultdict(factory)[key]` | 1 | calls factory, inserts, returns | **yes, on a miss** | neither |

The documented behaviour, verbatim, because the differences are exactly one clause each:

- `d[key]` — *"Return the item of dictionary d with key key. Raises a `KeyError` if key is
  not in the dictionary."*
- `get(key, default=None)` — *"Return the value for key if key is in the dictionary, else
  default. If default is not given, it defaults to `None`, so that this method never
  raises a `KeyError`."*
- `setdefault(key, default=None)` — *"If key is in the dictionary, return its value. If
  not, insert key with a value of default and return default."*
- `pop(key[, default])` — *"If key is in the dictionary, remove it and return its value,
  else return default. If default is not given and key is not in the dictionary, a
  `KeyError` is raised."*
- `key in d` — *"Return `True` if d has a key key, else `False`."*

## The decision, in three questions

**1. What does absence mean to this function's contract?**

```python
# Required. Absence is a programming error or a corrupt payload — raise, and say what.
def user_id(event: dict) -> int:
    return event["user_id"]          # KeyError is the right outcome, uncaught

# Optional with a known fallback. Absence is ordinary.
def page_size(query: dict) -> int:
    return int(query.get("page_size", 50))

# Optional, and the caller decides. Return None and document it.
def find_nickname(profile: dict) -> str | None:
    return profile.get("nickname")
```

The first function is the one people get wrong: they wrap it in `try`/`except KeyError`
and return `None`, and the missing field becomes an `AttributeError` four frames later.
If the key is genuinely required, letting `KeyError` propagate **is** the design — it
names the key, points at the line, and reaches the caller who built the dict. That is the
whole argument of [`None` and the no-result
contract](../14-none-and-no-result/README.md).

**2. Who owns the default?**
If the fallback belongs to the caller, `get(key, default)` puts it at the call site where
it is visible. If it belongs to the data structure — every miss in this dict means an
empty list — the structure should own it, which is `defaultdict`, not a default repeated
at nine call sites.

**3. Does the miss need to be recorded?**
`get` leaves the dict alone. `setdefault` and `defaultdict` **write** on a miss. That is
the feature when you are building an index and a landmine when you are reading a config:
a read that inserts turns a lookup into a mutation, and every subsequent `in`, `len` and
`json.dumps` sees the key you accidentally created.

## Gotchas

**★ Symptom: `if d.get("count"):` skips a row whose count is `0`.** Cause: `get` returns
the value, and a real `0` is falsy — the test conflates "absent" with "present and
zero-ish". Fix: test presence explicitly, or compare against the sentinel.

```python
count = d.get("count")
if count is not None:
    report.append(f"{d['name']}: {count}")
```

Falsy-versus-absent is the single most productive bug in this area and
[truthiness](../05-truthiness/README.md) is its home topic.

**★ Symptom: `KeyError` with a message that is just a key, and no idea which dictionary
it came from.** Cause: the exception carries only the key — the docs describe
`__missing__` as raising *"a `KeyError` exception with the key as argument"* — and a bare
propagation adds no context. Fix: catch and re-raise with context using `from`, or give
the mapping its own miss policy.

```python
try:
    dsn = settings["DATABASE_URL"]
except KeyError as exc:
    raise ConfigError("DATABASE_URL is required (set it in .env)") from exc
```

**★ Symptom: a required field is missing and the traceback points at a line four frames
later, complaining about `NoneType`.** Cause: `get` was used for a key the function
requires, so the miss became a `None` that travelled. Fix: `d[key]` for required keys —
the `KeyError` names the key at the line that needed it, which is the whole reason it
exists.

**Symptom: `d.pop(key)` raises `KeyError` in cleanup code.** Cause: `pop` without a
default is documented to raise — *"If default is not given and key is not in the
dictionary, a `KeyError` is raised"* — and cleanup runs twice, or runs after another path
removed the key. Fix: `d.pop(key, None)`, the idempotent form.

**Symptom: a lookup that "cannot fail" fails on a dict built from user input.** Cause:
the required-key contract is right for internal data and wrong at a trust boundary,
where a missing field is an ordinary client error rather than a bug. Fix: validate the
payload once at the boundary and raise a 400-shaped domain error there; inside the
boundary keep `d[key]` and let it assert.

**Symptom: two spellings of the same lookup in one function — `get` on one line, a
subscript on the next.** Cause: the contract was never decided, so each line was written
to whatever felt safe at the time. Fix: decide once per function whether the key is
required, and make every access in it agree.

## Interview questions

**★ When should a missing key raise, and when should it return a default?**
When the key is part of the function's precondition — an internal payload your own code
built, a required config value, a database row's primary field — absence is a bug, and
`d[key]`'s `KeyError` is the correct outcome: it names the key and points at the line. When
absence is an ordinary state of the world — an optional query parameter, a cache miss, a
field the API marks optional — return a default with `get`. The failure mode to avoid is
catching `KeyError` on a required key and returning `None`, which converts a precise
error at the source into a vague one several frames away.

**★ Why is `d.get(key, default)` neither EAFP nor LBYL, and why does that matter?**
Because it is a single atomic operation that already contains the fallback — there is no
pre-check to go stale and no exception to handle. It matters because most arguments about
these two styles are conducted over code where the third option was available: the choice
was never "look or apologise", it was "use the API's own default". The same family
includes `pop` with a default, `getattr` with a default, `set.discard`,
`Path.mkdir(exist_ok=True)` and `Path.unlink(missing_ok=True)`.

**★ Is `if key in d: value = d[key]` ever the right thing to write?**
Only when you genuinely need presence *and* the value as separate facts and cannot
express it in one call — and even then the modern spelling is a walrus over `get` with a
sentinel, which keeps it to one operation. The pattern's real cost is that it hashes
twice and can raise between the two lines; the pattern's real appeal is that it reads
like English, which is not a technical argument.

```python
sentinel = object()
if (value := d.get(key, sentinel)) is not sentinel:
    use(value)
```

**Why is `dict.get`'s documented promise that it "never raises a `KeyError`" a design
statement rather than a convenience?**
Because it fixes the function's contract at the call site. A `get` with a default says
"absence is expected and here is what it means"; a subscript says "absence is
impossible, and if I am wrong I want to know immediately". Those are two different
promises to the caller, and choosing the spelling is how you write the promise down —
there is no separate place in Python where you would declare it.

**`d.pop(key, None)` both reads and mutates. When is that the right lookup?**
When the read is a hand-off: consuming an option out of a kwargs dict so the remainder
can be passed on, taking a job out of a pending map, or draining a buffer. The
single-operation property matters most here — a `pop` cannot be raced between the check
and the removal, which is exactly what makes it the correct spelling for "claim this
entry if it is there".

**How do you decide between `KeyError` propagating and a domain exception?**
By who is going to read it. Inside a module, `KeyError` is fine and precise — it names
the key and the line. Crossing a boundary that other people's code calls, translate it:
`raise ConfigError(...) from exc`, so the message says what to *do* about it while the
cause keeps the original diagnosis attached. Chaining is what makes translation
non-destructive, and it is [topic 11's](../11-exceptions/06b-exception-chaining.md)
subject.

---

← Prev: [Databases, queues, and when LBYL clears](02c-databases-queues-and-when-lbyl-clears.md) · Index: [EAFP vs LBYL](README.md) · Next → [Writing on a miss](03b-writing-on-a-miss.md)
