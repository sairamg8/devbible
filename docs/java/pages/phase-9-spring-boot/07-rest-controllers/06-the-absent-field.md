---
title: "The absent field, and why PATCH is hard"
sidebar_label: "6 · The absent field"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against RFC 5789 (HTTP PATCH — the method is a set of
> *instructions* describing how to modify a resource, and is neither safe nor
> idempotent in general), RFC 7386 (JSON Merge Patch — `null` in the patch
> document means *remove the member*, and absence means *leave it unchanged*),
> RFC 6902 (JSON Patch — an explicit operation array), and the Jakarta
> Validation 3.1 specification page (jakarta.ee — records support).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A record component always has a value. If the JSON omits a field, Jackson
supplies the type's default — `null` for a reference, `0` for an `int`, `false`
for a `boolean` — and the record cannot afterwards distinguish "the client
omitted this" from "the client explicitly sent null". For `POST` and `PUT` that
loss costs nothing, because both replace the whole resource. For `PATCH` it is
fatal, because the entire meaning of `PATCH` is the difference between those two
cases. This is not a Jackson limitation or a Spring limitation; it is what
"every component has a value" implies, and no annotation fixes it.**

## The three cases that collapse into one

```java
public record UpdateOrder(String note, String currency) { }
```

| Client sent | `note` receives | What the client meant |
|---|---|---|
| `{"note": "gift wrap"}` | `"gift wrap"` | set it to this |
| `{"note": null}` | `null` | **clear it** |
| `{}` — omitted | `null` | **leave it alone** |

Rows two and three arrive identically and mean opposite things. Any code written
against this record must pick one interpretation and apply it to both.

Whichever it picks is wrong half the time:

```java
// Interpretation A — treat null as "clear it".
order.setNote(patch.note());
// PATCH {"currency":"EUR"} now silently wipes the note. Data loss.

// Interpretation B — treat null as "leave it alone".
if (patch.note() != null) { order.setNote(patch.note()); }
// Now a client can NEVER clear the note. There is no request that does it.
```

Interpretation B is overwhelmingly the one that ships, because it does not
destroy data and therefore does not generate incident reports. It generates a
support ticket eighteen months later titled *"cannot remove the note from an
order"*, which nobody connects to a line of code written by someone who has
since left.

**The `if (value != null)` guard is not a fix. It is a decision to make one
operation permanently impossible, taken silently.**

## What the RFCs actually say

The reason this matters is that `PATCH` has a specification and the collapse
above violates it.

**RFC 5789** defines `PATCH` as carrying *a set of instructions describing how
the resource should be modified* — not a partial representation to be merged by
whatever rule the server invented. It also notes `PATCH` is neither safe nor
idempotent in general, which is worth remembering when clients retry.

**RFC 7386 (JSON Merge Patch)** is the format most APIs think they are
implementing when they accept a partial JSON object. Its rule is explicit and it
is precisely the distinction a record destroys:

- a member **present with a value** — set it to that value;
- a member **present with `null`** — **remove** it;
- a member **absent** — leave it unchanged.

**RFC 6902 (JSON Patch)** avoids the problem entirely by not using a partial
object at all. The body is an array of operations — `add`, `remove`, `replace`,
`move`, `copy`, `test` — each naming a JSON Pointer path. Absence is not a
concept, because nothing is absent: an operation is either in the array or it is
not.

So the situation is that the two standard formats both depend on distinguishing
absent from null, and the record has already thrown that away by the time your
handler runs.

## The three honest options

### 1. Do not offer `PATCH`

The most common right answer. Most resources are small enough that `PUT` with
the full representation is simpler for both sides, and the read-modify-write
round trip it forces is usually a feature rather than a cost — it makes
concurrent modification visible, and it pairs naturally with `ETag` and
`If-Match` for optimistic concurrency.

```java
@PutMapping("/{id}")
OrderDetail replace(@PathVariable long id,
                    @Valid @RequestBody OrderRepresentation body) { ... }
```

Choose this unless a concrete requirement rules it out: very large resources
where sending the whole thing is genuinely expensive, or fields several clients
update independently and would clobber.

### 2. Make absence representable in the type

```java
public record PatchOrder(Optional<String> note,
                         Optional<String> currency) { }
```

