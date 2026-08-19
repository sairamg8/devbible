---
title: "Binding the named inputs"
sidebar_label: "3 · The named inputs"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0.8 reference,
> *Web MVC → Annotated Controllers → Handler Methods → Method Arguments*
> (docs.spring.io — the supported argument type table, `@PathVariable`,
> `@RequestParam`, `@RequestHeader`, `@CookieValue`, `java.util.Optional`
> support on annotations carrying a `required` attribute, and the
> **`-parameters`** compiler-flag requirement for parameter-name resolution).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Argument resolution is a second, independent stage after mapping — a request
that matched your route can still fail here, with a different status code and a
different cause. This chunk covers the inputs Spring finds *by name*: path
variables, query and form parameters, headers and cookies. They share one
property that causes most of the trouble: they are **required by default**, and
the name they look for is read out of the bytecode, which is only there if the
build asked for it.**

## The four named resolvers

```java
@RestController
@RequestMapping("/orders")
class OrderController {

    @GetMapping("/{id}")
    OrderDetail byId(
            @PathVariable long id,                              // URI template variable
            @RequestParam(defaultValue = "false") boolean full, // ?full=true
            @RequestHeader("X-Tenant") String tenant,           // a request header
            @CookieValue(required = false) String sessionId) {  // a cookie
        ...
    }
}
```

They come from four different parts of the request and fail in four different
ways.

**`@PathVariable`** reads a URI template variable declared in the pattern. It is
required by definition — if the pattern matched, the segment is present — so
there is no `required = false` case worth using. Its realistic failure mode is
type conversion, which is what you get when a variable pattern captured a
segment it should never have seen (`/orders/summary` binding into a `long`).

**`@RequestParam`** reads a *servlet* request parameter. That means query string
**and** URL-encoded form body, indistinguishably, because the servlet API merges
them — which is why a `@RequestParam` can be populated by a POST carrying
`application/x-www-form-urlencoded`. It is **required by default**, and that is
the single most common source of an unexpected 400.

**`@RequestHeader`** reads a header, converting to the declared type.
**`@CookieValue`** reads a cookie the same way. Both are also required by
default.

Values are converted to the declared type by the same conversion service that
handles the rest of Spring's binding, so `long`, `UUID`, `LocalDate`, an enum
constant and a comma-separated `List<String>` all work without ceremony — and
all fail with a 400-class binding error rather than a 500 when the input does
not parse.

## Required, `defaultValue`, and `Optional`

Three ways to say "this may be absent", and they are not interchangeable:

```java
// 1. Explicitly optional — null when absent
@RequestParam(required = false) String status

// 2. A default — never null; the mapping still matches when absent
@RequestParam(defaultValue = "open") String status

// 3. Optional<T> — equivalent to required = false, but the type says so
@RequestParam Optional<String> status
```

The reference notes that `java.util.Optional` is supported on any annotation
with a `required` attribute and is *equivalent to* `required = false`. Form 3
beats form 1 in new code for the ordinary reason `Optional` beats null anywhere:
the absence is in the type, so the compiler makes you handle it.

Form 2 beats both wherever a sensible default exists, because it removes the
null from the method body entirely and puts the default where a reader of the
signature can see it.

⚠️ **`defaultValue` implies `required = false`.** Setting both is redundant, and
declaring `required = true` alongside a `defaultValue` does not make the
parameter mandatory — the default simply fills in.

⚠️ **`required = false` on a primitive is always a bug.**
`@RequestParam(required = false) int page` cannot represent absence, because
there is no null `int`. An absent parameter produces a conversion failure rather
than a helpful zero. Use `Integer`, `Optional<Integer>`, or a `defaultValue`.

## 🔴 `-parameters`: the flag that must be on

Spring resolves the *name* of a parameter from the bytecode. Java does not
retain formal parameter names in class files unless you ask it to, and the
reference is explicit that name resolution depends on the **`-parameters`**
compiler flag.

```java
// Requires -parameters: the name "userId" is read from the bytecode
@GetMapping("/user")
User get(@RequestParam Long userId) { ... }

// Works without -parameters: the name is written into the annotation
@GetMapping("/user")
User get(@RequestParam("userId") Long userId) { ... }
```

Without the flag the name is simply absent, and the framework cannot infer which
request parameter you meant. This surfaces as a startup or first-request
failure, not as a subtle misbehaviour — which is confusing precisely because the
code looks obviously correct.

You almost certainly have the flag: `spring-boot-starter-parent` configures
`-parameters` for `maven-compiler-plugin`, and Boot's Gradle plugin does the
equivalent. It becomes a live problem in three situations — a project that does
not inherit the Boot parent, a build where somebody replaced `<compilerArgs>`
wholesale instead of adding to it, and a module compiled by tooling that never
reads the Maven configuration.

Setting it explicitly costs one element:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <parameters>true</parameters>   <!-- emits -parameters -->
  </configuration>
