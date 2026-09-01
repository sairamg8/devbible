---
title: "202 Accepted is the HTTP answer to a user who is waiting, and RFC 9110 is blunt that it is intentionally noncommittal — which is exactly the property that makes it honest and the reason it is sometimes the wrong choice"
sidebar_label: "29 · The user who is waiting"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against RFC 9110, "HTTP Semantics", §15.3.3 (`202 Accepted`) and §15.3.2
> (`201 Created`) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html)), and Chris
> Richardson, "Dark matter force: minimize runtime coupling"
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-runtime-coupling.html)).
> 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**"A user is waiting for the result" is the objection that ends most conversations about making
an interaction asynchronous, and it is the one worth taking apart most carefully — because it is
sometimes decisive and usually not. A user waiting for a *decision* needs it synchronously. A
user waiting for *work to be done* needs to know it was accepted and to find out later. HTTP has
a status code for exactly the second case, and the specification's description of it is a good
guide to both its power and its limits.**

## What the specification says

RFC 9110 §15.3.3:

> *"The 202 (Accepted) status code indicates that the request has been accepted for processing,
> but the processing has not been completed. The request might or might not eventually be acted
> upon, as it might be disallowed when processing actually takes place. There is no facility in
> HTTP for re-sending a status code from an asynchronous operation."*

> *"The 202 response is intentionally noncommittal. Its purpose is to allow a server to accept a
> request for some other process (perhaps a batch-oriented process that is only run once per day)
> without requiring that the user agent's connection to the server persist until the process is
> completed. The representation sent with this response ought to describe the request's current
> status and point to (or embed) a status monitor that can provide the user with an estimate of
> when the request will be fulfilled."*

Three things follow directly from that text and they are all load-bearing:

1. **"might or might not eventually be acted upon"** — a `202` is not a promise of success. If
   your product requires a promise, this is the wrong status.
2. **"no facility in HTTP for re-sending a status code"** — the client cannot be pushed the
   outcome over the same request. Something else has to deliver it, which is work.
3. **"ought to ... point to (or embed) a status monitor"** — the specification tells you to
   include the mechanism for finding out. A bare `202` with an empty body is not what the
   specification describes.

## The three questions that decide the shape

**Q1 · Does the user need a *decision* or a *confirmation of receipt*?**

A decision — "is my card accepted?", "is this username available?" — must be synchronous. There
is no version of `202 Accepted` that helps someone who needs to know whether they can proceed.

A receipt — "did my report request get through?", "was my order placed?" — is what `202` is for.

**Q2 · Is the outcome nearly always success?**

If the work fails once in ten thousand, telling the user "accepted" and handling the rare failure
out of band is honest. If it fails one time in five, `202` is a way of hiding a bad experience:
the user proceeds believing they succeeded, and finds out later that they did not, at a point when
recovery is more expensive for them.

**Q3 · Can the user find out, without effort, when it completes?**

If the answer is "they can refresh the page and it will be there", you are fine. If it is "they
would have to check their email in the morning", you have moved a cost onto the user, and whether
that is acceptable is a product decision.

**Two yeses and one non-decision, and `202` is right. Any no, and reconsider.**

## The shape in Spring

```java
@PostMapping("/reports")
ResponseEntity<ReportStatus> requestReport(@RequestBody ReportRequest request) {
    ReportJob job = reports.accept(request);           // durable: one transaction, our own DB
    return ResponseEntity.accepted()                   // 202
            .location(URI.create("/reports/" + job.id()))
            .body(ReportStatus.pending(job.id(), job.acceptedAt()));
}

@GetMapping("/reports/{id}")
ResponseEntity<ReportStatus> status(@PathVariable String id) {
    ReportJob job = reports.find(id).orElseThrow(ReportNotFound::new);
    return switch (job.state()) {
        case PENDING, RUNNING -> ResponseEntity.ok(ReportStatus.of(job));
        case FAILED           -> ResponseEntity.ok(ReportStatus.failed(job));    // 200 about a failure
        case DONE             -> ResponseEntity.status(HttpStatus.SEE_OTHER)
                                     .location(job.resultUri())
                                     .build();                                    // 303 to the result
    };
}
```

Three deliberate choices:

- **The accept is durable and in one transaction with nothing else.** If `reports.accept` commits,
  the work will happen; if it does not, the user gets an error and can retry. That is the property
  the entire pattern rests on.
- **A failed job returns `200` describing a failure, not a `5xx`.** The status resource was
  fetched successfully; what it reports is that the job failed. Returning `500` here means the
  client cannot distinguish "the status endpoint is broken" from "the job failed", and retry logic
  will do the wrong thing.
- **`303 See Other` on completion** points at the result without conflating the status resource
  with the resource it describes.

## The `201` versus `202` question

Worth settling, because it recurs. RFC 9110 §15.3.2 says `201 (Created)` means *"the request has
been fulfilled and has resulted in one or more new resources being created"*.

- If your handler creates the resource in its own database and returns, that is a **`201`** with a
  `Location`, even if downstream consequences are asynchronous. The order *was* created; the
  warehouse notification is separate.
- If nothing exists yet — the request was queued and a resource may be created later — that is
  a **`202`** pointing at a status monitor.

The distinction matters to clients: a `201` `Location` is a resource they can `GET` and expect;
a `202` `Location` is a status monitor and may 404 the resource for a while.

