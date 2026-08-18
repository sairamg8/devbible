---
title: "Custom exceptions and layer translation"
sidebar_label: "04 · Custom exceptions and translation"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.lang.Throwable` (cause chains, `initCause`, the four-arg protected
> constructor) and `java.lang.RuntimeException`, and *Effective Java*'s
> exception-translation items as corroborated by the `java.sql.SQLException`
> and Spring `DataAccessException` hierarchy Javadoc.

**A custom exception earns its existence by carrying *meaning the catcher
can act on* — a domain word in its name, structured fields a handler can
read, a layer boundary it defends. It does not earn it by renaming
`RuntimeException` for decoration. The discipline that makes custom
exceptions work is *translation*: each architectural layer catches the
exceptions of the layer below and rethrows its own — always, always passing
the original as the cause. Break that one habit and next month's incident
comes with a stack trace that ends exactly where the information was
thrown away.**

## When a custom exception is justified

Three tests; passing any one of them justifies the class:

1. **The catcher would branch on it.** `InsufficientStockException` vs
   `PaymentDeclinedException` produce different user messages and different
   retry behaviour. If every catcher would treat two exceptions identically,
   they should be one exception.
2. **It carries structured data.** An order ID, the rejected quantity, the
   upstream error code — as typed fields with accessors, not facts baked
   into the message string that a handler would have to parse back out.
3. **It marks a layer boundary.** `OrderRepositoryException` exists so that
   *nothing above the repository ever sees `SQLException`* — the layer above
   depends on the domain, not on JDBC.

Failing all three: reuse a standard exception. The JDK's
`IllegalArgumentException`, `IllegalStateException`,
`UnsupportedOperationException` and `NoSuchElementException` already say
"bad input", "bad timing", "not here", "nothing found" — a reader knows
them on sight, and half of good exception design is not surprising anyone.

## The shape of a well-built custom exception

Application code leans unchecked ([topic 01](01-hierarchy-checked-unchecked/README.md)
makes the argument), so extend `RuntimeException` — and **always provide the
`(message, cause)` constructor**, because translation (below) is the main
thing this class will ever do:

```java
public class OrderRepositoryException extends RuntimeException {

    private final String orderId;

    public OrderRepositoryException(String message, String orderId) {
        super(message);
        this.orderId = orderId;
    }

    public OrderRepositoryException(String message, String orderId, Throwable cause) {
        super(message, cause);          // the cause travels in the constructor
        this.orderId = orderId;
    }

    public String orderId() { return orderId; }
}
```

Details that repay attention:

- **Structured fields are `final`** and set in the constructor — an
  exception is an immutable record of a failure, not a mutable bag.
- **The message repeats the fields** (`"order %s: …".formatted(orderId)`)
  because logs show messages, not accessors — but handlers read the
  *fields*, never parse the message.
- **No business logic, no I/O in the constructor.** Constructing an
  exception already fills in the stack trace
  ([topic 07](07-exceptions-as-control-flow.md) prices that); anything else in
  the constructor runs at the worst possible moment.

## Translation at layer boundaries — the worked chain

The canonical three-layer flow, bottom to top:

```java
// Repository layer: JDBC vocabulary stops HERE
public Order findOrder(String orderId) {
    try (var conn = dataSource.getConnection();
         var stmt = conn.prepareStatement(SELECT_ORDER)) {
        stmt.setString(1, orderId);
        // ... map the ResultSet ...
    } catch (SQLException e) {
        throw new OrderRepositoryException(
            "loading order %s failed".formatted(orderId), orderId, e);  // cause!
    }
}