</plugin>
```

The same flag underpins constructor binding for `@ConfigurationProperties` and
for records, so losing it breaks several apparently unrelated things at once.
That simultaneity is a useful diagnostic signature in itself: one broken feature
is a bug in that feature, four broken features across unrelated subsystems is a
build-configuration problem.

Build mechanics — where compiler arguments live, and how a parent POM's plugin
configuration is inherited or overridden — are
[Phase 8 · Maven core](../../phase-8-build-dependencies/01-maven-core/README.md)
and
[Phase 8 · `javac` flags](../../phase-8-build-dependencies/11-javac-flags/README.md).

## Naming the parameter explicitly, even with the flag on

There is a case for writing `@RequestParam("status") String status` even when
`-parameters` makes it unnecessary: the wire name becomes part of the API
contract, and a refactor that renames the Java parameter then cannot silently
rename a public query parameter. With the name inferred, a rename in the IDE is
a breaking API change that no test will catch unless one exercises binding.

The cost is duplication that drifts, so this is a judgement call rather than a
rule. The defensible middle is to name it explicitly wherever the wire name and
the Java name would differ anyway — `@RequestParam("order_id") long orderId` —
and wherever the parameter is part of a published contract.

## Gotchas

**Symptom:** an endpoint returns 400 whenever an "optional" query parameter is omitted
**Cause:** `@RequestParam` is **required by default**. Reading it as optional is an assumption imported from other frameworks
**Fix:** say what you mean — `@RequestParam(required = false)`, `@RequestParam(defaultValue = "open")`, or `@RequestParam Optional<String>`. Prefer `defaultValue` where a sensible default exists, because it removes the null from the method body altogether

**Symptom:** the application fails at startup or on first request, complaining that a parameter name is unavailable, on code that is obviously correct
**Cause:** the `-parameters` compiler flag is off, so formal parameter names are not in the bytecode and `@RequestParam Long userId` cannot know it means `userId`
**Fix:** turn it on — `<parameters>true</parameters>` under `maven-compiler-plugin`, which `spring-boot-starter-parent` already does. If a build overrode `<compilerArgs>` wholesale, restore it rather than adding the flag a second time somewhere else

**Symptom:** several unrelated features break at once — request binding, `@ConfigurationProperties`, record deserialisation
**Cause:** all three read formal parameter names, so all three depend on `-parameters`. This is one root cause wearing three costumes
**Fix:** check the compiler configuration before investigating any of the three individually. The breadth of the breakage is the diagnosis

**Symptom:** `@RequestParam(required = false) int page` throws a conversion failure instead of yielding `0` when absent
**Cause:** a primitive cannot hold absence, so "not required" and "primitive" are contradictory instructions
**Fix:** use `Integer`, `Optional<Integer>`, or — best — `defaultValue = "0"`, so the parameter is never absent from the method's point of view

**Symptom:** a `@RequestParam` is unexpectedly populated on a POST that sent no query string
**Cause:** the servlet API merges query-string parameters and `application/x-www-form-urlencoded` body fields into one parameter map; `@RequestParam` reads that merged map and cannot distinguish the two sources
**Fix:** nothing, if the behaviour is wanted — but do not rely on `@RequestParam` to mean "query string only". Where the distinction matters to the API contract, take the body explicitly with `@RequestBody` and a declared content type

**Symptom:** renaming a controller method parameter in the IDE silently breaks clients
**Cause:** with `-parameters` on and no explicit name in the annotation, the Java parameter name *is* the public query-parameter name; a rename is an API change that compiles cleanly
**Fix:** write the wire name into the annotation for parameters that are part of a published contract, and cover them with a test that actually exercises binding rather than calling the method directly

## Interview questions

**★ What is the difference between `@RequestParam` and `@PathVariable` beyond where the value comes from?**
`@PathVariable` reads a URI template variable, so its presence is guaranteed by
the mapping having matched — there is no meaningful optional case, and its
realistic failure is type conversion when a variable pattern captured a segment
it should not have. `@RequestParam` reads a *servlet* request parameter, which
merges query string and URL-encoded form body indistinguishably, because the
servlet API does. It is required by default, and its realistic failure is a 400
on a parameter the author assumed was optional. The form-body overlap also means
a `@RequestParam` can be populated by a POST, which surprises people who read it
as query-string-only.

**★ How do you express "this query parameter is optional", and which form would you choose?**
Three forms: `required = false`, which yields null when absent; `defaultValue`,
which substitutes a value so nothing is ever null; and declaring the parameter
as `Optional<T>`, which the reference documents as equivalent to
`required = false` on any annotation carrying a `required` attribute. I would
reach for `defaultValue` first wherever a sensible default exists, because it
eliminates the null and puts the default somewhere a reader of the signature
sees it. Where there is genuinely no default, `Optional<T>` beats
`required = false` because the absence lives in the type and the compiler
enforces handling it. And `required = false` on a primitive is always wrong,
since a primitive cannot represent absence — that combination produces a
conversion failure rather than a zero.

**★ What is the `-parameters` flag and what breaks without it?**
It tells `javac` to retain formal parameter names in the class file. Spring
reads those names to resolve `@RequestParam Long userId` against the request
parameter `userId`; without the flag the name is absent from the bytecode
entirely and the framework cannot infer it, so every such name must be written
into the annotation. `spring-boot-starter-parent` configures it, so it normally
only surfaces in projects that do not inherit the Boot parent or in builds where
somebody replaced the compiler arguments wholesale. The detail worth carrying
into a debugging session is that the same flag drives constructor binding for
`@ConfigurationProperties` and for records — so it breaks several
unrelated-looking features simultaneously, and that breadth is the strongest
clue to the cause.

**★ Is there a reason to write `@RequestParam("status")` when `-parameters` makes the name inferable?**
Yes, for parameters that are part of a published contract. With the name
inferred, the Java parameter name *is* the public query-parameter name, so an
ordinary IDE rename becomes a breaking API change that compiles cleanly and that
no unit test calling the method directly will catch. Writing the name explicitly
pins the wire contract independently of the Java identifier. The cost is two
names that can drift apart, so I would not do it universally — I would do it
wherever the wire name and the Java name differ anyway, such as
`@RequestParam("order_id") long orderId`, and wherever the endpoint is public.

---

← Prev: [Narrowing the match](02-narrowing-the-match.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Binding the body](04-binding-the-body.md)
