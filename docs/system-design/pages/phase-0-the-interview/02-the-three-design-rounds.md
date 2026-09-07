---
title: "Three rounds carry the word \"design\" and grade three different things — HLD grades judgement at the box level, LLD grades it at the class level, and machine coding grades whether you can ship working code in a window"
sidebar_label: "02 · The three design rounds"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Round formats and durations are described as **tendencies across
> product-company loops** — no company is quoted, no statistic is used, and a loop you meet may
> differ. Code is TypeScript targeting Node 24 (LTS), written to be runnable; **nothing was run**.
> Where a round is taught in depth elsewhere in the bible, the link is to that part.

**A recruiter's "design round" can mean three different interviews, and preparing for the wrong
one is a common, avoidable way to fail.** High-level design (HLD) is the whiteboard round — a
system for an ambiguous product problem, in 45 to 60 minutes, graded on scoping, numbers,
trade-offs and depth on one component. Low-level design (LLD) is the class-and-interface round —
the same kind of problem one level down, graded on responsibilities, extensibility and whether the
skeleton could actually run. Machine coding is the working-program round — a complete, tested
program for a bounded problem in a fixed window, graded first on *does it work* and only then on how
it is built. Product companies tend to run more than one because they grade different failure
modes: an engineer can be strong at boxes and weak at classes, or strong at both and unable to ship.

## The three rounds, side by side

