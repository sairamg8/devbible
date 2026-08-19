---
title: "Method security: the annotations"
sidebar_label: "7 · Method security"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Method Security*
> (docs.spring.io/spring-security/reference/servlet/authorization/method-security.html
> — `@EnableMethodSecurity` and its defaults, `@PreAuthorize`, `@PostAuthorize`,
> `@PreFilter`, `@PostFilter`, the SpEL methods, meta-annotations and
> `AnnotationTemplateExpressionDefaults`, `@P`, and the note that the security
> starter does not activate method-level authorization). Spring Boot 4.1.0,
> Spring Security 7.x, JDK 25.

**URL rules protect *paths*; method security protects *behaviour*. The
difference matters the moment a piece of behaviour is reachable from more than
one path — an HTTP endpoint, a scheduled job, a message listener — because a URL
rule guards one of those doors and a method rule guards the room. This chunk is
the annotations; [chunk 8](08-method-vs-url-security.md) is the mechanism under
them and the argument about where each layer belongs.**

## Turning it on, and the silence if you do not

```java
@Configuration
@EnableMethodSecurity
public class MethodSecurityConfig { }
```

The reference states the trap outright:

> Spring Boot Starter Security does not activate method-level authorization by
> default.

So `@PreAuthorize` on a method in an application without `@EnableMethodSecurity`
is **an annotation nothing reads**. No warning at startup, no failure, no log —
the method simply has no authorization. This is the highest-severity gotcha in
the topic: a security control that silently does nothing looks exactly like one
that works, right up until an audit.

Defaults once enabled: `@PreAuthorize`, `@PostAuthorize`, `@PreFilter` and
`@PostFilter` are active. `@Secured` and the JSR-250 annotations
(`@RolesAllowed`, `@PermitAll`, `@DenyAll`) are **off** and need asking for:

```java
@EnableMethodSecurity(securedEnabled = true, jsr250Enabled = true)
```

## `@PreAuthorize` — check before running

```java
@Service
public class BankService {

    @PreAuthorize("hasRole('ADMIN')")
    public Account readAccount(Long id) {
        // only invoked if the Authentication has ROLE_ADMIN
    }
}
```

The expressions are the same family as the URL rules: `permitAll`, `denyAll`,
`hasAuthority(String)`, `hasRole(String)`, `hasAnyRole(String...)`,
`hasPermission(Object, String)` — the last delegating to a `PermissionEvaluator`
for domain-object permissions.

The same `ROLE_` prefix rule as in [chunk 5](05-configuring-the-chain.md) applies
unchanged: `hasRole('ADMIN')` checks for the authority `ROLE_ADMIN`, and
`hasRole('ROLE_ADMIN')` checks for `ROLE_ROLE_ADMIN` and denies everyone.

Method parameters are available in the expression, but only if their names
survived compilation:

```java
@PreAuthorize("hasPermission(#c, 'write')")
public void updateContact(@P("c") Contact contact) { ... }
```

