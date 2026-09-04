---
title: "The controller and the pipeline"
sidebar_label: "1 · Controller and pipeline"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0.9 reference,
> *Web MVC → Annotated Controllers → Request Mapping*
> (docs.spring.io — the shortcut annotations, the composed-annotation
> definition, the `PathPattern` syntax table, and the rule that
> `@RequestMapping` may not be combined with another `@RequestMapping`),
> the Spring Framework 6.0 release notes with
> spring-projects/spring-framework#28552 (trailing-slash match deprecated,
> default flipped to `false`) and #34036
> (`PathPatternParser.setMatchOptionalTrailingSeparator()` removed in 7.0),
> and the spring.io blog *Introducing Jackson 3 support in Spring*
> (2025-10-07 — `JacksonJsonHttpMessageConverter` replacing
> `MappingJackson2HttpMessageConverter`). Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**`@RestController` is not a kind of controller. It is a plain `@Controller`
with `@ResponseBody` folded into it, and `@ResponseBody` changes exactly one
thing: the return value stops being a *view name* and becomes *the response
body*, written by an `HttpMessageConverter` instead of rendered by a template
engine. Every surprise in this topic — why returning a `String` sends the
literal text, why the `Accept` header can 406 a method that plainly exists, why
adding a second mapping crashes at startup rather than at request time — falls
out of that one substitution.**

## The two annotations, and what the composition actually does

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Controller          // ← a @Component stereotype, so the class is scanned
@ResponseBody        // ← applied to every handler method on the class
public @interface RestController { }
```

`@Controller` is a `@Component` specialisation: it makes the class a bean and
marks it a web handler, nothing more. `@ResponseBody` is the whole story.
Without it, a handler returning `"orders"` means *resolve a view named
`orders`*. With it, that same method sends the six bytes `orders` with
`Content-Type: text/plain`.

This is why the most confusing beginner bug in Spring MVC is a *missing*
`@ResponseBody`: the method is mapped, the code runs, and the client gets a view
resolution failure naming a template nobody wrote. The composed annotation
exists so you cannot forget it.

The other half of the substitution is *who writes the bytes*. A view goes
through a `ViewResolver` and a template engine. A response body goes through the
**`HttpMessageConverter`** chain, which in a Boot 4 web application is led by
**`JacksonJsonHttpMessageConverter`** — the Jackson 3 converter that replaced
`MappingJackson2HttpMessageConverter`. Converters are chosen by the return type
*and* by content negotiation, which is why the `Accept` header participates in
whether your method can respond at all. That selection is
[chunk 2](02-narrowing-the-match.md).

## The path a request takes, as far as a controller author needs it

```
   request
      │
      ▼
DispatcherServlet          the front controller — one servlet, every route
      │
      ▼
HandlerMapping             which @RequestMapping matches? → HandlerMethod
      │                    (RequestMappingHandlerMapping owns the registry)
      ▼
HandlerAdapter             invoke it: resolve every argument, call the method
      │                    (RequestMappingHandlerAdapter)
      ▼
HttpMessageConverter       return value → bytes, and set Content-Type
      │
      ▼
   response
```

Four things a controller author takes from this diagram and uses constantly:

- **The mapping registry is built at startup**, by scanning every `@Controller`
  bean. That is why a duplicate mapping is a *startup* failure — the registry
  cannot hold two entries under one key, and the framework will not pick for you.
- **Argument resolution is a separate stage from mapping.** A request can match a
  mapping and still fail while binding; those are different failures with
  different status codes. That whole stage is [chunk 3](03-the-named-inputs.md).
- **Content negotiation happens at mapping time, not response time.** `consumes`
  narrows the mapping by `Content-Type`, `produces` narrows it by `Accept`. Both
  are conditions on *whether the method matches at all*.
- **The converter, not your method, decides the wire format.** Your method
  returns an object; what that looks like as JSON is a Jackson 3 question,
  covered in [chunk 7](07-the-response.md).

The full pipeline — servlet filters, MVC interceptors, where AOP sits relative
to both — is a topic of its own: **[topic 10 · The request pipeline](../10-the-request-pipeline/README.md)**
.

## Mapping: the shortcut annotations and the class-level prefix

```java
@RestController
@RequestMapping("/orders")            // class-level prefix for every method
class OrderController {

    @GetMapping                        // GET /orders
    List<OrderSummary> list() { ... }

