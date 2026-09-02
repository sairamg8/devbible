---
title: "Five lint rules cover the mutable-default family, and the only one people configure wrongly is the one a web framework deliberately violates"
sidebar_label: "6d · Linting the whole family"
sidebar_position: 82
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Ruff rule pages
> [B006 mutable-argument-default](https://docs.astral.sh/ruff/rules/mutable-argument-default/),
> [B008 function-call-in-default-argument](https://docs.astral.sh/ruff/rules/function-call-in-default-argument/),
> [B039 mutable-contextvar-default](https://docs.astral.sh/ruff/rules/mutable-contextvar-default/),
> [RUF008 mutable-dataclass-default](https://docs.astral.sh/ruff/rules/mutable-dataclass-default/),
> [RUF012 mutable-class-default](https://docs.astral.sh/ruff/rules/mutable-class-default/),
> and the Python 3.14 [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html#mutable-default-values)
> and [`contextvars`](https://docs.python.org/3.14/library/contextvars.html) docs.
> Target: **CPython 3.14**, Ruff current.

**Every variant of "one object created once and shared by everything that takes
the default" has a lint rule, and turning all five on costs nothing. The one
piece of real configuration this needs is an allow-list for the frameworks —
FastAPI, Typer — whose entire calling convention is a function call in a default
argument; get that wrong with a blanket suppression and you also switch off the
rule that catches `created=datetime.now()`.**

## The linters, and which gap each one covers

| Rule | Catches |
|---|---|
| **B006** `mutable-argument-default` | `def f(x=[])`, `{}`, `set()` in any function signature |
| **B008** `function-call-in-default-argument` | `def f(x=uuid4())`, `datetime.now()` — the frozen-value form |
| **B039** `mutable-contextvar-default` | `ContextVar("x", default=[])` — same bug, one process-wide object |
| **RUF008** `mutable-dataclass-default` | a dataclass field defaulted to `[]`/`{}`/`set()` |
| **RUF012** `mutable-class-default` | a plain class attribute defaulted to `[]`/`{}`/`set()` |
| pylint **W0102** `dangerous-default-value` | the B006 case, for pylint users |

B006's own statement of the problem matches the docs exactly: *"Function
defaults are evaluated once at definition time, creating a shared mutable
object across all function calls."* RUF012's advice is the same advice this
topic gives: *"initialize such variables in `__init__`"*, or mark them
`typing.ClassVar` if the sharing is deliberate, or use immutable types.

**B008 has a known false-positive class**: FastAPI's `Depends()`, `Query()`,
`Body()` and Typer's `Option()` are function calls in defaults *on purpose*.
Ruff supports an allow-list — `flake8-bugbear.extend-immutable-calls` — rather
than a blanket `noqa`, and configuring it is the right move because a blanket
suppression also hides the real `datetime.now()` bugs.

## Other libraries, at recognition level

`attrs` has `attr.Factory(list)` and `field(factory=list)`, the same design.
Pydantic v2 uses `Field(default_factory=list)` and additionally offers
`model_config` settings around validating and copying defaults; I have not
verified the exact copy-on-default semantics of the current release against
primary documentation, so treat "pydantic copies mutable defaults for you" as
something to check in the version you are on rather than something to rely on.
The safe habit is identical everywhere: **pass a factory, never a value.**

## `ContextVar` deserves its own mention

B039 exists because `ContextVar("state", default=[])` looks like per-context
state and is not:

```python
_items = contextvars.ContextVar("items", default=[])   # ONE list, forever

_items.get().append(x)      # every context appends to the same list
```

The default is a single object created when the `ContextVar` was constructed,
shared by every context that never called `set()`. In an async web application
that is a cross-request leak with the same shape as the mutable default
argument, and it is harder to spot because the whole point of `ContextVar` is
that it looks isolated. Use `default=None` and `set()` a fresh object at the
start of each context — typically in middleware.

## Configuration, concretely

```toml
# pyproject.toml
[tool.ruff.lint]
select = ["B", "RUF"]        # bugbear + ruff-specific; B006/B008/B039/RUF008/RUF012

[tool.ruff.lint.flake8-bugbear]
extend-immutable-calls = [
    "fastapi.Depends",
    "fastapi.Query",
    "fastapi.Path",
    "fastapi.Body",
    "fastapi.Header",
    "typer.Option",
    "typer.Argument",
]
```

The allow-list is a statement that *these particular calls* produce objects that
are safe to share, which is true — they are dependency markers, not mutable
state. Everything else keeps failing, which is the point.

## What the linters cannot see

- A default that is a **hashable mutable** object — the dataclass gap, and no
  linter knows your class is mutable.
- A default read from a module-level name: `def f(opts=DEFAULT_OPTS)` is a
  name, not a literal or a call, so B006 and B008 both pass. It is still one
  shared dict.
- A **factory that returns a shared object**:
  `field(default_factory=lambda: SHARED)` is syntactically a factory and
  semantically a shared default.
- Mutation of an *argument* rather than a default — nothing in this rule family
  addresses [function arguments](05-function-arguments.md).

Which is the general lesson about this whole topic: the linters cover the
literal syntactic shapes, and the shapes are the easy half.

## Gotchas

### `# noqa: B008` sprinkled across a FastAPI codebase
**Symptom.** A genuine `default=datetime.now()` bug ships because the rule is
suppressed everywhere.
**Cause.** A framework's intentional call-in-default idiom was silenced with a
blanket suppression.
**Fix.** Configure `lint.flake8-bugbear.extend-immutable-calls` with
`fastapi.Depends`, `fastapi.Query` and friends, and let the rule keep
working elsewhere.

### `ClassVar` used to silence RUF012 without thinking
**Symptom.** The lint goes quiet and every instance still shares one list.
**Cause.** `ClassVar` tells the checker the attribute is class-level and shared
*on purpose* — it is an annotation of intent, not a fix.
**Fix.** Use `ClassVar` only when the sharing is genuinely intended (a registry,
a constant lookup table, and ideally an immutable one). Otherwise initialise in
`__init__` or use `default_factory`.

### `select = ["B"]` without `RUF`
**Symptom.** Function defaults are clean and dataclass fields are not.
**Cause.** B006/B008/B039 come from flake8-bugbear; the dataclass and
class-attribute rules are RUF008 and RUF012 in ruff's own ruleset.
**Fix.** Select both. They are the same bug in three syntactic positions.

### `ContextVar(..., default=[])` in async middleware
**Symptom.** Data from one request appears in another, intermittently, under
concurrency.
**Cause.** The default object is created once and shared by every context that
has not called `set()`.
**Fix.** `default=None`, and `var.set([])` at the start of each request. B039
flags the literal form.

### A linter clean-up that changed behaviour
**Symptom.** Fixing B006 mechanically — swapping `x=[]` for `x=None` without
adding the `if x is None` branch — turns a silent accumulation bug into a
`AttributeError: 'NoneType' object has no attribute 'append'`.
**Cause.** The autofix changes the signature; the body still assumes a list.
**Fix.** Review every B006 fix by hand. The exception is better than the leak,
but it is not the finished repair.

## Interview questions

**Q: Which ruff rules cover this family?**
B006 for mutable function-argument defaults, B008 for function calls in
defaults, B039 for mutable `ContextVar` defaults, RUF008 for mutable dataclass
field defaults and RUF012 for mutable class attributes; pylint's equivalent of
B006 is W0102 `dangerous-default-value`.


**Q: You get B008 on `def endpoint(db = Depends(get_db))`. What do you do?**
Not a blanket `noqa`. Add the framework's constructors to ruff's
`flake8-bugbear.extend-immutable-calls` allow-list, so the intentional idiom is
accepted and the rule keeps catching real cases such as
`def f(created=datetime.now())` elsewhere in the codebase.


**★ Q: What is wrong with `ContextVar("items", default=[])`?**
The default list is created once, when the `ContextVar` is constructed, and
every context that never calls `set()` gets that same object. It looks like
per-context state and is process-wide shared state — a cross-request leak in an
async server. Ruff's B039 flags it; the fix is `default=None` plus an explicit
`set()` per context.

**Q: Name a mutable-default bug no linter will catch.**
`def f(opts=DEFAULT_OPTS)` where `DEFAULT_OPTS` is a module-level dict — the
default is a name, not a literal, so B006 sees nothing. Likewise a dataclass
field defaulted to an instance of a hashable user-defined class, and
`field(default_factory=lambda: SHARED)`, which is a factory in form and a
shared default in substance.

**Q: Is `typing.ClassVar` a fix for RUF012?**
No — it is a declaration that the attribute is deliberately class-level and
shared, which silences the rule by asserting intent. It is right for a
constant registry or lookup table (ideally an immutable one) and wrong as a way
to make the warning go away on state that should have been per-instance. For
per-instance state, initialise in `__init__` or use `field(default_factory=…)`.

**Q: Your autofixer rewrites `def f(x=[])` to `def f(x=None)`. Are you done?**
No. The body still expects a list, so the first call that omits the argument
now raises `AttributeError` instead of silently accumulating. The complete fix
adds `if x is None: x = []` — an identity test, not `x = x or []`, which would
also replace a legitimately passed empty list.

---

← Prev: [Dataclass defaults and linting](06c-dataclass-defaults-and-linting.md) · Index: [Assignment and aliasing](README.md) · Next → [Class-attribute aliasing](07-class-attribute-aliasing.md)