// Service layer: repository failures become domain outcomes
public Order placeOrder(PlaceOrder command) {
    try {
        return orders.findOrder(command.orderId());
    } catch (OrderRepositoryException e) {
        throw new OrderPlacementException(
            "order %s could not be placed".formatted(command.orderId()), e);
    }
}
```

At the web boundary, the global handler maps `OrderPlacementException` to a
clean HTTP 500 — status, correlation ID, and a message that names no table,
no SQL, no driver (the Spring `@ControllerAdvice` half of this story is
**phase 9's global-handler topic**; [topic 08](08-global-handler.md)
sketches where the handler lives). The full cause chain — placement → repository →
`SQLException` with the vendor code — lands in the *log*, not the response.

Why each layer bothers:

- **Dependency direction.** If services catch `SQLException`, the service
  layer imports `java.sql` forever; swapping JDBC for R2DBC or JPA rewrites
  service code. Translation keeps infrastructure vocabulary in the
  infrastructure layer.
- **Meaning accumulates.** `SQLException` knows the statement failed;
  `OrderRepositoryException` knows *which order* was being loaded;
  `OrderPlacementException` knows *what the user was doing*. Each hop adds
  the context only that layer has.
- **Handlers stay small.** The web layer handles a handful of domain
  exceptions instead of every failure mode of every driver two floors down.

## Never lose the cause

The whole chain works only if every hop passes the cause. The three ways to
attach it:

```java
throw new OrderRepositoryException(msg, orderId, e);   // 1. constructor — the normal way

var ex = new OrderRepositoryException(msg, orderId);
ex.initCause(e);                                       // 2. retrofit, once only
throw ex;

throw new OrderRepositoryException(msg, orderId, e) {  // 3. never do this to *hide* one
};
```

`initCause` exists for exception types whose constructors predate cause
chaining (`Throwable` grew causes in 1.4) — it may be called **once**, and
only if no cause was set by a constructor; a second attempt throws
`IllegalStateException`. In your own classes, provide the cause-taking
constructor and forget `initCause` exists.

The failure mode this prevents is the **lost stack trace**:
`catch (SQLException e) { throw new OrderRepositoryException("load failed", id); }`
compiles, runs, and produces incident logs whose trace *starts at the
translation site* — the actual failing statement, the vendor error code,
the line in the driver: gone. [Topic 05](05-reading-stack-traces/README.md)
shows what that looks like from the reading side.

## Messages that help at 3 a.m.

The message is read by an engineer holding a pager. Optimize for them:

- **Name the identifiers**: order ID, customer ID, state that was expected
  vs found — `"order 7f3a: expected status PAID, was CANCELLED"`.
- **Never include secrets or PII**: no passwords, tokens, card numbers,
  emails in messages — messages go to logs, logs go to aggregators, and
  aggregator access is wider than database access.
- **State the operation, not just the noun**: `"loading order 7f3a failed"`
  beats `"order error"` — the verb locates the code path.
- **Don't duplicate what the cause already says.** The `SQLException`
  message travels along in the chain; the wrapper adds the domain context
  the driver couldn't know.

## One exception per layer, or per case?

Both patterns are legitimate; mixing them without a rule is what hurts.

- **Per layer** (`OrderRepositoryException`): few classes, easy to
  translate, good when callers rarely branch on the failure kind. Add a
  typed *reason field* (an enum) if handlers occasionally need to branch.
- **Per case** (`InsufficientStockException`, `DuplicateOrderException`):
  more classes, but handlers branch by `catch` clause and each class can
  carry exactly the fields its case needs. Right when the *business*
  distinguishes the outcomes.
- The compromise that scales: **one abstract layer exception, few concrete
  cases** — `catch (OrderException e)` for the code that doesn't care,
  specific catches for the code that does.

Error codes *inside* one exception class (`e.code() == STOCK`) trade
`catch`-clause dispatch for `switch` dispatch. Prefer subtypes when the
catcher's behaviour differs; prefer a code field when the code is merely
*reported* (into a response body or a log) rather than branched on.

## Gotchas

**Symptom:** incident trace ends at your own `throw new …Exception(msg)` line; the database error is nowhere in the log
**Cause:** translation without the cause — the wrapper was constructed with message only
**Fix:** every translating `throw` passes the caught exception as the cause; make the `(message, cause)` constructor mandatory in review

**Symptom:** `IllegalStateException: Can't overwrite cause` from deep inside error handling
**Cause:** `initCause` called on an exception whose cause was already set (by constructor or a previous call)
**Fix:** set the cause in the constructor, once; treat `initCause` as legacy-interop only