    @GetMapping("/{id}")               // GET /orders/42
    OrderDetail byId(@PathVariable long id) { ... }

    @PostMapping                       // POST /orders
    @ResponseStatus(HttpStatus.CREATED)
    OrderDetail create(@RequestBody NewOrder body) { ... }

    @DeleteMapping("/{id}")            // DELETE /orders/42
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void cancel(@PathVariable long id) { ... }
}
```

`@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping` and
`@PatchMapping` are composed annotations meta-annotated with `@RequestMapping`;
the reference shows the definition:

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@RequestMapping(method = RequestMethod.GET)
public @interface GetMapping { ... }
```

Nothing is lost by using them — they are simply the readable spelling of
`method = RequestMethod.GET`.

⚠️ **`@RequestMapping` cannot be combined with another `@RequestMapping` on the
same element.** The reference states that when several are detected, only the
first is used — silently. So you cannot stack `@GetMapping` and `@PostMapping`
on one method to serve both verbs; that requires
`@RequestMapping(method = {RequestMethod.GET, RequestMethod.POST})`.

Note also that `path` **composes** between class and method level: the class
value is a prefix, the method value is appended. This is worth stating
explicitly because `consumes` and `produces` do *not* behave this way, which is
the subject of the next chunk.

## URI patterns: `PathPattern`, not `AntPathMatcher`

Spring MVC parses patterns with `PathPattern`, a parsed, pre-compiled
representation. `AntPathMatcher` still exists but is now the less-preferred
option. The syntax the reference documents:

| Pattern | Meaning | Matches |
|---|---|---|
| `/orders` | literal | `/orders` |
| `/t?st` | exactly one character | `/test`, `/tast` |
| `/resources/*.png` | zero or more characters, **within one segment** | `/resources/a.png` |
| `/resources/**` | zero or more **segments** | `/resources/img/a.png` |
| `/orders/{id}` | capture one segment | `id=42` |
| `/orders/{id:[0-9]+}` | capture with a regex guard | `id=42`, never `id=abc` |
| `/files/{*path}` | capture **the rest of the path** | `path=/a/b/c.txt` |

Two of these earn their keep in ordinary APIs.

The **regex guard** is the cheapest way to stop `/orders/summary` being routed
into `/orders/{id}` and blowing up converting the string `summary` into a
`long`. Pattern-specificity rules do exist and generally favour the literal, but
a guard states the intent rather than relying on them.

The **`{*path}` capture** is the only pattern that puts multiple segments into
one variable, and it must be the final segment.

`**` is deliberately restrictive under `PathPattern`: it is permitted **only at
the end** of a pattern. `AntPathMatcher` allowed it mid-pattern, and a great deal
of online material still assumes that — a pattern like `/files/**/download`
simply never matches now.

## Gotchas

**Symptom:** the application refuses to start, and the failure names two handler methods and one pattern
**Cause:** two mappings resolve to the same key — commonly a class-level `@RequestMapping("/orders")` on a controller whose method also declares `@GetMapping("/orders")` (giving `/orders/orders` and freeing `/orders` for a clash elsewhere), or two controllers that genuinely claim the same route
**Fix:** make the mappings distinct. The registry is built at startup precisely so this is a boot failure rather than a coin flip decided by scan order — check both controllers named in the message, not only the first

**Symptom:** a `@Controller` method returns `"orders"` and the client gets a view-resolution error about a missing template
**Cause:** `@ResponseBody` is absent, so the return value is being read as a view name — the class was annotated `@Controller` rather than `@RestController`
**Fix:** use `@RestController` on an API class. Add `@ResponseBody` to the individual method only in the rare mixed class that serves both templates and JSON

