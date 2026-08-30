---
title: "MockMvc constructs a MockMultipartHttpServletRequest directly, so a multipart test parses no boundaries and enforces no size limit — and the convenient file(name, bytes) overload builds a part whose original filename is the empty string and whose content type is null, which is enough to make a filename-validation test pass for the wrong reason"
sidebar_label: "04c · Multipart and post-processors"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "Performing Requests"
> ([hamcrest](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/requests.html),
> [assertj](https://docs.spring.io/spring-framework/reference/testing/mockmvc/assertj/requests.html))
> — read as asciidoc source at tag `v7.0.9`, and the `spring-test` 7.0.9 sources for
> `AbstractMockMultipartHttpServletRequestBuilder`, `MockMultipartFile`,
> `MockHttpServletRequestBuilder` and `RequestPostProcessor`, from which every javadoc sentence
> and code excerpt below is taken.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8 (docs and sources read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**Two things the request builder does that deserve their own page. Multipart, because what it
builds is much less than what a container would build and the shortcut overload is incomplete in a
way that produces false green tests. And `with(RequestPostProcessor)`, because the builder is
deliberately closed for extension and this one method is how Spring Security, and your own
conventions, get into a request at all.**

## 🔴 Multipart: nothing is parsed, and the filename is empty

```java
mockMvc.perform(multipart("/doc").file("a1", "ABC".getBytes("UTF-8")));
```

The reference is upfront about the mechanism:

> *"You can also perform file upload requests that internally use
> `MockMultipartHttpServletRequest` so that **there is no actual parsing of a multipart request**.
> Rather, you have to set it up to be similar to the following example."*

The builder's constructor sets two things for you:

```java
AbstractMockMultipartHttpServletRequestBuilder(HttpMethod httpMethod) {
    super(httpMethod);
    super.contentType(MediaType.MULTIPART_FORM_DATA);   // and multipart() defaults to POST
}
```

so you do not set the method or the content type — but you also do not get boundary parsing,
part-size limits, `MaxUploadSizeExceededException`, or any of the container's own multipart
behaviour. A test that "proves" a 10 MB upload is rejected is proving your controller's check,
never `spring.servlet.multipart.max-file-size`.

**And the convenient overload builds an incomplete part:**

```java
public B file(String name, byte[] content) {
    this.files.add(new MockMultipartFile(name, content));
    return self();
}

// MockMultipartFile:
public MockMultipartFile(String name, byte @Nullable [] content) {
    this(name, "", null, content);          // originalFilename = "", contentType = null
}
```

So `.file("document", bytes)` produces a `MultipartFile` whose `getOriginalFilename()` is `""` and
whose `getContentType()` is `null`. Any controller that validates the extension, derives a
content type, or stores the original name sees an empty string — and a validation test written
this way passes for the wrong reason. Use the four-argument form when the filename or type
matters:

```java
new MockMultipartFile("document", "invoice.pdf", MediaType.APPLICATION_PDF_VALUE, bytes)
```

`part(Part...)` is the other route, since 5.0, when you need Servlet `Part` semantics rather than
Spring's `MultipartFile`.

## `with(RequestPostProcessor)` — the extension point everything else plugs into

```java
/**
 * An extension point for further initialization of {@link MockHttpServletRequest}
 * in ways not built directly into the {@code MockHttpServletRequestBuilder}.
 * Implementation of this interface can have builder-style methods themselves
 * and be made accessible through static factory methods.
 */
public B with(RequestPostProcessor postProcessor) { … }
```

The builder is explicitly closed — *"This class is not open for extension. To apply custom
initialization to the created `MockHttpServletRequest`, please use the
`with(RequestPostProcessor)` extension point"* — so every third-party addition arrives this way.
Spring Security's `csrf()`, `user(...)`, `jwt()` and `httpBasic(...)` are all
`RequestPostProcessor`s ([08](08-security-in-a-slice.md)), and your own house conventions can be
too:

```java
public final class TestRequests {
    public static RequestPostProcessor tenant(String id) {
        return request -> { request.addHeader("X-Tenant", id); return request; };
    }
}

// then, in any test, with either API:
assertThat(mvc.get().uri("/orders").with(tenant("acme"))).hasStatusOk();
```

That is the sanctioned way to stop repeating four setup lines in every test of a multi-tenant
API, and it composes with everything else on the builder.

## Gotchas

**★ `.file("doc", bytes)` when the controller reads the original filename.**
That overload builds `new MockMultipartFile(name, content)`, whose original filename is `""` and
whose content type is `null`. A filename-validation test then passes against an empty string. Use
the four-argument `MockMultipartFile`.


**★ Expecting a multipart size limit to be enforced.**
There is *"no actual parsing of a multipart request"*, so `spring.servlet.multipart.max-file-size`
does nothing here and `MaxUploadSizeExceededException` is never thrown. That behaviour needs a
running server.


**★ Setting `contentType` yourself on a `multipart(...)` request.**
The builder already sets `multipart/form-data`. Overriding it with `application/octet-stream`
because the part is a binary produces a request no multipart resolver will handle.


**★ Repeating four setup lines in every test instead of writing a `RequestPostProcessor`.**
The builder is closed for extension precisely so that `with(...)` is the place to put house
conventions. A static factory returning a `RequestPostProcessor` reads better than a
`@BeforeEach` that mutates a shared builder.


**★ Asserting that an oversized upload is rejected, in a slice test.**
Nothing enforces a size limit, so the assertion is either testing a check you wrote in the
controller — fine, say so — or passing because the request never got large enough to matter. The
container-level limit needs a running server.

**★ A `RequestPostProcessor` that returns a different request object.**
The contract is to initialise and return the given `MockHttpServletRequest`. Returning a new
instance discards everything the builder already set, and the failure looks like the builder
silently ignoring your calls.

**★ Applying `with(...)` before the property it depends on.**
Post-processors run after the request is built, so ordering among builder calls does not matter —
but ordering *among post-processors* does, and two that both set the same header will not merge.
Keep each one responsible for one concern.

## Interview questions

**★ What does a MockMvc multipart test not test?**
The parsing. `MockMultipartHttpServletRequest` is constructed directly, so there is *"no actual
parsing of a multipart request"* — no boundaries, no size limits, no
`MaxUploadSizeExceededException`, no container behaviour. It tests your controller's handling of
parts that Spring handed it, which is worth testing and is not the same claim.


**★ Why does a file-upload validation test pass when it should not?**
Very likely `.file("name", bytes)`, whose `MockMultipartFile` has an original filename of `""` and
a `null` content type. A check like "reject anything that is not `.pdf`" then runs against an
empty string, which may take a branch you did not intend. Construct the `MockMultipartFile` with
the four-argument form.


**★ How do you add a project-specific convention — a tenant header, a trace id — to every test
request?** Write a `RequestPostProcessor` and expose it from a static factory, then `.with(...)`
it. The request builder is closed for extension and its javadoc names `with(RequestPostProcessor)`
as the extension point; it is the same mechanism Spring Security's `csrf()` and `user(...)` use.

{/* FOOTER */}

**★ Why is the request builder closed for extension?**
Its javadoc says so directly — *"This class is not open for extension. To apply custom
initialization to the created `MockHttpServletRequest`, please use the `with(RequestPostProcessor)`
extension point"* — and the reason is that the builder's `merge` semantics with `defaultRequest`
would be impossible to keep correct across subclasses. A `RequestPostProcessor` runs after the
request is built, so it composes with defaults and with every other post-processor.

{/* FOOTER */}