Now `Optional.empty()` means absent and `Optional.of(null)` is impossible — so
you need a three-state wrapper if you want to express *set to null* as well. The
usual shapes are a nested `Optional<Optional<T>>`, which nobody enjoys reading,
or a purpose-built type:

```java
// A three-state value: absent | present-with-null | present-with-value.
public sealed interface Patch<T> {
    record Absent<T>()          implements Patch<T> { }
    record Set<T>(T value)      implements Patch<T> { }   // value may be null
}

public record PatchOrder(Patch<String> note, Patch<String> currency) { }
```

This is correct and it is honest, and it costs a custom deserialiser plus a
`switch` at every use site. It is worth it when `PATCH` is genuinely central to
the API — and disproportionate when it is one endpoint.

⚠️ Either variant requires configuring Jackson so an absent property leaves the
component as the empty case rather than `null`, and requires that consumers
handle the extra level. Verify the behaviour on your own configuration rather
than assuming it; this is exactly the sort of thing that differs between setups.

### 3. Take the raw tree and apply only what is present

```java
@PatchMapping(path = "/{id}", consumes = "application/merge-patch+json")
OrderDetail patch(@PathVariable long id,
                  @RequestBody Map<String, Object> patch) {

    Order order = repository.findById(id).orElseThrow();

    // containsKey is the whole point: present-with-null is distinguishable
    // from absent, which is what RFC 7386 requires.
    if (patch.containsKey("note")) {
        order.setNote((String) patch.get("note"));   // null here means "remove"
    }
    if (patch.containsKey("currency")) {
        order.setCurrency((String) patch.get("currency"));
    }
    return mapper.toDetail(repository.save(order));
}
```

`containsKey` recovers exactly the distinction the record lost. Note the media
type: `application/merge-patch+json` is the registered type for RFC 7386, and
declaring it in `consumes` documents which patch semantics this endpoint
implements — worth doing, because a client cannot otherwise tell.

The trade is real and should be stated plainly: you have given up the typed DTO
for this endpoint, so **validation and API documentation no longer come for
free**. Bean Validation has no DTO to annotate, and a generated OpenAPI schema
will describe an untyped object. Both have to be supplied by hand — which is a
genuine cost, and the main reason option 1 wins so often.

## The trade-off

Every option above trades away something people want to keep:

| Option | Keeps | Gives up |
|---|---|---|
| No `PATCH` | typed DTO, validation, docs, simplicity | partial update; clients send the whole resource |
| Wrapper type | correctness, typed DTO | readability; custom deserialiser; every use site branches |
| Raw tree | correctness, `PATCH` semantics | the typed DTO — so validation and generated docs |

There is no option that keeps all three of *typed record DTO*, *correct `PATCH`
semantics* and *no extra machinery*. That combination does not exist, and the
reason it does not exist is a language-level property of records rather than
anything Spring chose. Recognising that early is the difference between picking
a trade-off and discovering one.

## Gotchas

**Symptom:** a `PATCH` that sets one field wipes every field the client did not mention
**Cause:** interpretation A — omitted components arrive as `null`, and the update code applies all of them, so absence is being read as "clear this"
**Fix:** pick one of the three options above deliberately. Until then, the least destructive stopgap is to reject the endpoint's use with a 501 rather than to keep losing data quietly

**Symptom:** clients report they cannot clear an optional field — sending `null` does nothing
**Cause:** interpretation B — the update is guarded by `if (value != null)`, which makes *set to null* unrepresentable. This is the "safe" fix for the previous gotcha and it has simply moved the bug somewhere quieter
**Fix:** the same three options. `if (value != null)` is not a solution to either symptom; it chooses which of the two bugs you ship

**Symptom:** an `int` or `boolean` component behaves as though the client sent `0` or `false`
**Cause:** a primitive component cannot even hold `null`, so absence collapses one step further — into a value that looks entirely legitimate
**Fix:** never use primitives in a patch DTO. Box everything, so absence at least reaches your code as `null` rather than as a plausible-looking number

**Symptom:** two clients patch different fields of the same resource and one update disappears
**Cause:** a read-modify-write cycle with no concurrency control — both read the same state, both write, the second wins. `PATCH` is not idempotent in general (RFC 5789), and retries make it worse
**Fix:** add optimistic concurrency — serve an `ETag`, require `If-Match`, and return 412 on a mismatch. This is orthogonal to the absent-field problem and is needed regardless of which option you pick

