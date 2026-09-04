---
title: "A scheduled job is two artefacts pretending to be one — a cron string and a body of work — and the only reason anyone waits for a schedule in a test is that the annotated method's signature is legally forbidden from taking the arguments that would make it testable"
sidebar_label: "07b · Testing a scheduled job"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.x** reference *Task Execution and
> Scheduling*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/scheduling.html));
> the `CronExpression`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/support/CronExpression.html)),
> `ScheduledTaskHolder`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/config/ScheduledTaskHolder.html))
> and `TaskUtils`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/support/TaskUtils.html))
> javadocs; the **Spring Boot 4.1** reference *Task Execution and Scheduling*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html));
> and the **JDK 25** `ScheduledExecutorService` javadoc
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ScheduledExecutorService.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**`@Scheduled` is proxy-driven configuration wrapped around ordinary code, and the testable
thing is the ordinary code plus a separate, cheap assertion that the cron string says what
you think it says. Nobody should ever wait for a schedule to fire in a test. The clue telling
you to extract is in the annotation's own contract: the method it decorates is not allowed to
take arguments or return anything.**

## The constraint that dictates the design

From the reference, about `@Scheduled`:

> *"Notice that the methods to be scheduled must have void returns and must not accept any
> arguments."*

Read that as a design instruction rather than a limitation. A method that takes no arguments
and returns nothing is a method whose inputs and outputs are hidden state — the worst
possible test subject. So the annotated method should be a **shell**, one line long, and
everything you want to assert should live in a method with parameters and a return value.

```java
@Component
public class ExpiryJob {

    private final ExpiryService service;
    private final Clock clock;

    public ExpiryJob(ExpiryService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "Europe/London")
    void runNightly() {                       // the shell — no arguments, no return
        expireOlderThan(Instant.now(clock).minus(Duration.ofDays(30)));
    }

    /** The unit under test: takes its cutoff, reports what it did. */
    public ExpiryReport expireOlderThan(Instant cutoff) {
        List<Reservation> stale = service.findExpiring(cutoff);
        stale.forEach(service::expire);
        return new ExpiryReport(stale.size(), cutoff);
    }
}
```

The interesting test now has no schedule, no Spring and no waiting:

```java
@Test
void expiresOnlyReservationsOlderThanTheCutoff() {
    ExpiryReport report = job.expireOlderThan(Instant.parse("2026-01-01T00:00:00Z"));

    assertThat(report.expiredCount()).isEqualTo(2);
    verify(service).expire(oldReservation);
    verify(service, never()).expire(freshReservation);
}
```

And the shell — the part that computes "thirty days ago" — is testable because the `Clock` is
injected. `MutableClock` from [01b](01b-the-js-to-java-map.md) drives it:

```java
@Test
void theNightlyRunUsesAThirtyDayWindow() {
    clock.setTo("2026-03-15T03:15:00Z");

    job.runNightly();

    verify(service).findExpiring(Instant.parse("2026-02-13T03:15:00Z"));
}
```

Note what is being asserted: the *arithmetic*, not the *timing*. Advancing a clock never
makes a scheduler fire — [01c](01c-where-the-analogy-breaks.md)'s fourth break — and this
test does not need it to.

## Asserting the schedule as configuration

The cron string is the remaining risk, and it is a real one: `0 15 3 * * *` and `0 15 3 * * ?`
and `15 3 * * *` are three different things, one of which is a five-field crontab that Spring
will reject. Spring gives you a parser you can point at it:

```java
@Test
void theNightlyCronMeansQuarterPastThreeEveryDay() {
    CronExpression cron = CronExpression.parse("0 15 3 * * *");

    ZonedDateTime from = ZonedDateTime.parse("2026-03-15T09:00:00Z");
    assertThat(cron.next(from))
            .isEqualTo(ZonedDateTime.parse("2026-03-16T03:15:00Z"));
}
```

`CronExpression` is documented as a *"Representation of a crontab expression that can
calculate the next time it matches"*, created *"through `parse(String)`"* with *"the next
match … determined with `next(Temporal)`"*. There is also
`CronExpression.isValidExpression(String)` — *"Determine whether the given string represents
a valid cron expression"* — which is enough for a parameterized test over every cron string
in the application, read out of the properties file.

⚠️ One dialect warning straight from the javadoc, because it bites teams migrating from
Quartz: Spring *"Supports a Quartz day-of-month/week field with an `L`/`#` expression"* but
*"follows common cron conventions in every other respect, including 0-6 for SUN-SAT (plus 7
for SUN as well). Note that Quartz deviates from the day-of-week convention in cron through
1-7 for SUN-SAT whereas Spring strictly follows cron"*. A weekly job copied from a Quartz
config runs on the wrong day and nobody notices for a week. The `next()` assertion above
catches it in milliseconds.

