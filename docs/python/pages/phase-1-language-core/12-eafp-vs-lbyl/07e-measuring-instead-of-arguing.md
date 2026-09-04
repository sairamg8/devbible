---
title: "There is no number to look up, so if the decision genuinely needs one you design the harness — sweeping the miss rate, keeping construction out of the timed statement and recording the build beside every figure — and you accept that the result belongs only to the machine that produced it"
sidebar_label: "07e · Measuring instead of arguing"
sidebar_position: 152
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Python 3.14 documentation —
> the [`timeit`](https://docs.python.org/3.14/library/timeit.html) module reference for the
> API used below (read its own notes on interpreting repeated runs before trusting a
> result), and
> [What's New in Python 3.11 — Misc](https://docs.python.org/3.14/whatsnew/3.11.html) for
> the only two published cost figures. Target: **Python 3.14**.
> 🔴 **Nothing on this page was run.** The harness is code you execute on your machine;
> no result of it is printed here, because a result printed here would be a claim about
> my hardware and none about yours.

**Every honest answer in this area ends in "measure it", and that sentence is only useful
if you can say what to measure. `timeit` is the right tool and the design of the harness
decides the answer far more than the interpreter does: a benchmark of `try` against `if`
that fixes the miss rate at 1.0, or builds its dictionary inside the timed statement,
will produce a confident number about something nobody asked. This chunk is the harness,
the three rules most pasted benchmarks break, and how to record a figure so it is still
interpretable in six months — plus the reason this page prints no output of its own.**

## When someone demands a number: design the harness

`timeit` is the right tool, and the design matters more than the tool. A benchmark of
this pair is only meaningful if it names four things:

1. **The spellings** compared, written exactly as your code writes them (`in`-then-index,
   `get` with a default, `try`/`except`, `defaultdict`).
2. **The miss rate** — the variable that decides the whole question. One number for a
   single miss rate is not a result; a curve across miss rates is.
3. **The container** — size, and the key type. A small dict of interned strings and a
   large dict of tuples are not the same experiment.
4. **The build** — the interpreter version, and whether it is a free-threaded build.
   Report it beside the figure or the figure is unattributable.

```python
"""Compare three spellings of one dict read across a range of miss rates.
Run this yourself; the numbers belong to the machine that produced them."""
import random
import sys
import timeit

SETUP = """
import random
random.seed(20260903)
SIZE = {size}
MISS_RATE = {miss}
present = {{f"key-{{i}}": i for i in range(SIZE)}}
keys = [
    f"key-{{random.randrange(SIZE)}}" if random.random() >= MISS_RATE
    else f"absent-{{random.randrange(SIZE)}}"
    for _ in range(1000)
]
MISSING = object()
"""

SPELLINGS = {
    "lbyl": "for k in keys:\n"
            "    v = present[k] if k in present else MISSING",
    "get":  "for k in keys:\n"
            "    v = present.get(k, MISSING)",
    "eafp": "for k in keys:\n"
            "    try:\n"
            "        v = present[k]\n"
            "    except KeyError:\n"
            "        v = MISSING",
}

def main(size=10_000, repeats=7, number=200):
    print(sys.version)
    for miss in (0.0, 0.01, 0.1, 0.5, 0.9, 1.0):
        setup = SETUP.format(size=size, miss=miss)
        for name, stmt in SPELLINGS.items():
            samples = timeit.repeat(stmt, setup=setup, repeat=repeats, number=number)
            # Read the low end, not the mean: the high samples are your machine's
            # other work, not the code's cost.
            print(f"miss={miss:<5} {name:<5} best={min(samples):.6f}s")

if __name__ == "__main__":
    main()
```

Three rules that this harness encodes, and that most pasted benchmarks break:

- **Construction lives in `setup`, never in `stmt`.** Building a 10,000-entry dict inside
  the timed statement measures the dict constructor, and it swamps the thing you asked
  about.
- **Every spelling sees the same keys.** A seeded `random` in `setup` gives each variant
  the same workload; regenerating keys per variant compares two different experiments.
- **Sweep the miss rate.** The row at `miss=1.0` is the one people quote as proof that
  exceptions are slow. It is the corner of the space that EAFP was never chosen for.

🔴 **This page prints no output from that script on purpose.** The result depends on the
machine, the interpreter build, the dict size and the key type, and the only run that
answers your question is the one on your hardware with your data.

## Gotchas

**★ Symptom: a benchmark says `get` is dramatically slower than `try`, or vice versa, and
rerunning it gives a different winner.** Cause: the dict is being rebuilt inside the
timed statement, so both figures are dominated by construction and by whatever else the
machine was doing. Fix: move construction into `setup` and read the minimum of several
repeats.

```python
timeit.repeat(
    "for k in keys: v = present.get(k, MISSING)",
    setup="present = {f'key-{i}': i for i in range(10_000)}\n"
          "keys = list(present)\n"
          "MISSING = object()",
    repeat=7,
    number=200,
)
```

**★ Symptom: the timed statement raises `NameError` for a name that plainly exists in the
module.** Cause: `timeit` executes the statement in its own namespace, not the caller's —
that is what `setup` is for. Fix: define everything the statement needs in `setup`, or
pass the caller's namespace explicitly with the `globals` parameter.

```python
timeit.timeit("lookup(key)", setup="pass", globals=globals(), number=1000)

# Or keep it self-contained, which is the better habit for a benchmark you will paste
# into a review — it carries its own environment.
timeit.timeit(
    "lookup(key)",
    setup="from mymodule import lookup\nkey = 'key-1'",
    number=1000,
)
```

**Symptom: two spellings are compared and each one generated its own keys, so the winner
changes with the seed.** Cause: they were run against different workloads — that is two
experiments, not a comparison. Fix: build the data once in `setup` from a fixed seed so
every variant sees identical keys.

```python
SHARED_SETUP = (
    "import random\n"
    "random.seed(20260903)\n"
    "present = {f'key-{i}': i for i in range(10_000)}\n"
    "keys = [f'key-{random.randrange(20_000)}' for _ in range(1000)]\n"
    "MISSING = object()"
)
```

**★ Symptom: a figure from a benchmark gets quoted in review six months later and nobody
can reproduce it.** Cause: it was recorded without the interpreter version, the build, or
the miss rate it was measured at — the three things that determine it. Fix: print the
provenance in the same breath as the number, so the figure carries its own expiry date.

```python
print(sys.version)                      # build and version
print(f"size={size} miss={miss}")       # the workload the figure describes
print(f"best={min(samples):.6f}s")
```

**Symptom: `timeit` numbers from a laptop are used to justify a change to a service
running on different hardware and a different interpreter build.** Cause: every figure in
this area is machine-, build-, version- and data-specific; that is why the official
documentation publishes none of them. Fix: measure on something that resembles
production, and prefer the profile of the real workload to a synthetic loop — a
microbenchmark tells you which spelling is faster, never whether it matters.

## Interview questions

**★ Someone demands a concrete number for `try` versus `if`. What do you do?**
Agree that it is measurable, and then insist on designing the measurement rather than
quoting one. `timeit` is the tool; the harness has to name four things or the result is
meaningless — the exact spellings as the codebase writes them, the miss rate (swept, not
picked), the container size and key type, and the interpreter version and build. Then
read the minimum of several repeats rather than the mean, because the larger samples are
the machine's other work. And say plainly why no page can hand them the number: the
official documentation publishes only two figures, both about 3.11 versus 3.10, and the
crossover between the spellings depends on the ratio of a lookup to a raise, which is not
published anywhere.

**★ How would you design the benchmark if you had to?**
Parameterise the miss rate and sweep it from 0 to 1, because that is the axis the answer
lives on — a single point is not a result. Keep all container construction in `setup` so
you time the lookup rather than the dict constructor. Seed the random generator so every
spelling sees identical keys. Vary the container size and the key type in a second sweep,
since hashing cost differs by type. Use `timeit.repeat` and take the minimum. Print
`sys.version` and the workload parameters alongside every figure. And decide in advance
what result would change your mind — if no plausible number would alter the code, you are
running the benchmark to win an argument, not to make a decision.

**Does a microbenchmark ever settle this?**
It settles *which spelling is faster on that machine for that workload*. It never settles
whether to use it, because the guard's cost has to be compared against the cost of the
surrounding work, and a microbenchmark deliberately removes the surrounding work. The
decision needs a profile of the real workload; the microbenchmark is only useful once the
profile has already pointed at the line.


**A colleague's benchmark shows `get` losing to `try`/`except` at a zero miss rate. Is
that plausible?**
Entirely, and it is a good illustration of why the operation count is a model rather than
a measurement. `d.get(k, default)` is an attribute lookup followed by a call; `d[k]` is a
subscription. Those are different pieces of work, so "one lookup each" does not mean "the
same cost each" — the model in [07b](07b-the-miss-rate-decides.md) deliberately ignores
per-call overhead and says so. At a zero miss rate the `try` never raises, so the only
thing left in the comparison *is* that overhead, and which side it favours is a
measurement on their build, not something you can deduce. What you should still check is
the harness: same keys, construction in `setup`, minimum of several repeats, and the
version printed beside the figure.

---

← Prev: [Where the cost actually is](07d-where-the-cost-actually-is.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [The costs that actually decide](07f-the-costs-that-actually-decide.md)
