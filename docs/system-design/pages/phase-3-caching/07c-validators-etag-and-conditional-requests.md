---
title: "A validator lets a stale response be checked instead of refetched, the 304 saves the bytes and not the origin's work unless the validator is cheaper than the response, and the same ETag that powers revalidation can guard writes against lost updates"
sidebar_label: "07c · Validators and 304"
sidebar_position: 7.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §8.8.1
> (strong and weak validators), §8.8.2 (`Last-Modified`), §8.8.3 (entity tag), §13.1.3
> (`If-Modified-Since`), §15.4.5 (304), all quoted; [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html)
> for freshness (quoted in [07](07-http-caching-semantics.md)); and the Spring Framework reference
> [HTTP Caching](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-caching.html)
> (`ShallowEtagHeaderFilter`, `ResponseEntity.eTag`, `checkNotModified`), quoted. `If-None-Match`
> is described as mechanism: the one RFC sentence retrieved for it was a garbled extraction and is
> not quoted. Express's default `ETag` generation and the behaviour of web servers that derive
> validators from file metadata are stated as mechanism and were **not fetched**. **No sandbox
> run.**

**Freshness answers "may I skip the origin"; validation answers "I must ask — can the answer be
small?" A validator is the token that makes the answer small: the cache sends back the one it
holds, the origin compares, and either returns a few hundred bytes of `304` or the whole new
response.** Two things decide whether this is worth building. The first is what the origin does to
*decide* — a `304` that costs the same database query as the full response saves the network and
nothing else. The second is whether the validator is stable across the machines that serve it —
a validator that differs between instances turns every revalidation into a full response. This
page is the mechanism, the cost, the code, and the use of the same token to stop two writers
overwriting each other.

## The two validators

Both are representation metadata that the origin attaches to a response; the cache stores them and
echoes them back.

> *"An entity tag is an opaque validator for representing a selected representation of the target resource."* — RFC 9110 §8.8.3

> *"The Last-Modified header field in a response provides a timestamp indicating the date and time at which the origin server believes the selected representation was last modified."* — RFC 9110 §8.8.2

**`ETag`** is a string the origin makes up and the client must not interpret: *opaque*. A hash of
the body, a database row version, a counter — whatever changes when the representation changes.
**`Last-Modified`** is a timestamp, with the limits of a timestamp: second resolution, and it
asserts a time the origin merely "believes".

The echo headers carry them back. `If-None-Match` carries the stored `ETag` (the origin compares
it to the current one — the comparison semantics are the mechanism; I do not quote the RFC's
sentence on it, see the Verified line). `If-Modified-Since` carries the stored timestamp:

> *"The If-Modified-Since header field makes a GET or HEAD request conditional on the selected representation's modification date being more recent than the date provided in the field-value."* — RFC 9110 §13.1.3

And the answer that makes it cheap:

> *"The 304 response indicates that a conditional GET or HEAD request has been received and would have resulted in a 200 OK response if it were not for the evaluated precondition being false."* — RFC 9110 §15.4.5