| | HLD | LLD | Machine coding |
|---|---|---|---|
| **Artefact** | boxes and arrows, numbered flows, a few numbers | classes, interfaces, a sequence diagram, a runnable skeleton | a working program, tests, a way to run it |
| **Typical window** | 45–60 minutes, live | 45–90 minutes, live | 90 minutes to a few hours, often alone, then a walkthrough |
| **The question sounds like** | "design a ticket-booking service" | "design the classes for seat locking in a booking system" | "implement a booking system: create shows, book seats, cancel; seats must not double-book" |
| **What is graded** | scoping, estimation, the high-level shape, depth on one component, failure handling, trade-offs said unprompted | responsibilities per class, the interfaces between them, the state machine, extensibility to the follow-up, testability | correctness on the stated cases, then edge cases, then structure; does it run, do the tests pass, can it be extended live |
| **The anti-signal** | coding, or drawing classes | drawing boxes and services | designing for an hour and shipping nothing |
| **Where the bible teaches it** | this track, phases 1–18 and the [HLD catalogue](../../syllabus/12-the-hld-catalogue.md) | [Part 11 — Low-level design](../../syllabus/11-low-level-design.md) | Part 11 phase 19, the [JavaScript machine-coding phase](../../../javascript/pages/phase-17-machine-coding/README.md), and the [DSA track's plan](../../../dsa/syllabus/08-the-ladder-and-the-plan.md) |

The columns are not levels of difficulty. They are *altitudes*. HLD is the system seen from
above; LLD is one service seen from inside; machine coding is one module seen from the keyboard.
A senior loop wants to know you can operate at all three and, more importantly, that you know
which one you are in.

## One problem at three altitudes

The storefront's checkout makes the difference concrete, because the same feature is a legitimate
question in every round.

**HLD — "design checkout for a sale day."** The board holds the client, an edge, the order
service, the inventory service, the payment provider, a queue for the order events and the stores
behind each. The graded sentences are about the inventory row under contention, the payment
boundary outside the transaction, idempotency on the create-order call, and what is deferred until
a stated trigger. No class is named. A candidate who starts writing `class Order` here has changed
rounds without being asked.

**LLD — "design the classes for a cart with promotions."** The board holds `Cart`, `CartLine`,
a `PricingRule` interface with `PercentageOff` and `BuyXGetY` behind it, a `PriceCalculator` that
applies rules in a defined order, and a `CartRepository` interface with an in-memory implementation.
The graded sentences are about why pricing is a strategy (the follow-up will add a rule), why the
cart does not know about the database (testability), where the money type lives (integer minor
units, never floats), and what the sequence is when a coupon is applied. No service boundary is
drawn; no queue appears.

**Machine coding — "implement the cart: add, remove, apply a coupon, total; two hours."** The
deliverable is a repository that runs. The graded order is: do the stated operations work; do the
edge cases hold (removing more than was added, applying a coupon twice, an empty cart's total);
then is the structure the LLD above, so that "now add a buy-two-get-one rule" is a ten-minute
change during the walkthrough. A perfect class diagram with no passing tests scores below a plain
implementation that works.

The LLD skeleton, written so that the machine-coding round is a matter of filling it in:

```ts
// cart.ts — the LLD deliverable: interfaces first, one in-memory implementation, money in minor units
export type Money = number; // integer paise/cents; never a float

export interface CartLine {
  readonly productId: string;
  readonly unitPrice: Money;
  readonly qty: number;
}

export interface PricingRule {
  readonly code: string;
  /** returns the discount in minor units for this cart; 0 when the rule does not apply */
  discount(lines: readonly CartLine[]): Money;
}

export class PercentageOff implements PricingRule {
  constructor(readonly code: string, private readonly percent: number) {}
  discount(lines: readonly CartLine[]): Money {
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    return Math.floor((subtotal * this.percent) / 100);
  }
}

export class Cart {
  private readonly lines = new Map<string, CartLine>();
  private readonly rules = new Map<string, PricingRule>();

  add(productId: string, unitPrice: Money, qty: number): void {
    if (qty <= 0) throw new RangeError('qty must be positive');
    const current = this.lines.get(productId);
    const next = current ? current.qty + qty : qty;
    this.lines.set(productId, { productId, unitPrice, qty: next });
  }

  remove(productId: string, qty: number): void {
    const current = this.lines.get(productId);
    if (!current) throw new Error(`not in cart: ${productId}`);
    if (qty >= current.qty) this.lines.delete(productId);
    else this.lines.set(productId, { ...current, qty: current.qty - qty });
  }

  apply(rule: PricingRule): void {
    // idempotent: applying the same code twice is one application
    this.rules.set(rule.code, rule);
  }

  total(): Money {
    const items = [...this.lines.values()];
    const subtotal = items.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const discount = [...this.rules.values()].reduce((s, r) => s + r.discount(items), 0);
    return Math.max(0, subtotal - discount);
  }
}
```

Every design decision the LLD grader asks about is visible: the rule is an interface (the
follow-up adds `BuyXGetY` without touching `Cart`), coupons are keyed by code (applying twice is
one application — an edge case the machine-coding grader will try), money is an integer, and
nothing here knows about a database, which is what makes the tests trivial to write.

## What each round is really checking

- **HLD checks whether you can be handed ambiguity.** The question is deliberately underspecified
  so that the first ten minutes reveal whether you scope before you build. It also checks the
  trade-off habit — whether the cost of a choice is said without prompting — and whether you can go
  deep on one box when asked rather than staying at the level of names.
- **LLD checks whether the code you write will survive the next requirement.** The follow-up is
  the test: "now add a second rule", "now make it thread-safe", "now the cart must persist". A
  design that absorbs the follow-up in one class passes; one that needs a rewrite does not. It also
  checks the state machine — what states an order can be in, and which transitions are illegal.
- **Machine coding checks execution under a clock.** Product companies added it because HLD and
  LLD can be talked through by someone who does not ship. The grader runs the code, reads the
  tests, and asks for one extension live. Working, tested, extensible — in that order.

## Why a loop runs more than one

Because the three rounds fail differently, and a hiring decision needs to know which failure it is
looking at. A candidate who draws a clean HLD but cannot produce a class diagram would design
services their team cannot build. A candidate strong at both who ships nothing in two hours would
be a reviewer, not an engineer. And a candidate who codes beautifully but cannot scope an ambiguous
problem needs a senior above them. Product-company loops for senior roles tend to run at least two
of the three, and the choice of which two says something about the role: an HLD-heavy loop is
hiring for architecture influence, a machine-coding-heavy one for hands-on delivery.

The [senior loop part](../../syllabus/13-the-senior-loop-and-proof-of-work.md) covers how the
rounds are sequenced and what each level is expected to show in each. For the Java side of the
same distinction — services versus the classes inside them — the
[microservice architecture phase](../../../java/pages/phase-14-microservice-architecture/README.md)
is the HLD altitude and Part 11 here is the LLD altitude.

## Confirming the round before it starts

The cheapest fix for the wrong-round failure is a question in the first minute. It costs nothing
and interviewers answer it plainly:

- *"Should I be at the level of services and data stores, or classes and interfaces?"* — settles
  HLD versus LLD.
- *"Is the deliverable a diagram we discuss, or code that runs?"* — settles LLD versus machine
  coding.
- *"How much of the time do you want on requirements versus the design itself?"* — settles the
  agenda in an HLD round, and signals that you know there is one.

If the recruiter's description was ambiguous ("a design round", "a coding-heavy round"), ask the
recruiter beforehand which of the three it is, and what the graders are told to look for. Most
will say.

## Gotchas

**★ Symptom: an LLD round, and you drew services and a queue.** Cause: HLD reflexes carried into
the wrong altitude; the interviewer wanted `Cart`, `PricingRule` and a sequence, and got boxes.
Fix: when the question names a *feature* rather than a *system* ("seat locking", "a cart with
promotions"), start with the nouns as classes and the verbs as methods, and draw the sequence for
the main operation before anything else.

**★ Symptom: machine coding — a beautiful design, half the operations unimplemented at the
bell.** Cause: the LLD was done live instead of beforehand, and the window went to the diagram.
Fix: spend the first ten minutes on interfaces and the state machine, then implement the stated
operations end to end with tests before touching any extensibility. Working beats elegant; elegant
is what the walkthrough is for.

**Symptom: an HLD round, and you started writing a class.** Cause: the design got hard and code
was the comfortable place to go. Fix: when you feel the pull to code, that is the deep-dive signal —
say "the hard part is the inventory row under contention; let me go deep there", and go deep in
*mechanism* (row locks, reservation ledger, TTL), not in syntax.

**Symptom: machine coding — the tests pass, and the grader's first extension takes forty minutes.**
Cause: the operations were implemented directly with no seam — pricing hard-coded into `total()`,
storage baked into the class. Fix: the one abstraction that always pays is the one on the axis the
follow-up will move along. In a cart it is the pricing rule; in a booking system it is the seat
allocation policy; in a rate limiter it is the algorithm. Put an interface there and nowhere else.

**Symptom: LLD — every GoF pattern appeared and the interviewer looked tired.** Cause:
patterns applied as vocabulary rather than as answers to a change you expect. Fix: name a pattern
only when you can say which follow-up it absorbs. "Strategy for pricing, because the next rule is
coming" is graded well; a factory for two classes is graded as noise.

**Symptom: machine coding — the code runs on your machine and the grader cannot run it.** Cause:
no entry point, no instructions, a dependency on a local database. Fix: in-memory by default, a
single command to run the tests, and a short README that says what is implemented and what is not.
The walkthrough starts from the README.

**Symptom: the recruiter said "design round" and you prepared HLD; it was LLD.** Cause: the word
is overloaded and nobody asked. Fix: ask the recruiter which of the three it is and what the grader
is told to look for. Then ask the interviewer in the first minute anyway.

**Symptom: money as a float, and a total that is off by one paisa.** Cause: `0.1 + 0.2` in any
language with IEEE doubles. Fix: integer minor units everywhere, as in the skeleton above; convert
to a display string only at the edge. Graders in every one of the three rounds check this.

**Symptom: LLD — the state machine was never drawn, and the follow-up was "what happens if the
payment fails after the seat is locked?"** Cause: the design had operations but no states. Fix:
draw the states first (`LOCKED → CONFIRMED | RELEASED`), then the transitions, then the classes.
The illegal transition is the question the interviewer is holding.

## Interview questions

**★ What does each of the three design rounds grade, and what is the anti-signal in each?**
HLD grades scoping under ambiguity, estimation, the shape of the system, depth on one component,
failure handling and trade-offs said unprompted; the anti-signal is coding or drawing classes. LLD
grades responsibilities, interfaces, the state machine and whether the design absorbs the next
requirement; the anti-signal is drawing services and queues. Machine coding grades a working,
tested program in a window, then its structure; the anti-signal is an hour of design and nothing
that runs. They are altitudes, not difficulties, and the first skill is knowing which one you are
in.

**★ Why do product companies run more than one design round for a senior hire?**
Because the rounds fail in different ways and a hiring decision needs to know which. Clean boxes
with no ability to produce classes means designing what the team cannot build; strong diagrams with
nothing shipped in two hours means a reviewer rather than an engineer; strong code with no ability
to scope means needing a senior above. Running two or three of the rounds separates those cases.
Which ones a loop weights says what the role is for — architecture influence or hands-on delivery.

**★ Same feature, three rounds: what is on the board for checkout in each?**
HLD: client, edge, order and inventory services, the payment provider, a queue for order events,
the stores; the graded sentences are about the inventory row under contention, the payment boundary
outside the transaction, idempotency and what is deferred. LLD: `Cart`, `CartLine`, a
`PricingRule` interface with implementations, a calculator, a repository interface; the graded
sentences are about why pricing is a strategy, why the cart is storage-agnostic and where money
lives. Machine coding: a repository that runs — add, remove, apply, total with tests — structured as
that LLD so the live extension is a ten-minute change.

**What does "a runnable skeleton" mean in an LLD round?**
Interfaces and classes with real signatures, an in-memory implementation of any storage interface,
and enough of the main operation implemented that a test could be written against it — not a
diagram of names. The skeleton above is the shape: types, one interface on the axis of change, one
concrete class, no framework. It proves the design compiles in your head, and it is the same file
the machine-coding round starts from.

**In machine coding, what is the grading order, and why does it matter for time management?**
Works on the stated cases; then holds on the edge cases; then is structured so an extension is
cheap; then is readable. Because correctness is graded first, the window goes to implementing the
stated operations end to end with tests before any refactoring for extensibility. The one
abstraction worth building up front is the one on the axis the follow-up will move along — pricing
rules in a cart, allocation policy in a booking system.

**How do you find out which round you are in when the description is ambiguous?**
Ask the recruiter beforehand which of the three it is and what graders look for, then ask the
interviewer in the first minute: "services and stores, or classes and interfaces?" and "a diagram we
discuss, or code that runs?" Both questions cost nothing and signal that you know the rounds
differ.

**Which language should you use for LLD and machine coding, and why?**
The one you can write without thinking, because the window is short and the grader reads
structure, not syntax. For this reader that is TypeScript first and Java second: TypeScript for
speed and a small test setup, Java when the loop is Java-flavoured or when the problem leans on
concurrency primitives that Java expresses directly. Whichever it is, have a project skeleton with
a test runner ready before the round — setting up tooling inside the window is time the grader
never sees.

**Why is money a recurring trap across all three rounds?**
Because floats cannot represent most decimal fractions exactly, so a total computed in floats is
eventually off by a minor unit, and every grader knows to check. Integer minor units end the
problem: prices, discounts and totals are integers, division rounds explicitly once, and formatting
to a decimal string happens only at the presentation edge. In HLD the same trap appears as "where is
the ledger and how is it reconciled"; in LLD as "what is the `Money` type"; in machine coding as a
failing test.

---

← Prev: [01b · Staff, and reading the room](01b-staff-and-reading-the-room.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → **The rubric interviewers actually hold** *(not written yet)*
