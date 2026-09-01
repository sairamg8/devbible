---
title: "ExecutionCondition is the interface every conditional annotation in Jupiter is built on, and the configuration parameter that deactivates conditions is the one line that turns a graveyard of @Disabled tests back into information"
sidebar_label: "07e · ExecutionCondition and deactivation"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — the extension-model page
> "Conditional Test Execution"
> ([extensions/conditional-test-execution](https://docs.junit.org/6.0.3/extensions/conditional-test-execution.html))
> and "Configuration Parameters — Pattern Matching Syntax"
> ([configuration-parameters](https://docs.junit.org/6.0.3/running-tests/configuration-parameters.html));
> javadoc for `ExecutionCondition`
> ([ExecutionCondition](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExecutionCondition.html))
> and `ConditionEvaluationResult`
> ([ConditionEvaluationResult](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ConditionEvaluationResult.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**`@Disabled`, `@EnabledOnOs`, `@DisabledIf` and everything else in
[07](07-disabling-and-conditions.md)–[07d](07d-custom-conditions.md) are implementations of
one functional interface with one method. Writing it yourself costs about fifteen lines and
buys the one thing the declarative annotations cannot give you: a reason string computed at
the moment of the decision, which is what the report shows. And because it is all one
mechanism, one configuration parameter switches any of it off.**

## Writing an `ExecutionCondition`

The interface is a single method and is documented with the same caveat as everything else
in this family:

> *"If an `ExecutionCondition` disables a test method, that prevents execution of the test
> method and method-level lifecycle callbacks … However, that does not prevent the test
> class from being instantiated, and it does not prevent the execution of class-level
> lifecycle callbacks such as `@BeforeAll` methods."*

The result type has exactly three factories — `enabled(String reason)`,
`disabled(String reason)`, and `disabled(String reason, String customReason)` *"for
creating disabled results with custom reasons added by the user"* — plus `isDisabled()`
and `getReason()`.

```java
import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;

class DisabledOnMissingBrokerCondition implements ExecutionCondition {

    @Override
    public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
        String url = System.getProperty("broker.url");
        if (url == null) {
            return ConditionEvaluationResult.disabled(
                "no broker.url system property — set it to run broker tests");
        }
        return ConditionEvaluationResult.enabled("broker.url = " + url);
    }
}
```

Registered like any other extension ([10 · extensions](10-extensions.md)), and worth
wrapping in a meta-annotation so that the call site reads as intent rather than as
plumbing:

```java
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
@ExtendWith(DisabledOnMissingBrokerCondition.class)
public @interface RequiresBroker {
}

@RequiresBroker
class OutboxPublisherTest { }
```

Note what the extension buys you over `@EnabledIf`: the reason string is *computed*, so
the report says which property was missing and what to set, rather than "condition
returned false".

⚠️ **The condition must be a pure predicate.** Because conditions short-circuit
([07b](07b-the-built-in-conditions.md)), yours may not be evaluated at all on a given run.
Do not start anything, do not cache anything, do not write anything.

## Turning conditions off for a run

> *"Sometimes it can be useful to run a test suite without certain conditions being active.
> For example, you may wish to run tests even if they are annotated with `@Disabled` in
> order to see if they are still broken. To do this, provide a pattern for the
> `junit.jupiter.conditions.deactivate` configuration parameter to specify which conditions
> should be deactivated (i.e., not evaluated) for the current test run. The pattern can be
> supplied as a JVM system property, as a configuration parameter in the
> `LauncherDiscoveryRequest` that is passed to the `Launcher`, or via the JUnit Platform
> configuration file."*

```
-Djunit.jupiter.conditions.deactivate=org.junit.*DisabledCondition
```

The pattern language is the Platform's, shared with listener deactivation, stack-trace
pruning and extension auto-detection filtering:

> *"If the value for the given configuration parameter consists solely of an asterisk
> (`*`), the pattern will match against all candidate classes. Otherwise, the value will be
> treated as a comma-separated list of patterns where each pattern will be matched against
> the fully qualified class name (FQCN) of each candidate class. Any dot (`.`) in a pattern
> will match against a dot (`.`) or a dollar sign (`$`) in a FQCN. Any asterisk (`*`) will
> match against one or more characters in a FQCN. All other characters in a pattern will be
> matched one-to-one against a FQCN."*

The examples the guide gives, verbatim in effect:

- `*` — *"matches all candidate classes"*
- `org.junit.*` — *"matches all candidate classes under the `org.junit` base package and
  any of its subpackages"*
- `*.MyCustomImpl` — *"matches every candidate class whose simple class name is exactly
  `MyCustomImpl`"*
- `*System*` — *"matches every candidate class whose FQCN contains `System`"*
- `*System*, *Unit*` — both of the above

Two uses worth building into a project:

**A nightly "are they still broken?" job** deactivating only `DisabledCondition`, so every
`@Disabled` test runs for real and the ones that now pass get deleted from the graveyard.

**A local debugging switch.** `-Djunit.jupiter.conditions.deactivate=*` runs everything,
including the environment-gated tests you had forgotten existed
([07c](07c-environment-conditions.md)) — usually with several failures, which is the
point.

⚠️ Note the dot rule: `org.junit.*DisabledCondition` matches a nested class too, because a
dot in the pattern matches `$` in the FQCN. That is deliberate and occasionally matches
more than you meant.
## Gotchas

**★ Returning `enabled(null)` and wondering why the report explains nothing.**
`getReason()` returns an `Optional`, and an absent reason is what the report prints.
Compute a reason even on the enabled path; it costs one string concatenation and it is the
difference between a debuggable skip and a mystery.

**★ Doing work in `evaluateExecutionCondition`.**
Conditions short-circuit, so the work may not happen. Provisioning, starting containers and
opening connections belong in `BeforeAllCallback` ([10](10-extensions.md)).

**★ A condition that queries the network.**
Every test class pays the latency, the condition is evaluated far more often than you
think, and a flaky network turns into a suite that silently shrinks
([14 · flaky tests](14-flaky-tests.md)).

**★ Deactivating conditions in the normal CI run to "get more coverage".**
Deactivation is a diagnostic. Left on, it runs tests in environments they document
themselves as not supporting, and the resulting failures teach the team to ignore red.

**★ Expecting `junit.jupiter.conditions.deactivate` to enable filtered-out tests.**
It deactivates *conditions*. A test excluded by a tag expression was removed by a
post-discovery filter and no configuration parameter about conditions will bring it back
([06e](06e-tag-expressions-and-filtering.md)).
## Interview questions

**★ When would you write an `ExecutionCondition` instead of using `@EnabledIf`?**
When the predicate is used more than once, when it needs to inspect the `ExtensionContext`
(annotations, tags, the store), or when the report deserves a computed explanation rather
than a fixed string. An extension is a type — importable, testable, renameable — and
`@EnabledIf` is a string the compiler never checks.

**★ What does `ConditionEvaluationResult` carry, and why does the reason matter?**
`isDisabled()` and an optional reason. The reason is what the Launcher passes to
`executionSkipped` and therefore the only explanation that reaches a report. There are
three factories: `enabled(reason)`, `disabled(reason)` and
`disabled(reason, customReason)`.

**★ How do you run a suite as if none of its conditions existed?**
`-Djunit.jupiter.conditions.deactivate=*`, or a narrower pattern such as
`org.junit.*DisabledCondition` to deactivate only `@Disabled`. The value is matched against
the fully qualified class names of the condition implementations, with `*` matching one or
more characters and `.` matching a dot or a `$`.

**★ Why must conditions be side-effect free?**
Because evaluation short-circuits on the first "disabled" verdict, so any given condition
may not be evaluated on any given run. A condition that provisions or mutates does so
nondeterministically, which is the definition of a test suite you cannot trust.

{/* FOOTER */}