So the exchange is: the cache holds a stale response with an `ETag`. A request arrives; the cache
sends the origin a request carrying `If-None-Match: <that etag>`. If the origin's current
`ETag` matches, it answers `304` with no body, the cache keeps its stored body, and — because
the response was *successfully validated* — its age restarts from zero
([07](07-http-caching-semantics.md)'s definition of age). If it does not match, the origin
answers `200` with the new body and new validator. Prefer `ETag` where you have a choice;
`Last-Modified` is the fallback for when the origin has a timestamp and no better token.

### Strong and weak

> *"A strong validator is representation metadata that changes value whenever the associated representation's observable state changes."* — RFC 9110 §8.8.1

> *"A weak validator is representation metadata that might not change for every alteration to the associated representation."* — RFC 9110 §8.8.1

A strong tag promises byte-for-byte equality of what it labels; a weak tag promises only that the
two representations are equivalent for the client's purposes, written with a `W/` prefix on the
tag. A weak validator is sufficient for "may I reuse my cached copy" — the question a `304`
answers — and is inadequate for anything that needs byte identity (resuming a partial download
by range). A response that is compressed differently per client or whose body contains a
timestamp changes bytes without changing meaning, and a weak tag lets those still validate.

## What the 304 saves, and what it does not

The `304` saves the **response body on the wire**. It saves the **origin's work** only if the
origin can decide *without doing the work*. That is the point most explanations skip, and Spring's
reference says it directly about its automatic mechanism:

> *"You can use the `ShallowEtagHeaderFilter` to add "shallow" `eTag` values that are computed from the response content and, thus, save bandwidth but not CPU time."* — Spring Framework reference, HTTP Caching

A shallow ETag is computed *from the response*, so the controller still ran the query, built the
view and rendered the body; the filter hashes it, compares with the request's `If-None-Match`, and
if equal sends a `304` instead of the bytes. The database saw every request. That is better than
nothing for large payloads over slow links, and it is nothing for the origin's load.

The mechanism that does save the origin is a **cheap validator**: compute the tag from something
the origin can read without building the response — a version column, an `updated_at`, a
revision counter in the cache — compare first, and only build the body on a mismatch. Spring
documents that shape, and says why it asks for it:

> *"Controllers can add explicit support for HTTP caching. We recommended doing so, since the `lastModified` or `ETag` value for a resource needs to be calculated before it can be compared against conditional request headers."* — Spring Framework reference, HTTP Caching

```java
@GetMapping("/book/{id}")
public ResponseEntity<Book> showBook(@PathVariable Long id) {

	Book book = findBook(id);
	String version = book.getVersion();

	return ResponseEntity
			.ok()
			.cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS))
			.eTag(version) // lastModified is also available
			.body(book);
}
```

> *"The preceding example sends a 304 (NOT_MODIFIED) response with an empty body if the comparison to the conditional request headers indicates that the content has not changed. Otherwise, the `ETag` and `Cache-Control` headers are added to the response."* — Spring Framework reference, HTTP Caching

Note that this example still calls `findBook(id)` — it loads the entity to read its version. For
a real saving the version must be readable more cheaply than the body, which is what the
`checkNotModified` form is for: it lets the controller compute the validator, ask the framework
whether the request is satisfied, and return before the expensive work.

```java
@RequestMapping
public String myHandleMethod(WebRequest request, Model model) {

	long eTag = ... (1)

	if (request.checkNotModified(eTag)) {
		return null; (2)
	}

	model.addAttribute(...); (3)
	return "myViewName";
}
```

The reference's callouts: (1) application-specific calculation; (2) the response has been set to
304 and no further processing is needed; (3) continue with the request. For the storefront's
product page the cheap validator is the product's `version` or `updated_at`, one indexed read —
or, if the view is held in the distributed cache, a version stored alongside it — and the
expensive part (joining reviews, rendering) happens only on a mismatch.

The same in Express, where the framework offers the mechanism and you supply the token:

```js
app.get('/products/:id', async (req, res) => {
  const version = await catalogue.version(req.params.id);   // one cheap read
  const etag = `"p${req.params.id}-v${version}"`;

  res.set('Cache-Control', 'public, max-age=0, s-maxage=60, must-revalidate');
  res.set('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();                          // no body built
  }
  res.json(await catalogue.view(req.params.id));           // the expensive path
});
```

(Express's built-in `req.fresh` does the comparison; the explicit form above shows what it is
comparing. Express also generates a weak `ETag` from the body by default for responses it sends
— a shallow validator in the Spring sense: bandwidth saved, handler work not. That default is
stated from the framework's behaviour and was not re-fetched.) A production version should
tolerate a list of tags in `If-None-Match` and the `W/` prefix; a plain equality test is the
simplest case that shows the mechanism.

## Conditional requests are also a write guard

The same tokens that revalidate a read protect a write. Spring states both uses in one passage:

> *"There are three variants for checking conditional requests against `eTag` values, `lastModified` values, or both. For conditional `GET` and `HEAD` requests, you can set the response to 304 (NOT_MODIFIED). For conditional `POST`, `PUT`, and `DELETE`, you can instead set the response to 412 (PRECONDITION_FAILED), to prevent concurrent modification."* — Spring Framework reference, HTTP Caching

The pattern is optimistic concurrency over HTTP: a client reads the admin's product record with its
`ETag`, edits it, and sends the `PUT` with the tag in a precondition header; if someone else saved
in between, the tag no longer matches and the origin refuses with `412` rather than letting the
second writer silently overwrite the first. It belongs on the storefront's admin API, where two
staff editing one product is the realistic collision, and it costs nothing extra because the
validator already exists for the read.

## Validators across a fleet

A validator must be the same on every instance, or revalidation degrades into refetching.

- **Derived from content or from a shared version** — a body hash, a database version — is the
  same on every machine that serves the same data.
- **Derived from local state** — a file's inode and modification time, a per-process counter, a
  boot-time seed — differs between instances. The mechanism is easy to reason about: the cache
  stored the tag from instance A, the revalidation lands on instance B, the tags differ, the
  answer is a full `200`. A load-balanced fleet then shows revalidation that "never gets a 304".
  I state this as mechanism; the specific web servers and versions that derive tags from file
  metadata were not checked here.
- **Compression** changes the bytes while the resource is the same. A validator computed before
  compression, sent on a compressed body, and compared by a cache holding a different encoding
  can mismatch or can wrongly match; the safe discipline is a tag that is stable per
  representation and a `Vary: Accept-Encoding` ([07d](07d-vary-stale-directives-and-configuring-the-edge.md)).

## Gotchas

**★ Symptom: the origin shows a `304` for most requests yet its database load did not fall.**
Cause: the ETag is shallow — computed from the rendered response — so every request still ran
the query and built the body before being discarded. A `304` saves bandwidth, not work (Spring:
*"save bandwidth but not CPU time"*). Fix: derive the validator from a cheap version read and
compare before building; measure origin work per `304`, not the `304` count.

**★ Symptom: revalidation never produces a `304` on a load-balanced service.** Cause: the
`ETag` differs between instances (derived from per-machine state), so the validator a cache
stored never matches the instance that answers the revalidation. Fix: content-derived or
version-derived tags that are identical fleet-wide; test by requesting the same resource twice
through the load balancer.

**★ Symptom: a client edits a record and silently overwrites a colleague's change.** Cause: the
write carries no precondition, so the server cannot detect that the representation changed after
the client read it. Fix: return the `ETag` on the read, require it as a precondition on
`PUT`/`PATCH`/`DELETE`, and answer `412` on mismatch.

**★ Symptom: a page change is not visible to clients holding the old copy even though the origin
is correct.** Cause: the validator did not change when the representation did — a `Last-Modified`
at second resolution with two edits in one second, or an ETag derived from a field that the edit
did not touch. Fix: a validator that is strong with respect to every field in the representation,
typically a version incremented on any write.

**Symptom: the `ETag` changes on every request, so nothing ever validates.** Cause: the tag is
derived from something that varies per request — a rendered timestamp, a nonce in the HTML, a
random identifier in the body. Fix: exclude volatile fields from what is hashed, or use a weak tag
over the stable part.

**Symptom: client code receives a `304` with an empty body and treats it as the data.** Cause:
the code added `If-None-Match` or `If-Modified-Since` by hand, so the browser's cache was not
the one making the conditional request and the `304` is handed to the script as-is. Fix: let the
browser issue its own conditional requests from its stored entry; if a script must do it, keep
its own copy of the body and handle `304` explicitly.

**Symptom: `Last-Modified` revalidation misbehaves after a deploy that touched every file.**
Cause: the timestamp is from file metadata and a deploy reset it, invalidating every validator
without any content change. Fix: ETag from content; or keep `Last-Modified` from content time,
not from build time.

**Symptom: large images are revalidated on every view and the `304`s add up.** Cause: a short or
zero `max-age` on content that never changes. Fix: content-hash the URL and send a long lifetime
with `immutable` ([07d](07d-vary-stale-directives-and-configuring-the-edge.md)); validators are
for content whose URL stays fixed while the bytes change.

## Interview questions

**★ Walk me through a conditional request. What is on the wire, and what does the cache do?**
The cache holds a response that has gone stale and has stored its `ETag`. A request arrives; the
cache forwards a request carrying `If-None-Match` with that tag. The origin compares it with the
current tag of the representation. If they match, it answers `304` with no body — RFC 9110
defines it as a response that *"would have resulted in a 200 OK response if it were not for the
evaluated precondition being false"* — and the cache serves its stored body, treating the
response as validated, which restarts its age. If they differ the origin answers `200` with the new
body and tag. `Last-Modified` with `If-Modified-Since` is the same exchange with a timestamp.

**★ Does a `304` reduce load on the origin?**
Only if the validator is cheaper to produce than the response. A shallow ETag — hashed from the
rendered body, as Spring's `ShallowEtagHeaderFilter` does (and, from unfetched memory, Express's default does) — saves the bytes
on the wire and nothing else, because the handler ran in full. A version-derived validator, read
from an indexed column or a cached revision and compared before the body is built, saves both. The
design decision is therefore where the validator comes from, not whether to send one.

**★ What is the difference between a strong and a weak ETag, and which do you use for the
product page?**
A strong validator *"changes value whenever the associated representation's observable state
changes"*, a weak one *"might not change for every alteration"* (RFC 9110 §8.8.1). A weak tag
(`W/"..."`) says the two representations are equivalent enough to reuse; a strong tag says
byte-identical. For deciding whether a cached copy may be reused, weak is enough and tolerates
re-compression and volatile fields; for byte-range resumption or any use that needs identity,
strong is required. The product page uses a version-derived tag; whether it is weak or strong
depends on whether anything beyond reuse relies on it.

**How do conditional requests prevent lost updates?**
By carrying the validator on the write. The client read the record with its `ETag`; the `PUT`
sends it back as a precondition; the origin compares to the current tag and refuses with `412` on
a mismatch instead of applying the write over a newer version. It is optimistic concurrency using
the headers the read side already needed, and it is the right guard for the admin product editor.

**Why would revalidation fail to produce `304`s behind a load balancer?**
Because the tag is derived from per-instance state, so the instance that answers the
revalidation computes a different tag from the one that produced the stored response. Every
revalidation becomes a full response. The fix is a tag derived from the content or a shared
version, identical on every instance.

**When would you choose `ETag` over `Last-Modified`?**
Whenever I can produce a token that changes exactly when the representation does. `Last-Modified`
is second-granularity, depends on the origin's belief about a time, and can be reset by
operations like a redeploy. `ETag` is opaque and can be a version, a hash, or a counter. I use
`Last-Modified` only when a timestamp is what the data has and nothing better exists.

{/* FOOTER */}