To assert the task is actually *registered* — that the bean was scanned, that
`@EnableScheduling` is present, that nobody commented the annotation out during an
incident — the context exposes `ScheduledTaskHolder`, documented as returning *"an overview
of the tasks that have been scheduled by this instance"*:

```java
@Autowired ScheduledTaskHolder taskHolder;

@Test
void theExpiryJobIsRegisteredWithTheScheduler() {
    assertThat(taskHolder.getScheduledTasks())
            .extracting(task -> task.getTask().toString())
            .anyMatch(s -> s.contains("ExpiryJob.runNightly"));
}
```

Spring Boot's own doc confirms the enabling annotation is still yours to write: *"A scheduler
can also be auto-configured if it needs to be associated with scheduled task execution
(using `@EnableScheduling` for instance)."*

## The scheduled job that fails silently forever

Two documented behaviours combine into the most under-tested property of scheduled work.

The JDK, on `scheduleAtFixedRate`:

> *"An execution of the task throws an exception. In this case calling `get` on the returned
> future will throw `ExecutionException`, holding the exception as its cause. Subsequent
> executions are suppressed."*

Spring, however, decorates repeating tasks with an error handler that changes this.
`TaskUtils.LOG_AND_SUPPRESS_ERROR_HANDLER` is documented as:

> *"An `ErrorHandler` strategy that will log the Exception but perform no further handling.
> This will suppress the error so that subsequent executions of the task will not be
> prevented."*

So a Spring-scheduled job that throws does **not** stop — it logs and runs again next time,
forever, failing every time. That is better than the raw JDK behaviour and worse for
observability: there is no failed future, no alert, no metric, and the only artefact is a log
line in a stream nobody reads. The testable consequence is that your job's failure handling
has to be code you wrote — a counter, a status row, a `Result` return — and that code is what
the test asserts:

```java
@Test
void recordsAFailedRunInsteadOfThrowing() {
    when(service.findExpiring(any())).thenThrow(new DataAccessResourceFailureException("down"));

    ExpiryReport report = job.expireOlderThan(CUTOFF);

    assertThat(report.status()).isEqualTo(RunStatus.FAILED);
    verify(runLog).record(argThat(r -> r.failed()));
}
```

And the overlap question, which people assume the annotation handles: it does, but only
because of the executor. The JDK contract for `scheduleAtFixedRate` is *"If any execution of
this task takes longer than its period, then subsequent executions may start late, but will
not concurrently execute."* One task never overlaps itself. It can still **queue**, and with
Boot's default `ThreadPoolTaskScheduler` — the reference says it *"uses one thread by
default"* — a slow job delays every *other* scheduled job in the application. That is a
production property worth knowing and not something a test will tell you.

## Where this connects

- The async half of the same argument, and the wiring-test pattern this reuses:
  [07 · Async, scheduled and eventual](07-async-scheduled-and-eventual.md).
- Bounding the one wait you cannot remove:
  [07a · Waiting without sleeping](07a-waiting-without-sleeping.md).
- Application events and retry policies — the other two annotations with this shape:
  [07c · Events and retries](07c-events-and-retries.md).
- The `MutableClock` that drives the shell method:
  [01b · The JS-to-Java map](01b-the-js-to-java-map.md).
- Why advancing a clock cannot fire a schedule:
  [01c · Where the analogy breaks](01c-where-the-analogy-breaks.md).

## Gotchas

**★ Advancing an injected `Clock` does not make a `@Scheduled` method fire, and half the internet implies it does.**
The scheduler has its own time source. This is [01c](01c-where-the-analogy-breaks.md)'s fourth break, and it is the reason the extract-the-method pattern exists rather than being merely tidier. If a test seems to need the schedule to fire, it is testing the wrong thing.

**★ A Spring-scheduled job that throws keeps running and keeps failing, silently.**
`TaskUtils.LOG_AND_SUPPRESS_ERROR_HANDLER` *"will suppress the error so that subsequent executions of the task will not be prevented"*. There is no failed future to inspect and no default metric — the only evidence is a log line. So "does the job report its failures" is a genuine behavioural requirement that needs its own test, and if the job has no failure-reporting code, the answer is that production has no way of knowing either.

**★ A five-field crontab in `@Scheduled` is not a Unix cron expression and will not silently do the right thing.**
Spring's expression has a seconds field. `15 3 * * *` copied from a crontab is a parse failure at context startup if you are lucky and a different schedule if you are not. `CronExpression.isValidExpression(String)` over every cron string in the configuration is a five-line parameterized test that removes the whole category.

