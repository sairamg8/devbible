---
title: "Chained .get() is the most-copied wrong answer in Python — it allocates, it flattens three failures into one None, and it raises AttributeError on exactly the input it was written to survive"
sidebar_label: "10 · Nested access"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [`json`](https://docs.python.org/3.14/library/json.html), [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict), [The `match` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement). Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Nothing in Python's mapping API helps you with nested data. `get` handles one level, and every idiom people build on top of it — chained `get`, `try`/`except KeyError` around a three-level index, autovivifying `defaultdict` — trades one failure mode for another. This chunk is the four shapes for reading nested mappings, the exact input each one breaks on, and how to write the nested *write* without creating dictionaries you never wanted.**

## Nested access, and the trap in the obvious idiom

The chained-`get` idiom is everywhere and it is subtly wrong:

```python
region = payload.get("user", {}).get("address", {}).get("region")
```

Three problems, in ascending order of nastiness:

1. It allocates up to three throwaway dicts per call.
2. It returns `None` for "no user", "no address" and "region is null" alike — the ambiguity from [09 · Reading a key](04-reading-a-key.md), three times over.
3. 🔴 **If `payload["user"]` is present but is `None`** — extremely common in JSON from a database with nullable columns — then `.get` is called on `None` and you get `AttributeError: 'NoneType' object has no attribute 'get'`, not a clean miss.

The third point is the one that matters, because the whole reason someone wrote the chain was to avoid an exception. It survives a *missing* key and dies on a *null* one, and null is what a nullable column serialises to.

The honest version states what it assumes:

```python
def dig(mapping: dict, *path: str, default: object = None) -> object:
    """Walk a nested mapping, returning `default` at the first missing or non-mapping level."""
    current: object = mapping
    for key in path:
        if not isinstance(current, dict) or key not in current:
            return default
        current = current[key]
    return current

region = dig(payload, "user", "address", "region")
```

The `isinstance` check is not defensive noise — it is what turns "the value at this level is `None`, or a string, or a list" into a clean miss instead of an `AttributeError` or a `TypeError`.

And when the structure is a contract rather than a guess, index it and let the `KeyError` name the level that broke:

```python
region = payload["user"]["address"]["region"]
```

## The four shapes, and what each one breaks on

| Shape | Survives a missing key | Survives a `None` level | Survives a non-mapping level | Tells you *which* level failed |
|---|---|---|---|---|
| `a["x"]["y"]["z"]` | ❌ `KeyError` | ❌ `TypeError` | ❌ `TypeError` | ✅ the `KeyError` names it |
| `a.get("x", {}).get("y", {}).get("z")` | ✅ | ❌ `AttributeError` | ❌ `AttributeError` | ❌ |
| `try: a["x"]["y"]["z"] except (KeyError, TypeError)` | ✅ | ✅ | ✅ | ⚠️ only via the exception |
| `dig(a, "x", "y", "z")` | ✅ | ✅ | ✅ | ❌ unless you make it |

None of the four is right in every situation, and the choice is genuinely about what you want to happen:

**Indexing** when the shape is a schema you validated at the edge. The `KeyError` is the correct outcome and the traceback carries the key.

**`try`/`except`** when you want one expression, all-or-nothing, and you are catching a *narrow* pair of exception types. Note that `TypeError` must be in the tuple — a `None` level produces `TypeError: 'NoneType' object is not subscriptable`, not `KeyError`:

```python
try:
    region = payload["user"]["address"]["region"]
except (KeyError, TypeError):
    region = None
```

⚠️ That catch is wider than it looks: a `TypeError` raised *inside* a `__getitem__` on a custom mapping is swallowed too. When the mapping is a plain `dict` that risk is nil; when it might be an ORM row or a config object, prefer the explicit walk.

**The `dig` walk** when the data is genuinely optional at several levels and you want one code path.

**Structural pattern matching** when you want the shape *and* the values in one statement, which is what `match` was designed for. Mapping patterns test for the presence of the named keys and bind them:

```python
match payload:
    case {"user": {"address": {"region": str(region)}}}:
        apply_region(region)
    case {"user": {"address": {}}}:
        apply_region(DEFAULT_REGION)         # address exists, no region
    case _:
        raise ValueError("payload has no address")
```

That is the version that distinguishes the three failures the chained `get` flattens, and it does not allocate. Pattern matching is Phase 1's topic — [Phase 1 · 10 · `match` and pattern matching](../../phase-1-language-core/10-match-pattern-matching/README.md) owns the semantics; here it is simply the best-fitting tool for nested mappings.

## Writing into a nested mapping

Reading is the easy half. The write is where people reach for something clever:

```python
# fails with KeyError if "acme" is not already there
metrics["acme"]["requests"] = 1
```

**`setdefault` chains** are the stdlib answer and read badly past two levels:

```python
metrics.setdefault("acme", {}).setdefault("2026-09", {})["requests"] = 1
```

**`defaultdict` of `defaultdict`** — "autovivification" — reads beautifully and has a real cost:

```python
from collections import defaultdict

def tree() -> defaultdict:
    return defaultdict(tree)

metrics = tree()
metrics["acme"]["2026-09"]["requests"] = 1        # every level springs into being
```

🔴 **The cost is that *reading* also creates.** `metrics["nope"]["nope"]` does not raise — it creates two nested dictionaries and returns an empty one, and now `"nope" in metrics` is `True`. A typo in a read path silently grows the structure, and a `len()` or a serialisation later shows keys nobody wrote. `defaultdict` is topic [06 · `collections`](../06-collections-module/README.md); the relevant fact here is that its `__missing__` fires on `d[k]` and only on `d[k]`, so the create-on-read behaviour is unavoidable by construction.

The mitigation, when you do use a tree, is to freeze it before anything reads it:

```python
def solidify(node: object) -> object:
    """Convert a defaultdict tree into plain dicts, so reads stop creating."""
    if isinstance(node, dict):
        return {key: solidify(value) for key, value in node.items()}
    return node

metrics = solidify(metrics)      # from here on, a missing key is a KeyError again
```

**An explicit helper** is the version that survives review, because the create-on-write is deliberate and confined to one function:

```python
def set_path(root: dict, path: tuple[str, ...], value: object) -> None:
    """Create intermediate dicts as needed and set the leaf."""
    node = root
    for key in path[:-1]:
        existing = node.get(key)
        if not isinstance(existing, dict):
            existing = {}
            node[key] = existing
        node = existing
    node[path[-1]] = value

set_path(metrics, ("acme", "2026-09", "requests"), 1)
```

Note that it *replaces* a non-mapping intermediate rather than raising. That is a policy decision — make it consciously, and the opposite policy (raise on a conflicting non-mapping level) is one line away.

## Flattening, and why it is often the real answer

Deeply nested mappings are frequently a symptom rather than a design. If every access is a three-level walk, the data probably wants to be keyed on a tuple:

```python
# nested: every read is a walk, every write needs intermediates
metrics = {"acme": {"2026-09": {"requests": 1}}}

# flat: one hash, one lookup, no intermediates, trivially serialisable
metrics = {("acme", "2026-09", "requests"): 1}
metrics[("acme", "2026-09", "requests")] += 1
```

The flat form gives up cheap "all metrics for acme" queries — that becomes an *O*(n) scan — so it is the right shape when exact-key access dominates, and the wrong one when you slice by prefix. That trade is the same one [02 · What O(1) does not promise](01b-what-o1-does-not-promise.md) makes about second indexes: a dict is fast at exactly one access pattern, and a nested dict is fast at exactly one *path*.

⚠️ A tuple key does not survive JSON — object keys must be strings. If the structure is serialised, either keep the nesting or join the tuple into a delimiter-separated string at the boundary, with a delimiter that cannot occur in a component.

## Gotchas

**★ Symptom: `AttributeError: 'NoneType' object has no attribute 'get'` in a chained-`get` expression.** Cause: an intermediate key exists with the value `None`, so `.get` is called on `None`. `get` protects you against a *missing* key, never against a *null* value. Fix: walk the path with an explicit guard.

```python
def dig(mapping: dict, *path: str, default: object = None) -> object:
    current: object = mapping
    for key in path:
        if not isinstance(current, dict) or key not in current:
            return default
        current = current[key]
    return current
```

**★ Symptom: `KeyError` with no context — the traceback names the key and nothing else.** Cause: `d[k]` raised exactly what it should, but three levels down from where the missing data actually originated. Fix: catch and re-raise with the context, rather than replacing the index with `get`.

```python
try:
    region = payload["user"]["address"]["region"]
except KeyError as exc:
    raise ValueError(f"malformed address payload; missing {exc.args[0]!r}") from exc
```

**★ Symptom: a `defaultdict` tree contains keys nobody ever wrote.** Cause: `__missing__` fires on `d[k]`, so *reading* a path creates it. A single typo in a read populates the structure permanently. Fix: convert to plain dicts once the building phase is over.

```python
def solidify(node: object) -> object:
    if isinstance(node, dict):
        return {key: solidify(value) for key, value in node.items()}
    return node

metrics = solidify(metrics)
```

**★ Symptom: `try: a["x"]["y"] except KeyError` does not catch the failure.** Cause: the intermediate value is `None` or a list, so the failure is `TypeError: 'NoneType' object is not subscriptable`, not `KeyError`. Fix: catch both, or walk explicitly.

```python
try:
    value = payload["user"]["address"]
except (KeyError, TypeError):
    value = None
```

**Symptom: `metrics["acme"]["requests"] = 1` raises `KeyError` on the *first* key.** Cause: assignment creates the leaf, never the intermediates — `d[k][j] = v` is a *read* of `d[k]` followed by a write into whatever it returned. Fix: create the level explicitly.

```python
metrics.setdefault("acme", {})["requests"] = 1
```

**Symptom: a `setdefault` chain quietly replaces a scalar with a dict, or fails when it finds one.** Cause: `setdefault` only inserts when the key is *absent*; if `metrics["acme"]` is already the string `"n/a"`, the chain returns that string and the next `.setdefault` raises `AttributeError`. Fix: check the type at each level, as `set_path` above does.

**Symptom: a nested config merge loses whole subtrees.** Cause: `a | b` and `a.update(b)` are one level deep — a nested key in `b` replaces the entire subtree in `a` rather than merging into it. Fix: recurse deliberately; there is no built-in deep merge.

```python
def deep_merge(base: dict, override: dict) -> dict:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged
```

**Symptom: a tuple-keyed mapping cannot be serialised to JSON.** Cause: JSON object keys are strings; a tuple is not a valid key in that format. Fix: join at the boundary with a delimiter that cannot appear in a component, and split on the way back.

```python
SEP = "\x1f"      # ASCII unit separator: cannot occur in a tenant or date component

wire = {SEP.join(key): value for key, value in metrics.items()}
metrics = {tuple(key.split(SEP)): value for key, value in wire.items()}
```

**Symptom: a `dig`-style helper returns `None` and the caller cannot tell why.** Cause: it collapses "missing", "null" and "wrong type" into one sentinel — the same flattening as the chained `get`, just better contained. Fix: give it a distinguishable sentinel, or use `match` when the three outcomes need different handling.

```python
_MISSING = object()
region = dig(payload, "user", "address", "region", default=_MISSING)
if region is _MISSING:
    raise ValueError("no region in payload")
```

## Interview questions

**★ Someone writes `payload.get("user", {}).get("address", {}).get("region")`. What do you say?**
That it works right up until `payload["user"]` is present and `None`, at which point it raises `AttributeError` on `None.get` rather than returning a clean miss — and null intermediate values are the normal case in JSON coming from a database. It also allocates throwaway dicts on every call, and it flattens three different failures into one `None`. Replace it with an explicit walk that checks both presence and type at each level, or, if the shape is a contract rather than a guess, index it and let the `KeyError` name the level that broke.

**★ Why does `try: d["a"]["b"] except KeyError` not always catch the failure?**
Because a missing key and a non-subscriptable intermediate raise different exceptions. `d["a"]` missing gives `KeyError`; `d["a"]` being `None`, a string that has no such key, or a list indexed by a string gives `TypeError`. Any `try` around a nested index has to name both, and once you are catching `TypeError` you are catching more than you meant — including a `TypeError` raised inside a custom `__getitem__`. That breadth is exactly what the width-of-the-`try` argument in Phase 1's exception material is about, and it is a good reason to prefer an explicit walk over a wide catch.

**★ What is wrong with an autovivifying `defaultdict` tree?**
That reading creates. `__missing__` fires on `d[k]` and only on `d[k]`, so there is no way to make a `defaultdict` tree that grows on write but not on read. A typo in a read path permanently adds keys, `len()` and serialisation then show entries nobody wrote, and a membership test that was `False` becomes `True` after a read. It is a genuinely nice building tool; the discipline is to convert the finished structure into plain dicts before anything queries it, so a missing key becomes a `KeyError` again.

**How do you write into a three-level nested dict when the intermediate levels may not exist?**
`d[a][b] = v` cannot do it — that expression *reads* `d[a]` and writes into the result, so it raises if `a` is absent. The stdlib answer is a `setdefault` chain, `d.setdefault(a, {}).setdefault(b, {})[c] = v`, which is correct and unreadable past two levels and silently misbehaves if an intermediate holds a non-mapping. The version that survives review is a small explicit helper that walks the path, creates a dict where the level is absent *or is not a mapping*, and sets the leaf — because it puts the "what if the level holds a string" policy in one visible place.

**When is a nested dict the wrong shape entirely?**
When every access is a full-path lookup. A `dict` is fast at exactly one thing — exact-key access — and a nested dict is fast at exactly one *path*; you pay a hash and a lookup per level and you pay intermediates on every write. Keying on a tuple flattens all of that into one hash: `metrics[("acme", "2026-09", "requests")]`. You give up cheap prefix queries, which become linear scans, so the flat form is right when exact access dominates and wrong when you slice by prefix. And a tuple key does not survive JSON, so the boundary needs a join.

**Why is `match` a good fit for nested payloads?**
Because a mapping pattern tests for the presence of the named keys and binds their values in one statement, and you can add a type test — `{"user": {"address": {"region": str(region)}}}` — so "region is present but null" falls through to a different case rather than binding `None`. That is precisely the distinction the chained `get` destroys. It also does not allocate intermediate dicts, and the cases read as a specification of the shapes you accept rather than as defensive plumbing.

---

← [09 · Reading a key](04-reading-a-key.md) · [Topic index](README.md) · Next → [11 · `setdefault`](04c-setdefault.md)