**Symptom:** a `PATCH` endpoint accepts `application/json` and different clients assume different semantics
**Cause:** `application/json` says nothing about *which* patch format the body is; RFC 7386 and RFC 6902 are different documents with different meanings for the same-looking payload
**Fix:** declare the real media type in `consumes` — `application/merge-patch+json` or `application/json-patch+json` — so the contract is explicit and a client sending the wrong format gets a 415 rather than a silent misinterpretation

## Interview questions

**★ Why is `PATCH` hard to implement with record DTOs?**
Because a record component always has a value, so an omitted JSON field and an
explicitly null one both arrive as `null`, and `PATCH` semantics require those
to differ — omitted means "leave this alone", explicit null means "clear this".
The information is gone before the handler runs, so no amount of code inside the
handler can recover it. It is worth being precise that this is not a Jackson or
Spring shortcoming: it follows from records having no notion of an absent
component, which is a language-level property.

**★ Someone fixes a data-loss bug by wrapping every update in `if (value != null)`. What did they actually do?**
They swapped one bug for a quieter one. The original bug was that omitted fields
were being cleared; the guard stops that, but it also makes *set to null* an
operation no client can ever perform, because both cases arrive identically and
the guard now ignores both. It ships because the new failure produces a support
ticket rather than an incident — "I can't remove the note" is discovered months
later and rarely traced back. The correct framing is that `if (value != null)`
is not a fix at all, it is a silent choice about which of two bugs to keep.

**★ What does RFC 7386 say, and why is it relevant here?**
JSON Merge Patch defines exactly the semantics most APIs believe they are
implementing when they accept a partial JSON object: a member present with a
value sets it, a member present with `null` **removes** it, and an absent member
is left unchanged. It is relevant because those three rules are precisely the
distinction a record destroys — two of them become indistinguishable. So an API
accepting a partial record DTO and calling it a merge patch is not implementing
the RFC, whatever the documentation claims. RFC 6902's JSON Patch sidesteps the
issue entirely by sending an array of explicit operations, where nothing is ever
"absent".

**★ Give me the three ways to handle this and when you would pick each.**
First, do not offer `PATCH` — use `PUT` with a full representation. This is my
default, because it keeps the typed DTO, keeps validation and generated
documentation, and the read-modify-write round trip pairs naturally with `ETag`
and `If-Match`. Second, make absence representable in the type, either with
`Optional` components or a purpose-built three-state wrapper; this is correct
and typed but costs a custom deserialiser and a branch at every use site, so I
would only do it where `PATCH` is central to the API. Third, bind the body as a
map or Jackson tree and apply only the keys `containsKey` reports as present;
this is the most faithful to RFC 7386 and the cheapest to write, but it gives up
the typed DTO, so Bean Validation and OpenAPI generation have to be supplied by
hand. The thing to be clear about is that no option keeps all three of typed
DTO, correct semantics and no extra machinery — that combination does not exist.

**★ Is `PATCH` idempotent, and does it matter?**
Not in general — RFC 5789 says `PATCH` is neither safe nor idempotent, because
the body is a set of *instructions* rather than a target state, and instructions
like "increment" or "append" produce different results when applied twice. It
matters a great deal in practice, because clients and proxies retry on timeouts,
and a retried non-idempotent patch can apply twice. That is why a `PATCH`
endpoint usually needs optimistic concurrency — an `ETag` served on `GET`, an
`If-Match` required on the patch, and a 412 when they disagree — which also
solves the separate problem of two clients patching different fields and one
update vanishing.

**★ Why declare `application/merge-patch+json` rather than just `application/json`?**
Because `application/json` describes the syntax and says nothing about the
semantics, and there are at least two incompatible things a JSON body on a
`PATCH` can mean — RFC 7386 merge patch and RFC 6902 JSON Patch — which look
similar enough for a client to guess wrong. Declaring the specific registered
media type in `consumes` makes the contract explicit, and has the useful side
effect that a client sending the other format gets a clean 415 instead of having
its operation array silently interpreted as a set of fields to assign.

---

← Prev: [Records as DTOs](05-records-as-dtos.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The response](07-the-response.md)
