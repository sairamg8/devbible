---
title: "04 · Spring @Transactional"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: see each chunk's own `> Verified:` line.

**68 chunks.**

<!--CHUNKS-->

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · Not a language feature](01-not-a-language-feature.md)** | @Transactional is metadata on a method, not an instruction to the JVM — and something has to be listening for it to mean anything |
| 2 | **[2 · The proxy](02-the-proxy.md)** | The bean you injected is not the object you wrote, and which kind of impostor it is decides what the annotation can reach |
| 3 | **[2b · Where the annotation lives](02b-where-the-annotation-lives.md)** | The interceptor asks one question per call — 'does this method have a transaction attribute?' — and inheritance answers it in w… |
| 4 | **[2c · Visibility and interfaces](02c-visibility-and-the-interface-question.md)** | Whether a method can be advised at all comes down to two things the compiler decided for you: its visibility and where it was d… |
| 5 | **[2d · The inheritance rule](02d-the-inheritance-rule.md)** | A class-level @Transactional flows down to subclasses and never up to ancestors — which is why moving a method to a base class … |
| 6 | **[3 · The self-invocation trap](03-the-self-invocation-trap.md)** | A method calling another method of its own class never goes through the proxy, so the annotation on the inner method does nothi… |
| 7 | **[3b · The initialization variant](03b-the-initialization-variant.md)** | Initialization code is the one shape that fails twice, because the proxy has not been built yet and no reference to it exists t… |
| 8 | **[3c · Bound receivers](03c-bound-receivers.md)** | A default method, a lambda and a method reference all bind to the target instance, so the call is a self-invocation with no vis… |
| 9 | **[4 · Fixing self-invocation](04-fixing-self-invocation.md)** | Two ways to fix self-invocation by changing where the transaction is declared — one of which is right, and one of which works b… |
| 10 | **[4b · The escape hatches](04b-the-escape-hatches.md)** | Two runtime escape hatches: recovering the proxy from a ThreadLocal, which Spring calls highly discouraged, and abandoning the … |
| 11 | **[4c · AspectJ weaving](04c-aspectj-weaving.md)** | AspectJ weaving is the only option that makes the ignored annotation actually work, because there is no proxy left to bypass |
| 12 | **[5 · Annotations that do nothing](05-annotations-that-do-nothing.md)** | Nine placements where @Transactional compiles, starts, runs and does absolutely nothing, in the order you should check them |
| 13 | **[5b · Detecting a dead annotation](05b-detecting-a-dead-annotation.md)** | Three ways to ask the running application whether a transaction is actually there, because reading the code only tells you what… |
| 14 | **[5c · Proving it and preventing it](05c-proving-it-and-preventing-it.md)** | The two techniques that belong permanently in a project: a test that fails when the boundary is missing, and a build rule that … |
| 15 | **[6 · The transaction manager](06-the-transaction-manager.md)** | Spring's entire transaction story is one interface with three methods, and everything else in this topic is an argument about w… |
| 16 | **[6b · The implementations](06b-which-manager-you-have.md)** | The five implementations behind the interface, and the four javadoc sentences on the JDBC one that explain most of the surprise… |
| 17 | **[6c · What Boot picked for you](06c-what-boot-picked-for-you.md)** | In a Boot application nothing in your code names a transaction manager, so adding a dependency can change one — and two data so… |
| 18 | **[6d · The status handle](06d-the-status-handle.md)** | The status object is a handle to a scope, not to a transaction — and the one boolean on it tells you whether your settings were… |
| 19 | **[7 · Thread binding](07-thread-binding.md)** | The transaction is a Connection in a ThreadLocal, and asking the DataSource for a connection gets you a different one that is n… |
| 20 | **[7b · Getting the connection safely](07b-getting-the-connection-safely.md)** | Getting a raw Connection without leaving the transaction, releasing it without closing it, and the one wrapper Spring tells you… |
| 21 | **[8 · Propagation REQUIRED](08-propagation-required.md)** | Three annotated methods in a call chain produce three logical scopes and exactly one physical transaction, and only the outermo… |
| 22 | **[8b · Whose settings win](08b-whose-settings-win.md)** | A participating transaction silently ignores its own isolation, timeout and read-only flag — and there is one switch that turns… |
| 23 | **[8c · Making the mismatch loud](08c-making-the-mismatch-loud.md)** | validateExistingTransaction turns a silently ignored setting into an exception — off by default, and one of the few flags worth… |
| 24 | **[9 · Marked rollback-only](09-marked-rollback-only.md)** | You caught the exception, you handled it, your method returned normally — and the commit threw UnexpectedRollbackException anyway |
| 25 | **[9b · Fixing the rollback-only trap](09b-fixing-the-rollback-only-trap.md)** | Three ways out of the rollback-only trap, and choosing between them is a business decision about whether one failed item is fat… |
| 26 | **[10 · REQUIRES_NEW](10-requires-new.md)** | REQUIRES_NEW starts a genuinely separate transaction on a second connection, and Spring's own documentation states the arithmet… |
| 27 | **[10b · When REQUIRES_NEW is right](10b-when-requires-new-is-right.md)** | One shape where REQUIRES_NEW is unambiguously right, three where it is chosen because it was the smallest change that made an e… |
| 28 | **[10c · What suspension costs](10c-what-suspension-costs.md)** | Suspending a transaction is a thread-binding operation and nothing else — the database is never told, and every lock the outer … |
| 29 | **[11 · NESTED and savepoints](11-nested-and-savepoints.md)** | NESTED is not a second transaction — it is one physical transaction with a savepoint, and that single fact decides everything i… |
| 30 | **[11b · Choosing NESTED](11b-choosing-nested.md)** | NESTED does the job REQUIRES_NEW is usually hired for, at one connection instead of two — unless you are on JPA, where it throws |
| 31 | **[12 · The other propagations](12-the-other-propagations.md)** | Two of the remaining four propagations change nothing at all — MANDATORY and NEVER are runtime assertions, and MANDATORY is the… |
| 32 | **[12b · SUPPORTS and NOT_SUPPORTED](12b-supports-and-not-supported.md)** | SUPPORTS and NOT_SUPPORTED adapt to whatever they find, and both cost something their one-line definitions never mention |
| 33 | **[12c · The empty transaction](12c-the-empty-transaction.md)** | When there is nothing to join and nothing to start, Spring does not do nothing — it builds an \"empty\" transaction, and that o… |
| 34 | **[13 · Rollback rules](13-rollback-rules.md)** | An unchecked exception rolls the transaction back and a checked exception commits it — Spring's default is the opposite of what… |
| 35 | **[13b · Changing the rule](13b-changing-the-rule.md)** | You can change the rollback rule on one method or on the whole application — and Spring's own javadoc tells you which one you p… |
| 36 | **[13c · How a rule is matched](13c-how-a-rule-is-matched.md)** | A rollback rule written as a string matches by substring, not by type — so a rule for CustomException also fires for CustomExce… |
| 37 | **[13d · The matching algorithm](13d-the-matching-algorithm.md)** | Explicit rollback rules ADD to the default rather than replacing it — the twenty lines of Spring source that decide every rollb… |
| 38 | **[13e · When rules collide](13e-when-rules-collide.md)** | When two rollback rules match the same exception the shallowest one wins — which is how a loose pattern quietly overrides the t… |
| 39 | **[14 · The caught exception](14-the-caught-exception.md)** | Catching an exception inside a transactional method rolls back nothing — the interceptor never sees a failure, so it commits |
| 40 | **[14b · Three honest options](14b-three-honest-options.md)** | There are exactly three honest things to do when something fails inside a transactional method, and 'catch it and carry on' is … |
| 41 | **[14b2 · Its own transaction](14b2-its-own-transaction.md)** | the third honest option moves the catch outside the boundary entirely — which buys independence and pays for it in atomicity, d… |
| 42 | **[14c · What the database did](14c-what-the-database-did.md)** | On PostgreSQL a failed statement poisons the whole transaction — so the loop that catches and carries on usually cannot carry on |
| 43 | **[15 · Read-only](15-read-only.md)** | readOnly = true is a hint that passes through four independent layers, and each of them is free to ignore it |
| 44 | **[15b · Where read-only pays](15b-where-read-only-pays.md)** | The read-only win is Hibernate skipping dirty checking and the flush — and the flag is silently ignored on a transaction it did… |
| 45 | **[16 · Isolation](16-isolation.md)** | Isolation on @Transactional applies only to a transaction Spring actually starts — set it on a method that joins one and it is … |
| 46 | **[16b · Isolation in the plumbing](16b-isolation-in-the-plumbing.md)** | Isolation is session state on a pooled connection, so three layers decide what DEFAULT means and two independent mechanisms put… |
| 47 | **[17 · Timeouts](17-timeouts.md)** | A transaction timeout is not a wall clock — it is checked before operations and pushed down as a JDBC statement timeout, and co… |
| 48 | **[17b · What actually bounds it](17b-what-actually-bounds-it.md)** | The only thing that reliably bounds a runaway transaction is the database, because it is the participant no application code ca… |
| 49 | **[18 · Threads and @Async](18-threads-and-async.md)** | The transaction is bound to a ThreadLocal, so the moment work moves to another thread it leaves the transaction behind and gets… |
| 50 | **[18b · Reactive and virtual threads](18b-reactive-and-virtual-threads.md)** | The reactive model puts the transaction in the subscriber context instead of a ThreadLocal, and virtual threads change the econ… |
| 51 | **[19 · Transactional events](19-transactional-events.md)** | @TransactionalEventListener delays a listener until a chosen phase of the transaction — and if there is no transaction it does … |
| 52 | **[19b · After-commit is not durable](19b-after-commit-is-not-durable.md)** | AFTER_COMMIT runs after the commit, which means a crash in between loses the side effect forever — the outbox is what survives … |
| 53 | **[20 · Transactions in tests](20-transactions-in-tests.md)** | @Transactional on a test method means something different from @Transactional on a service method — the test's transaction is r… |
| 54 | **[20b · The false positives](20b-the-false-positives.md)** | The test passes because nothing was ever flushed — the same code throws in production, and Spring's own documentation warns abo… |
| 55 | **[20c · The other ways a test lies](20c-the-other-ways-a-test-lies.md)** | Flushing is only the first way a transaction test lies — a second thread and a mocked repository each give you a green test ove… |
| 56 | **[20d · What a test must assert](20d-what-a-test-must-assert.md)** | A transaction test is only worth something if it asserts on state the database actually produced — an assertion answered from t… |
| 57 | **[20e · What the context hides](20e-what-the-context-hides.md)** | The persistence context answers reads the database never sees — which is why a lifecycle callback can silently never run and a … |
| 58 | **[20f · Asserting the boundary exists](20f-asserting-the-boundary-exists.md)** | The assertion nobody writes is that a transaction existed at all — and it is the only one that catches a self-invocation or a d… |
| 59 | **[20g · Asserting the settings](20g-asserting-the-settings.md)** | A boundary that exists can still have the wrong settings — and the manager reports what the actual transaction got, not what yo… |
| 60 | **[20h · Asserting the commit](20h-asserting-the-commit.md)** | The only place a rollback can be observed is from outside the transaction that was rolled back — which is why the assertion bel… |
| 61 | **[20i · Committing, and what participates](20i-committing-and-what-participates.md)** | Committing in a test is a debt you take on, and the propagation of the code under test decides how much of it the rollback was … |
| 62 | **[20j · The fixture and the real database](20j-the-fixture-and-the-real-database.md)** | The fixture is a transactional decision too — and an in-memory database quietly removes every engine behaviour the test was wri… |
| 63 | **[20k · Getting the real engine in](20k-getting-the-real-engine-into-the-test.md)** | on Boot 4 the annotation everybody adds to get a real database under a test is not only unnecessary, it removes the check that … |
| 64 | **[21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md)** | A transaction is a lock on shared state, so its duration is a concurrency budget — and an HTTP call inside one spends that budg… |
| 65 | **[21b · Shaping the work](21b-shaping-the-work.md)** | Read, then act: do the slow part with no transaction open, then take a short one for the write — and put the retry above the bo… |
| 66 | **[22 · The debugging order](22-the-checklist.md)** | \"My @Transactional did nothing\" — the eight checks, in the order that finds it fastest |
| 67 | **[22b · Reviewing a service](22b-reviewing-a-service.md)** | What to look for when you review a transactional service, and the four defaults worth changing once for the whole application |