**★ Quartz and Spring disagree about day-of-week numbering.**
The `CronExpression` javadoc says Spring uses *"0-6 for SUN-SAT (plus 7 for SUN as well)"* and that *"Quartz deviates from the day-of-week convention in cron through 1-7 for SUN-SAT whereas Spring strictly follows cron"*. A migrated weekly job runs one day off, every week, and the only assertion that catches it is `cron.next(someInstant)`.

**★ `@Scheduled` without a `zone` follows the server's default time zone, which differs between your laptop and the cluster.**
A job at `0 0 2 * * *` runs at a different absolute instant on a machine in `Europe/London` than on one in `UTC`, and it moves twice a year relative to the other. Set `zone` explicitly and assert with `CronExpression.next` on a zoned temporal, which forces you to state the zone in the test too.

**★ Boot's default scheduler has one thread, so a slow job delays unrelated jobs.**
The reference states the auto-configured `ThreadPoolTaskScheduler` *"uses one thread by default"*. The JDK guarantees a task will not overlap itself — *"subsequent executions may start late, but will not concurrently execute"* — but says nothing about other tasks, which simply queue behind it. Raising `spring.task.scheduling.pool.size` is a production decision no test will prompt you to make.

**★ The scheduler starts in every test that loads a context containing `@EnableScheduling`.**
A nightly job with a `fixedDelay` and no initial delay will fire during your integration test, against your test database, while your assertions are running — producing a failure that moves around between test classes because it depends on how long the context stays up. Keep `@EnableScheduling` on a configuration class that is excluded from the test profile, and assert the schedule with `CronExpression` instead of letting it run.

**★ Extracting the shell but leaving `Instant.now()` inside the extracted method achieves nothing.**
The whole point of the shell is that the cutoff becomes a *parameter*. If the extracted method still calls `Instant.now()`, its behaviour still depends on the wall clock, the boundary cases (exactly thirty days old) are still untestable, and the test still fails one day a year. The parameter and the injected `Clock` are the same move made at two levels.

**★ Asserting `getScheduledTasks()` is not empty proves less than it looks.**
It proves the scheduler has *some* task, which the health-check job also satisfies. If the assertion is worth writing it is worth making specific — match on the task's target method — because the version that passes for the wrong reason is worse than no test, since it will be trusted.

## Interview questions

**★ How do you test a job that runs at 3:15 every morning?**
Not by waiting, and not by advancing a clock, because an injected `Clock` is a value the code reads and not a scheduler you can drive. I split it in two. The `@Scheduled` method becomes a one-line shell — it has to be, since the reference requires that scheduled methods *"must have void returns and must not accept any arguments"*, which makes it a hopeless test subject — and it delegates to a public method that takes the cutoff instant and returns a report. That method gets ordinary unit tests with no Spring at all. Then the schedule itself is configuration, and I assert it as configuration: `CronExpression.parse("0 15 3 * * *").next(someZonedDateTime)` gives me the next fire time, and I assert it is 03:15 the following day. If I also want to know the job is registered at all, `ScheduledTaskHolder.getScheduledTasks()` tells me the context has it. Three fast, deterministic tests replacing one that could never have run.

**★ Why is "the scheduled job silently failing" a testing problem rather than an operations problem?**
Because the framework guarantees that failure will be invisible unless your code makes it visible, and that is a design property a test can pin. Spring decorates repeating scheduled tasks with an error handler documented as one that *"will suppress the error so that subsequent executions of the task will not be prevented"* — good for availability, and it means there is no failed future, no propagated exception, and by default no metric. The raw JDK behaviour is the opposite and arguably worse: *"subsequent executions are suppressed"*, so the job stops forever. Either way, nobody is told. So the job needs its own failure-reporting code — a status row, a counter, a structured log with a distinct event name — and that code is directly testable by making the collaborator throw and asserting the report says `FAILED`. If I write that test and there is nothing to assert on, I have discovered that the production system has no way of knowing the job is broken, which is the finding, not a blocker.

**★ Two scheduled jobs, one of which occasionally takes twenty minutes. What do you tell the team, and can a test tell you it?**
I tell them the second job is not running when they think it is, and no, a test will not tell them. Boot's auto-configured `ThreadPoolTaskScheduler` *"uses one thread by default"*, so the two jobs share it and the slow one blocks the queue. The JDK guarantees only that a task will not overlap *itself* — *"subsequent executions may start late, but will not concurrently execute"* — and says nothing about other tasks. A unit test of either job's body passes; a cron assertion passes; the fleet still misses a window. This is the honest boundary of what testing buys you here: the fix is a configuration decision (`spring.task.scheduling.pool.size`, or moving the long job onto its own executor) and the evidence for it is production timing, not a green suite. What I *can* pin in a test is that the long job is idempotent and resumable, which is what makes a late run harmless.

{/* FOOTER */}
