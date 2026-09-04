---
title: "Message codes: rewording and translating errors"
sidebar_label: "9 · Message codes and i18n"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Error
> Responses*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
> — *"An `ErrorResponse` exposes message codes for 'type', 'title', and
> 'detail', as well as message code arguments for the 'detail' field.
> `ResponseEntityExceptionHandler` resolves these through a `MessageSource` and
> updates the corresponding `ProblemDetail` fields accordingly"*, the code
> scheme `problemDetail.type.[FQCN]` / `problemDetail.title.[FQCN]` /
> `problemDetail.[FQCN][suffix]`, and the per-exception message-argument
> table). Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Every `ProblemDetail` Spring builds for its own exceptions is
message-source-resolvable, which means you can retitle and reword all of them —
in every language you support — from a properties file, without writing a
handler. It is the cheapest customisation in this entire topic, and the only
supported way to change wording that is generated inside the framework.**

## The code scheme

| Field | Message code |
|---|---|
| `type` | `problemDetail.type.[fully qualified exception class name]` |
| `title` | `problemDetail.title.[fully qualified exception class name]` |
| `detail` | `problemDetail.[fully qualified exception class name][suffix]` |

```properties
# messages.properties
problemDetail.title.org.springframework.web.HttpRequestMethodNotSupportedException=\
  Method not allowed
problemDetail.org.springframework.web.HttpRequestMethodNotSupportedException=\
  {0} is not supported on this resource. Supported methods: {1}

problemDetail.title.org.springframework.web.servlet.resource.NoResourceFoundException=\
  Not found
problemDetail.org.springframework.web.servlet.resource.NoResourceFoundException=\
  No resource exists at {0}
```

```properties
# messages_de.properties — same keys, translated detail
problemDetail.org.springframework.web.HttpRequestMethodNotSupportedException=\
  {0} wird für diese Ressource nicht unterstützt. Unterstützt: {1}
```

Boot auto-configures a `MessageSource` over `messages.properties` on the
classpath, so in a Boot application there is nothing to wire — dropping the file
in `src/main/resources` is the whole change. The locale comes from the request
in the usual MVC way, so `Accept-Language` selects the bundle.

## The arguments each exception supplies

The reference documents these per exception. A working selection:

| Exception | Arguments |
|---|---|
| `HttpRequestMethodNotSupportedException` | `{0}` current HTTP method, `{1}` supported methods |
| `HttpMediaTypeNotSupportedException` | `{0}` unsupported media type, `{1}` supported media types |
| `HttpMediaTypeNotAcceptableException` | `{0}` list of supported media types |
| `MethodArgumentNotValidException` | `{0}` global errors, `{1}` field errors |
| `HandlerMethodValidationException` | `{0}` all validation errors |
| `MissingServletRequestParameterException` | `{0}` parameter name |
| `MissingRequestHeaderException` | `{0}` header name |
| `MissingPathVariableException` | `{0}` path variable name |
| `MissingRequestCookieException` | `{0}` cookie name |
| `MissingMatrixVariableException` | `{0}` matrix variable name |
| `MissingServletRequestPartException` | `{0}` part name |
| `TypeMismatchException` | `{0}` property name, `{1}` property value, `{2}` required type |
| `ConversionNotSupportedException` | `{0}` property name, `{1}` property value |
| `NoResourceFoundException` | `{0}` request path |
| `UnsatisfiedServletRequestParameterException` | `{0}` parameter conditions |
| `HttpMessageNotReadableException`, `HttpMessageNotWritableException`, `NoHandlerFoundException`, `AsyncRequestTimeoutException` | none |

That last row matters: several built-ins supply **no** arguments, so a
placeholder in their override renders literally.

⚠️ **`TypeMismatchException`'s `{1}` is the value the client sent.** If a client
puts a token in a query parameter that should be an `int`, echoing `{1}` puts
that token in the error body — and in your logs. Prefer `{0}` and `{2}`
(the parameter name and the expected type), which are the two things the client
actually needs. This is the same class of leak as
[chunk 13](13-never-reaches-the-client.md) deals with at length.

## The precondition nobody reads

🔴 **The message codes are only resolved if something resolves them, and that
something is `ResponseEntityExceptionHandler`.** The reference is unambiguous:
it *"resolves these through a `MessageSource` and updates the corresponding
`ProblemDetail` fields accordingly"*, and the resolution happens inside its
`handleExceptionInternal`.

