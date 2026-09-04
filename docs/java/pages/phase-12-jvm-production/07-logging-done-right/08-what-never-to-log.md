---
title: "Nobody logs a password on purpose — it arrives inside a request object's `toString()`, inside an exception message that quoted the input it rejected, inside a debug line somebody enabled for one afternoon three years ago, and the reason this keeps happening is that logging a whole object is the convenient thing to write"
sidebar_label: "08 · What never to log"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **OWASP Logging Cheat Sheet** and **OWASP Top 10 A09:2021 ·
> Security Logging and Monitoring Failures**
> ([owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)); **PCI DSS
> v4.0 Requirement 3.3.1**, which prohibits storage of sensitive authentication data after
> authorisation, and **3.3.2/3.4.1** on rendering PAN unreadable
> ([pcisecuritystandards.org](https://www.pcisecuritystandards.org/document_library/)); **GDPR
> Article 5(1)(c)** (data minimisation) and **Article 32** (security of processing)
> ([eur-lex.europa.eu](https://eur-lex.europa.eu/eli/reg/2016/679/oj)); and the **SLF4J** and
> **Logback** documentation for the mechanics quoted here.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A log is a copy of your data with none of your data's protections. It goes to a file with
different permissions, into a shipping pipeline, into a search index a hundred people can query,
into a backup with a retention period nobody chose deliberately, and into a third-party SaaS. Every
control the original data had — encryption at rest, access review, the right to erasure — has to
be rebuilt around the log or it is simply gone. That is the whole argument of this page, and it is
why "what never to log" is a design question rather than a review checklist.**

## The list

Absolutely never, under any level, in any environment:

- **Credentials.** Passwords, whether plaintext or hashed. A hash in a log is an offline cracking
  target with the account name conveniently adjacent.
- **Session identifiers and tokens.** A session id in a log is a session anyone with log access
  can assume. Bearer tokens, refresh tokens, API keys, `Authorization` headers.
- **Cardholder data.** PCI DSS forbids storing sensitive authentication data — the CVV, the full
  magnetic-stripe track, the PIN block — after authorisation *at all*, and a log file is storage.
  The PAN itself must be rendered unreadable wherever it is stored.
- **Government identifiers.** National insurance and social security numbers, passport numbers,
  tax identifiers.
- **Cryptographic material.** Private keys, symmetric keys, initialisation vectors used with a
  reused key, and the seed of anything.
- **Health and other special-category data**, which under GDPR carries a higher bar than ordinary
  personal data and is frequently logged inadvertently by systems that never intended to hold it.

Then a second list, which is where the actual arguments happen, because these are *sometimes*
legitimate and always require a decision:

- **Personal data in general** — names, email addresses, IP addresses, device identifiers. Not
  forbidden; subject to minimisation, retention and erasure obligations that a log pipeline
  usually does not implement.
- **Full request and response bodies.** The single most common source of accidental disclosure,
  because the decision to log them is made once, generically, and then applies to every endpoint
  ever added.
- **Business-sensitive values** — prices, balances, internal identifiers that leak volume or
  structure to anyone reading a log they were granted access to for an unrelated reason.

## How it actually gets there

Nobody types `log.info("password={}", password)`. The routes are indirect, and each one is worth
recognising on sight:

**1. `toString()` on a whole object.** The most common by a wide margin:

```java
log.debug("Authenticating {}", loginRequest);      // toString() includes the password field
```

Records make this worse rather than better: the compiler generates a `toString()` including
*every* component, so a `record LoginRequest(String username, String password)` prints the
password by default, with no code anywhere that looks wrong. Lombok's `@Data` and `@ToString` do
the same unless a field is explicitly excluded.

**2. Exception messages that quote their input.** A validation or parsing failure naturally wants
to say what it rejected:

```java
throw new IllegalArgumentException("Invalid token: " + token);
```

The exception then travels up through layers that log it, and the token is now in the log of
every service that touched the call. This is the highest-value pattern to recognise, because it
looks like good error reporting.

**3. Debug logging enabled temporarily.** Someone raises a package to `DEBUG` to chase an issue,
the framework's own debug output includes headers and bodies, and the level is never lowered. That
this is *reversible* is the problem: it never gets reverted because nothing fails.
[12 · Changing levels at runtime](12-changing-levels-at-runtime.md) is the mechanism, and its
gotcha is exactly this.

**4. Framework and library logging you did not write.** HTTP clients logging headers, an ORM
logging bound parameters, a serialisation library logging payloads on error. `DEBUG` on a
third-party package is a decision about *their* logging, and you have not read it.

**5. The generic request-logging filter.** Written once to log method, path and body, applied to
every endpoint including the login endpoint that did not exist yet.

**6. MDC that outlives its scope.** A value put into the MDC on a pooled thread and not removed is
attached to whatever that thread does next — [06b](06b-mdc-and-thread-pools.md). If the value was
personal data, it is now attached to another user's request.

## Why "we will grep it out later" fails

Every downstream removal strategy shares a defect: the data was already written. Between the write
and the redaction it sat on a disk with the application's permissions, was probably shipped
somewhere, and may well have been indexed. Redaction at the aggregator removes it from the search
UI and not from the shipper's buffer, the local file, or the backup taken in between.

There is also a scale problem. A regex that redacts a token pattern will miss a token in a
different format, will miss it inside a JSON body that got escaped, and will happily corrupt
unrelated lines that resemble the pattern. It is a mitigation for the case you already know about,
which is exactly the case you could have fixed at the source.

**The only reliable control is not producing the line.** Everything else is defence in depth, and
[08b · Masking and the audit trail](08b-masking-and-the-audit-trail.md) is about doing that layer
properly given that mistakes will still happen.

## What to log instead

The information you actually need is almost never the value:

| Instead of | Log |
|---|---|
| The token | Its identifier claim (`jti`), or a truncated hash prefix |
| The password | Nothing. The fact of a failed authentication attempt |
| The card number | The last four digits and the scheme, which is what PCI permits displaying |
| The email address | The internal user id, which is meaningless outside your system |
| The whole request body | The endpoint, the outcome, the size, and a correlation id |
| The exception's offending input | Its length, its type, and which validation rule rejected it |

The correlation id is what makes this work: it lets you reconstruct a request's path without
carrying its contents — [07 · Correlation ids](07-correlation-ids.md). If you genuinely need the
payload to debug, the answer is a system where an authorised person can retrieve it *from the
source* with an access record, not a log line everybody can read.

## Structured logging changes the shape of the risk

JSON logging ([05 · Structured JSON](05-structured-json.md)) helps and hurts. It helps because a
field has a name, so a redaction policy can target `password` rather than guessing at a substring,
and because a schema is reviewable — [05c](05c-schema-and-field-naming.md).

It hurts because serialising an object to JSON is *even more* automatic than calling `toString()`,
so an object graph containing a sensitive field is now emitted in full, with the field labelled
for whoever finds it. The mitigation is the same annotation-driven exclusion used for API
responses, applied deliberately to the logging path as well — and remembering that they are two
different serialisers with two different configurations, which is the mistake people make once.

## Gotchas

**★ A record's generated `toString()` includes every component, including the password.**
`record LoginRequest(String username, String password)` prints both. There is no warning and
nothing at the call site to notice. Overriding `toString()` on records that carry secrets is a
routine defensive measure, and it is the single highest-value habit on this page.

**★ Lombok's `@Data` and `@ToString` do the same, and are easy to miss in review.**
The annotation is at the top of the class and the sensitive field is fifty lines down.
`@ToString.Exclude` on the field is the fix; a project-wide check for annotated classes containing
credential-shaped field names is the systematic version.

**★ The exception message that quotes its input is the most common leak, and it looks like good
practice.**
*"Invalid token: eyJ…"* is a genuinely helpful error and a disclosure. The rule is that an
exception message may describe the input — its length, its shape, which rule it violated — and may
not contain it.

**★ A hashed password in a log is still a finding.**
It is an offline cracking target delivered with its username. "It is only the hash" is not a
mitigation, and no auditor accepts it.

**★ Redaction at the aggregator does not undo the write.**
The line existed on local disk, in the shipper's buffer and possibly in a backup before the
aggregator saw it. Downstream masking is defence in depth, never the control.

**★ Raising a third-party package to DEBUG is a decision about logging you have not read.**
HTTP clients log headers, ORMs log bound parameters, serialisation libraries log payloads on
failure. You are enabling their judgement about what is safe, applied to your data.

**★ Temporary DEBUG is permanent because nothing fails when you forget.**
There is no error, no alert and no test. The only reliable countermeasure is a mechanism that
reverts it — a level change with an expiry, or a periodic audit of effective levels rather than
configured ones.

**★ An IP address is personal data under GDPR.**
It is routinely logged by every access log in existence, which is usually defensible under
legitimate interest — but it is a decision with a retention consequence, not a neutral default,
and "it is just an IP" is not the analysis.

**★ JSON logging makes accidental disclosure both easier and more labelled.**
Serialising an object emits every field with its name attached. The upside is that a
name-targeted redaction policy becomes possible; the downside is that the leak is now
machine-readable for whoever finds it.

**★ The logging serialiser and the API serialiser are two different configurations.**
`@JsonIgnore` on a DTO protects the HTTP response and does nothing for a log line produced by a
different `ObjectMapper`. Assuming one covers the other is a mistake most teams make exactly once.

**★ MDC contents are attached to every subsequent line on that thread.**
A personal-data value left in the MDC on a pooled thread will appear on another user's request.
That makes MDC hygiene a data-protection control and not only a correctness one —
[06b](06b-mdc-and-thread-pools.md).

**★ Logs are frequently the least-protected copy of the most sensitive data.**
The database has encryption at rest, row-level access control and an audit trail. The log has a
file, a shipper, a search index with broad read access, and a retention period nobody chose. The
asymmetry is the reason this page is Master tier.

**★ The right to erasure applies to logs, and almost no log pipeline can honour it.**
An erasure request means removing that person's data from everywhere it is stored. If personal
data is scattered through immutable append-only logs across a dozen indices and their backups, the
honest answer is that you cannot comply — which is an argument for not putting it there rather
than an argument to be had later.

## Interview questions

**★ How does a password end up in a log when nobody wrote a line that logs one?**
Almost always through an object's string representation. Someone writes
`log.debug("Authenticating {}", request)` — which is a completely natural thing to write — and
the request object's
`toString()` includes every field. Records make this sharper because the compiler generates a
`toString()` containing every component, so a `record LoginRequest(String username, String
password)` discloses by default with nothing at any call site that looks wrong; Lombok's `@Data`
does the same. The second common route is an exception message that quotes its input — *"Invalid
token: …"* is helpful error reporting and a disclosure at the same time, and the exception then
propagates to every layer that logs it. The third is a level change: someone sets a package to
DEBUG to investigate something, framework code logs headers or bound parameters, and nothing ever
fails to prompt reverting it. The common factor is that logging a whole object is more convenient
than logging the two fields you need, so the safe thing is also the more effortful one.

**★ Why is "we mask it in the log aggregator" not a sufficient control?**
Because the sensitive value was already written. Before the aggregator ever applies a pattern, the
line existed as plaintext in a file on the application's disk, in the log shipper's buffer, and
potentially in a backup or a snapshot taken in the interval. Masking at the aggregator removes it
from the search interface, which is where people look, and leaves it everywhere else — which is
precisely the set of places a breach investigation cares about. Beyond that, pattern-based
redaction is a mitigation for the formats you anticipated: a token in an unexpected encoding, a
value nested inside an escaped JSON body, or a field name you did not think of will pass through,
and an over-broad pattern will corrupt legitimate lines. It is worth doing as defence in depth,
because mistakes will happen and reducing their blast radius is real value. It is not the control,
and treating it as one converts a design requirement into an operational hope.

**★ You need to debug a failing request that involves personal data. What do you log?**
A correlation id and the shape of the problem, not the data. The endpoint, the outcome, which
validation rule failed, the size and type of the input, timing, and the ids of the internal
entities involved — internal identifiers being meaningless outside the system and therefore much
cheaper to hold. That is usually enough to reproduce the path. When it genuinely is not — when the
bug depends on the specific content — the answer is not a log line but a mechanism with access
control and an audit record: an authorised person retrieving the payload from its source, or a
short-lived capture with an explicit approval, an expiry and a record of who looked. The
distinction that matters is that a log line is readable by everyone with log access forever,
whereas a deliberate retrieval is readable by one person once and leaves a trace. Framing it that
way also tends to end the argument, because nobody defends "everybody, forever" out loud.

**★ What is the problem with logging a hashed password rather than a plaintext one?**
It is still a credential disclosure, and the hash is delivered together with the username that
makes it useful. An attacker with the log has an offline cracking target with no rate limiting, no
lockout and no detection — and if the hashing is fast or the password is common, offline is exactly
where they want to be. The reasoning that "it is only the hash" imports an assumption about the
hash function's cost that may not survive a hardware generation, and it also ignores that the same
hash may appear for the same password across accounts, which leaks structure. There is no
diagnostic question that a logged hash answers, either — you can log that authentication failed,
for which user, from where, and how many times, and that is the full set of things anyone actually
needs. So it is a pure cost, which is why every standard treats it as a finding rather than as a
mitigated risk.

**★ Where does the tension between GDPR and logging actually bite?**
In three places. Minimisation, because the default behaviour of every logging framework is to
record whatever it was handed, and "we might need it" is exactly the reasoning Article 5(1)(c)
exists to constrain. Retention, because log retention is normally set by storage cost or by a
compliance rule about *availability* of logs, not by a decision about how long personal data may
be held — and those two numbers have no reason to match. And erasure, which is the hardest:
honouring a deletion request means removing that person's data from everywhere it is stored, and
personal data scattered through append-only logs across several indices, plus their backups, is
not practically removable. The honest engineering conclusion is that the compliance answer and the
architecture answer are the same one — keep personal data out of logs, use internal identifiers
that are meaningless outside the system, and let the erasure story be about the database, where it
is actually achievable.

**★ Structured JSON logging: does it make disclosure better or worse?**
Both, in ways worth separating. Worse, because serialising an object to JSON is even more
automatic than calling `toString()`: an object graph containing a sensitive field is emitted in
full, with the field labelled, so the leak arrives machine-readable and easy to find. Better,
because a named field is something a policy can target precisely — a redaction rule for a field
called `password` is exact where a substring pattern over unstructured text is a guess — and
because a documented log schema is a reviewable artefact in a way that thousands of ad-hoc format
strings are not. The trap in between is assuming the two serialisers are one: `@JsonIgnore` on a
DTO configures the `ObjectMapper` producing HTTP responses, and the logging path may use a
different mapper with a different configuration entirely. So the field you carefully hid from the
API can still be in the log, which is the specific mistake this design invites.

{/* FOOTER */}