## The self-contained-service framing

Richardson's version of this shape:

> *"A service self-contained is a service that respond to a synchronous request with a partial
> outcome and then asynchronously complete the operation."*

with the concrete example that

> *"the Order Service could respond to the HTTP POST /orders request with a 202 Accepted response
> and then initiate a Create Order Saga complete the operation"*

and the honest cost, which he states directly: **it improves availability while adding client
complexity.** That trade is the entire content of this chunk. Someone is doing more work — the
client — so that the server can stop depending on other services being up.

[30 · Self-contained services](06f-self-contained-services.md) develops that framing.

## When it is worse UX, and you should not do it

Say this out loud in a design review, because the pattern gets over-applied by people who have
just learned it:

- **When the user cannot act on "accepted".** If they must wait for the outcome anyway before
  doing anything else, you have replaced a spinner with a spinner plus a polling loop plus a page
  that says "pending", and made things worse.
- **When failure is common.** `202` for an operation that fails 20% of the time trains users not
  to trust confirmations.
- **When the outcome is a rejection the user could fix immediately.** "Your address is invalid" is
  far more useful in the response than in an email an hour later.
- **When the client is not yours.** A partner integrating over HTTP may have no mechanism for
  polling a status resource and no place to receive a callback. `202` is a contract change that
  costs *them* work, and it needs their agreement.

## Gotchas

**★ A `202` with no status monitor is not what the specification describes.** RFC 9110 says the
representation *"ought to describe the request's current status and point to (or embed) a status
monitor"*. A bare `202` with an empty body tells the client that something happened and gives it
no way to find out what. Half the pattern is the status resource.

**★ `202` promises nothing, and the specification says so.** *"The request might or might not
eventually be acted upon."* If your product promises the user it will happen, the promise comes
from your durable accept and your monitoring, not from the status code. Do not let the code do
argumentative work it is not doing.

**★ Returning `5xx` from a status endpoint for a failed job breaks client retry logic.** The
status endpoint succeeded; the job failed. Those are different facts and they need different
representations, or every client will retry the status fetch on a permanently failed job.

**★ The accept must be durable *before* you return `202`.** Accepting into an in-memory queue and
returning `202` means a pod restart loses work that a user was told was accepted. This is
[19 · Fire-and-forget](05b-fire-and-forget.md)'s rule applied at the HTTP boundary, and it is the
single most common way this pattern is implemented wrongly.

**★ Polling a status resource is load you have moved, not removed.** A thousand clients polling
every second is a thousand requests per second on an endpoint that exists to say "not yet". Set a
polling interval in the response, use conditional requests or long-polling where appropriate, and
consider a callback for clients that can accept one.

**★ Status resources need a retention policy.** Jobs accumulate forever otherwise, and a client
that polls a job from six months ago should get a defined answer rather than a `404` that it
interprets as "the job never existed". Decide the retention and document it in the API.

**★ `202` moves work to the client and someone has to agree to that.** Richardson names the cost:
improved availability, added client complexity. If the client is another team or another company,
that is a negotiation and not a unilateral improvement.

## Interview questions

**★ What does `202 Accepted` actually mean, and what does it not promise?**
It means the request has been accepted for processing and processing has not completed. RFC 9110
is explicit that it promises nothing about the outcome — *"The request might or might not
eventually be acted upon, as it might be disallowed when processing actually takes place"* — and
that HTTP has no way to send a later status code over the same request. The specification also
says the response *ought* to describe the current status and point to a status monitor, so a bare
`202` with no body is an incomplete implementation of the pattern.

**★ When is `202` the wrong answer for a user who is waiting?**
When they need a decision rather than a receipt — is my card accepted, is this name available —
because there is no asynchronous version of a decision they must have to proceed. When failure is
common, because the confirmation becomes untrustworthy. When the rejection is something they could
fix immediately, so telling them an hour later is strictly worse. And when the client is not yours
and has no way to poll or receive a callback, in which case it is a contract change that costs
someone else work.

**★ `201` or `202` — how do you choose?**
By whether a resource exists when you return. If your handler created it in your own database,
that is `201` with a `Location` the client can `GET`, regardless of what happens downstream
asynchronously. If nothing exists yet and may not, that is `202` with a `Location` pointing at a
status monitor. The distinction is visible to clients: a `201` `Location` is a resource, a `202`
`Location` is a status, and conflating them means clients get a `404` on something they were told
was created.

**★ What should a status endpoint return when the job failed?**
`200`, with a body describing the failure. The status resource was fetched successfully; the fact
it reports is that the job failed. Returning `5xx` conflates "the status service is broken" with
"the job failed", and any client with retry logic will keep retrying a permanently failed job.
The same principle applies throughout: the transport status describes the transport, and the body
describes the domain.

**★ What is a self-contained service, and what does it cost?**
Richardson's definition: a service that responds to a synchronous request with a partial outcome
and then asynchronously completes the operation — for example returning `202 Accepted` to
`POST /orders` and completing via a saga. It removes runtime coupling because the response no
longer waits on other services being available. Its cost is client complexity: the client must
handle a pending state, discover the outcome later, and represent "not yet" in its UI. The
availability improvement is real and somebody else pays for it, which is why it needs to be agreed
rather than assumed.

{/* FOOTER */}
