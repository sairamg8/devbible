---
title: "EAFP and LBYL are not style preferences — they are two answers to the question of whether your check and your action are one operation or two"
sidebar_label: "01 · The two names"
sidebar_position: 120
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Glossary: `EAFP`, `LBYL`, `duck-typing`](https://docs.python.org/3.14/glossary.html),
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access),
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict),
> [What's New in Python 3.11 — Misc](https://docs.python.org/3.14/whatsnew/3.11.html).
> Every definition below is quoted, not paraphrased. Target: **Python 3.14**.
> Documentation-validated; **no timings**.

**Both names are in the Python glossary, which means this is a vocabulary the language
itself hands you — not a blog-era argument. But the glossary's definitions are about
*shape* ("many `try` statements", "many `if` statements"), and the shape is the least
interesting thing about the choice. The difference that decides real code is that **LBYL
performs two operations where EAFP performs one**. Two operations have a gap between
them, and everything that goes wrong with LBYL — the race condition the glossary itself
warns about, the check that was true and stopped being true, the guard that answers a
subtly different question from the action — lives in that gap. Pick by asking whether
the gap can hurt you, never by asking which one looks more Pythonic.**

## What the glossary actually says

**EAFP**, verbatim:

> *"Easier to ask for forgiveness than permission. This common Python coding style
> assumes the existence of valid keys or attributes and catches exceptions if the
> assumption proves false. This clean and fast style is characterized by the presence of
> many `try` and `except` statements. The technique contrasts with the LBYL style common
> to many other languages such as C."*

**LBYL**, verbatim:

> *"Look before you leap. This coding style explicitly tests for pre-conditions before
> making calls or lookups. This style contrasts with the EAFP approach and is
> characterized by the presence of many `if` statements."*

Three things are worth extracting from those two paragraphs before going further.

1. **The docs take a side, mildly.** EAFP is *"this clean and fast style"*; LBYL gets no
   adjective at all. That is an editorial signal, not a rule, and it is the strongest
   endorsement the reference gives either one.
2. **EAFP is defined by an assumption, not by `try`.** *"Assumes the existence of valid
   keys or attributes"* — the `try` is the consequence of writing code that assumes, not
   the point. Code that assumes nothing and wraps everything in `try` is not EAFP; it is
   just a lot of `try`.
3. **LBYL is defined by *pre-conditions*.** A pre-condition is a claim about state made
   *before* the operation that depends on it. That word is the whole hazard: state you
   checked and state you act on are the same state only if nothing moved in between.

## The same operation, written both ways

```python
# LBYL — two operations: a membership test, then a lookup.
def timeout_lbyl(config: dict[str, int]) -> int:
    if "timeout" in config:
        return config["timeout"]
    return 30

# EAFP — one operation, plus a handler for the way it fails.
def timeout_eafp(config: dict[str, int]) -> int:
    try:
        return config["timeout"]
    except KeyError:
        return 30

# Neither — one operation with the fallback pushed into the call itself.
def timeout_flag(config: dict[str, int]) -> int:
    return config.get("timeout", 30)
```

All three return the same value for every input. They are not equivalent, and the
inequality is mechanical rather than aesthetic:

| | Operations on `config` | Behaviour if `config` mutates mid-call | Cost of the miss |
|---|---:|---|---|
| `timeout_lbyl` | **2** (`__contains__`, then `__getitem__`) | 🔴 `KeyError` escapes — the key was there when looked at and gone when read | one hash lookup |
| `timeout_eafp` | **1** (`__getitem__`) | cannot happen — there is no gap | raise + catch |
| `timeout_flag` | **1** (`__getitem__` internally) | cannot happen | one hash lookup |

The third row is the one most arguments about EAFP forget exists. `dict.get` is
documented as *"Return the value for key if key is in the dictionary, else default. If
default is not given, it defaults to `None`, so that this method never raises a
`KeyError`."* It is a **single atomic operation that already contains the fallback** —
neither a look nor an apology. Where the standard library offers one of these, it is
almost always the right answer, and the rest of this topic keeps returning to that
third family: `dict.get`, `dict.pop` with a default, `getattr` with a default,
`Path.mkdir(exist_ok=True)`, `Path.unlink(missing_ok=True)`, `open(path, "x")`.

## The reframe: three questions, no style opinions

When the choice is genuinely between a check and a handler, these decide it — in this
order.

**1. Can the pre-condition change between the look and the leap?**
If the state is shared — a `dict` another thread writes, a filesystem, a database, a
cache, a network peer — the answer is yes, and LBYL is *wrong*, not merely
unfashionable. The glossary says so directly, and [the race between the look and the
leap](02-the-race-between-look-and-leap.md) is the whole of the next chunk.

**2. Does the check ask exactly the same question as the operation?**
`hasattr(obj, "read")` asks whether an attribute lookup raises; `obj.read()` asks
whether calling it works. `s.isdigit()` asks a Unicode property question; `int(s)` asks
a parsing question. Every LBYL guard is an *approximation* of the operation it guards,
and every gap between the two is a bug that presents as "but I checked".

**3. What does the failure branch need to know?**
An exception arrives carrying the diagnosis: `KeyError` names the key, `OSError` carries
`errno` and `filename`, `sqlite3.IntegrityError` says which constraint. An `if` that
returns `False` carries nothing — you know the check failed, not why. When the failure
path has to *report*, EAFP hands you the material and LBYL makes you reconstruct it.

Notice what is not on that list: which one has fewer lines, which one a reviewer called
Pythonic, and how fast a `try` is. The cost question has a real, documented answer and
it is smaller than people expect — [the cost argument](07-the-cost-argument.md) takes it
apart with the only two numbers the CPython documentation actually publishes.

## Gotchas

**★ Symptom: `KeyError` in production from a line that is inside `if key in config`.**
Cause: two operations, one gap — the mapping was mutated between the membership test and
the subscript, exactly the glossary's own example. Fix: make it one operation.

```python
# Was: if "timeout" in config: return config["timeout"]
return config.get("timeout", 30)
```

**Symptom: the LBYL version is measurably slower on the hot path and nobody can see
why.** Cause: `if key in d: return d[key]` hashes the key **twice** and walks the table
twice — the check is not free just because it is an `if`. Fix: `d.get(key, default)`
hashes once; the EAFP form also hashes once, and pays extra only on the miss.

**Symptom: `try`/`except KeyError` around a `defaultdict` lookup never runs its handler,
and the dict silently grows.** Cause: `__missing__` inserts and returns instead of
raising, so there is no exception for EAFP to catch. Fix: use `.get()`, which the
`collections` docs state *"will, like normal dictionaries, return `None` as a default
rather than using `default_factory`"* — the mechanism is in
[mappings](03-mappings-the-decision-table.md).

**Symptom: two branches of the same function disagree about whether a missing value is
an error.** Cause: LBYL returned a default and EAFP raised, in the same call path,
because the style was chosen per-line. Fix: choose the *contract* first — raise, return
a default, or return `None` — and only then choose the mechanism. [`None` and the
no-result contract](../14-none-and-no-result/README.md) is where that decision lives.

**Symptom: the "third option" is available and nobody used it, because the review
argued styles.** Cause: the two glossary names are so memorable that the API flag in
front of you goes unread. Fix: grep the call you are guarding for a default, an
`exist_ok`, a `missing_ok` or an exclusive mode before writing either an `if` or a `try`.

```python
# Neither look nor apology — one call, fallback included.
port = config.get("port", 8080)
value = getattr(settings, "retries", 3)
Path(target).mkdir(parents=True, exist_ok=True)
Path(stale).unlink(missing_ok=True)
```

## Interview questions

**★ What are EAFP and LBYL, and where do those definitions come from?**
They are Python glossary terms. EAFP — "easier to ask for forgiveness than permission" —
is the style that *"assumes the existence of valid keys or attributes and catches
exceptions if the assumption proves false"*, and the glossary calls it *"clean and
fast"*. LBYL — "look before you leap" — *"explicitly tests for pre-conditions before
making calls or lookups"*. The glossary characterises them by shape, many `try`s versus
many `if`s, and notes LBYL is the style *"common to many other languages such as C"*. The
answer that shows you have thought about it adds the mechanical difference: LBYL is two
operations with a gap between them, EAFP is one.

**★ Why is `if key in mapping: return mapping[key]` singled out in the documentation as
a hazard?**
Because it is two separate operations on shared state. The glossary's own words: in a
multi-threaded environment LBYL *"can risk introducing a race condition between "the
looking" and "the leaping""*, and that exact snippet *"can fail if another thread removes
key from mapping after the test, but before the lookup"*. The fix it names is a lock or
EAFP. The secondary cost is that it hashes the key twice.

**★ Is there a third option?**
Usually, and it is the best one. Many standard-library APIs fold the fallback into the
call so there is neither a look nor an apology: `dict.get(key, default)` *"never raises a
`KeyError`"*, `getattr(obj, name, default)` returns the default instead of raising,
`Path.mkdir(exist_ok=True)` and `Path.unlink(missing_ok=True)` suppress exactly one
`OSError` subclass each, and `open(path, "x")` is documented as *"open for exclusive
creation, failing if the file already exists"* — an atomic test-and-create no `if` can
express. Reach for the flag before reaching for either style.

**Which is easier to type-check?**
LBYL, and it is a genuine argument for it. The narrowing constructs mypy documents are
all conditions — `isinstance()`, `issubclass()`, `type(obj) is int`, `callable()`,
`obj is not None`, truthiness and `assert` — so an `if` both guards the operation and
tells the checker what is true afterwards. An `except` handler is not one of those
constructs. When you need a checker to prove `T | None` has been eliminated, the `if`
does two jobs and the `try` does one.

**Why does the glossary describe the two styles by counting keywords rather than by
semantics?**
Because a glossary entry is a vocabulary aid, not a design guide — it has to let you
recognise the style in unfamiliar code, and *"many `if` statements"* does that in four
words. The consequence is that the terms get *applied* by counting keywords too, which
misclassifies constantly: a `try` spanning four operations looks like EAFP and asserts
nothing, and a domain-rule guard looks like LBYL and is simply correct. [Why Python
leans EAFP](01b-why-python-leans-eafp.md) takes both misreadings
apart.

**If both forms return the same value for every input, in what sense are they not
equivalent?**
In the number of operations they perform on the shared object, and therefore in what a
concurrent mutation can do to them. `if k in d: return d[k]` touches `d` twice and can
raise `KeyError` from a line guarded by a test that passed; `d.get(k, default)` and
`try: d[k]` touch it once and cannot. Equivalence of return values under a quiet
single-threaded test says nothing about equivalence under load — which is why this is a
semantic choice wearing a style label.

---

← **Topic index** *(not written yet)* · Next → [Why Python leans EAFP](01b-why-python-leans-eafp.md)