**Symptom:** `GET /orders/` returns 404 while `GET /orders` works, after an upgrade to Boot 3 or 4
**Cause:** trailing-slash matching was deprecated in Framework 6.0 with its default flipped from `true` to `false` (#28552), and `PathPatternParser.setMatchOptionalTrailingSeparator()` was **removed outright in 7.0** (#34036). No configuration switch remains
**Fix:** pick one canonical form. If clients genuinely send the slash, either map both explicitly — `@GetMapping({"", "/"})` under a class-level prefix — or, better, normalise at the edge with a redirect so one URL is canonical and caches and search engines agree with you

**Symptom:** `GET /orders/summary` fails with a type-conversion error trying to parse `summary` as a `long`
**Cause:** `/orders/{id}` matched — a variable segment accepted a literal one it should never have seen
**Fix:** guard the variable so it cannot match: `@GetMapping("/{id:[0-9]+}")`

**Symptom:** `/files/**/download` never matches any request
**Cause:** `PathPattern` permits `**` only as the final segment; `AntPathMatcher` allowed it mid-pattern and much older material assumes that behaviour
**Fix:** capture the variable portion with a trailing `{*path}` and branch inside the method, or restructure the URL so the wildcard is genuinely last

**Symptom:** stacking `@GetMapping` and `@PostMapping` on one method quietly serves GET only
**Cause:** `@RequestMapping` may not be combined with another `@RequestMapping` on the same element; when multiple are detected only the first is used
**Fix:** `@RequestMapping(path = "/orders", method = {RequestMethod.GET, RequestMethod.POST})` — though a handler serving both verbs is usually two handlers wearing one coat

**Symptom:** a controller is plainly annotated and plainly correct, and every route on it 404s
**Cause:** the class is not being component-scanned — it sits outside the package tree beneath the `@SpringBootApplication` class, so it never became a bean and never reached the mapping registry
**Fix:** move it under the application package, or widen the scan explicitly with `@ComponentScan`. The tell is that *every* route on the class fails, not one — a single failing route is a mapping problem, a whole class failing is a scanning problem

## Interview questions

**★ What does `@RestController` add over `@Controller`, and what concretely changes as a result?**
It is `@Controller` meta-annotated with `@ResponseBody`, so `@ResponseBody`
applies to every handler method on the class. The concrete change is what the
return value *means*: under a bare `@Controller` a returned `String` is a view
name handed to a `ViewResolver` and rendered by a template engine; under
`@ResponseBody` it is the response body itself, serialised by an
`HttpMessageConverter`. Everything else — component scanning, mapping,
argument resolution — is identical. That substitution is also why the `Accept`
header starts mattering to an API developer, because converter selection is
content-negotiated.

**★ Walk me through what happens between the socket and your controller method.**
`DispatcherServlet` receives the request as the single front controller. It asks
its `HandlerMapping` implementations — `RequestMappingHandlerMapping` for
annotated controllers — which mapping matches, and gets back a `HandlerMethod`.
`RequestMappingHandlerAdapter` invokes it, resolving each argument through the
registered argument resolvers. The return value is passed to an
`HttpMessageConverter`, selected by return type and content negotiation, which
writes the bytes and sets `Content-Type`. The structurally important point is
that mapping and argument resolution are *separate stages*, so "matched the
route but failed to bind" is a real and distinct outcome with its own status
codes.

**★ Why is a duplicate mapping a startup failure rather than a runtime one?**
Because the registry is built once, at startup, by scanning every `@Controller`
bean and inserting one entry per handler method. Two methods producing the same
key cannot both be inserted, and the framework refuses to guess. Deferring the
decision to request time would make the winner depend on component scan order,
which is not a stable contract — so it fails loudly while you are still looking
at the code. It is the same reasoning that makes an ambiguous bean definition a
startup error in the container.

**★ A client reports 404 on an endpoint you can see in the source. How do you work through it?**
Start from the status code, because it already excludes things: `consumes` and
`produces` mismatches produce 415 and 406 respectively, and a path that matched
under a different verb produces 405, so a genuine 404 means nothing matched the
path at all. Then check, in order: the class-level prefix composing with the
method-level path into a doubled or unexpected segment; a trailing slash, which
stopped being tolerated in Framework 6 and has no switch left in 7; a `params`
or `headers` condition the client does not satisfy, since those degrade to 404
rather than to anything diagnostic; and whether the controller is being
component-scanned at all. The last one has a clean signature — *every* route on
the class fails rather than one.

**★ What is `PathPattern` and how does it differ from what older Spring code assumed?**
`PathPattern` is the parsed, pre-compiled pattern representation Spring MVC now
uses in place of `AntPathMatcher`. Beyond being faster, it is deliberately
stricter: `**` is legal only as the final segment, so mid-pattern wildcards like
`/files/**/download` that worked under `AntPathMatcher` now match nothing. It
also adds `{*path}`, which captures all remaining segments into a single
variable and must likewise be last. The practical upshot is that a lot of
pre-6.x sample code and blog material contains patterns that silently fail to
match rather than failing loudly.

---

← Prev: [REST controllers](README.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Narrowing the match](02-narrowing-the-match.md)