**Symptom:** service layer littered with `import java.sql.SQLException`
**Cause:** missing translation at the repository boundary — infrastructure exceptions leaking upward
**Fix:** the repository catches JDBC/JPA exceptions and rethrows the domain wrapper; no `java.sql` import compiles above it

**Symptom:** handler code does `e.getMessage().contains("stock")` to decide the response
**Cause:** facts that handlers need were baked into the message string instead of typed fields
**Fix:** structured fields (or an enum reason) on the exception; messages are for humans, fields are for code

**Symptom:** user-facing 500 page shows table names and SQL fragments
**Cause:** the low-level exception's message was passed through to the response at the web boundary
**Fix:** the boundary maps exception *types* to safe messages; cause details go to the log with a correlation ID linking the two

**Symptom:** a dozen exception classes that are all `extends RuntimeException {}` with nothing inside
**Cause:** class-per-throw habit without the three-test check — renames, not designs
**Fix:** collapse to standard exceptions or one layer exception; keep only the classes some catcher actually distinguishes

**Symptom:** exception messages in the aggregator contain customer emails
**Cause:** identifiers and PII conflated — "include the identifiers" applied to personal data
**Fix:** log opaque IDs; if a human needs the email, they look it up with access controls, not in the log stream

**Symptom:** `NotSerializableException` when an exception crosses a serialization boundary (RMI, a distributed cache, some test frameworks)
**Cause:** `Throwable` implements `Serializable`, so custom exceptions inherit the contract — but a custom field holding a non-serializable object (a request, a connection) breaks it
**Fix:** keep fields to serializable value types (strings, IDs, enums); mark anything heavier `transient` and carry only the facts, not the machinery

## Interview questions

**★ When does a custom exception deserve to exist?**
When a catcher would branch on it, when it carries structured fields, or
when it defends a layer boundary. Absent all three, a standard JDK
exception communicates faster than a new name.

**★ Walk me through exception translation across a repository → service → web stack.**
Repository catches `SQLException`, throws `OrderRepositoryException` with
the cause; service catches that, throws `OrderPlacementException` with the
cause; the web boundary maps the type to a status and safe message, logging
the full chain. Each layer speaks its own vocabulary; the cause chain
preserves the forensics end to end.

**★ Why is losing the cause so damaging, concretely?**
The rethrown exception's stack trace begins where *it* was constructed —
the translation site — so the log no longer contains the failing statement,
the driver frames, or the vendor error code. The bug's location is
unrecoverable from the log alone; you're reproducing in the dark.

**★ Checked or unchecked for your domain exceptions, and why?**
Unchecked in application code: the callers who can't recover shouldn't be
forced to declare or swallow, and translation happens at few, deliberate
boundaries rather than in every signature. Checked earns its cost only
where the *immediate* caller is realistically expected to recover.

**★ Error-code field vs exception subtypes — how do you choose?**
Branching handlers want subtypes (`catch` dispatch, per-case fields);
reporting-only codes want a field (fewer classes, codes flow into
responses/metrics). The smell is a `switch` on a code where every arm does
something different — that's subtype dispatch written by hand.

**★ Your custom exception — extend `RuntimeException`, `Exception`, or `Throwable`?**
`RuntimeException` for the standard unchecked domain exception; `Exception`
only when you deliberately want checked semantics at an edge. Never
`Throwable` directly: catch clauses and framework handlers are written
against `Exception`/`RuntimeException`, and a direct `Throwable` subtype is
checked anyway while sorting with `Error`s in every broad catch — all cost,
no meaning. (Extending `Error` is reserved for the platform.)

**★ What belongs in an exception message, and what must never be there?**
Operation, identifiers, expected-vs-actual state — enough to locate and
reason without reproduction. Never secrets, tokens, card data or PII:
messages outlive the request in logs with broader access than the data
store the secrets came from.

---

← Prev: [try-with-resources](03-try-with-resources/README.md) · Next → [Reading a stack trace fast](05-reading-stack-traces/README.md)
