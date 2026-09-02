---
title: "A default argument is one object created once when `def` runs, so a mutable default is shared state hiding inside a function signature"
sidebar_label: "6 · The mutable default argument"
sidebar_position: 79
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [§8.7 Function definitions](https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions),
> the [Programming FAQ — "Why are default values shared between objects?"](https://docs.python.org/3.14/faq/programming.html#why-are-default-values-shared-between-objects),
> [`inspect`](https://docs.python.org/3.14/library/inspect.html#inspect.signature),
> and [the data model's `__defaults__`](https://docs.python.org/3.14/reference/datamodel.html#the-standard-type-hierarchy).
> Target: **CPython 3.14**.

**`def f(items=[])` does not mean "if no argument is given, make an empty
list". It means "evaluate `[]` right now, at definition time, store the
resulting list on the function object, and hand that same list to every call
that omits the argument". The list is created once for the lifetime of the
process. Everything about this bug follows from `def` being an executable
statement whose defaults are ordinary expressions, evaluated once, at the
moment the statement runs.**

## The reference states it and shows the fix

> *"Default parameter values are evaluated from left to right when the function
> definition is executed. This means that the expression is evaluated once,
> when the function is defined, and that the same 'pre-computed' value is used
> for each call. This is especially important to understand when a default
> parameter value is a mutable object, such as a list or a dictionary: if the
> function modifies the object (e.g. by appending an item to a list), the
> default parameter value is in effect modified. This is generally not what was
> intended. A way around this is to use `None` as the default, and explicitly
> test for it in the body of the function, for example:"*
>
> ```python
> def whats_on_the_telly(penguin=None):
>     if penguin is None:
>         penguin = []
>     penguin.append("property of the zoo")
>     return penguin
> ```

The FAQ says the same thing from the other direction:

> *"It is often expected that a function call creates new objects for default
> values. This is not what happens. Default values are created exactly once,
> when the function is defined. If that object is changed, like the dictionary
> in this example, subsequent calls to the function will refer to this changed
> object."*

## The gate question

```python
def f(items=[]):
    items.append(1)
    return items
```

- First call: the default list is `[]`, one `1` is appended, `[1]` is returned.
- Second call: the *same* list already holds `[1]`, so it becomes `[1, 1]`.
- **Third call: `[1, 1, 1]`.**

And every returned value is the same object, so the caller who kept the result
of the first call now sees three items in it. `f() is f()` is true.

The FAQ's version of the same thing, with a dict: *"The first time you call
this function, `mydict` contains a single item. The second time, `mydict`
contains two items because when `foo()` begins executing, `mydict` starts out
with an item already in it."*

## Where the object lives, and how to see it

The default is stored on the function object, and you can look at it directly:

```python
def f(items=[]):
    items.append(1)
    return items

f.__defaults__            # a tuple of the positional defaults — holds THE list
f.__defaults__[0] is f()  # True: the returned list is the stored default
f.__kwdefaults__          # a dict of keyword-only defaults, or None
inspect.signature(f).parameters["items"].default   # the same object again
```

`__defaults__` is writable, which is occasionally how a test resets the damage —
`f.__defaults__ = ([],)` — and is never a design you should ship. It is,
however, the fastest way to *prove* the diagnosis to a colleague who does not
believe you: print `id(f.__defaults__[0])` and `id(result)`.

## Why the language does it this way

Because `def` is a statement that runs, not a declaration the compiler
consumes. When Python executes `def f(items=[]):` it evaluates the default
expressions, builds a function object, attaches the defaults to it, and binds
the name. Evaluating defaults per call would require storing the *expression*
and re-running it every call — a different, slower and more surprising model in
which `def f(x=expensive())` calls `expensive()` on every invocation, and in
which the default could see a mutated global.

The consequence generalises past mutability. **Any** default expression is
frozen at import time:

```python
def log(ts=datetime.datetime.now()):     # the import time, forever
    ...

def read(path=CONFIG["path"]):           # the value CONFIG had at import
    ...

def f(n=len(SOME_LIST)):                 # the length at import
    ...
```

None of those involve a mutable default and all three are the same bug: the
expression ran once. `ts=None` plus `ts = ts or datetime.datetime.now()` inside
is the fix in every case.

## The trap has a mirror image: the default that is never mutated

Not every shared default is a bug, and the reason is worth stating explicitly
because it tells you which defaults to worry about. Sharing is only observable
if something can change the object. `def f(x=0)`, `def f(s="")`,
`def f(t=())`, `def f(fs=frozenset())` all share one object across every call
and no program can detect it. The defaults that need attention are exactly the
ones that are mutable (`[]`, `{}`, `set()`, a `Counter`, a class instance) or
whose *value* was computed at import time.

## Gotchas

### `f()` returns more each time it is called
**Symptom.** A function that "returns a new list" returns a longer one on every
call, and callers who kept earlier results see them grow too.
**Cause.** The default list was created once at `def` time and is mutated by
every call that omits the argument.
**Fix.** `None` sentinel, per the reference's own example.

### `def f(ts=datetime.now())` timestamps everything with the import time
**Symptom.** Every record carries the same timestamp, which is roughly when the
process started.
**Cause.** Same mechanism, no mutation involved: the default expression was
evaluated once when the `def` statement ran.
**Fix.** `ts=None` and `if ts is None: ts = datetime.now()` in the body.

### `uuid4()` as a default
**Symptom.** Every generated record shares one id.
**Cause.** As above.
**Fix.** As above, or `field(default_factory=uuid.uuid4)` in a dataclass.

### `__defaults__` "reset" as a fix
**Symptom.** A test suite passes because a fixture does `f.__defaults__ = ([],)`
between tests; production still leaks.
**Cause.** The reset patches the symptom on the function object rather than
removing the shared default from the signature.
**Fix.** Change the signature to `None`. Keep the `__defaults__` trick for
*diagnosis* only — printing `id(f.__defaults__[0])` next to `id(result)` is the
fastest way to prove the sharing to someone who does not believe it.

### A default shared by two functions
**Symptom.** Two unrelated functions accumulate each other's data.
**Cause.** `SHARED = []` at module level used as the default of both:
`def a(x=SHARED)` and `def b(x=SHARED)` store references to one object on two
function objects.
**Fix.** As always, `None`. A module-level mutable used as a default is the
same bug with a wider blast radius.

## Interview questions

**★ Q: `def f(items=[]): items.append(1); return items` — what does the third
call return?**
`[1, 1, 1]`. The default list is created once when the `def` statement executes
and is reused by every call that omits the argument, so the appends accumulate.
Every call also returns *the same list object*, so a caller holding the first
result sees it grow.

**★ Q: Why does Python evaluate defaults at definition time?**
Because `def` is an executable statement: running it evaluates the default
expressions, builds a function object and attaches the results to it. The
alternative — storing the expression and re-evaluating it per call — would make
every default a hidden function call, would change the cost model, and would
let defaults observe mutated globals. The current rule is simple, fast and
consistent with the rest of the language; it is only surprising if you expected
a declaration rather than a statement.

**Q: How would you prove that the default object is shared?**
`f.__defaults__` holds the actual default objects; compare identities:
`f.__defaults__[0] is f()` is true for the buggy function, and
`inspect.signature(f).parameters["items"].default` shows the same object. Two
successive calls returning objects with the same `id()` is the other tell.

**Q: Does the problem apply to immutable defaults?**
The *sharing* applies to every default, but it is unobservable when the object
is immutable — you cannot tell one shared `0` from many. The observable form of
the trap without mutability is a default whose *value* was computed at import
time: `datetime.now()`, `uuid4()`, `os.environ["X"]`, `len(SOME_LIST)`.

**Q: When exactly is the default expression evaluated?**
When the `def` statement executes — which for a module-level function is at
import time, for a nested function is each time the enclosing function runs, and
for a method is when the class body executes. The reference: *"Default parameter
values are evaluated from left to right when the function definition is
executed."* Left to right matters if one default's expression has a side effect
another depends on, which is a good reason to have none.

**Q: A decorator wraps the function. Does that change the defaults?**
Not by itself — the defaults belong to the original function object, and
`functools.wraps` copies `__wrapped__`, `__name__`, `__doc__` and friends but
the wrapper has its own (usually `*args, **kwargs`) signature. That is why
`inspect.signature` follows `__wrapped__` to report the real defaults. A shared
mutable default remains shared no matter how many decorators sit on top.

**Q: Does a nested function get a fresh default each time the outer function
runs?**
Yes, because the `def` statement itself runs again, evaluating the default
expression again and building a new function object. That is the one case where
`def f(items=[])` is *not* process-lifetime shared state — it is shared only
across calls to that particular inner function object. It is still a bad idea,
because the inner function is often returned or registered and then lives a
long time.

---

← Prev: [Saying "don't touch mine"](05b-dont-touch-mine.md) · Index: [Assignment and aliasing](README.md) · Next → [Fixing mutable defaults](06b-fixing-mutable-defaults.md)