Compile with `-parameters` (Boot's Maven and Gradle plugins do) and `#contact`
works directly; `@P("c")` names it explicitly when you would rather not depend
on that.

## `@PostAuthorize` — check the return value

```java
@PostAuthorize("returnObject.owner == authentication.name")
public Account readAccount(Long id) { ... }
```

The reference calls this "particularly helpful when defending against Insecure
Direct Object Reference" — the case where the caller is a perfectly legitimate
user, but of a *different* account, and the id came out of the URL. No URL rule
can express that, because the answer depends on data the rule has not loaded.

It also carries an explicit warning:

> Note that `@PostAuthorize` is not recommended for classes that perform
> database writes since that typically means that a database change was made
> before the security invariants were checked.

The method body has already run. If it wrote, it wrote. Only a transaction
rollback saves you, and relying on that quietly couples your security to your
transaction boundaries.

## `@PreFilter` and `@PostFilter` — filter collections

```java
@PreFilter("filterObject.owner == authentication.name")
public Collection<Account> updateAccounts(Account... accounts) { ... }

@PostFilter("filterObject.owner == authentication.name")
public Collection<Account> readAccounts(String... ids) { ... }
```

`@PreFilter` removes elements from an incoming array, collection, map or stream
before the method sees them; `@PostFilter` removes them from the return value.
`filterObject` is the current element.

`@PostFilter` is the one to be careful with: it runs **in memory, after the query
has already executed**. Fetch a page of fifty rows, filter forty-five away, and
you have five results on a page that claimed fifty — and you read all fifty from
the database to get there. For anything paginated or large, push the predicate
into the query instead:

```java
Page<Account> findByOwner(String owner, Pageable pageable);
```

## Class-level annotations and inheritance

Annotations can sit on the type and be inherited by every method:

```java
@Controller
@PreAuthorize("hasAuthority('ROLE_USER')")
public class MyController {

    @GetMapping("/endpoint")
    public String endpoint() { ... }
}
```

A method-level annotation **overrides** the class-level one rather than adding
to it, which is the opposite of what people usually assume. A class-level
`hasRole('USER')` plus a method-level `hasRole('ADMIN')` means admin only — the
`USER` requirement is replaced, not ANDed. Multiple *different* annotations on
the same method (say `@PreAuthorize` and `@PostAuthorize`) are ANDed; repeating
the same annotation on one method "is not supported".

## Meta-annotations: making the rules readable

Twenty methods carrying `@PreAuthorize("hasRole('ADMIN')")` is twenty chances to
mistype a string the compiler never sees. Collapse it:

```java
@Target({ ElementType.METHOD, ElementType.TYPE })
@Retention(RetentionPolicy.RUNTIME)
@PreAuthorize("hasRole('ADMIN')")
public @interface IsAdmin { }
```

and with an `AnnotationTemplateExpressionDefaults` bean, parameterise it:

```java
@Target({ ElementType.METHOD, ElementType.TYPE })
@Retention(RetentionPolicy.RUNTIME)
@PreAuthorize("hasRole('{value}')")
public @interface HasRole {
    String value();
}

@HasRole("ADMIN")
public Account readAccount(Long id) { ... }
```

The expression now exists in exactly one place, the call sites are ordinary
annotations, and renaming a role is a single edit rather than a grep.

## The trade-off

Method security expresses rules that URL rules cannot express at all — anything
that depends on the object being operated on. That is a genuine capability, not
a convenience. What it costs is that **the policy stops being readable in one
place**: after a year the answer to "who can cancel an order" lives in a SpEL
string on a service method that nobody reviewing the security configuration will
open. Meta-annotations claw some of that back by giving the rules names; nothing
gives you back the single reviewable file.

## Gotchas

**Symptom:** `@PreAuthorize` has no effect at all.
**Cause:** No `@EnableMethodSecurity` anywhere in the application.
**Fix:** Add it to a `@Configuration` class. Then check the annotated object is
actually a Spring bean — an annotation on a `new`-ed instance is equally inert.

**Symptom:** `@RolesAllowed` is ignored while `@PreAuthorize` works.
**Cause:** JSR-250 support is off by default.
**Fix:** `@EnableMethodSecurity(jsr250Enabled = true)`.

**Symptom:** A page of results comes back short, and the totals do not match.
**Cause:** `@PostFilter` removing rows after pagination was applied.
**Fix:** A repository method that takes the owner as a parameter, so the
database does the filtering.

**Symptom:** A row was written even though authorization failed.
**Cause:** `@PostAuthorize` on a method that performs a write — the body already
ran.
**Fix:** Authorize before the write: load the object, check ownership with
`@PreAuthorize` on a method that takes it, then write.

**Symptom:** A class-level rule seems to be ignored on one method.
**Cause:** The method-level annotation overrides it rather than combining.
**Fix:** Restate the full condition on the method, or express it as one
expression with `and`.

**Symptom:** An expression referencing `#customerId` fails to resolve.
**Cause:** Parameter names were not retained at compile time.
**Fix:** Compile with `-parameters`, or name it with `@P("customerId")`.

**Symptom:** A denial produces a stack trace and a 500 rather than a 403.
**Cause:** `AccessDeniedException` thrown from a service method reaches your
exception handling before Spring Security's, because it was raised inside the
controller call rather than by `AuthorizationFilter`.
**Fix:** Let it propagate — do not catch `Exception` broadly in a service — so
`ExceptionTranslationFilter` can translate it, and make sure no
`@ExceptionHandler(Exception.class)` swallows it first.

## Interview questions

**★ Why does `@PreAuthorize` sometimes do nothing at all?**
Because method-level authorization is not enabled by default — the security
starter does not switch it on. Without `@EnableMethodSecurity` nothing reads the
annotation, and there is no warning at startup. It is the most dangerous default
in Spring Security precisely because the failure is completely silent.

**★ `@PreAuthorize` versus `@PostAuthorize` — when is each right?**
`@PreAuthorize` when the decision can be made from the caller's authorities and
the method arguments; `@PostAuthorize` when it depends on the object being
returned, such as an ownership check on a record fetched by id. `@PostAuthorize`
runs after the body, so it must not guard a method that writes.

**★ What is wrong with `@PostFilter` on a paginated query?**
It filters in memory after the database has returned the page, so the page comes
back short, counts are wrong, and rows the caller is not allowed to see were
still read into the application. Push the predicate into the query instead.

**★ A class-level `@PreAuthorize("hasRole('USER')")` and a method-level `@PreAuthorize("hasRole('ADMIN')")`. What is required?**
`ROLE_ADMIN` only. The method-level annotation replaces the class-level one
rather than adding to it. If both are genuinely required, write one expression:
`hasRole('USER') and hasRole('ADMIN')`.

**★ How do you avoid SpEL strings scattered through the codebase?**
Meta-annotations — a custom `@IsAdmin` carrying the `@PreAuthorize`, or a
templated `@HasRole("ADMIN")` with an `AnnotationTemplateExpressionDefaults`
bean. The expression is written once and the call sites become ordinary
annotations, so a typo is a compile error rather than a rule that silently never
matches.

**★ How would you express "the caller may edit this specific document"?**
Not as a `GrantedAuthority` — those are application-wide. Either
`@PostAuthorize("returnObject.owner == authentication.name")` for a read, or
`hasPermission(#doc, 'write')` backed by a `PermissionEvaluator` for a richer
model, or best of all a repository query scoped by owner so the row is never
loaded in the first place.

---

← Prev: [Matchers and multiple chains](06-matchers-and-multiple-chains.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Method security vs URL rules](08-method-vs-url-security.md)
