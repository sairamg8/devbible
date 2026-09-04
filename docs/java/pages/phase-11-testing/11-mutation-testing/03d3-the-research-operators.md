---
title: "Seven operators from the mutation-testing literature — ABS, AOR, AOD, CRCR, OBBN, ROR and UOI — are in ALL and in no other group, and between them they expand to twenty-five sub-mutators; they are what makes ALL strongly discouraged, and reading their replacement tables tells you exactly why an operator that produces more mutants produces less information"
sidebar_label: "03d3 · Research operators"
sidebar_position: 20
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Negation Mutator (ABS)*,
> *Arithmetic Operator Replacement Mutator (AOR)*, *Arithmetic Operator Deletion Mutator (AOD)*,
> *Constant Replacement Mutator (CRCR)*, *Bitwise Operator Mutator (OBBN)*, *Relational Operator
> Replacement Mutator (ROR)* and *Unary Operator Insertion (UOI)* sections with their replacement
> tables, the *Experimental Mutators* block (*Argument Propagation*, *Big Integer*, *Naked Receiver*,
> *Member Variable*, *Switch*), and the group table — all quoted verbatim — plus the
> [FAQ](https://pitest.org/faq/) entry *"Can I activate more mutators without relisting all the default
> ones?"*. Group registration read from pitest 1.30.0 source at the `1.30.0` tag:
> `engine/gregor/config/Mutator.java` and `engine/gregor/config/StandardMutatorGroups.java`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Operator behaviour and every table below are quoted
> from pitest's documentation; no mutant count on this page came from a run.

**`ALL` is the group pitest tells you not to use, in four words: *"Using the ALL option is strongly
discouraged."* This chunk is what is actually in it once the five optional operators
([03d2](03d2-the-optional-operator-inventory.md) onwards) and the five experimental ones are accounted
for — seven operators from the academic mutation-testing literature, which between them expand into
twenty-five distinct sub-mutators. They are worth a page not because you will enable them but because
their replacement tables are the clearest possible demonstration of pitest's design criterion: every
one of the seven is either trivially killed or systematically equivalent, and reading the tables shows
you which, and why.**

## The seven, and their sub-mutator counts

Each of these is a name that expands to several concrete mutators, numbered by suffix. From the docs'
own tables:

| Operator | Sub-mutators | What it does, verbatim |
|---|---|---|
| `ABS` | 1 | *"This mutator replace any use of a numeric variable (local variable, field, array cell) with its negation."* |
| `AOR` | `AOR_1`–`AOR_4` | *"Like the math mutator, this mutator replaces binary arithmetic operations for either integer or floating-point arithmetic with another operation."* |
| `AOD` | `AOD_1`, `AOD_2` | *"This mutator replaces an arithmetic operation with one of its members."* |
| `CRCR` | `CRCR1`–`CRCR6` | *"Like the inline constant mutator, this mutator mutates inline constant."* |
| `OBBN` | `OBBN1`–`OBBN3` | *"This mutator mutates bitwise and (&) and or (|)."* |
| `ROR` | `ROR1`–`ROR5` | *"This mutator replaces a relational operator with another one."* |
| `UOI` | `UOI1`–`UOI4` | *"This mutator inserts a unary operator (increment or decrement) to a variable call. It affects local variables, array variables, fields, and parameters."* |

One, four, two, six, three, five, four — **twenty-five**. Every one of them generates its own mutants
against the same instruction, which is the arithmetic behind "`ALL` is slow".

## The replacement tables

These are the substance, and they are short enough to read in full.

**`AOR` — every arithmetic operator becomes every other one.**

| Original | `AOR_1` | `AOR_2` | `AOR_3` | `AOR_4` |
|---|---|---|---|---|
| `+` | `-` | `*` | `/` | `%` |
| `-` | `+` | `*` | `/` | `%` |
| `*` | `/` | `%` | `+` | `-` |
| `/` | `*` | `%` | `+` | `-` |
| `%` | `*` | `/` | `+` | `-` |

The default `MATH` operator uses one replacement per original — `+` becomes `-`, `*` becomes `/`. `AOR`
uses four. On a single `a + b` you get four mutants where the default set gives one, and any test that
kills the `MATH` mutant almost certainly kills all four, because an assertion that pins the exact result
distinguishes the original from every arithmetic alternative at once.

**`ROR` — every relational operator becomes every other one.**

| Original | `ROR1` | `ROR2` | `ROR3` | `ROR4` | `ROR5` |
|---|---|---|---|---|---|
| `<` | `<=` | `>` | `>=` | `==` | `!=` |
| `<=` | `<` | `>` | `>=` | `==` | `!=` |
| `>` | `<` | `<=` | `>=` | `==` | `!=` |
| `>=` | `<` | `<=` | `>` | `==` | `!=` |
| `==` | `<` | `<=` | `>` | `>=` | `!=` |
| `!=` | `<` | `<=` | `>` | `>=` | `==` |

`ROR` is `CONDITIONALS_BOUNDARY` and `NEGATE_CONDITIONALS` and three more replacements, all at once.
The first two are already in the default set and carry distinct, readable diagnostics
([03](03-mutators.md)); the extra three mostly duplicate them. Five mutants per comparison, of which
the two informative ones are the ones you already had.

**`AOD` — the operation is replaced by one of its operands.**

```java
int a = b + c;
```

becomes

```java
int a = b;
```

and

```java
int a = c;
```

**`OBBN` — the same idea for bitwise operators, plus a swap.**

```java
a & b;
```

becomes `a | b` under `OBBN1`, `a` under `OBBN2` and `b` under `OBBN3`.

**`CRCR` — six replacements for every constant.**

| Constant | `CRCR1` | `CRCR2` | `CRCR3` | `CRCR4` | `CRCR5` | `CRCR6` |
|---|---|---|---|---|---|---|
| `c` | `1` | `0` | `-1` | `-c` | `c+1` | `c-1` |

Compare `INLINE_CONSTS` ([03d2c](03d2c-inline-constants.md)), which produces exactly one replacement per
literal, chosen by rules whose special cases exist specifically to avoid non-viable and equivalent
mutants. `CRCR` produces six and applies no such care — `CRCR2` turns a constant into `0`, which for a
literal that is already `0` is an equivalent mutant by construction, and `CRCR1`'s `1` does the same
for a literal `1`.

**`UOI` — an increment or decrement is inserted at a variable use.**

| Variable | `UOI1` | `UOI2` | `UOI3` | `UOI4` |
|---|---|---|---|---|
| `a` | `a++` | `a--` | `++a` | `--a` |

Four mutants per *use* of a variable — not per assignment, per use — across locals, array variables,
fields and parameters. On a method with ten variable references that is forty mutants, and the
postfix/prefix pair often produces two mutants that are indistinguishable in effect because the value
is not read again in that expression.

**`ABS` — every numeric variable use becomes its negation.**

```java
public float get(final float i) {
  return i;
}
```

becomes

```java
public float get(final float i) {
  return -i;
}
```

Note the difference from the default `INVERT_NEGS`, which *removes* an existing negation and, per its
own documentation, *"does not mutate negative constants, only variables"*. `ABS` inserts a negation
where none was written, at every numeric variable use in the codebase.

## Why they are all in `ALL` and nowhere else

Run each of the seven against pitest's two criteria and the answer falls out.

**They duplicate default operators with more mutants and no more information.** `AOR` is `MATH` times
four; `ROR` is `CONDITIONALS_BOUNDARY` plus `NEGATE_CONDITIONALS` plus three; `CRCR` is `INLINE_CONSTS`
times six without the special cases. The tests that kill the default mutant kill the extras, so what
you buy is runtime.

**They are systematic equivalent-mutant factories.** `CRCR2` on a literal `0`, `CRCR1` on a literal `1`,
`UOI`'s prefix/postfix pair where the value is not re-read, `ABS` on a value the caller immediately
takes the magnitude of — each is a mutant no assertion can distinguish, and each will sit in the report
forever ([04b · Equivalent mutants](04b-equivalent-mutants.md)).

**They multiply the expensive case.** A survivor runs *every* covering test to completion, whereas a
kill stops at the first failure ([02](02-how-it-works.md)). So an operator family that produces mostly
survivors is also the one that makes the run slowest — the two costs compound rather than trade off.

Hence the flat instruction, which is the whole of pitest's advice about this group:

> *"Using the ALL option is strongly discouraged."*

The five **experimental** operators — argument propagation, big integer, naked receiver, member
variable and switch — are the rest of `ALL`, and they are a different kind of thing: not redundant
re-encodings of default operators but capabilities nothing else in the tool has.
[03d3b](03d3b-the-experimental-operators.md) takes them apart.

## The one honest use for `ALL`

Not on a build. On **one class**, once, from the command line, when you are trying to understand what
pitest is capable of seeing — or when you are writing a page like this one and want to know what an
operator actually emits. Point it at a single class with a narrow `targetClasses`, read the report as a
catalogue rather than as a score, and then delete the configuration.

Everything else about `ALL` is a mistake with a plausible motivation: more mutants feels like more
information, and it is the one place in this topic where that intuition is exactly backwards.

## Where this connects

- **[03d · Optional mutators](03d-optional-mutators.md)** — the group machinery, and why `ALL` means
  "every registered operator id, including ones a plugin added".
- **[03d3b · The experimental operators](03d3b-the-experimental-operators.md)** — the other five
  members of `ALL`, which are capabilities rather than redundancies.
- **[03d2 · Optional operators](03d2-the-optional-operator-inventory.md)** — the two-bucket rule these
  seven operators illustrate at scale.
- **[03d2c · Inline constants](03d2c-inline-constants.md)** — `INLINE_CONSTS`, whose careful special
  cases are what `CRCR` does not have.
- **[03 · Mutators](03-mutators.md)** — `CONDITIONALS_BOUNDARY` and `NEGATE_CONDITIONALS`, which `ROR`
  subsumes and dilutes.
- **[03b · Arithmetic mutators](03b-arithmetic-mutators.md)** — `MATH` and `INVERT_NEGS`, the default
  operators that `AOR` and `ABS` correspond to.
- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** — the 1.25.8 `BigInteger` fix
  for Java 25, and arcmutate, which is where additional operators actually come from.
- **[04b · Equivalent mutants](04b-equivalent-mutants.md)** — the problem these operators manufacture in
  bulk.

## Gotchas

**★ `ALL` is twenty-five sub-mutators from this page alone, before the optional and experimental operators.**
`AOR` is four, `CRCR` six, `ROR` five, `UOI` four, `OBBN` three, `AOD` two, `ABS` one. Each fires on the
same instructions the default operators already cover. The mutant count on a numeric-heavy class goes up
by roughly an order of magnitude, and so does the runtime, because most of the extras survive and a
survivor runs every covering test to completion.

**★ `ROR` contains `CONDITIONALS_BOUNDARY` and `NEGATE_CONDITIONALS` and dilutes both.**
The default pair gives you two mutants per comparison with distinct, readable meanings — a boundary
survivor means the exact threshold is untested, a negation survivor means the decision is unobserved.
`ROR` gives you five, of which three carry no diagnostic anyone has written down. The extra rows do not
add findings; they add rows.

**★ `CRCR` is `INLINE_CONSTS` with the safety rules removed.**
`INLINE_CONSTS` produces one replacement per literal, chosen by rules whose special cases exist to avoid
non-viable and equivalent mutants — pitest's own footnotes explain both. `CRCR` produces six per literal
including `0` and `1`, so a literal `0` gets a `CRCR2` mutant that replaces it with `0`. Equivalent
mutants by construction, and there is no filter for them.

**★ `UOI` generates four mutants per variable *use*, not per assignment.**
It *"affects local variables, array variables, fields, and parameters"*, inserting `a++`, `a--`, `++a`
and `--a`. A method that reads a parameter in five places gets twenty mutants from this one operator,
and the prefix/postfix pair is frequently indistinguishable because the value is not read again within
the expression.

**★ `ABS` is not `INVERT_NEGS`, and the difference is which direction it works.**
`INVERT_NEGS` removes a negation that you wrote and explicitly *"does not mutate negative constants, only
variables"*. `ABS` inserts a negation at every numeric variable use whether or not one was written. One
is a targeted probe of sign handling; the other is a mutant on every number in the codebase.

**★ Enabling a plugin changes what `ALL` means, without any change to your build file.**
`Mutator.all()` is `fromStrings(MUTATORS.keySet())`, and that map is populated by every
`MethodMutatorFactory` and `MutatorGroup` found on pitest's classpath via `ServiceLoader`. So installing
arcmutate, or any other pitest plugin, silently expands `ALL` and moves your denominator. It is one more
reason the group is discouraged, and it is the reason a score produced with `ALL` is not reproducible
even by you.

## Interview questions

**★ What is actually in `ALL` that is not in `STRONGER`, and why is that group discouraged?**
Mostly seven operators from the academic literature — ABS, AOR, AOD, CRCR, OBBN, ROR and UOI — which
between them expand to twenty-five sub-mutators, plus the optional operators and four of the five
experimental ones. They are discouraged because each fails one of pitest's two design criteria. Several
are strictly redundant with default operators but with more replacements per instruction: `AOR` is
`MATH` with four substitutions instead of one, `ROR` is `CONDITIONALS_BOUNDARY` and
`NEGATE_CONDITIONALS` plus three more, `CRCR` is `INLINE_CONSTS` with six substitutions and none of its
safety rules. Others manufacture equivalent mutants by construction — `CRCR2` replaces a constant with
`0`, which for a literal `0` is no mutation at all. And because a survivor is the expensive case, an
operator family that mostly survives is also the one that makes the run slowest. More mutants is not
more information when the extra mutants are noise.

**★ How would you find out whether a defect class is reachable by mutation testing at all?**
Run `ALL` against one class, once, from the command line with a narrow `targetClasses` glob, and read
the report as a catalogue of what pitest can emit rather than as a score. That is the one honest use for
the group. It answers questions like "can anything here see a wrong field assignment" — the answer being
`EXPERIMENTAL_MEMBER_VARIABLE` and nothing else — or "can anything see a wrong `String`", where the
answer is no operator in the tool. Then delete the configuration, because the same run across a
repository produces a report nobody will read and a score nobody can reproduce.

**★ Why is `ROR` a worse operator than the two default conditional mutators it contains?**
Because a mutation report's value is in the diagnostic attached to each survivor, and adding rows to the
replacement table dilutes it. `CONDITIONALS_BOUNDARY` shifts a comparison by one boundary, so its
survivor means precisely "no test uses the exact threshold value". `NEGATE_CONDITIONALS` inverts it, so
its survivor means "the decision's outcome is not asserted". Those are two different, actionable
sentences. `ROR` produces five mutants per comparison, of which those two are among them and the other
three carry no established reading — so a reader gets more entries, has to work out which of them is the
boundary case, and pays five times the runtime for it. The default set is a curated subset for a reason.

**★ A build's mutation score changes after a dependency upgrade with no code or configuration change. What could have happened?**
Several things, and if the build uses `ALL` the most likely one is that a pitest plugin arrived or
changed. `Mutator.all()` resolves to every mutator id registered on pitest's classpath through
`ServiceLoader`, so adding arcmutate — or upgrading something that brings a pitest plugin transitively —
changes what `ALL` expands to and therefore the denominator. Even without `ALL`, a pitest engine upgrade
can change filter behaviour or add a default operator, and a compiler or Lombok upgrade can change what
bytecode exists to mutate. This is the general reason a mutation score is only comparable against a run
with the same operator set, the same pitest version and the same toolchain — and why the *Active
mutators* list at the bottom of each HTML source page is worth archiving alongside the number.

{/* FOOTER */}
