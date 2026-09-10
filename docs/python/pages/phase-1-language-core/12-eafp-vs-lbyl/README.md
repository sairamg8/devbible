---
title: "EAFP vs LBYL: the question is never which one is Pythonic — it is whether your check and your action are one operation or two, and what the gap between them is worth"
sidebar_label: "12 · EAFP vs LBYL"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Glossary: `EAFP`, `LBYL`, `duck-typing`](https://docs.python.org/3.14/glossary.html),
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access),
> [`os.path`](https://docs.python.org/3.14/library/os.path.html),
> [`pathlib`](https://docs.python.org/3.14/library/pathlib.html),
> [`open()`](https://docs.python.org/3.14/library/functions.html#open),
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict),
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> [`collections`](https://docs.python.org/3.14/library/collections.html)
> (`defaultdict`, `Counter`, `UserDict`),
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html),
> [`hasattr`](https://docs.python.org/3.14/library/functions.html#hasattr) /
> [`getattr`](https://docs.python.org/3.14/library/functions.html#getattr) /
> [`iter`](https://docs.python.org/3.14/library/functions.html#iter) /
> [`isinstance`](https://docs.python.org/3.14/library/functions.html#isinstance),
> [`typing.runtime_checkable`](https://docs.python.org/3.14/library/typing.html#typing.runtime_checkable),
> [`inspect.getattr_static`](https://docs.python.org/3.14/library/inspect.html#inspect.getattr_static),
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html),
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement),
> [The `assert` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-assert-statement),
> [`queue`](https://docs.python.org/3.14/library/queue.html),
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html#exceptions),
> [`threading`](https://docs.python.org/3.14/library/threading.html),
> [Python support for free threading — Thread safety](https://docs.python.org/3.14/howto/free-threading-python.html#thread-safety),
> [`timeit`](https://docs.python.org/3.14/library/timeit.html),
> [What's New in Python 3.11](https://docs.python.org/3.14/whatsnew/3.11.html),
> CPython's [*Zero-Cost Exception Handling*](https://github.com/python/cpython/blob/main/InternalDocs/exception_handling.md),
> [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/),
> and [mypy — Type narrowing](https://mypy.readthedocs.io/en/stable/type_narrowing.html).
> Target: **Python 3.14**. Documentation-validated; **no timings**.

**Both names are in the glossary, and the glossary defines them by keyword count —
EAFP is *"characterized by the presence of many `try` and `except` statements"*, LBYL
by *"many `if` statements"*. That is the least useful thing about them, and counting
keywords is how the labels get misapplied in both directions: a `try` spanning four
statements reads as EAFP while asserting nothing, and a domain-rule guard reads as LBYL
while being simply correct. The distinction that decides real code is structural.
**LBYL performs two operations where EAFP performs one**, so LBYL has a gap between the
look and the leap — and everything that goes wrong with it lives in that gap. Everything
that goes wrong with EAFP lives in the opposite place: a handler wider than the one
assumption it was supposed to state.**

Three parts of this topic are more concrete than the argument usually gets. The
`os.access` documentation does not merely prefer EAFP — it calls the check-then-open
pattern a *"security hole"* in those words. `hasattr` is not a look at all; the reference
defines it as calling `getattr` and seeing whether `AttributeError` comes out, so the
"check" runs your property. And the speed argument has exactly two published figures,
both from **3.11**, neither of which compares a `try` against an `if` — so the honest
version of that argument is fought in operation counts, not seconds.

The seven chapters answer seven different questions. **01** — what the two names
actually claim, and why Python leans one way. **02** — when the gap between the look and
the leap is a bug rather than a theory. **03** — how the container APIs already decided
this for you. **04** — what a check on an *object's shape* really tests. **05** — where
LBYL is not a fallback but the only correct shape. **06** — what makes a handler too
wide, given that EAFP is a claim about one assumption. **07** — what this choice actually
costs, and in what order to decide.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The two names](01-the-two-names.md)** | Both glossary entries verbatim, including the mild editorial side the docs take; the same operation written both ways; that LBYL is two operations and EAFP is one; the reframe into three questions that contain no style opinion |
| 1b | **[Why Python leans EAFP](01b-why-python-leans-eafp.md)** | The three language properties behind the lean — specific exception types carrying data, duck-typed protocols where using the interface is the only complete test of it, and a non-raising `try` costing nothing since 3.11; and a worked misreading showing how counting keywords mislabels code both ways |
| 2 | **[The race between look and leap](02-the-race-between-look-and-leap.md)** | The three lines of which only two are yours; the glossary's own race-condition paragraph verbatim, naming `if key in mapping` as the example; what the interpreter has always protected and what it never did, including free-threaded builds |
| 2b | **[The filesystem and the atomic flag](02b-the-filesystem-and-the-atomic-flag.md)** | 🔴 The `os.access` entry calling check-then-open a *"security hole"*, plus the second note that the check can be wrong even when it was fresh; `Path.exists()` returning `False` for *"invalid, inaccessible or missing"* alike; and the replacements that decide and act in one call — `exist_ok`, `missing_ok`, mode `'x'`, `Path.replace` |
| 2c | **[Databases, queues, and when LBYL clears](02c-databases-queues-and-when-lbyl-clears.md)** | `SELECT`-then-`INSERT` producing the duplicate row it was written to prevent, and the unique constraint as the only real check; the `queue` docs refusing to let `empty()` promise anything; and the section that clears LBYL — the large class of checks where nothing can race them |
| 3 | **[Mappings: the decision table](03-mappings-the-decision-table.md)** | The seven correct spellings of one lookup and what a miss does in each; that five of the seven are neither EAFP nor LBYL because the library already folded the check into the call; the three questions that pick one |
| 3b | **[Writing on a miss](03b-writing-on-a-miss.md)** | `setdefault` and `defaultdict` as reads that write, and the config lookup that changes what `in`, `len` and `json.dumps` report afterwards; the eagerly-constructed default argument; 🔴 `except KeyError` around a `defaultdict` subscript being dead code, because `__missing__` supplies a value instead of raising; `__missing__` on a mapping of your own |
| 3c | **[Sequences, sets and nesting](03c-sequences-sets-and-nested-lookups.md)** | The same three families in every container; `set.remove` versus `discard` as the whole argument reduced to a method name; `list.index` raising rather than returning `-1`, so the LBYL spelling scans twice; and a chain of subscripts under one `except KeyError` as the widest handler in ordinary Python |
| 4 | **[`hasattr` is EAFP in disguise](04-hasattr-is-eafp-in-disguise.md)** | 🔴 The reference's definition — `getattr` plus a test for `AttributeError` — and its three consequences: the property body runs and its side effects happen, an `AttributeError` from inside that body reports as "no such attribute", and any other exception escapes the check |
| 4b | **[Duck typing and type-shaped checks](04b-duck-typing-and-the-type-shaped-check.md)** | Where `hasattr` is genuinely the right call; `isinstance(obj, Iterable)` not detecting `__getitem__` iteration, with the docs' own statement that calling `iter(obj)` is *"the only reliable way"*; and the `str` trap, which is the same failure in reverse |
| 4c | **[Protocols and structural checks](04c-protocols-and-structural-checks.md)** | The three structural checks — a `__subclasshook__` ABC, a `@runtime_checkable` `Protocol`, and `inspect.getattr_static`; that a runtime protocol check verifies *"only the presence of the required methods or attributes"*, with the typing docs' own `ssl.SSLObject` counterexample that passes a `Callable` check and cannot be called |
| 5 | **[Where LBYL is right](05-where-lbyl-is-right.md)** | The six cases where the check wins; why untrusted input is exempt from every argument in chapters 02–04 — it has no invariants yet for an exception to report the violation of; and the parse-at-the-edge, assume-inside pattern that makes the interior stop checking |
| 5b | **[`assert` is not validation](05b-assert-is-not-validation.md)** | 🔴 The reference's sentence that no code is generated for an `assert` under `-O`, so a boundary check spelled `assert` is one deployment flag from not existing; why it looks right anyway (one line, reads as documentation, narrows for mypy); and the tripwire role it keeps |
| 5c | **[The quiet boundaries](05c-the-quiet-boundaries.md)** | The edges that do not look like edges — an environment variable with a default, a client's declared `Content-Length`, a cache entry written by the previous release, a JSON column from two migrations ago — each with its own correct shape: validate all configuration at startup and refuse to boot, treat a declared size as a filter and the byte counter as enforcement, treat a version mismatch in your own store as a miss |
| 5d | **[Irreversible leaps](05d-irreversible-leaps.md)** | That the axis is **retryability**, not reversibility; why the pre-check in front of a charge, a bulk send or a `DROP` earns its place even though it is stale the instant it passes; and exactly which part of the problem it does not solve |
| 5e | **[Claim, then leap](05e-claim-then-leap.md)** | Making the *decision* atomic when the side effect cannot be — a conditional `UPDATE` or an `INSERT` against a primary key is a test-and-set the store performs as part of the write, and the loser learns from `rowcount == 0`; then at-most-once versus at-least-once as a trade you choose rather than a bug you fix |
| 5f | **[The asymmetry](05f-the-asymmetry.md)** | The comparison that actually decides: not check versus try — both are cheap — but the price of a leap that should not have been made; the rule falling out in *both* directions, including the one that tells you to delete a check; and the catastrophic leap you can neutralise instead of guarding |
| 5g | **[Closing the gap with a lock](05g-closing-the-gap-with-a-lock.md)** | The glossary's first remedy done properly: a check narrows the population reaching the gap and never closes it; what a lock protects is an invariant, not an object; what belongs inside it and nothing more; and the three ways it silently stops working |
| 5h | **[Reports, not first casualties](05h-aggregating-failures.md)** | Why a `raise` cannot produce a list — it transfers control, so the importer dies on row 4,000 and the form reports one field; the collecting pattern; deciding what to do with a partly-valid file; and the same shape in a web form |
| 5i | **[The check is the rule](05i-the-check-is-the-rule.md)** | The distinction the whole topic turns on: an `if` that duplicates a failure the operation already reports, versus one that manufactures the only failure anything will ever report; the delete-the-check test; giving the guard data to carry; and `ExceptionGroup` as EAFP's answer to aggregation |
| 5j | **[Designing the failure channel](05j-designing-the-failure-channel/README.md)** — *ten chunks, its own chapter* | An API's failure channel is chosen once by its author and paid for by every call site forever. Why `X \| None` forces every caller into LBYL and the checker makes that visible, while a raised exception is invisible to the signature — Python has no checked exceptions, and PEP 484 says the only known use for declaring them is documentational; sentinels, `@overload`, union returns and `assert_never` |
| 6 | **[Narrowing the try](06-narrowing-the-try.md)** | The glossary's *singular* assumption as the rule, and the one-sentence test that applies it; why a four-statement `try` is a strict regression on the `if` it replaced; and width as three **independent** axes rather than one |
| 6b | **[A worked width repair](06b-a-worked-width-repair.md)** | One eleven-line function failing all three axes at once; the six situations its handler answers, three of them bugs in code it called, all six reported identically; the repair as four separate decisions, two of which want an `if`; the propagation budget; and why narrowing raises your visible error rate before it lowers your incident count |
| 6c | **[The breadth of one class](06c-the-breadth-of-one-class.md)** | The invisible axis: `except OSError` around a single `open()` covering fifteen separately documented situations with fifteen different right answers, and — since 3.3 merged `socket.error` into it — every socket failure too; the question that picks a class; the narrowing ladder when nothing tighter exists |
| 6d | **[The lookup classes](06d-the-lookup-classes.md)** | `LookupError` merging two findings whose fixes differ, and `codecs.lookup()` raising it too; a slice that cannot fail and therefore cannot tell you anything; and the five distinct sources of `KeyError` that are not the dict subscript you meant to guard |
| 6e | **[Attribute, value and `Exception`](06e-attribute-value-and-exception.md)** | `AttributeError` covering assignment as well as reference, which is what a misspelling produces; `IndexError` routing a wrong-typed index to `TypeError`, so the obvious handler is incomplete; `ValueError` defined residually as the class for anything *"not described by a more precise exception"*; and `except Exception` swallowing the `AssertionError` your test was counting on |
| 6f | **[Whose exception is it?](06f-whose-exception-is-it.md)** | That an `except` clause matches a class and can never ask *who raised it*, so the handler owns the same class from anything the suite called, however deep; PEP 8's own pair with the comments that are the argument; and the two mechanical repairs — hoist the leap, and move the consuming work into `else` |
| 6g | [Width at a boundary](06g-width-at-a-boundary.md) | Where `else` narrows and where it cannot: the two grammar constraints, the `os.access` rewrite as three decisions, and keeping the assignment out of the `try` |
| 6h | **[Where `finally` sits](06h-finally-and-the-widest-handler.md)** | The order the clauses actually run in; `else` carries three conditions and `finally` carries none, so no ordinary exit — not even a `return` from an `except` clause — skips the cleanup |
| 6n | **[What belongs in a `finally`](06n-what-belongs-in-a-finally.md)** | The clause has no width knob, so its contents are the only variable: three questions decide, and 🔴 `if x is not None:` inside a `finally` means an object's lifetime has been written out longhand |
| 6o | **[`with` is the sanctioned form](06o-with-is-the-sanctioned-form.md)** | The seven steps verbatim — `__exit__` is looked up at step 3, before `__enter__` is called at step 4 — and step 7's third paragraph, which consults the return value 🔴 only on the exception path |
| 6p | **[The guarantee and the nesting](06p-the-guarantee-and-the-nesting.md)** | 🔴 The guarantee is conditional on `__enter__` returning, so a two-resource `__enter__` leaks the first; target-assignment failure falls on the safe side; multi-item nesting is the structural repair |
| 6q | **[`contextlib` when the object won't cooperate](06q-contextlib-when-the-object-does-not-cooperate.md)** | The answer to *"the object does not implement the protocol"*: `@contextmanager` hands you both halves and neither guarantee — cleanup after the `yield` runs only inside a `finally`, and 🔴 the banked rule that the generator **must reraise** what is thrown in at the `yield` or it has silently suppressed it |
| 6v | **[One yield and one use](06v-one-yield-and-one-use.md)** | The generator must yield exactly once on every path, and the manager it produces may be entered exactly once — so the **factory**, never the manager, is the only thing you may keep in a module global |
| 6w | **[The decorator form](06w-the-decorator-form.md)** | `ContextDecorator` spells the same factory with an `@`, free on every `@contextmanager` — but the decorator form has nowhere to put an `as` target and still suppresses exactly as the `with` form does |
| 6x | **[`closing` — a `close()` is enough](06x-closing-a-close-method-is-enough.md)** | The docs' own five-line equivalent implementation, read closely: the three things it promises and the two it does not, and when you reach for it instead of writing `__exit__` |
| 6z | **[`suppress`](06z-suppress.md)** | EAFP with the handler made declarative — why it reads better than `try`/`except`/`pass`, and 🔴 the trap that makes it dangerous: it suppresses for the **rest of the block**, not for the statement you meant |
| 6za | **[`nullcontext`](06za-nullcontext-the-manager-that-does-nothing.md)** | So that *optional* does not mean *duplicated* — it turns the choice of context manager into a value, and `enter_result` extends that from optional behaviour to an optional bound name |
| 6zb | **[`ExitStack`](06zb-exitstack-the-stack-you-build-at-runtime.md)** | When the number of resources is not known until runtime: cleanups registered on a stack and unwound in reverse, so the result is indistinguishable from nesting; `enter_context` and `callback`, and which of them can suppress |
| 6zc | **[`push`, `pop_all`, ownership](06zc-push-pop-all-and-ownership-transfer.md)** | `push` registers an `__exit__` **without** calling `__enter__`, which is how a half-built object cleans up after itself; `pop_all` moves a whole callback stack without running any of it — the commit/rollback pattern |
| 6k | **[The jump that discards](06k-the-jump-that-discards.md)** | A `return`, `break` or `continue` in a `finally` discards a saved exception outright — the widest possible handler — and what 3.14 changed with PEP 765's `SyntaxWarning` |
| 6i | **[When cleanup raises](06i-when-cleanup-raises-and-the-grammar-refuses.md)** | The failure that replaces the one you were diagnosing; what `__context__` is and who sets it; and surfacing both failures instead of picking one |
| 6l | **[The `else` you cannot write](06l-the-else-you-cannot-write.md)** | The grammar refuses `else` without `except`, so the narrowing tool is unavailable exactly where a bare `try`/`finally` needs it; plus the *other* `else`, the one on loops |
| 6r | **[`except*` does not mix](06r-except-star-does-not-mix.md)** | A second *grammar*, not a second clause: it cannot share a statement with `except`, its type is mandatory so `except*:` is a syntax error, and its clauses match by **splitting** the group so more than one of them can run |
| 6y | **[What escapes, what you are handed](06y-what-escapes-an-except-star.md)** | An `except*` clause running is not a promise the statement finished — unmatched leaves merge with whatever your handlers raised and propagate on; and `break`/`continue`/`return` are a `SyntaxError` inside one, because the group's members are assumed independent |
| 6j | **[Ambient state the guard cannot see](06j-ambient-state-the-guard-cannot-see.md)** | A guard's correctness depending on state it never reads: `decimal` contexts and their per-thread traps, and warning filters — the call that raises only in CI |
| 6t | **[Warning filters](06t-warning-filters.md)** | A warning is not an exception until a filter says so, which is why a narrow `try` correct in production starts firing in CI; the filter list, first-match-wins, the spec format, and 🔴 why you have never seen your dependencies' `DeprecationWarning`s |
| 6u | **[Changing the filter in-process](06u-catch-warnings-and-the-test-runner.md)** | Every in-process way to change the filter **inserts at the front**, which is how a library silences your CI — and `catch_warnings`, the one that scopes properly, mutates module state and is documented as not thread-safe |
| 6m | **[The guard the platform deletes](06m-the-guard-the-platform-deletes.md)** | `-O` removes the `assert` that was your validation, and `-OO` the docstrings your CLI's `--help` was built from; the three ways the flag arrives, and 🔴 `if __debug__:` blocks vanishing with their side effects |
| 6zd | **[The bytecode cache and the flag](06zd-the-bytecode-cache-and-the-flag.md)** | The optimization level is baked into the cached bytecode's **filename**, so `-O` lives in a second, on-disk place the running process never chose; PEP 488 made the levels coexist, so a mismatch is a lookup miss rather than an error |
| 6zf | **[Bytecode-only and the name that is read](06zf-bytecode-only-and-the-name-that-is-read.md)** | Strip the `.py` files and the mismatch stops being a slow start: a `.pyc` inside `__pycache__` is ignored outright when its source is missing, so a `compileall -o 2` artefact is **invisible** to an interpreter started without `-OO` |
| 6zp | **[The path API for the cache](06zp-the-path-api-for-the-cache.md)** | Stop guessing at cache filenames — `importlib.util.cache_from_source` answers which bytecode file *this* interpreter will look for, and `source_from_cache` inverts it |
| 6zq | **[Where the cache lives](06zq-where-the-cache-lives.md)** | `PYTHONPYCACHEPREFIX` relocates the whole tree and makes in-tree `__pycache__` directories invisible; `PYTHONDONTWRITEBYTECODE` decides whether the cache your build wrote is the cache your runtime reads |
| 6zr | **[When the cache stops noticing](06zr-when-the-cache-stops-noticing.md)** | A `.pyc` carries its own staleness rule and 🔴 one of the three is *not to check* — unchecked hash-based bytecode is assumed valid if it exists, which is how a source edit has no effect |
| 6s | **[The check that lies](06s-the-check-that-lies.md)** | The other half of the ambient-state problem — a guard that runs and answers **wrongly**: `os.access` documents three independent reasons its `True` is not the answer you wanted, `os.path.exists` collapses *invalid, inaccessible and missing* into one `False`; and the three questions to ask of any guard |
| 6ze | **[The answer with a shelf life](06ze-the-answer-with-a-shelf-life.md)** | Memoising a filesystem or permission predicate does not make the check cheaper — it widens the window the glossary already warned about, on purpose. A cached check is LBYL with the gap extended |
| 6zg | **[Keying the work, not the question](06zg-keying-the-work-not-the-question.md)** | When the cost avoided was real work rather than a syscall, the repair is not to delete the cache but to move the key onto something that changes when the truth changes, so a stale entry becomes a miss |
| 6zh | **[Cache only what the leap re-verifies](06zh-cache-only-what-the-leap-reverifies.md)** | A cached `True` is usually survivable because the operation is about to check it again; 🔴 a cached `False` never is, because nothing afterwards will — and even the survivable half holds only when the leap actually re-checks |
| 7 | **[The cost argument](07-the-cost-argument.md)** | The entire published record: two claims, both from What's New in 3.11 — a non-raising `try` costs nothing, catching one got about 10% cheaper — and neither compares a `try` with an `if`; the zero-cost mechanism that relocated the price onto the raising path rather than deleting it |
| 7b | **[The miss rate decides](07b-the-miss-rate-decides.md)** | The argument you can make from the code alone: LBYL puts its extra work on the hit, EAFP on the miss, and `get` with a default pays neither — so the miss rate is the only variable; the crossover condition, and the one unknown in it that no official source publishes |
| 7c | **[The double-work argument](07c-the-double-work-argument.md)** | The claim that wins a review without a stopwatch, because it is about the code rather than the clock; the duplicated unit priced across four cases, from a second hash lookup to a second network round trip; and the sharper point — `__contains__` and `__getitem__` are different questions, so doing two *different* things and believing they agree is the real bug |
| 7d | **[Where the cost actually is](07d-where-the-cost-actually-is.md)** | Why the guard is a rounding error next to a syscall and the duplicated round trip is the whole cost; the one-call spellings the library already ships; the single case where the spelling really is the largest term, and the three cheaper moves to make before you touch it |
| 7e | **[Measuring instead of arguing](07e-measuring-instead-of-arguing.md)** | Designing the harness when someone demands a number: sweep the miss rate rather than fixing it at 1.0, keep construction out of the timed statement, record the build beside the figure; and why a result belongs only to the machine that produced it |
| 7f | **[The costs that decide](07f-the-costs-that-actually-decide.md)** | The three costs paid by the next reader — a handler wide enough to hide a bug that surfaces three modules away, a precondition validated in three layers that disagree about what valid means, and a guard that runs the property it is guarding — each priced in code, and each larger than any benchmark difference |
| 7g | **[Provability and the order](07g-provability-and-the-order-to-decide.md)** | The one genuinely asymmetric cost: an `if` narrows a type for the checker and an `except` handler is not among the constructs mypy documents for narrowing; why `assert` is the narrowing construct not to ship; and the order to decide in — atomicity, contract, legibility, provability, and only then speed, and only when a profiler named the line |

## The one paragraph the whole topic expands

LBYL is two operations and EAFP is one, so the entire argument is about what happens in
the gap — and the gap grows with the distance to the state, from nanoseconds between two
bytecodes to a network round trip between two SQL statements. When something else can
write to that state, the check is a claim about the past: the glossary says so for
dictionaries, the `os.access` docs call the filesystem version a security hole, and the
`queue` docs refuse to let `empty()` promise anything about `get()`. Most of the time you
never have to choose, because the container APIs already folded the check into the call —
`get`, `setdefault`, `discard`, `exist_ok`, `missing_ok`, mode `'x'` — and those are one
operation, so they are neither style. Where you do choose, three things flip the answer
toward the check: untrusted input, which has no invariants yet for an exception to
violate; a leap that cannot be retried, where a stale check still converts nearly every
bad call into a domain error; and validation that must produce a *report*, because a
`raise` transfers control and only a condition evaluates to something you can append. And
the check that is not LBYL at all is the one that manufactures a failure nothing else
would ever report — `if amount > balance: raise InsufficientFunds` is not dodging an
exception, it is creating the only one that describes the rule. On the EAFP side the
failure mode is width: a handler is a promise about one assumption, and three independent
axes — statements, tuple members, and the breadth of a single class — quietly make it a
promise about six. Speed decides last, and almost never: the published record is two
sentences from 3.11, neither of which compares a `try` against an `if`.

## Where this connects

- **[Exceptions](../11-exceptions/README.md)** is the prerequisite and owns the
  machinery this topic only *chooses between* — the four clauses, the hierarchy that
  makes a narrow `except` possible, chaining, and
  [`suppress`](../11-exceptions/11-suppress-and-the-explicit-ignore.md) as the compact
  EAFP spelling. [`assert`](../11-exceptions/10-assert.md) is stated in full there;
  [05b](05b-assert-is-not-validation.md) is only its consequence at a boundary.
- **[Control flow](../08-control-flow/README.md)** owns the `if` this topic keeps putting
  on trial, and the loop that an aggregating validator is built from.
- **[Truthiness](../05-truthiness/README.md)** is why `if d.get(key):` is not the same
  test as `if key in d:` — a stored `0`, `""` or `[]` makes the two disagree.
- **[Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md)**
  explains why `dict.fromkeys(keys, [])` and a `defaultdict(list)` behave differently on
  a miss, which is the mutation half of [03b](03b-writing-on-a-miss.md).
- **[Comprehensions](../09-comprehensions/README.md)** cannot host a `try`, so a
  comprehension forces the LBYL spelling or forces a loop — one of its six tests.
- **[`match` — structural pattern matching](../10-match-pattern-matching/README.md)** is
  a third answer to the shape question: it tests structure without calling anything, and
  a `case` that matches nothing raises nothing.
- **[Unpacking](../13-unpacking/README.md)** is the next topic and the same decision in
  miniature: check the length first, or unpack and catch the `ValueError`.
- **[`None` and the no-result contract](../14-none-and-no-result/README.md)** is the
  third option this topic keeps deferring — neither raising nor checking, but returning a
  sentinel, and the reasons that moves the failure away from its cause.
- **[PEP 8 and idiom](../15-pep8-and-idiom/README.md)** owns the style guide whose own
  worked example is [06f](06f-whose-exception-is-it.md)'s argument.
- **Phase 8 — Concurrency and async** is where the gap stops being a footnote: the lock
  in [05g](05g-closing-the-gap-with-a-lock.md), the free-threaded build, and the
  claim-then-leap pattern under real parallelism.

---

← Prev: [Exceptions](../11-exceptions/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [Unpacking](../13-unpacking/README.md)
