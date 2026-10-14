---
title: "Link map · System design · Part 11 (phases 19–20)"
sidebar_label: "11 · low-level design"
sidebar_position: 11
---

# Link map · System design · Part 11 (phases 19–20)

Covers every topic row of phases 19 and 20 in `docs/system-design/syllabus/11-low-level-design.md`: object-oriented design and the machine-coding round (T19-01 to T19-21) and the LLD problem catalogue (T20-01 to T20-30). That is 51 rows. `docs/system-design/pages` holds phases 0 to 3 only, so every row is marked not written and its delta describes what the syllabus row promises (the phase 2 rate-limiting page covers the HLD algorithms, not the LLD class design, so T20-05 stays not written).
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title or headings checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Related rows share sources on purpose. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means language and project documentation, standards, vendor docs and the pattern catalogues of refactoring.guru and martinfowler.com; interview-prep write-ups and blogs count as beyond the docs, and the prep sites are illustrative rather than authoritative, so each prep-site link is labelled as such and none is the only source for a claim. Where a prep site states something wrong, the block says so or the link is dropped.

---

## Phase 19 — Object-oriented design and the machine-coding round

### T19-01 · What the round grades — Master · 🔲 not written
- **Read this:** [What is a Machine Coding Round?](https://workat.tech/machine-coding/article/what-is-a-machine-coding-round-omfn1w54ojlg) · Gaurav Chandak, workat.tech (prep site; the page itself warns it was written a few years ago) · the general expectations: working and demonstrable, functionally correct, modular and readable, separation of concerns, new requirements with minimal changes, a main method to test from, no UI (*read*) · covers our angle: **partial** — the machine-coding criteria, not the 60-minute design version · fetched 2026-10-14
- **Also good:** [Machine Coding Round Guide 2026](https://prachub.com/resources/machine-coding-round-guide-2026-requirements-architecture-tests-and-working-code) · PracHub (prep site; illustrative) · a clean class diagram will not rescue a program that cannot run; cites Flipkart's published SDE guide for a 120-minute round of 15 minutes clarification, 90 coding and 15 demo, and says there is no universal format (*read*) · fetched 2026-10-14
- **Also good:** [Yagni](https://martinfowler.com/bliki/Yagni.html) · Martin Fowler, 26 May 2015 · capabilities presumed for the future should not be built now, the basis of grading against over-design (*read*) · covers our angle: **partial** — a principle, not a rubric · fetched 2026-10-14
- **Our delta:** the five grading axes (domain model, extensibility under a new requirement, working code, tests, communication) and how the 60-minute design round differs from the multi-hour machine-coding one. The phase 0 page `docs/system-design/pages/phase-0-the-interview/02-the-three-design-rounds.md` already tabulates what HLD, LLD and machine coding each grade in one row; this row is the deep version.

### T19-02 · SOLID as applied — Master · 🔲 not written
- **Read this:** [SOLID](https://en.wikipedia.org/wiki/SOLID) · Wikipedia · lists the five principles and states LSP as: code using a base-class reference must work with derived classes without knowing it (*read*) · covers our angle: **partial** — definitions, not the refactor each principle forces · fetched 2026-10-14
- **Also good:** [Principles of OOD](http://butunclebob.com/ArticleS.UncleBob.PrinciplesOfOod) · Robert C. Martin · one-line statements of SRP (one reason to change), OCP (extend without modifying), LSP and the rest (*read*) · fetched 2026-10-14
- **Also good:** [Strategy](https://refactoring.guru/design-patterns/strategy) · refactoring.guru · a family of algorithms in separate interchangeable classes, the standard way to get open/closed for pricing rules (*read*) · fetched 2026-10-14
- **Our delta:** each principle paired with the refactor it forces in the storefront (a second pricing rule, a subclass that throws on a base method).

### T19-03 · Composition over inheritance — Master · 🔲 not written
- **Read this:** [Fragile Base Class Problem: Composition over Inheritance](https://pratikpandey.substack.com/p/fragile-base-class-problem-composition) · Pratik Pandey, Substack · a Storage base class with File, Database and Cloud subclasses plus an EncryptedStorage override; when the base class changes how its own storeDocument works internally, the subclass's overrides are silently bypassed (*read*) · covers our angle: **partial** — the failure, not the delegation refactor · fetched 2026-10-14
- **Also good:** [Composition over inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance) · Wikipedia · the Player, Cloud, Building and Trap example where Solid, Movable and Visible combinations explode under inheritance; behaviours in separate interfaces accommodate requirement changes that would otherwise force restructuring, and the drawback is forwarding methods (*read*) · fetched 2026-10-14
- **Our delta:** the deep hierarchy that could not take one more feature, rewritten as delegation to small interfaces.

### T19-04 · Strategy, Factory and Builder — Master · 🔲 not written
- **Read this:** [Strategy](https://refactoring.guru/design-patterns/strategy) · refactoring.guru · a behavioral pattern that puts each algorithm in its own class so they are interchangeable (*read*) · covers our angle: **full** for the pattern, **partial** for when a plain function is enough · fetched 2026-10-14
- **Also good:** [Factory Method](https://refactoring.guru/design-patterns/factory-method) · refactoring.guru · an interface for creating objects that lets subclasses alter the type created (*read*) · fetched 2026-10-14
- **Also good:** [Builder](https://refactoring.guru/design-patterns/builder) · refactoring.guru · constructs complex objects step by step, producing different representations with the same code (*read*) · fetched 2026-10-14
- **Our delta:** pricing rules, payment handlers and order assembly as the three cases, plus the honest verdict on when a function beats the pattern.

### T19-05 · Observer, Command and Chain of Responsibility — Master · 🔲 not written
- **Read this:** [Observer](https://refactoring.guru/design-patterns/observer) · refactoring.guru · a subscription mechanism that notifies many objects of events on the one they watch (*read*) · covers our angle: **partial** — no domain-event framing · fetched 2026-10-14
- **Also good:** [Command](https://refactoring.guru/design-patterns/command) · refactoring.guru · turns a request into an object, and keeps a history stack of commands with state backups to support undo (*read*) · fetched 2026-10-14
- **Also good:** [Chain of Responsibility](https://refactoring.guru/design-patterns/chain-of-responsibility) · refactoring.guru · a request passes along handlers, each deciding to process or pass on; the example is a sequence of authentication and validation checks (*read*) · fetched 2026-10-14
- **Our delta:** listeners for domain events, undoable actions and a discount or validation pipeline all on the storefront order.

### T19-06 · State and explicit state machines — Master · 🔲 not written
- **Read this:** [State](https://refactoring.guru/design-patterns/state) · refactoring.guru · lets an object alter its behavior when its internal state changes, so it appears to change class (*read*) · covers our angle: **partial** — no guards or money-critical transitions · fetched 2026-10-14
- **Also good:** [Finite-state machine](https://en.wikipedia.org/wiki/Finite-state_machine) · Wikipedia · defines states and transitions, with vending machines and elevators as the opening examples (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Build Type-Safe State Machines in TypeScript](https://oneuptime.com/blog/post/2026-01-30-typescript-type-safe-state-machines/view) · OneUptime, 30 Jan 2026 · discriminated unions and exhaustive checking so invalid transitions fail at compile time (*read*) · fetched 2026-10-14
- **Our delta:** order status transitions with guards, illegal moves rejected at the type or method, and the one transition money depends on.

### T19-07 · Domain-driven design, lite — Master · 🔲 not written
- **Read this:** [Effective Aggregate Design, Part I](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf) · Vaughn Vernon, 2011 · invariants and consistency boundaries, false invariants in a large-cluster aggregate, and the guidance to modify one aggregate instance per transaction (*read*) · covers our angle: **full** for the aggregate, **partial** for value objects and repositories · fetched 2026-10-14
- **Also good:** [Value Object](https://martinfowler.com/bliki/ValueObject.html) · Martin Fowler, 14 November 2016 · a money amount is a number plus a currency, and compounds are compared by value not reference (*read*) · fetched 2026-10-14
- **Also good:** [DDD Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html) · Martin Fowler, 23 April 2013 · an order with its line items as one unit with a single aggregate root (*read*) · fetched 2026-10-14
- **Also good:** [Repository](https://martinfowler.com/eaaCatalog/repository.html) · Martin Fowler · a collection-like interface between the domain and data mapping layers (*read*) · fetched 2026-10-14
- **Our delta:** a `Money` type, `Order` as the aggregate and transaction boundary, and a repository, all inside the storefront.

### T19-08 · Class and sequence diagrams, fast — Master · 🔲 not written
- **Read this:** [UML as Sketch](https://martinfowler.com/bliki/UmlAsSketch.html) · Martin Fowler, 28 May 2003 · the essence of sketching is selectivity; forward sketches communicate ideas and alternatives before the code is written (*read*) · covers our angle: **partial** — the stance, not a five-minute routine · fetched 2026-10-14
- **Also good:** [Class diagrams](https://mermaid.js.org/syntax/classDiagram.html) · Mermaid docs · classes, members and relationship arrows such as `Vehicle <|-- Car` for inheritance, in plain text for a remote round (*read*) · fetched 2026-10-14
- **Also good:** [Sequence diagrams](https://mermaid.js.org/syntax/sequenceDiagram.html) · Mermaid docs · participants rendered in order of appearance, messages, and loop and alt blocks for the hard flow (*read*) · fetched 2026-10-14
- **Our delta:** requirements to a class list in five minutes, only the relationships that matter, one sequence for the hard flow.

### T19-09 · Designing for testability — Master · 🔲 not written
- **Read this:** [Clock](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/Clock.html) · Oracle, Java SE 21 · applications obtain the time from a Clock object rather than a static method, which can simplify testing, with fixed or offset clocks for tests (*read*) · covers our angle: **partial** — the clock only, not ids or repositories · fetched 2026-10-14
- **Also good:** [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) · Martin Fowler · fakes have working shortcut implementations such as an in-memory database, stubs return canned answers (*read*) · fetched 2026-10-14
- **Also good:** [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) · Martin Fowler, 23 January 2004 · constructor, setter and interface injection against a service locator; the testing argument is that you must be able to replace real services with stubs, which both approaches allow (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Singletons are Pathological Liars](https://testing.googleblog.com/2008/08/by-miko-hevery-so-you-join-new-project.html) · Miško Hevery, Google Testing Blog, 17 August 2008 · a test that charges a real card because hidden collaborators are reachable through global state (*read*) · fetched 2026-10-14
- **Our delta:** dependency injection, in-memory implementations behind interfaces, and clocks and id generators injected so the gate test is deterministic.

### T19-10 · Concurrency in low-level design — Master · 🔲 not written
- **Read this:** [Lock Objects](https://docs.oracle.com/javase/tutorial/essential/concurrency/newlocks.html) · Oracle Java Tutorials · ReentrantLock and tryLock backing out if the lock is not free, with a deadlock example (*read*) · covers our angle: **partial** — Java only, no seat-locking problem · fetched 2026-10-14
- **Also good:** [Atomic Variables](https://docs.oracle.com/javase/tutorial/essential/concurrency/atomicvars.html) · Oracle Java Tutorials · the atomic package gives atomic single-variable operations with compareAndSet (*read*) · fetched 2026-10-14
- **Also good:** [java.util.concurrent](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html) · Oracle, Java SE 21 · a ConcurrentHashMap is normally preferable to a synchronized HashMap (*read*) · fetched 2026-10-14
- **Also good:** [Worker threads](https://nodejs.org/api/worker_threads.html) · Node.js docs · workers are useful for CPU-intensive JavaScript and do not help much with I/O-bound work (*read*) · covers our angle: **partial** — the Node half · fetched 2026-10-14
- **Our delta:** the seat-locking problem solved twice, with Java locks and with Node's single thread and async boundaries.

### T19-11 · The machine-coding round — Master · 🔲 not written
- **Read this:** [Machine Coding Round Guide 2026](https://prachub.com/resources/machine-coding-round-guide-2026-requirements-architecture-tests-and-working-code) · PracHub (prep site; illustrative) · sections on the smallest testable architecture, getting to working code early, tests that prove the design and handling a new requirement; first slice of an expense splitter is users, one expense, balances (*read*) · covers our angle: **full** for the sequence, **partial** for what graders check · fetched 2026-10-14
- **Also good:** [How to ace the machine coding round?](https://workat.tech/machine-coding/article/how-to-ace-machine-coding-round-hi8lnpp8tlmo) · Gaurav Chandak, workat.tech (prep site; dated by its own disclaimer) · a timed plan of 5–10 minutes clarifying, 10–15 designing, 60–75 coding, then a demo; an unfinished mandatory requirement because you chased extensibility is a red flag (*read*) · fetched 2026-10-14
- **Our delta:** the fifteen-minute design, the vertical slice first, tests as you go, the demo, and the working / extensible / readable checklist.

### T19-12 · Common mistakes — Master · 🔲 not written
- **Read this:** [Anemic Domain Model](https://martinfowler.com/bliki/AnemicDomainModel.html) · Martin Fowler, 25 November 2003 · the fundamental horror is that it separates data from process, a procedural design that is contrary to object-oriented design (*read*) · covers our angle: **partial** — one of the six mistakes · fetched 2026-10-14
- **Also good:** [Large Class](https://refactoring.guru/smells/large-class) · refactoring.guru · the god-class smell, with Extract Class, Extract Subclass and Extract Interface as fixes (*read*) · fetched 2026-10-14
- **Also good:** [Yagni](https://martinfowler.com/bliki/Yagni.html) · Martin Fowler · capabilities presumed for later should not be built now, the case against premature patterns (*read*) · fetched 2026-10-14
- **Our delta:** god classes, anaemic models, premature patterns, ignored concurrency, no tests and no demo, as the checklist graders actually mark down.

### T19-13 · Decorator, Adapter, Facade and Proxy — Understand · 🔲 not written
- **Read this:** [Decorator](https://refactoring.guru/design-patterns/decorator) · refactoring.guru · attach new behaviors by placing objects inside wrapper objects that contain them (*read*) · covers our angle: **partial** — one of four · fetched 2026-10-14
- **Also good:** [Adapter](https://refactoring.guru/design-patterns/adapter) · refactoring.guru · lets objects with incompatible interfaces collaborate (*read*) · fetched 2026-10-14
- **Also good:** [Facade](https://refactoring.guru/design-patterns/facade) · refactoring.guru · a simplified interface to a library or complex set of classes (*read*) · fetched 2026-10-14
- **Also good:** [Proxy](https://refactoring.guru/design-patterns/proxy) · refactoring.guru · a placeholder that controls access to the original object (*read*) · fetched 2026-10-14
- **Our delta:** wrapping without modifying, a third-party payment SDK behind an adapter, a facade over a subsystem, lazy or guarded access.

### T19-14 · Singleton and its pitfalls — Understand · 🔲 not written
- **Read this:** [Singleton](https://refactoring.guru/design-patterns/singleton) · refactoring.guru · ensures one instance with a global access point, and notes it solves two problems at once, violating the single responsibility principle (*read*) · covers our angle: **partial** — pitfalls are secondary · fetched 2026-10-14
- **Beyond the docs:** [Singletons are Pathological Liars](https://testing.googleblog.com/2008/08/by-miko-hevery-so-you-join-new-project.html) · Miško Hevery, Google Testing Blog, 17 August 2008 · singletons are global state, so APIs hide their real collaborators and tests cannot isolate them (*read*) · fetched 2026-10-14
- **Our delta:** global state, testability and lifecycle, with the container-managed instance as the alternative.

### T19-15 · Interfaces and abstractions in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [Narrowing, discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · TypeScript Handbook · a common literal property across a union makes a discriminated union that the compiler can narrow (*read*) · covers our angle: **partial** — the TypeScript half · fetched 2026-10-14
- **Also good:** [Sealed Classes](https://docs.oracle.com/en/java/javase/21/language/sealed-classes-and-interfaces.html) · Oracle, Java SE 21 · sealed types restrict which classes may extend or implement them (*read*) · covers our angle: **partial** — the Java half · fetched 2026-10-14
- **Also good:** [Abstract Methods and Classes](https://docs.oracle.com/javase/tutorial/java/IandI/abstract.html) · Oracle Java Tutorials · abstract classes cannot be instantiated but can be subclassed (*read*) · fetched 2026-10-14
- **Our delta:** interfaces vs abstract classes, generic repositories, and discriminated unions against sealed hierarchies for the same order domain.

### T19-16 · Error handling design — Understand · 🔲 not written
- **Read this:** [Replacing Throwing Exceptions with Notification in Validations](https://martinfowler.com/articles/replaceThrowWithNotification.html) · Martin Fowler, 9 December 2014 · when validating data you usually should not signal failures by exceptions, and the refactoring to a Notification (*read*) · covers our angle: **partial** — validation failures only · fetched 2026-10-14
- **Also good:** [Unchecked Exceptions — The Controversy](https://docs.oracle.com/javase/tutorial/essential/exceptions/runtime.html) · Oracle Java Tutorials (written for JDK 8) · the bottom line: if a client can reasonably be expected to recover, make it checked, otherwise unchecked; runtime exceptions signal programming problems such as a null argument (*read*) · fetched 2026-10-14
- **Our delta:** typed errors, invariants that throw, result types against exceptions, and error boundaries between layers.

### T19-17 · Clean and hexagonal architecture — Understand · 🔲 not written
- **Read this:** [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) · Robert C. Martin, 2012 · the Dependency Rule: source code dependencies can only point inwards (*read*) · covers our angle: **partial** — no folder structure · fetched 2026-10-14
- **Also good:** [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) · Alistair Cockburn, 2005 · create the application to work without a UI or a database so it can be regression-tested, with ports and adapters (*read*) · fetched 2026-10-14
- **Our delta:** domain, application and adapters, where the framework may appear, and the folder layout a grader recognises in seconds.

### T19-18 · In-memory persistence behind an interface — Understand · 🔲 not written
- **Read this:** [Repository](https://martinfowler.com/eaaCatalog/repository.html) · Martin Fowler · mediates between domain and data mapping using a collection-like interface, acting like an in-memory collection of domain objects (*read*) · covers our angle: **partial** — no swap-to-PostgreSQL story · fetched 2026-10-14
- **Also good:** [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) · Martin Fowler · a fake object has a working implementation with a shortcut, an in-memory database being the example (*read*) · fetched 2026-10-14
- **Our delta:** the repository interface you later swap for PostgreSQL, and why the round expects exactly that.

### T19-19 · API-first low-level design — Understand · 🔲 not written
- **Read this:** [Published Interface](https://martinfowler.com/bliki/PublishedInterface.html) · Martin Fowler, 26 December 2003 · a published interface is used outside its code base, so unlike a merely public one it cannot be renamed freely (*read*) · covers our angle: **partial** — why the surface matters, not how to design it · fetched 2026-10-14
- **Our delta:** the public surface of each class before its internals, checked by the "how would a caller use this" test.

### T19-20 · TypeScript vs Java for the round — Understand · 🔲 not written
- **Read this:** [Narrowing, discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · TypeScript Handbook · discriminated unions as the TypeScript way to model alternatives (*read*) · covers our angle: **partial** — one side of the comparison · fetched 2026-10-14
- **Also good:** [Sealed Classes](https://docs.oracle.com/en/java/javase/21/language/sealed-classes-and-interfaces.html) · Oracle, Java SE 21 · the Java counterpart: a closed set of permitted subtypes (*read*) · fetched 2026-10-14
- **Our delta:** speed against the structure graders expect, the same design written in both so the choice is deliberate.

### T19-21 · Reviewing a design as a senior — Understand · 🔲 not written
- **Read this:** [Large Class](https://refactoring.guru/smells/large-class) · refactoring.guru · signs of a class doing too much and the extract refactorings that answer it (*read*) · covers our angle: **partial** — one smell of many · fetched 2026-10-14
- **Also good:** [Anemic Domain Model](https://martinfowler.com/bliki/AnemicDomainModel.html) · Martin Fowler · a review question: does behaviour live with the data (*read*) · fetched 2026-10-14
- **Our delta:** the questions to ask of any class model and how to defend your own under "what if we add X".

---

## Phase 20 — The LLD problem catalogue

### T20-01 · Parking lot — Master · 🔲 not written
- **Read this:** [Strategy](https://refactoring.guru/design-patterns/strategy) · refactoring.guru · interchangeable algorithm classes, the shape of a pricing strategy (*read*) · covers our angle: **partial** — the pattern, not the problem · fetched 2026-10-14
- **Also good:** [Factory Method](https://refactoring.guru/design-patterns/factory-method) · refactoring.guru · creating the right vehicle or spot object through one interface (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Low-Level Design Interview: Design a Parking Lot System](https://www.techinterview.org/post/3233463532/low-level-design-parking-lot/) · techinterview.org (prep site, unsigned; illustrative) · lists thread-safety across entrance and exit lanes as a requirement, and gives each spot its own lock so two gates cannot both take one spot (*read*) · fetched 2026-10-14
- **Our delta:** vehicles, spots, levels, pricing, and the twist of two gates admitting cars at once.

### T20-02 · Ticket booking with seat locking — Master · 🔲 not written
- **Read this:** [Distributed Locks with Redis](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/) · Redis docs · mutual exclusion as the safety property, and why failing over to an asynchronously replicated replica breaks it (*read*) · covers our angle: **partial** — the lock, not the hold state machine · fetched 2026-10-14
- **Also good:** [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) · PostgreSQL docs · FOR UPDATE locks the selected rows so other transactions trying to update, delete or lock them block until the current transaction ends (*read*) · fetched 2026-10-14
- **Also good:** [Optimistic concurrency control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control) · Wikipedia · transactions verify before committing that no one changed the data they read, and roll back on conflict (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Ticket Booking System Low-Level Design](https://www.techinterview.org/post/3233467045/lld-ticket-booking/) · techinterview.org (prep site, unsigned; illustrative) · seat states AVAILABLE to HELD to BOOKED with a 10 minute TTL, and pessimistic, optimistic and Redis lock options compared (*read*) · fetched 2026-10-14
- **Our delta:** shows, seats, holds with expiry, and the twist of the hold that expires mid-payment.

### T20-03 · Splitwise — Master · 🔲 not written
- **Read this:** [Settling Multiple Debts Efficiently: An Invitation to Computing Science](https://infedu.vu.lt/journal/INFEDU/article/612/file/pdf) · Tom Verhoeff, Informatics in Education, 2004 · repeatedly settling any positive balance against any negative one gives an acyclic set of at most N−1 transfers, but that is not always the minimum (for balances +5, +3, −5, −3 a pairing can take three where two suffice); minimising the number of transfers means partitioning balances into as many zero-sum groups as possible and is NP-hard, via 3-Partition (*read*) · covers our angle: **full** for settle-up, **none** for the class model · fetched 2026-10-14
- **Also good:** [How to design Splitwise?](https://workat.tech/machine-coding/editorial/how-to-design-splitwise-machine-coding-ayvnfo1tfst6) · workat.tech (prep site; a widely used machine-coding walkthrough) · EQUAL, EXACT and PERCENT splits with validation that shares sum to the total or to 100, rounding 100 over three as 33.34, 33.33, 33.33, and Split subclasses in Java (*read*) · covers our angle: **partial** — its "simplify" option is pairwise netting, not minimisation · fetched 2026-10-14
- **Also good:** [Value Object](https://martinfowler.com/bliki/ValueObject.html) · Martin Fowler · money as number plus currency, the basis for exact split amounts (*read*) · fetched 2026-10-14
- **Our delta:** unequal and percentage splits, and settle-up told straight: the greedy largest-debtor-to-largest-creditor match (common on prep sites) is a fast N−1 bound, not the minimum. Balances +6, +4, +3 against −8, −3, −2 take five greedy transfers where four suffice (group +3 with −3, and +6, +4 with −8, −2); the exact minimum is an exponential search over zero-sum groups, fine for the handful of people in one group.

### T20-04 · LRU and LFU caches — Master · 🔲 not written
- **Read this:** [LinkedHashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html) · Oracle, Java SE 21 · access order, from least to most recently accessed, is well suited to building LRU caches (*read*) · covers our angle: **partial** — the shortcut, not the hand-built list · fetched 2026-10-14
- **Also good:** [An O(1) algorithm for implementing the LFU cache eviction scheme](http://dhruvbird.com/lfu.pdf) · Shah, Mitra and Matani, 2010 · compares MRU, MFU, LRU and LFU and gives O(1) LFU (*read*) · fetched 2026-10-14
- **Also good:** [Cache replacement policies](https://en.wikipedia.org/wiki/Cache_replacement_policies) · Wikipedia · LRU, TLRU for entries with a lifetime, and LFU (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Design of a Modern Cache](https://highscalability.com/design-of-a-modern-cache/) · High Scalability, on Caffeine · a fixed TTL becomes a write-order queue and read and write buffers cut lock contention (*read*) · fetched 2026-10-14
- **Our delta:** the map plus doubly linked list, frequency buckets, and the twist of TTL and thread safety.

### T20-05 · Rate limiter — Master · 🔲 not written
- **Read this:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe · uses the token bucket with a centralized bucket host, and separates rate limiters from load shedders (*read*) · covers our angle: **partial** — production use, not the class design · fetched 2026-10-14
- **Also good:** [Token bucket](https://en.wikipedia.org/wiki/Token_bucket) · Wikipedia · tokens added at a fixed rate to a bucket of fixed capacity, checked per request (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How we built rate limiting capable of scaling to millions of domains](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/) · Cloudflare Blog · sliding windows built from only GET, SET and INCR, as an alternative to the naive fixed window (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Low-Level Design: API Rate Limiter](https://www.techinterview.org/post/3233466721/lld-api-rate-limiter/) · techinterview.org (prep site, unsigned; illustrative) · token bucket and sliding window log as classes over Redis, retrying on WatchError (*read*) · fetched 2026-10-14
- **Our delta:** both algorithms as strategies behind one interface, with per-key limits and a distributed store as the twist.

### T20-06 · Elevator system — Master · 🔲 not written
- **Read this:** [Elevator algorithm](https://en.wikipedia.org/wiki/Elevator_algorithm) · Wikipedia · SCAN keeps travelling in its current direction until empty, named after the behaviour of a building elevator (*read*) · covers our angle: **partial** — disk scheduling, not multiple cars · fetched 2026-10-14
- **Also good:** [State](https://refactoring.guru/design-patterns/state) · refactoring.guru · behaviour that changes with internal state (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Low-Level Design: Elevator System](https://www.techinterview.org/post/3233463535/low-level-design-elevator-system/) · techinterview.org (prep site, unsigned; illustrative) · a dispatcher using nearest car with a directional preference based on LOOK, scoring with a penalty for reversing (*read*) · fetched 2026-10-14
- **Our delta:** requests, cars, a scheduling strategy, and the twist of multiple cars with direction-aware scheduling.

### T20-07 · Notification system — Master · 🔲 not written
- **Read this:** [Amazon SNS message delivery retries](https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html) · AWS docs · retries with jitter, and after the policy is exhausted the message is discarded unless a dead-letter queue is attached (*read*) · covers our angle: **partial** — retry policy, not preferences or templates · fetched 2026-10-14
- **Also good:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe API docs · an idempotency key lets a request be retried without being performed twice (*read*) · fetched 2026-10-14
- **Also good:** [Observer](https://refactoring.guru/design-patterns/observer) · refactoring.guru · notify many subscribers of an event (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur Leach, 27 Oct 2017 · atomic phases around each foreign state mutation so a retry resumes where it stopped (*read*) · fetched 2026-10-14
- **Our delta:** channels, templates, preferences and retries, with per-user rate limits and idempotent sends as the twist.

### T20-08 · In-memory key-value store with transactions — Master · 🔲 not written
- **Read this:** [Transactions](https://redis.io/docs/latest/develop/using-commands/transactions/) · Redis docs · MULTI, EXEC, DISCARD and WATCH, with commands serialized and never interleaved with another client's request (*read*) · covers our angle: **partial** — no nested transactions or rollback of keys · fetched 2026-10-14
- **Also good:** [Nested transaction](https://en.wikipedia.org/wiki/Nested_transaction) · Wikipedia · changes stay invisible to unrelated transactions until the outermost commits (*read*) · fetched 2026-10-14
- **Our delta:** get, set, delete, begin, commit, rollback and nesting, with TTL and concurrent readers as the twist.

### T20-09 · Task scheduler — Master · 🔲 not written
- **Read this:** [ScheduledExecutorService](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ScheduledExecutorService.html) · Oracle, Java SE 21 · schedules commands after a delay or periodically with scheduleAtFixedRate and scheduleWithFixedDelay (*read*) · covers our angle: **partial** — an in-process pool, no priorities or persistence · fetched 2026-10-14
- **Also good:** [Quartz tutorial, triggers](https://www.quartz-scheduler.org/documentation/quartz-2.3.0/tutorials/tutorial-lesson-04.html) · Quartz docs · a misfire is a persistent trigger missing its fire time because the scheduler was down or no thread was free, with per-trigger misfire instructions (*read*) · fetched 2026-10-14
- **Our delta:** one-off and recurring jobs, priorities, a worker pool, and the twist of missed runs and exactly-once execution.

### T20-10 · Vending machine — Master · 🔲 not written
- **Read this:** [State](https://refactoring.guru/design-patterns/state) · refactoring.guru · the pattern the classic vending machine exercise is built on (*read*) · covers our angle: **partial** — no refunds or stock edge cases · fetched 2026-10-14
- **Also good:** [Finite-state machine](https://en.wikipedia.org/wiki/Finite-state_machine) · Wikipedia · names vending machines that dispense on the proper combination of coins as a simple example (*read*) · fetched 2026-10-14
- **Our delta:** states, coins and inventory, with refunds and out-of-stock mid-transaction as the twist.

### T20-11 · Payment gateway state machine — Master · 🔲 not written
- **Read this:** [The lifecycle of a PaymentIntent](https://docs.stripe.com/payments/paymentintents/lifecycle) · Stripe docs · states including requires_capture, processing, succeeded and canceled, with cancellation irreversible (*read*) · covers our angle: **partial** — one provider's states · fetched 2026-10-14
- **Also good:** [Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks) · Stripe docs · endpoints may receive the same event more than once, so log processed event IDs and skip repeats (*read*) · covers our angle: **full** for the twice-arriving webhook · fetched 2026-10-14
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur Leach, 27 Oct 2017 · idempotency key table and atomic phases for payment calls (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Payment System Low-Level Design](https://www.techinterview.org/post/3233466877/lld-payment-system/) · techinterview.org (prep site, unsigned; illustrative) · a payment state machine that forbids arbitrary transitions, plus a webhook handler that checks a signature and an event id (*read*) · fetched 2026-10-14
- **Our delta:** initiated, authorised, captured, refunded and failed, with the webhook that arrives twice as the twist.

### T20-12 · Flash-sale inventory service — Master · 🔲 not written
- **Read this:** [Optimistic concurrency control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control) · Wikipedia · works when conflicts are rare, and repeated rollback is costly under high contention (*read*) · covers our angle: **partial** — the trade-off, not the service · fetched 2026-10-14
- **Also good:** [SELECT](https://www.postgresql.org/docs/current/sql-select.html) · PostgreSQL docs · the locking clause with FOR UPDATE, NOWAIT and SKIP LOCKED (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Low-Level Design: Flash Sale System](https://www.techinterview.org/post/3233464757/lld-flash-sale-system/) · techinterview.org (prep site, unsigned; illustrative) · the goal of no oversell and no undersell, with reservations that expire and a queue for fairness (*read*) · fetched 2026-10-14
- **Our delta:** reservations, decrements and expiry, with ten thousand requests for one unit as the twist.

### T20-13 · Cab booking — Understand · 🔲 not written
- **Read this:** [Low Level Design: Ride-Hailing Dispatch System](https://www.techinterview.org/post/3233472823/lld-ride-hailing-dispatch/) · techinterview.org (prep site, unsigned; illustrative) · cancellations as transitions on the trip state machine, driver cancellations re-queueing the rider with priority, and offer states with an expiry (*read*) · covers our angle: **partial** — dispatch scale rather than a class model · fetched 2026-10-14
- **Also good:** [State](https://refactoring.guru/design-patterns/state) · refactoring.guru · the trip lifecycle pattern (*read*) · fetched 2026-10-14
- **Our delta:** riders, drivers, matching and a trip state machine, with cancellation and driver reassignment as the twist.

### T20-14 · Food delivery — Understand · 🔲 not written
- **Read this:** [The lifecycle of a PaymentIntent](https://docs.stripe.com/payments/paymentintents/lifecycle) · Stripe docs · a cancel before capture releases held funds, the mechanism behind a partial cancellation or refund (*read*) · covers our angle: **partial** — payment side only · fetched 2026-10-14
- **Also good:** [Low Level Design: Ride-Hailing Dispatch System](https://www.techinterview.org/post/3233472823/lld-ride-hailing-dispatch/) · techinterview.org (prep site, unsigned; illustrative) · offer and acceptance with expiry, the same dispatch shape as riders (*read*) · fetched 2026-10-14
- **Our delta:** orders, restaurants, riders and dispatch, with partial cancellations and refunds as the twist.

### T20-15 · Hotel booking — Understand · 🔲 not written
- **Read this:** [Range Types](https://www.postgresql.org/docs/current/rangetypes.html) · PostgreSQL docs · date ranges for scheduling are the clearest use, and under Constraints on Ranges a `reservation` table with `EXCLUDE USING GIST (during WITH &&)` rejects any overlapping booking with a conflicting-key error (*read*) · covers our angle: **partial** — the database guard, not the class model or overbooking policy · fetched 2026-10-14
- **Also good:** [Range](https://martinfowler.com/eaaDev/Range.html) · Martin Fowler, 7 March 2004 · one object represents a range and offers the operations to compare ranges (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Low-Level Design: Hotel Reservation System](https://www.techinterview.org/post/3233464423/lld-hotel-reservation-system/) · techinterview.org (prep site, unsigned; illustrative) · an overlap test of existing check-in before requested check-out and existing check-out after requested check-in (*read*) · fetched 2026-10-14
- **Our delta:** rooms, rates, availability and an overbooking policy, with date-range conflicts as the twist.

### T20-16 · Library management — Understand · 🔲 not written
- **Read this:** [Integrated library system](https://en.wikipedia.org/wiki/Integrated_library_system) · Wikipedia · circulation as lending to patrons and receiving items back, with a unique ID for each patron and item (*read*) · covers our angle: **partial** — the domain vocabulary, no loans or fines model · fetched 2026-10-14
- **Also good:** [State](https://refactoring.guru/design-patterns/state) · refactoring.guru · copy status changes such as available, loaned, reserved (*read*) · fetched 2026-10-14
- **Our delta:** books, copies, members, loans and fines, with reservations on a checked-out copy as the twist.

### T20-17 · Logging framework — Understand · 🔲 not written
- **Read this:** [Asynchronous loggers](https://logging.apache.org/log4j/2.x/manual/async.html) · Apache Log4j · asynchronous logging runs all I/O in a separate thread, offered as an async appender (queue-based) and async loggers (LMAX Disruptor) (*read*) · covers our angle: **partial** — async only, not levels or formatters · fetched 2026-10-14
- **Also good:** [Chain of Responsibility](https://refactoring.guru/design-patterns/chain-of-responsibility) · refactoring.guru · handlers passing a request along a chain, the shape of level-based log routing (*read*) · fetched 2026-10-14
- **Our delta:** levels, appenders, formatters and a chain, with asynchronous appenders and loss on crash as the twist.

### T20-18 · Publish-subscribe system — Understand · 🔲 not written
- **Read this:** [Publish-subscribe pattern](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern) · Wikipedia · publishers send messages by topic without knowing receivers, and a broker that stops after a time cannot guarantee assured delivery (*read*) · covers our angle: **partial** — no slow-subscriber handling · fetched 2026-10-14
- **Also good:** [Consumer Prefetch](https://www.rabbitmq.com/docs/consumer-prefetch) · RabbitMQ docs · limits the number of unacknowledged messages per consumer, the standard control for a slow subscriber (*read*) · fetched 2026-10-14
- **Our delta:** topics, subscribers and delivery guarantees, with a slow subscriber as the twist.

### T20-19 · Text editor with undo and redo — Understand · 🔲 not written
- **Read this:** [Command](https://refactoring.guru/design-patterns/command) · refactoring.guru · undoable text-editor operations, with a command history stack and a backup of editor state (*read*) · covers our angle: **partial** — no keystroke grouping · fetched 2026-10-14
- **Also good:** [Memento](https://refactoring.guru/design-patterns/memento) · refactoring.guru · saves and restores earlier state without exposing implementation, introduced through undo (*read*) · fetched 2026-10-14
- **Our delta:** Command with a history stack, and grouping keystrokes into one undo step as the twist.

### T20-20 · Chat application — Understand · 🔲 not written
- **Read this:** [Designing chat architecture for reliable message ordering at scale](https://ably.com/blog/chat-architecture-reliable-message-ordering) · Ably, 15 Nov 2024 · ordering is not guaranteed beyond a direct connection between two users and gets hard as clients and servers multiply (*read*) · covers our angle: **partial** — ordering, not read receipts or the class model · fetched 2026-10-14
- **Also good:** [Observer](https://refactoring.guru/design-patterns/observer) · refactoring.guru · delivering a message to the participants subscribed to a conversation (*read*) · fetched 2026-10-14
- **Our delta:** users, conversations, messages and read receipts, with group chats and ordering as the twist.

### T20-21 · Coupon and discount engine — Understand · 🔲 not written
- **Read this:** [Chain of Responsibility](https://refactoring.guru/design-patterns/chain-of-responsibility) · refactoring.guru · requests pass through a series of checks, each handler processing or passing on (*read*) · covers our angle: **partial** — no stacking or exclusivity rules · fetched 2026-10-14
- **Also good:** [Strategy](https://refactoring.guru/design-patterns/strategy) · refactoring.guru · each discount rule as an interchangeable class (*read*) · fetched 2026-10-14
- **Our delta:** rules, eligibility, stacking and a pipeline, with mutually exclusive offers as the twist.

### T20-22 · Meeting scheduler — Understand · 🔲 not written
- **Read this:** [ZonedDateTime](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/ZonedDateTime.html) · Oracle, Java SE 21 · an immutable date-time with a time-zone such as Europe/Paris, the type for zone-correct meetings (*read*) · covers our angle: **partial** — zones only, not conflicts · fetched 2026-10-14
- **Also good:** [Range](https://martinfowler.com/eaaDev/Range.html) · Martin Fowler, 7 March 2004 · a range object with operations to compare ranges, the model for conflict checks (*read*) · fetched 2026-10-14
- **Also good:** [RFC 5545, iCalendar](https://www.rfc-editor.org/info/rfc5545/) · RFC Editor, September 2009 · the iCalendar format for events, to-dos and free/busy, with section 3.3.10 Recurrence Rule and the TZID parameter; since updated by later RFCs including 7529 and 7986 (*read*) · fetched 2026-10-14
- **Our delta:** rooms, participants, conflicts and recurrence, with time zones as the twist.

### T20-23 · Stack Overflow — Understand · 🔲 not written
- **Read this:** [What is reputation?](https://stackoverflow.com/help/whats-reputation) · Stack Overflow Help Center · a question or answer upvote earns +10, an accepted answer +15, with a daily cap of 200 from upvotes, downvotes and edits (*read*) · covers our angle: **full** for the rules a strategy encodes · fetched 2026-10-14
- **Also good:** [Strategy](https://refactoring.guru/design-patterns/strategy) · refactoring.guru · reputation rules as swappable classes (*read*) · fetched 2026-10-14
- **Our delta:** questions, answers, votes and reputation, with the reputation rules modelled as a strategy.

### T20-24 · Inventory management — Understand · 🔲 not written
- **Read this:** [Audit Log](https://martinfowler.com/eaaDev/AuditLog.html) · Martin Fowler, 7 March 2004 · write a record of what happened and when each time something significant happens (*read*) · covers our angle: **partial** — the trail, not stock movements · fetched 2026-10-14
- **Beyond the docs:** [Inventory Management System Low-Level Design](https://www.techinterview.org/post/3233467520/lld-inventory-system/) · techinterview.org (prep site, unsigned; illustrative) · an inventory transaction record for reserve, release, fulfil and transfer, and SELECT FOR UPDATE to stop two orders taking the last unit (*read*) · fetched 2026-10-14
- **Our delta:** SKUs, warehouses, stock movements and an audit trail, with transfers between warehouses as the twist.

### T20-25 · URL shortener, the LLD version — Understand · 🔲 not written
- **Read this:** [URL shortening](https://en.wikipedia.org/wiki/URL_shortening) · Wikipedia · a technique where a short URL redirects to the long one (*read*) · covers our angle: **partial** — the concept, no encoding or collisions · fetched 2026-10-14
- **Also good:** [Repository](https://martinfowler.com/eaaCatalog/repository.html) · Martin Fowler · the storage interface behind the shortener (*read*) · fetched 2026-10-14
- **Our delta:** encoding, a storage interface and expiry, with custom aliases and collisions as the twist.

### T20-26 · File system — Understand · 🔲 not written
- **Read this:** [rename(2)](https://man7.org/linux/man-pages/man2/rename.2.html) · Linux man-pages · an existing newpath is atomically replaced so no process finds it missing (*read*) · covers our angle: **partial** — one operation · fetched 2026-10-14
- **Also good:** [unlink(2)](https://man7.org/linux/man-pages/man2/unlink.2.html) · Linux man-pages · a file still open by a process stays in existence until the last descriptor closes, the answer for open handles (*read*) · fetched 2026-10-14
- **Our delta:** directories, files, paths and permissions, with move and rename under open handles as the twist.

### T20-27 · Board games: tic-tac-toe, chess, snake and ladder — Understand · 🔲 not written
- **Read this:** [Board Representation](https://chessprogramming.org/Board_Representation) · Chess Programming Wiki · piece-centric bitboards against square-centric mailbox and 0x88 arrays (*read*) · covers our angle: **partial** — chess only · fetched 2026-10-14
- **Also good:** [Tic-tac-toe](https://en.wikipedia.org/wiki/Tic-tac-toe) · Wikipedia · a paper-and-pencil game for two players (*read*) · fetched 2026-10-14
- **Also good:** [Memento](https://refactoring.guru/design-patterns/memento) · refactoring.guru · saving snapshots for undo and replay (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to design Snake and Ladder?](https://workat.tech/machine-coding/editorial/how-to-design-snake-and-ladder-machine-coding-ehskk9c40x2w) · workat.tech (prep site; walkthrough) · a 100-cell board, a six-sided dice, no move past 100, a Driver class and a SnakeAndLadderService, with two dice and a custom board size as optional extensions (*read*) · fetched 2026-10-14
- **Our delta:** board, pieces, move validation and a game loop, with undo and replay as the twist.

### T20-28 · Cricket scoreboard — Know · 🔲 not written
- **Read this:** [Law 21: No Ball](https://lawsofcricket.lords.org/laws-of-cricket/the-over-scoring-runs-dead-ball-and-extras/no-ball) · MCC Laws of Cricket · a one-run penalty awarded on the call, scored as a No ball extra and debited against the bowler, and a No ball does not count as one of the over (*read*) · covers our angle: **partial** — one extra; Laws 22 and 23 cover wides, byes and leg byes · fetched 2026-10-14
- **Also good:** [Scorer](https://en.wikipedia.org/wiki/Scorer) · Wikipedia · the scorer fills in a bowling analysis and a batting analysis per ball, and software scorers record ball-by-ball events (*read*) · fetched 2026-10-14
- **Our delta:** matches, innings, balls and statistics, with derived statistics kept consistent as the twist.

### T20-29 · ATM — Know · 🔲 not written
- **Read this:** [State](https://refactoring.guru/design-patterns/state) · refactoring.guru · an object whose behaviour changes with its state, the ATM session model (*read*) · covers our angle: **partial** — no cash dispensing · fetched 2026-10-14
- **Also good:** [Nested transaction](https://en.wikipedia.org/wiki/Nested_transaction) · Wikipedia · changes stay invisible until the outermost transaction commits, relevant to a partial dispense failure (*read*) · fetched 2026-10-14
- **Our delta:** states, cash dispensing and accounts, with partial dispense failure as the twist.

### T20-30 · Amazon locker — Know · 🔲 not written
- **Read this:** [Bin packing problem](https://en.wikipedia.org/wiki/Bin_packing_problem) · Wikipedia · items of different sizes packed into a finite number of fixed-capacity bins, the model for allocation across locker sizes (*read*) · covers our angle: **partial** — theory, no codes or expiry · fetched 2026-10-14
- **Our delta:** lockers, sizes, codes and expiry, with allocation across sizes as the twist.
