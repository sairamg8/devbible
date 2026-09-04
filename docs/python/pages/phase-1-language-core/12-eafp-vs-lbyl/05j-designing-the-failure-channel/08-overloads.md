---
title: "typeshed gives dict.get three overloads because whether None can come back depends on an argument rather than on the function — which is the mechanism that stops a None-returning design from taxing the callers who supplied a default and opted out of it"
sidebar_label: "08 · Overloads"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Python 3.14 documentation —
> [`@typing.overload`](https://docs.python.org/3.14/library/typing.html#typing.overload)
> (quoted below) and
> [`dict.get`](https://docs.python.org/3.14/library/stdtypes.html#dict.get) — plus the
> [typeshed stubs for `dict.get`](https://github.com/python/typeshed/blob/main/stdlib/builtins.pyi)
> (`stdlib/builtins.pyi`, read 2026-09-04).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**Everything in this chapter so far has treated a function's failure contract as one fact.
It is not always one fact. `dict.get` returns `V | None` or `V` depending on whether you
passed a default — the *same runtime call*, two different contracts, chosen by an argument.
`@overload` is how that distinction reaches the type system, and it is the direct answer to
[05m](04-the-bill-every-caller-pays.md)'s complaint that a `None` return taxes every caller:
with overloads, only the callers who declined to supply a default pay it. The other half of
this idea — making the checker enforce a distinction about *outcomes* rather than arguments —
is [05r](09-union-returns-and-exhaustiveness.md).**

## The default argument decides the return type

The canonical example ships with the language. From typeshed's `stdlib/builtins.pyi` (read
2026-09-04):

```python
    # Positional-only in dict, but not in MutableMapping
    @overload  # type: ignore[override]
    def get(self, key: _KT, default: None = None, /) -> _VT | None: ...
    @overload
    def get(self, key: _KT, default: _VT, /) -> _VT: ...
    @overload
    def get(self, key: _KT, default: _T, /) -> _VT | _T: ...
```

Read it as three promises about the same runtime function:

| Call | Matching overload | Return type | Why it matters |
|---|---|---|---|
| `d.get(k)` | first | `V \| None` | you must narrow — the caller chose no default |
| `d.get(k, 0)` | second | `V` | **no narrowing needed**, because `0` is a `V` |
| `d.get(k, "n/a")` | third | `V \| str` | the default's own type joins the union |

That middle row is the payoff, and it is a direct answer to the LBYL bill from
[05m](04-the-bill-every-caller-pays.md): a caller who supplies a default of the right type
does **not** have to write `if x is None:`, because the checker can prove the miss was
already handled. Without overloads the single honest signature would be
`def get(self, key, default=None) -> _VT | None`, and every call — including
`counts.get(word, 0)` — would force a narrowing that the argument had already made
unnecessary.

The order is load-bearing. Overloads are matched top-down, so `default: None = None` must
come first: it is the most specific, and if the `default: _T` form were first it would match
`d.get(k)` too and swallow the other two.

The documentation on the decorator:

> *"The `@overload` decorator allows describing functions and methods that support multiple
> different combinations of argument types. A series of `@overload`-decorated definitions
> must be followed by exactly one non-`@overload`-decorated definition (for the same
> function/method)."*

> *"`@overload`-decorated definitions are for the benefit of the type checker only, since
> they will be overwritten by the non-`@overload`-decorated definition. The
> non-`@overload`-decorated definition, meanwhile, will be used at runtime but should be
> ignored by a type checker. At runtime, calling an `@overload`-decorated function directly
> will raise `NotImplementedError`."*

## Writing your own

The pattern generalises to any function whose failure contract depends on an argument:

```python
from typing import TypeVar, overload

T = TypeVar("T")


@overload
def get_setting(name: str) -> str: ...
@overload
def get_setting(name: str, default: T) -> str | T: ...
def get_setting(name: str, default: object = _MISSING) -> object:
    """Return the setting.

    Raises:
        KeyError: the setting is unset and no default was supplied.
    """
    try:
        return _CONFIG[name]
    except KeyError:
        if default is _MISSING:
            raise
        return default
```

Three details, each of which is a mistake if you get it wrong:

- **The two overloads express two different failure channels.** `get_setting("port")` raises;
  `get_setting("port", 8080)` cannot. That is the `dict[k]`-versus-`dict.get(k, d)` split
  from [05l](03-versioning-the-failure-channel.md), made visible to the checker rather than
  only to a reader of the docstring.
- **The implementation signature is not the contract.** It is deliberately loose so it can
  satisfy both overloads; callers never see it. The docs say it *"will be used at runtime but
  should be ignored by a type checker."*
- **The sentinel is what makes "no default" distinguishable** from `default=None`, which is
  [05o](06-the-sentinel-object.md) — and typing that sentinel is
  [05p](07-typing-the-sentinel.md).

## Gotchas

**★ Symptom: `counts.get(word, 0)` is typed `int | None` and every caller has to narrow a
`None` that cannot happen.** Cause: the function was written with one signature
(`default=None -> V | None`) so the type system cannot see that a supplied default removes
the `None`. Fix: overloads, ordered most-specific first, exactly as typeshed does for
`dict.get`.

```python
@overload
def get(self, key: _KT, default: None = None, /) -> _VT | None: ...
@overload
def get(self, key: _KT, default: _VT, /) -> _VT: ...
@overload
def get(self, key: _KT, default: _T, /) -> _VT | _T: ...
```

**★ Symptom: an overloaded function raises `NotImplementedError` at runtime.** Cause: the
non-`@overload`-decorated implementation was omitted or shadowed, so the last
`@overload`-decorated stub is what the name is bound to — the docs state that *"calling an
`@overload`-decorated function directly will raise `NotImplementedError`"*. Fix: exactly one
undecorated definition, last, containing the real body.

```python
@overload
def get_setting(name: str) -> str: ...
@overload
def get_setting(name: str, default: T) -> str | T: ...
def get_setting(name: str, default: object = _MISSING) -> object:   # the real one
    ...
```

**★ Symptom: `d.get(k)` returns the wrong type because a broad overload was listed first.**
Cause: overloads are matched in order, so a `default: _T` form placed above the
`default: None = None` form matches the no-default call and wins. Fix: order most specific
first — that is why typeshed's `None` overload leads.

**Symptom: overloads pass mypy and the implementation is wrong.** Cause: by default a checker
verifies each overload against the implementation signature loosely, and a deliberately loose
implementation (`default: object = _MISSING`) accepts almost anything — so a body that
returns the wrong type on one path can slip through. Fix: keep the implementation body small
and test both call shapes, since the overloads are documentation the checker enforces only at
call sites.

```python
def test_get_setting_raises_without_default():
    with pytest.raises(KeyError):
        get_setting("nope")


def test_get_setting_returns_default():
    assert get_setting("nope", 8080) == 8080
```

## Interview questions

**★ Why does typeshed give `dict.get` three overloads instead of one signature?**
Because the failure contract depends on an argument rather than on the function. `d.get(k)`
can return `None`, `d.get(k, 0)` cannot, and `d.get(k, "n/a")` returns a union that includes
the default's own type — three different promises about the same runtime call. With one
signature the honest annotation would be `-> _VT | None`, which would force a narrowing at
every call site including `counts.get(word, 0)` where the caller has already handled the miss
by supplying a default. So the overloads are exactly the mechanism that stops the
`None`-returning design from taxing callers who opted out of it. The ordering matters too:
the `default: None = None` overload comes first because overloads match top-down and the
broadest one would otherwise swallow the others.

**Why is the implementation signature of an overloaded function not part of its contract?**
Because it exists only to be broad enough to satisfy every overload, and the documentation
says checkers should ignore it: *"The non-`@overload`-decorated definition, meanwhile, will be
used at runtime but should be ignored by a type checker."* Callers see the overloads; the
implementation is an internal detail that usually takes `object` or a union simply so both
call shapes are legal. Two consequences follow. The implementation's looseness is not a hole
in your API, because no call site is checked against it — but it *is* a hole in your own
testing, since the checker is not verifying your body nearly as strictly as it verifies your
callers, so both call shapes want a test. And exactly one undecorated definition must exist
and come last, or the name stays bound to a stub and calling it raises `NotImplementedError`.

**When would you reach for `@overload` in ordinary application code, rather than in a stub?**
Whenever an argument changes the return type in a way a single annotation would have to
over-approximate. The commonest three: a `default` parameter that removes `None` from the
return, exactly like `dict.get`; a boolean flag that changes the shape of the result, such as
`fetch(..., as_dict=True) -> dict[str, Any]` versus `-> Row`; and a function that returns a
scalar for a scalar input and a list for a list input. In each case the alternative is a union
return that forces every caller to narrow something the argument already determined — which is
the same LBYL tax the whole chapter has been costing. The counter-indication is a function
where the overloads outnumber the useful call shapes: three overloads to describe two real
usages is a sign the function should be two functions.

---

← Prev: [Typing the sentinel](07-typing-the-sentinel.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Union returns](09-union-returns-and-exhaustiveness.md)