So an advice like this picks the overrides up:

```java
@RestControllerAdvice
class ApiErrorHandler extends ResponseEntityExceptionHandler { ... }
```

and an advice like this does **not**, no matter how correct your keys are:

```java
@RestControllerAdvice
class ApiErrorHandler {                    // no superclass
    @ExceptionHandler
    ProblemDetail handle(HttpRequestMethodNotSupportedException ex) { ... }
}
```

A hand-written handler builds the `ProblemDetail` itself and never consults the
`MessageSource`. If you want both a custom handler and message-source wording,
call `ex.updateAndGetBody(messageSource, locale)` yourself.

## What may and may not be translated

| Field | Localise? | Why |
|---|---|---|
| `detail` | ✅ yes | It is prose about this occurrence and exists to be read by a person |
| `title` | ✅ yes | Human-readable summary of the kind |
| `type` | ⛔ **never** | It is an **identifier** clients compare for equality. A `type` that varies with `Accept-Language` is broken |
| `status` | n/a | An integer |
| `instance` | ⛔ no | A URI identifying the occurrence |

Spring exposes a `problemDetail.type.[FQCN]` code, which makes localising `type`
*possible*. Use it to set a type URI centrally for a built-in exception — once,
in the default bundle — and never to vary it per locale.

## Where this fits in the customisation ladder

Three levels, cheapest first, and most teams should stop at the second:

1. **Message codes.** Wording and translation only. No Java, no redeploy if the
   bundle is externalised. Cannot change status, type semantics or structure.
2. **`ResponseEntityExceptionHandler` overrides.** A `handle*` method per
   exception when you need a different *status* or extra members, not just
   different words ([chunk 10](10-responseentityexceptionhandler.md)).
3. **A bespoke handler.** Full control, and you lose message resolution unless
   you call `updateAndGetBody` yourself.

## The trade-off

Message codes decouple wording from code, which is exactly right when product,
support or legal owns the copy — they can change "Method not allowed" without a
Java change. The price is that the keys embed **fully qualified Spring class
names**, so they are coupled to Spring's internal package layout and will
silently stop matching if a class moves in a future release. The failure is
invisible: you get the default wording back, with no error and no warning.

## Gotchas

**Symptom** — a `messages.properties` override for a Spring exception is
ignored entirely.
**Cause** — the advice does not extend `ResponseEntityExceptionHandler`, so
nothing resolves the codes.
**Fix** — extend it, or call `ex.updateAndGetBody(messageSource, locale)` in
your own handler before returning the body.

**Symptom** — `{0}` appears literally in the response text.
**Cause** — that exception supplies no message arguments, or the index is beyond
what it provides.
**Fix** — check the arguments table above; several built-ins supply none.

**Symptom** — a key that worked before a Spring upgrade stops working.
**Cause** — the exception class moved package, and the key embeds the FQCN.
**Fix** — re-verify the override set at each major upgrade and keep it small.
There is no wildcard form of these keys.

**Symptom** — the `type` URI differs between two languages.
**Cause** — someone added `problemDetail.type.…` to a locale-specific bundle.
**Fix** — remove it from every bundle except the default. `type` is an
identifier.

**Symptom** — an override renders with the wrong locale for API clients.
**Cause** — the locale is resolved from the request; API clients frequently send
no `Accept-Language`, so they get the default bundle.
**Fix** — that is usually correct behaviour. If your API must serve a specific
locale per tenant rather than per request, resolve it from your own context
rather than from the header.

**Symptom** — a translated `detail` for a validation error reads badly because
`{1}` is a raw list of field errors.
**Cause** — `MethodArgumentNotValidException`'s arguments are the global and
field error collections, formatted by their `toString`.
**Fix** — do not translate that one through the message source. Handle it
explicitly and build a structured `errors` extension member instead — see
[chunk 11](11-mapping-domain-exceptions.md).

**Symptom** — a key exists in `messages_de.properties` and nowhere else, and
German clients get the override while everyone else gets Spring's default text.
**Cause** — resource-bundle lookup falls back from the locale bundle to the
default bundle, not the other way round. A key present only in a locale bundle
has nothing to fall back *from*.
**Fix** — put every key in `messages.properties` first, then translate. The
default bundle is the source of truth for which keys exist at all.

