---
title: "@ControllerAdvice: scope, ordering and what belongs in it"
sidebar_label: "5 · @ControllerAdvice"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Controller
> Advice*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-advice.html
> — the three method kinds it hosts, `@RestControllerAdvice` as
> `@ControllerAdvice` + `@ResponseBody`, meta-annotation with `@Component`, the
> application order of global vs local methods, the `annotations` /
> `basePackages` / `basePackageClasses` / `assignableTypes` selectors and the
> runtime-evaluation performance caveat) and *Exceptions (`@ExceptionHandler`)*
> for the cross-advice priority rule. Spring Boot 4.1.1, Spring Framework
> 7.0.x, JDK 25.

**`@ControllerAdvice` is the composition root of your HTTP error contract: one
bean, scanned like any other, that hosts the exception-to-response table for
every controller in the application. Its two configuration surfaces — *which*
controllers it applies to, and *in what order* several advices are consulted —
are the difference between a table and a puzzle.**

## What an advice can host

Three kinds of method, and it is worth knowing all three even if you came for
the first:

| Annotation | Applies to | Typical use |
|---|---|---|
| `@ExceptionHandler` | Any controller in scope | The error table — the subject of this topic |
| `@InitBinder` | Binding for any controller in scope | Registering a `PropertyEditor`/`Formatter`, or **restricting** bindable fields with `setDisallowedFields` |
| `@ModelAttribute` | Model population for any controller in scope | Common model entries for server-rendered views |

All three are *global* versions of methods you could write in a single
controller. And the reference is precise about the order in which global and
local versions combine, in a way that is not symmetric:

> *"Global `@ExceptionHandler` methods (from `@ControllerAdvice`) are applied
> **after** local ones (from `@Controller`). Global `@ModelAttribute` and
> `@InitBinder` methods are applied **before** local ones."*

That asymmetry is deliberate and both halves make sense: a controller should be
able to *override* the global error mapping, and it should be able to *refine*
a model or binder the global one has already set up.

## `@RestControllerAdvice` for anything that serves JSON

`@RestControllerAdvice` is `@ControllerAdvice` + `@ResponseBody`. Both are
meta-annotated with `@Component`, so they are picked up by component scanning
with nothing else required — no registration, no `@Import`, no configuration
class. Put one in a package the scan reaches
([component scanning](../02-the-ioc-container/07-component-scanning.md)) and it
is live.

```java
@RestControllerAdvice
class ApiErrorHandler {

    @ExceptionHandler
    ProblemDetail handle(OrderNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler
    ProblemDetail handle(InsufficientStockException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        pd.setProperty("sku", ex.getSku());
        return pd;
    }
}
```

That is the whole shape. Notice what is *not* in it: no `try`, no `if`, no
status arithmetic. **An advice that reads as a table is one you can review; an
advice with branching logic in it is a controller in disguise.**

## Scoping an advice

By default an advice applies to every controller. Four selectors narrow it:

```java
// Every controller annotated @RestController — not @Controller.
@ControllerAdvice(annotations = RestController.class)
class ApiErrors { }

// Every controller in these packages (and below).
@ControllerAdvice("com.example.api.public")
class PublicApiErrors { }

// Type-safe variant of the same thing: the package of the named class.
@ControllerAdvice(basePackageClasses = PublicApiMarker.class)
class PublicApiErrors2 { }

// Every controller assignable to these types.
@ControllerAdvice(assignableTypes = { AdminController.class, ReportController.class })
class AdminErrors { }
```

`basePackageClasses` is worth preferring over the `String` form for the same
reason `@ComponentScan(basePackageClasses = ...)` is: a package rename is a
compiler event rather than a silent no-op that makes the advice apply to
nothing.

⚠️ **The documented cost.** The reference says the selectors *"are evaluated at
runtime and may negatively impact performance if used extensively"*. Not "are
slow" — *if used extensively*. One or two scoped advices are fine; twelve of
them, each with an `assignableTypes` list, means every controller/advice pair is
evaluated. If you find yourself needing that many, the shape you want is
probably one advice plus a per-controller local override, not twelve advices.

## When scoping is genuinely worth it

Two cases justify more than one advice, and both are about **audience**:

- **A public API and an internal/admin API in one application.** The public one
  must never leak a `detail` containing internal identifiers; the internal one
  is allowed to be chatty because its audience is your own operators. Same
  exception, two policies. Scope by package or by annotation.
- **A versioned API where v1 and v2 use different error shapes.** v1 shipped a
  bespoke `{"error": ...}` body before you knew better; v2 uses
  `ProblemDetail`. You cannot change v1 without breaking clients, so v1's advice
  is scoped to the v1 package and preserved. See
  [API versioning](../07-rest-controllers/12-api-versioning.md) — the error body
  is one of the things a version pins.

Everything else — "errors for the order module", "errors for the customer
module" — is usually a mistake, because it fragments the contract along **your**
boundaries rather than the client's.

## Ordering several advices

`@ControllerAdvice` beans implement the standard ordering contract, so `@Order`
or `Ordered` applies. This matters far more than it looks, because of the rule
from [chunk 3](03-matching-which-handler-wins.md): across advices, **priority is
consulted before specificity**, and a cause match in a higher-priority advice
beats a root match in a lower-priority one.

```java
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackageClasses = PublicApiMarker.class)
class PublicApiErrors { ... }          // narrow scope, highest priority

@Order(0)
@RestControllerAdvice
class DomainErrors { ... }             // your domain exception table

@Order(Ordered.LOWEST_PRECEDENCE)
@RestControllerAdvice
class LastResortErrors {               // the catch-all, last, always
    @ExceptionHandler
    ProblemDetail handle(Exception ex) { ... }
}
```

