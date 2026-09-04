---
title: "X | None is not a gentler alternative to raising — it is LBYL by decree, a narrowing if compelled by the type checker in every one of your callers, including the ninety who knew perfectly well the value was there"
sidebar_label: "05m · The bill every caller pays"
sidebar_position: 140.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Python 3.14 documentation —
> [`typing.Optional`](https://docs.python.org/3.14/library/typing.html#typing.Optional)
> (the *"not the same concept as an optional argument"* note, quoted below),
> [`dict.get`](https://docs.python.org/3.14/library/stdtypes.html#dict.get)
> (*"never raises a `KeyError`"*) — and [PEP 604](https://peps.python.org/pep-0604/)
> (*"overloading the `|` operator on types"*).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**The three chunks before this one covered the channel that says nothing. This one covers
the channel that says everything, and charges for it. `X | None` is a type, so a checker
refuses every operation `None` does not support until somebody writes a condition — which
means one line in your signature becomes a mandatory `if` in every call site in the
codebase. That is not a softer option than raising; it is the LBYL this entire topic has
spent seven chunks measuring, imposed by decree on callers who never got a vote. The
question is therefore not "is `None` nicer than an exception" but "how many meanings will
this `None` carry, and does the caller genuinely have a decision to make" — and `dict.get`
passes that test while most `find_user` functions do not.**

## The bill, itemised

```python
def find_user(user_id: int) -> User | None: ...

def greet(user_id: int) -> str:
    user = find_user(user_id)
    return f"Hello {user.name}"      # the checker rejects this: `None` has no `.name`
```

The fix is a condition, and it is the only shape available:

```python
def greet(user_id: int) -> str:
    user = find_user(user_id)
    if user is None:                 # narrows: below this, `user` is a User
        return "Hello stranger"
    return f"Hello {user.name}"
```

`X | None` is spelled that way since Python 3.10 — PEP 604 proposes *"overloading the `|`
operator on types to allow writing `Union[X, Y]` as `X | Y`"* — and `typing.Optional` is
documented as its equivalent: *"`Optional[X]` is equivalent to `X | None` (or
`Union[X, None]`)."*

Which constructs actually narrow is [07g](07g-provability-and-the-order-to-decide.md)'s
subject. What belongs here is the arithmetic, and it is stark:

| Design | What the author writes | What each of N callers writes | Who is forced |
|---|---|---|---|
| `-> User \| None` | nothing extra | `if user is None: ...` | **all N**, by the checker |
| `-> User`, raises | a `raise` and a `Raises:` entry | nothing, or one `try` where it matters | only the callers who care |

**Returning `None` does not merely permit a check at the call site — it compels one**, in
the ninety call sites where the caller knew the user existed as well as the ten where it
was genuinely in doubt. Raising leaves the decision where the knowledge is: a caller who
knows the id came from a foreign key does nothing, and the one handling user input writes a
`try`. That is why "just return `None`, it is simpler" is a claim about the author's file
rather than about the codebase.

⚠️ **`Optional` does not mean "this argument is optional", and the docs say so in their own
note.** This is the single most common misreading of the annotation:

> *"Note that this is not the same concept as an optional argument, which is one that has a
> default. An optional argument with a default does not require the `Optional` qualifier on
> its type annotation just because it is optional."*

Their example is `def foo(arg: int = 0) -> None:` — an optional argument whose type is
plainly `int`. The `|`-form removes the ambiguity entirely, which is one good reason to
prefer it in new code.

## Why `dict.get`'s `None` is honest and `find_user`'s usually is not

`dict.get` is the canonical `None`-returning API and nobody complains about it. The reason
is not that `dict` is a builtin. Read what the documentation actually promises:

> *"Return the value for key if key is in the dictionary, else `default`. If `default` is
> not given, it defaults to `None`, so that this method never raises a `KeyError`."*

Three properties make that contract exact:

1. **There is exactly one reason to get the default: the key was not present.** `dict.get`
   cannot time out, cannot be denied by a permission system, cannot decide the row is
   soft-deleted. Absence is the only failure available to it.
2. **The caller chose the sentinel.** `d.get(k, 0)` returns `0` on a miss; the `None` is a
   *default default*, not a fixed part of the contract — and typeshed encodes that choice
   in the type system with `@overload`, which is
   [05q](05q-overloads.md).
3. **The caller already knows whether the miss was expected**, because the caller supplied
   the key. `get` is what you reach for when you have decided a miss is ordinary; when it is
   not, `d[k]` is right there raising `KeyError` with the key in the message.

Now `find_user(user_id) -> User | None`. What does `None` mean?

- there is no such user;
- there is, but they are soft-deleted;
- there is, but this caller is not permitted to see them;
- the read replica is lagging and has not got the row yet;
- the connection pool was exhausted and the helper swallowed the error to "be safe".

**`None` is one token and those are five different situations, three of which are not
absence at all.** A caller who receives it can distinguish exactly nothing, and the last two
are the ones that hurt: an infrastructure failure has been laundered into a "not found",
which surfaces to a user as a 404 for a record that exists. The type checker is perfectly
satisfied — the caller narrowed, the narrowing was correct, the answer was wrong.

The repair is to make each situation the shape it actually is:

```python
class UserForbidden(PermissionError):
    def __init__(self, user_id: int, viewer_id: int) -> None:
        super().__init__(f"viewer {viewer_id} may not read user {user_id}")
        self.user_id = user_id
        self.viewer_id = viewer_id


def find_user(user_id: int, *, viewer_id: int) -> User | None:
    """Return the user, or None if no such user exists.

    Raises:
        UserForbidden: the viewer may not read this user.
        OperationalError: the database was unreachable. Deliberately not caught —
            a failed lookup is not an absent user.
    """
    row = db.fetchone("SELECT * FROM users WHERE id = ?", (user_id,))   # may raise
    if row is None:
        return None
    user = User.from_row(row)
    if not viewer_can_read(viewer_id, user):
        raise UserForbidden(user_id, viewer_id)
    return user
```

`None` now has exactly one meaning, the way `dict.get`'s does. Note what was *not* done: the
database error is not caught. A `try/except OperationalError: return None` inside a finder is
the single line that converts an outage into a wrong answer, and it is attractive precisely
because it makes the signature look tidy. Whose exception that is and where it should be
translated is [06f](06f-whose-exception-is-it.md).

**The general test is short:** a `None` return is honest when the function has exactly one
way to fail and the caller can act on knowing that. When there are several ways to fail,
`None` is a lossy encoding of information you had and discarded — and unlike an exception, it
cannot carry the `user_id`, the viewer, or the reason.

## Gotchas

**★ Symptom: a reviewer says the parameter is optional so it should be annotated
`Optional[int]`, and the annotation is wrong.** Cause: `Optional` names the *type*, not the
argument's optionality — the docs' own note says *"this is not the same concept as an
optional argument, which is one that has a default."* Fix: annotate what the parameter can
actually hold, and use the `|`-form so the question does not arise.

```python
def paginate(limit: int = 50) -> Page: ...            # optional argument, type is int
def paginate(limit: int | None = None) -> Page: ...   # None is genuinely accepted
```

**★ Symptom: mypy is happy with `if user:` and the code skips a real user.** Cause: plain
truthiness is a documented narrowing construct, so the checker accepts it — but it narrows
away every falsy value, not just `None`, and a `Money(0)`, an empty `list`, or a model whose
`__len__` returns 0 all take the wrong branch. Fix: test the sentinel you actually mean.

```python
if user is None:              # exactly one value takes this branch
    return "Hello stranger"
```

**★ Symptom: a "not found" page is served for a record that exists, and only during
incidents.** Cause: a finder catching a connection or timeout error and returning `None`, so
an infrastructure failure is indistinguishable from absence. Fix: let the operational error
propagate; `None` must mean absence and only absence.

```python
def find_user(user_id: int) -> User | None:
    row = db.fetchone("SELECT * FROM users WHERE id = ?", (user_id,))
    return None if row is None else User.from_row(row)   # no except here, deliberately
```

**Symptom: a dependency is untyped and none of this happens at all.** Cause: an unannotated
third-party function is inferred as returning `Any`, and `Any` supports every operation — so
`client.fetch(id).name` type-checks whether or not `fetch` can return `None`. Fix: wrap the
dependency at one boundary and give the wrapper a real signature, so the `Any` exists on
exactly one line.

```python
def fetch_user(client, user_id: int) -> User | None:
    raw = client.fetch(user_id)          # Any lives and dies on this line
    return None if raw is None else User.from_api(raw)
```

**Symptom: `user.profile.address.city` produces an `AttributeError` three levels down and
the traceback names none of the finders.** Cause: `None` propagates — each `T | None` in a
chain is a branch somebody has to write, and Python has no `?.` operator to make skipping it
cheap. Fix: resolve the union once, at the top, and let everything below be unconditional.

```python
user = find_user(uid)
if user is None:
    raise UserNotFound(uid)          # one narrowing, then a certain value
city = user.profile.address.city
```

**Symptom: a `None` sorts into the middle of a report, or a `sum` over a column raises
`TypeError`.** Cause: `None` has no ordering and no arithmetic, so one absent value poisons
an aggregate built from a `T | None` column. Fix: decide explicitly where absences go rather
than letting `or 0` rewrite legitimate zeroes.

```python
rows.sort(key=lambda r: (r.score is None, r.score))   # Nones last, values untouched
total = sum(r.score for r in rows if r.score is not None)
```

## Interview questions

**★ Everyone accepts `dict.get` returning `None`, and everyone argues about `find_user`
returning `None`. What is the difference?**
The number of things `None` can mean. `dict.get` has exactly one way to fail — the key is not
present — and the documentation says so precisely: *"Return the value for key if key is in the
dictionary, else `default`."* It cannot time out, cannot be forbidden, cannot be stale.
`find_user` can fail because the row does not exist, because it is soft-deleted, because this
viewer may not see it, because a replica is lagging, or because the database was unreachable
and somebody caught the error to keep the signature tidy. `None` encodes all five as one
token and the caller can distinguish none of them — so a genuine outage is served as a 404
with the type checker entirely satisfied. Keep `None` for functions with one failure mode, and
give each of the others an exception carrying the ids and the reason.

**★ Why does `if user:` satisfy the checker and still be a bug?**
Because truthiness is a legitimate narrowing construct and the checker is right about what it
was asked: after `if user:` the value is not `None`, so the attribute access is safe. The bug
is semantic. Truthiness narrows away *every* falsy value, so if the type is `Money | None`
where `Money(0)` is falsy, or `list[str] | None` where `[]` is falsy, the branch you wrote for
the missing case also swallows a perfectly real one. `is None` tests exactly the one value
that means absence, which is why it is the form to write even though the shorter one passes.
It is the empty-versus-missing distinction from [05h](05h-aggregating-failures.md) arriving
inside a narrowing.

**★ Is returning `None` the "lighter" option compared to raising?**
Only for the author. `X | None` is a type, and a checker will refuse every operation `None`
does not support until a condition narrows it, so the cost lands as a mandatory `if` in every
call site — including all the ones where the caller had no doubt about the value. Raising costs
the author a `raise` and a `Raises:` entry, and costs a caller nothing unless that caller
actually wants to handle the failure. So the two designs distribute the same work differently:
`None` collects an LBYL tax from everyone, and an exception charges only the callers who opted
in. Both are correct; what is not correct is choosing between them by which one reads better in
the file you happen to be editing.

**How do you decide the contract for a new lookup function, in order?**
Ask how many ways it can fail. One way, and the caller genuinely branches: return `X | None`,
and make sure every other failure raises rather than folding into the sentinel. One way, and
the caller almost never branches because absence means their assumption was wrong: raise, and
name the function `get_x`. Several ways: raise distinct types carrying their data, because a
single sentinel cannot say which. Result is a collection: return the collection, empty when
there is nothing. And whichever you pick, remember the count on the other side — the choice is
made once in your file and paid at every call site in the codebase, which is why it is worth
five minutes rather than a coin toss.

---

← Prev: [Versioning the failure channel](05l-versioning-the-failure-channel.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Choosing a sentinel](05n-choosing-a-sentinel.md)
