---
title: "Part 11 — Low-level design and the machine-coding round"
sidebar_label: "11 · Low-level design"
sidebar_position: 11
---

> Phases 19–20 · Designing the classes, interfaces and state machines inside one service — and the catalogue of problems the round draws from

Low-level design is the round most product companies use to separate "can talk architecture"
from "can write it". You are given a bounded problem — a parking lot, a ticket booking, a
rate limiter — and asked for the classes, their relationships, the invariants and, in the
machine-coding variant, working code in a few hours. This part is the design vocabulary,
the way graders think, and the problem catalogue. The language mechanics are in the
[TypeScript](../../typescript/README.md) and [Java](../../java/README.md) tracks; the
data-structure side of several problems is in the DSA track's design-flavoured phase.

---

## Phase 19 — Object-oriented design and the machine-coding round

Patterns are not the point; the point is a design that survives the follow-up ("now add a
second pricing rule", "now two gates open at once"). Each row here is a tool for that, plus
the round's format and the mistakes graders see most.

| Topic | Tier |
|---|---|
| **What the round grades** — a class design that models the domain, extensibility under a new requirement, working code, tests, communication; how the 60-minute design version differs from the multi-hour machine-coding version | <span className="db-tier t-master">Master</span> |
| **SOLID as applied** — single responsibility, open/closed through strategies, the Liskov violations you actually hit, interface segregation, dependency inversion; each with the refactor it forces | <span className="db-tier t-master">Master</span> |
| **Composition over inheritance** — the deep hierarchy that could not take one more feature; delegation and small interfaces instead | <span className="db-tier t-master">Master</span> |
| **Strategy, Factory and Builder** — pluggable pricing rules, creating the right payment handler, assembling a complex order; and when a plain function is the honest pattern | <span className="db-tier t-master">Master</span> |
| **Observer, Command and Chain of Responsibility** — listeners for domain events, undoable actions, a discount or validation pipeline | <span className="db-tier t-master">Master</span> |
| **State and explicit state machines** — order status transitions with guards, illegal transitions rejected at the type or the method; the transition money depends on | <span className="db-tier t-master">Master</span> |
| **Domain-driven design, lite** — entities, value objects (a `Money` type), aggregates and their invariants, repositories; the aggregate as the transaction boundary | <span className="db-tier t-master">Master</span> |
| **Class and sequence diagrams, fast** — turning requirements into a class list in five minutes, drawing only the relationships that matter, a sequence for the hard flow | <span className="db-tier t-master">Master</span> |
| **Designing for testability** — dependency injection, in-memory implementations behind interfaces, clocks and id generators as injected dependencies | <span className="db-tier t-master">Master</span> |
| **Concurrency in low-level design** — Java's locks, atomics and concurrent collections; Node's single thread with async boundaries and worker threads; the seat-locking problem solved in both | <span className="db-tier t-master">Master</span> |
| **The machine-coding round** — reading the problem, a fifteen-minute design, the vertical slice first, tests as you go, the demo; what graders check: working, extensible, readable | <span className="db-tier t-master">Master</span> |
| **Common mistakes** — god classes, anaemic models with all the logic in services, premature patterns, ignored concurrency, no tests, no demo | <span className="db-tier t-master">Master</span> |
| **Decorator, Adapter, Facade and Proxy** — wrapping without modifying, integrating a third-party SDK, hiding a subsystem, lazy or guarded access | <span className="db-tier t-understand">Understand</span> |
| **Singleton and its pitfalls** — global state, testability, lifecycle; the container-managed instance as the alternative | <span className="db-tier t-understand">Understand</span> |
| **Interfaces and abstractions in TypeScript and Java** — interfaces vs abstract classes, generic repositories, discriminated unions vs sealed hierarchies for the same domain | <span className="db-tier t-understand">Understand</span> |
| **Error handling design** — typed errors, invariants that throw, result types vs exceptions, error boundaries between layers | <span className="db-tier t-understand">Understand</span> |
| **Clean and hexagonal architecture** — domain, application and adapters; where the framework is allowed to appear; the folder structure a grader recognises in seconds | <span className="db-tier t-understand">Understand</span> |
| **In-memory persistence behind an interface** — the repository you swap for PostgreSQL later, and why the round expects exactly that | <span className="db-tier t-understand">Understand</span> |
| **API-first low-level design** — the public surface of each class before its internals; the "how would a caller use this" test | <span className="db-tier t-understand">Understand</span> |
| **TypeScript vs Java for the round** — speed against the structure graders expect; the same design written in both so the choice is deliberate | <span className="db-tier t-understand">Understand</span> |
| **Reviewing a design as a senior** — the questions to ask of any class model, and how to defend your own under "what if we add X" | <span className="db-tier t-understand">Understand</span> |

**Gate — deliverable:** the storefront's order domain as a class model — `Order`, line items,
a `Money` value object, an explicit status machine, a pricing strategy — with a test that
proves an illegal transition cannot happen and a second pricing rule added without editing
the first.

---

## Phase 20 — The LLD problem catalogue

Each row is one problem, its core abstractions, the pattern that usually fits, and the twist
that separates a good answer from a complete one. Every row is a future page with a worked
design in TypeScript and Java.

| Topic | Tier |
|---|---|
| **Parking lot** — vehicles, spots, levels, a pricing strategy; Strategy and Factory; the twist: two gates admitting cars at once | <span className="db-tier t-master">Master</span> |
| **Ticket booking with seat locking** — shows, seats, holds with expiry, payment confirmation; the state machine and the lock; the twist: the hold that expires mid-payment | <span className="db-tier t-master">Master</span> |
| **Splitwise** — users, groups, expenses, balances; the settle-up algorithm that minimises transactions; the twist: unequal and percentage splits | <span className="db-tier t-master">Master</span> |
| **LRU and LFU caches** — the map plus a doubly linked list, frequency buckets; the twist: TTL and thread safety | <span className="db-tier t-master">Master</span> |
| **Rate limiter** — token bucket and sliding window as strategies behind one interface; the twist: per-key limits and a distributed store | <span className="db-tier t-master">Master</span> |
| **Elevator system** — requests, cars, a scheduling strategy; State and Strategy; the twist: multiple cars and direction-aware scheduling | <span className="db-tier t-master">Master</span> |
| **Notification system** — channels, templates, preferences, retries; Strategy and Observer; the twist: rate limits per user and idempotent sends | <span className="db-tier t-master">Master</span> |
| **In-memory key-value store with transactions** — get, set, delete, begin, commit, rollback; nested transactions; the twist: TTL and concurrent readers | <span className="db-tier t-master">Master</span> |
| **Task scheduler** — one-off and recurring jobs, priorities, a worker pool; the twist: missed runs and exactly-once execution | <span className="db-tier t-master">Master</span> |
| **Vending machine** — states, coins, inventory; the classic State pattern; the twist: refunds and out-of-stock mid-transaction | <span className="db-tier t-master">Master</span> |
| **Payment gateway state machine** — initiated, authorised, captured, refunded, failed; idempotent callbacks from the provider; the twist: the webhook that arrives twice | <span className="db-tier t-master">Master</span> |
| **Flash-sale inventory service** — reservations, decrements, expiry; the twist: ten thousand requests for one unit | <span className="db-tier t-master">Master</span> |
| **Cab booking** — riders, drivers, matching, a trip state machine; the twist: cancellation and driver reassignment | <span className="db-tier t-understand">Understand</span> |
| **Food delivery** — orders, restaurants, riders, dispatch; the twist: partial cancellations and refunds | <span className="db-tier t-understand">Understand</span> |
| **Hotel booking** — rooms, rates, availability, overbooking policy; the twist: date-range conflicts | <span className="db-tier t-understand">Understand</span> |
| **Library management** — books, copies, members, loans and fines; the twist: reservations on a checked-out copy | <span className="db-tier t-understand">Understand</span> |
| **Logging framework** — levels, appenders, formatters, a chain; the twist: asynchronous appenders and loss on crash | <span className="db-tier t-understand">Understand</span> |
| **Publish-subscribe system** — topics, subscribers, delivery guarantees; the twist: a slow subscriber | <span className="db-tier t-understand">Understand</span> |
| **Text editor with undo and redo** — Command pattern, a history stack; the twist: grouping keystrokes | <span className="db-tier t-understand">Understand</span> |
| **Chat application** — users, conversations, messages, read receipts; the twist: group chats and ordering | <span className="db-tier t-understand">Understand</span> |
| **Coupon and discount engine** — rules, eligibility, stacking, a pipeline; Chain of Responsibility; the twist: mutually exclusive offers | <span className="db-tier t-understand">Understand</span> |
| **Meeting scheduler** — rooms, participants, conflicts, recurrence; the twist: time zones | <span className="db-tier t-understand">Understand</span> |
| **Stack Overflow** — questions, answers, votes, reputation; the twist: the reputation rules as a strategy | <span className="db-tier t-understand">Understand</span> |
| **Inventory management** — SKUs, warehouses, stock movements, an audit trail; the twist: transfers between warehouses | <span className="db-tier t-understand">Understand</span> |
| **URL shortener, the LLD version** — encoding, storage interface, expiry; the twist: custom aliases and collisions | <span className="db-tier t-understand">Understand</span> |
| **File system** — directories, files, paths, permissions; the twist: move and rename with open handles | <span className="db-tier t-understand">Understand</span> |
| **Board games: tic-tac-toe, chess, snake and ladder** — board, pieces, move validation, a game loop; the twist: undo and replay | <span className="db-tier t-understand">Understand</span> |
| **Cricket scoreboard** — matches, innings, balls, statistics; the twist: derived statistics kept consistent | <span className="db-tier t-know">Know</span> |
| **ATM** — states, cash dispensing, accounts; the twist: partial dispense failure | <span className="db-tier t-know">Know</span> |
| **Amazon locker** — lockers, sizes, codes, expiry; the twist: allocation across sizes | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can take any Master row above cold and produce, in forty-five
minutes, the class model, the state machine or lock the twist needs, and a vertical slice of
working code with one test — and explain what you would add if given another hour.

---

{/* NAV */}