**The rule that prevents most incidents: exactly one catch-all, and it is at
`LOWEST_PRECEDENCE`.** An unordered advice gets `Ordered.LOWEST_PRECEDENCE` by
default, which sounds safe until a *second* unordered advice exists — then two
beans share the lowest priority and the tie is broken by something you did not
choose (bean name order). Order every advice you have, even when there are only
two, so the resolution is written down.

## The trade-off

One global advice makes the contract stable and makes the error policy
reviewable in a single file. It also creates a file that **every team touches**,
which in a large codebase is a merge-conflict magnet and a place where a careless
addition (`handle(Exception ex)` at the top) silently changes behaviour for
everyone. The mitigation is not to split it by module — it is to keep it a table,
order it explicitly, and put a test on the mapping so a change that alters an
existing status fails the build rather than a customer's integration.

## Gotchas

**Symptom** — the advice class exists but nothing it declares ever runs.
**Cause** — it is outside the component-scan base package. `@ControllerAdvice`
is meta-annotated `@Component`, but nothing scans a package the application
class does not cover.
**Fix** — move it under the `@SpringBootApplication` class's package, or add
its package to `@ComponentScan`. See
[component scanning](../02-the-ioc-container/07-component-scanning.md).

**Symptom** — the advice runs for the web layer but not for a controller in a
test slice.
**Cause** — `@WebMvcTest` loads only the web layer plus advices it detects; if
the advice is filtered out by the slice's component filters or lives outside
the scanned packages, the test exercises a different error contract than
production.
**Fix** — import it explicitly in the slice test with `@Import(ApiErrorHandler.class)`
so the test asserts the real mapping.

**Symptom** — a `@ControllerAdvice` handler returns the right JSON in one
controller and a view-resolution failure in another.
**Cause** — the advice is `@ControllerAdvice` (not `@RestControllerAdvice`) and
returns `String`; whether that is a body or a view name depends on the
`@ResponseBody` in force.
**Fix** — `@RestControllerAdvice`, or return `ProblemDetail`/`ResponseEntity`,
which mean the same thing in both.

**Symptom** — adding a second advice class changed the status of errors the
first one had been handling correctly.
**Cause** — both are unordered, so both sit at `LOWEST_PRECEDENCE` and the
winner is decided by bean ordering you did not choose.
**Fix** — annotate every advice with an explicit `@Order`. Two advices is
already enough for this to matter.

**Symptom** — scoping with `basePackages = "com.example.api"` silently stops
working after a package rename.
**Cause** — the value is a `String`; the refactor updated the classes and not
the literal.
**Fix** — use `basePackageClasses` with a marker type in that package, so the
compiler enforces it.

**Symptom** — an advice scoped `annotations = RestController.class` does not
apply to a controller annotated `@Controller` + `@ResponseBody`.
**Cause** — correct behaviour: the selector matches the annotation, and
`@Controller` + `@ResponseBody` is not `@RestController` even though it behaves
identically at request time.
**Fix** — either standardise on `@RestController`, or scope by package instead,
which does not care how the controller was spelled.

**Symptom** — the error advice works, but `@InitBinder` restrictions you added
to it do not apply.
**Cause** — the local `@InitBinder` in a controller runs *after* the global one
and can re-open what the global closed (the ordering is the reverse of
`@ExceptionHandler`).
**Fix** — audit local `@InitBinder` methods; a global binder restriction is a
default, not a guarantee.

## Interview questions

**★ What is `@ControllerAdvice`, mechanically?**
An ordinary Spring bean — it is meta-annotated with `@Component` — that the
`ExceptionHandlerExceptionResolver` and the binding/model machinery consult for
`@ExceptionHandler`, `@InitBinder` and `@ModelAttribute` methods that should
apply across controllers rather than within one. There is nothing special about
how it is registered; it is component scanning.

**★ Why are global `@ExceptionHandler` methods applied after local ones, but
global `@ModelAttribute` and `@InitBinder` methods before?**
Because the intent differs. For errors you want a controller to be able to
*override* the global mapping, so the local one must be consulted first. For
model and binder setup you want the global one to establish a baseline the
controller can then *refine*, so the global one runs first. Both orderings serve
"the more specific declaration has the final say".

**★ You have two advices and a specific handler is being shadowed by a generic
one. What is happening?**
Cross-advice priority is consulted before handler specificity: a cause match in
a higher-priority advice beats even a root match in a lower-priority one. The
generic advice is higher priority — usually because the specific one is
unordered and both defaulted, or because someone put the catch-all first. Fix
it by ordering explicitly and pushing the catch-all to `LOWEST_PRECEDENCE`.

**★ When would you have more than one `@ControllerAdvice`?**
When two audiences need different error policies in the same application: a
public API that must not leak detail alongside an internal or admin API that
may, or a v1 API pinned to a legacy error body alongside a v2 on
`ProblemDetail`. Splitting by *domain module* is usually wrong, because it
fragments the client-facing contract along boundaries the client cannot see.

**★ Is there a cost to the advice selectors?**
Yes, and the reference names it: the selectors are evaluated at runtime and may
negatively impact performance if used extensively. It is not a reason to avoid
one or two scoped advices; it is a reason not to build a dozen and rely on
selector matching as an architecture.

**★ How do you make sure a test slice exercises the same error contract as
production?**
Import the advice into the slice explicitly — `@Import(ApiErrorHandler.class)`
on a `@WebMvcTest` — rather than trusting that the slice's component filters
happened to pick it up. Otherwise the test asserts Boot's default `/error`
behaviour and passes while production returns something else entirely.

---

← Prev: [Handler signatures](04-handler-signatures.md) · Index: [Error handling](README.md) · Next → [ProblemDetail and RFC 9457](06-problemdetail-and-rfc-9457.md)