**Symptom** — support changes a piece of copy and a frontend feature breaks.
**Cause** — the frontend was branching on `detail` text rather than on `type`.
Wording is meant to be free to change; that is the entire point of putting it in
a bundle.
**Fix** — publish `type` as the branching key and say so in the API
documentation. If a client insists on a short string, give it a `code` extension
member ([chunk 7](07-extension-members.md)) — a stable identifier, not prose.

## Interview questions

**★ How do you change the wording of Spring's built-in error messages?**
Through the `MessageSource`, with `problemDetail.title.[FQCN]` for the title and
`problemDetail.[FQCN]` for the detail, using the documented `{0}`/`{1}`
arguments per exception. In Boot, dropping `messages.properties` on the
classpath is the whole setup.

**★ Why might correct message keys have no effect?**
Because resolution happens inside `ResponseEntityExceptionHandler`. An advice
that does not extend it — or a hand-written handler that constructs the
`ProblemDetail` itself — never consults the `MessageSource`. The fix is to
extend it, or to call `updateAndGetBody` explicitly.

**★ Which `ProblemDetail` fields may be localised, and which must not?**
`title` and `detail` may. `type` must not: it is an identifier clients compare
for equality, so varying it by `Accept-Language` silently breaks branching for
anyone in a different locale. `status` and `instance` are machine fields.

**★ What is the maintenance risk of this mechanism?**
The keys embed fully qualified Spring class names. A class moving package in a
future Spring release makes the key stop matching, and the failure is silent —
the default text simply comes back. Keep the override set small and re-verify on
major upgrades.

**★ Where exactly does the resolution happen?**
Inside `ResponseEntityExceptionHandler`'s `handleExceptionInternal` — the method
every one of its `handle*` methods delegates to — with `createProblemDetail`
doing the `MessageSource` lookup for the detail field. That is why the mechanism
is invisible until you extend the base class, and why an override that stops
calling `super` quietly turns it off ([chunk 10](10-responseentityexceptionhandler.md)).

**★ You have a hand-written handler and you still want message-source wording.
How?**
Call `ex.updateAndGetBody(messageSource, locale)` on the exception — it is part
of the `ErrorResponse` contract ([chunk 8](08-errorresponse.md)) and it resolves
the type, title and detail codes and returns the updated `ProblemDetail`. It
only works for exceptions that implement `ErrorResponse`, which is every Spring
MVC exception and any of yours that opted in.

**★ Do message codes work for your own exceptions?**
Yes, on the same scheme, provided the exception implements `ErrorResponse` —
`problemDetail.title.[your FQCN]` and `problemDetail.[your FQCN]`. Whether you
*want* that is the question chunk 8 argues: it puts your exception's copy in a
properties file keyed by a class name you are then reluctant to rename. For a
domain exception you map centrally, writing the wording in the handler is
usually clearer.

**★ Should a machine-facing API translate its error text at all?**
Often not. `type` is the identifier a client branches on, and if the client
renders its own message keyed off `type`, translating `detail` server-side is
work nobody reads. Translate when a human reads the response directly — an
internal tool, an admin surface, a partner integration whose support staff quote
it back to you. Otherwise ship one clear language and treat `detail` as
diagnostic prose for a developer.

**★ Can the bundle be changed without a redeploy?**
Only if you make it so. The classpath `messages.properties` Boot auto-configures
is baked into the artifact. Pointing the message source at an external location
— or using a reloadable implementation — is what lets product or support edit
copy independently, and it is worth doing only when someone outside the
engineering team genuinely owns the wording. Confirm the reload semantics of
whatever you configure rather than assuming them; caching behaviour differs
between implementations.

**★ What is the one key you should never put in a locale bundle?**
`problemDetail.type.[FQCN]`. Spring exposes the code, so localising `type` is
mechanically possible and semantically broken: `type` is an identifier clients
compare for equality, and one that varies with `Accept-Language` means a client
in another locale silently stops matching. Set it once in the default bundle if
you want to give a built-in exception a stable type URI, and never anywhere
else.

---

← Prev: [ErrorResponse](08-errorresponse.md) · Index: [Error handling](README.md) · Next → [ResponseEntityExceptionHandler](10-responseentityexceptionhandler.md)
