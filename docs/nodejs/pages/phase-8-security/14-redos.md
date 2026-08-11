---
title: "ReDoS"
sidebar_label: "14 · ReDoS"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — every timing below was measured on this
> machine, single run.

**One regex, one request, and the whole process stops answering.** Node's single
threaded execution model turns a slow regex into an outage rather than a slow endpoint:
the match runs on the event loop, and nothing else — not other requests, not timers, not
health checks — runs until it finishes.

## The measurement that makes the case

`/^(a+)+$/` against `'a'.repeat(n) + '!'`:

```console
20 chars ->   89 ms
24 chars ->  229 ms
26 chars ->  898 ms
28 chars -> 3653 ms
```

Roughly ×2 per additional character. Twenty-eight bytes of input — well under any body
size limit — buys 3.6 seconds of CPU. Forty characters is hours.

And it is genuinely the *whole* process. A 10 ms interval running alongside:

```console
regex took 3774 ms; a 10 ms interval fired 0 times during it
(expected ~377 if the loop were free)
```

**Zero.** Not delayed — never scheduled. Your liveness probe fails, your queue consumer
stops, every in-flight request waits. That is the difference between ReDoS and an
ordinary slow query.

## Why it backtracks

The engine is a backtracking matcher, not a DFA. `(a+)+` gives it two nested ways to
consume the same run of `a`s: the inner `a+` can take *k* characters and the outer `+`
can repeat. For a string of *n* `a`s there are exponentially many partitions, and the
trailing `!` guarantees every one of them is tried before the match fails.

**The failing case is the expensive one.** A successful match short-circuits — which is
why this never shows up in your tests, where inputs are valid.

The dangerous shapes, all measured, all on inputs of 25–27 characters:

```console
/^(\w+\s?)*$/      25 chars ->  1893 ms
/^(a|a)+$/         27 chars -> 11084 ms
/(\d+)*$/          27 chars -> 10185 ms
```

Learn the pattern rather than the examples:

- **nested quantifiers** — `(a+)+`, `(a*)*`, `(\w+\s?)*`
- **alternation with overlapping branches under a quantifier** — `(a|a)+`, `(\d|\w)+`
- **a quantified group followed by something that can fail** — `(\d+)*$`

The common thread is *ambiguity*: more than one way for the pattern to match the same
substring. Where the engine has a choice, a failing input makes it try all of them.

## Fixes, in the order worth trying

### 1. Rewrite the regex so it cannot be ambiguous

```js
const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
```

```console
linear regex x1000 on an 81-char non-match -> 0.670 ms total
```

0.00067 ms per call. Negated character classes (`[^@\s]`) cannot overlap with what
follows them, so there is nothing to backtrack into. Most "validate a format" regexes can
be written this way.

### 2. Cap the input length before matching

The exponent is the input length, so a cap is a hard ceiling on the damage:

```console
worst case at 16 chars ->   1 ms
worst case at 20 chars ->   8 ms
worst case at 24 chars -> 120 ms
```

```js
if (value.length > 254) return fail('too long');   // then match
```

Do the length check **first**, and validate the cap against the format rather than
truncating — truncation can turn a hostile non-match into an accidental match. This is
the cheapest mitigation and it composes with everything else.

### 3. Don't use a regex

Splitting on a delimiter, `URL` parsing, `Date` parsing and `startsWith`/`endsWith` all
run in linear time and are usually clearer than the pattern they replace. An email
"validation" regex is mostly theatre anyway — the deliverable check is sending a
confirmation link.

### 4. Where the pattern must be user-supplied, isolate it

Search features that accept a user regex cannot be fixed by rewriting the pattern. Two
options:

- **A linear-time engine.** `re2` (a native binding to RE2) has no backtracking, so it
  cannot blow up. The cost is a compiled dependency and no backreferences or lookaround.
- **Run it somewhere killable.** A `worker_threads` worker with a watchdog:

```js
import { Worker } from 'node:worker_threads';

export function matchWithTimeout(pattern, input, ms = 100) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      `const {parentPort, workerData} = require('node:worker_threads');
       parentPort.postMessage(new RegExp(workerData.pattern).test(workerData.input));`,
      { eval: true, workerData: { pattern, input } }
    );
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('regex timeout')); }, ms);
    worker.on('message', (r) => { clearTimeout(timer); worker.terminate(); resolve(r); });
    worker.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}
```

A worker is a separate thread with its own event loop, so `terminate()` actually stops
it. **`AbortSignal` and `setTimeout` cannot help you here** — a synchronous regex never
yields, so the timer callback cannot run until the match is already over.

**Node 24 has no regex timeout.** There is no engine-level guard, no flag, no option on
`RegExp`. Mitigation is entirely in your code.

## Finding them before an attacker does

**Grep your own patterns** for nested quantifiers: `\)\+`, `\)\*`, `\+\)` next to each
other. Then check the ones that touch user input first.

**Check your dependencies.** ReDoS advisories are one of the most common categories in
`npm audit`, and the regex is usually in a parser or a validation helper you never call
directly — a URL router, a user-agent parser, a markdown renderer.

**Test the failure case.** Add the hostile input to the test suite with a time bound:

```js
test('email pattern is linear', () => {
  const t = performance.now();
  email.test('a'.repeat(200) + '!');
  assert.ok(performance.now() - t < 5);
});
```

**Watch event-loop lag in production** — the symptom of ReDoS is a lag spike on one
process with no corresponding traffic spike. Phase 10 covers the measurement.

## Gotchas

**Symptom:** One endpoint occasionally takes seconds, and unrelated endpoints time out with it
**Cause:** A backtracking regex blocks the event loop for the whole process — verified, a 10 ms interval fired zero times in 3.7 s.
**Fix:** Rewrite the pattern to be unambiguous; cap input length.

**Symptom:** The regex is fast in every test
**Cause:** Tests use valid inputs; catastrophic backtracking needs a *failing* match.
**Fix:** Test the hostile non-match with a time assertion.

**Symptom:** `setTimeout`-based protection never fires
**Cause:** The regex is synchronous; the timer cannot run until it returns.
**Fix:** A `worker_threads` worker with `terminate()`, or a linear engine.

**Symptom:** `npm audit` reports ReDoS in a package you don't call
**Cause:** A transitive parser or validator on the request path.
**Fix:** Upgrade; if unavailable, cap input length before it reaches that layer.

**Symptom:** Truncating input to the cap made an invalid value validate
**Cause:** Truncation removed the character that made it fail.
**Fix:** Reject over-long input, don't truncate it.

**Symptom:** A user-supplied search pattern hangs the service
**Cause:** No pattern can be pre-vetted; the engine backtracks.
**Fix:** `re2`, or run the match in a worker with a hard timeout.

## Interview questions

**★ Why is a slow regex a security problem rather than a performance one?**
Because it blocks the event loop. Node runs the match synchronously on the only thread
handling requests, so a single 28-character input stalls the entire process — verified,
3.6 s of CPU during which a 10 ms interval fired zero times. One request denies service
to all of them.

**★ What makes a regex vulnerable?**
Ambiguity: more than one way to match the same substring. Nested quantifiers `(a+)+`,
overlapping alternation `(a|a)+`, or a quantified group followed by something that can
fail. On a *failing* input the engine tries every combination, which is exponential in
the input length.

**★ Why don't your tests catch it?**
A successful match short-circuits. The blow-up needs an input that *almost* matches and
then fails at the end — `'a'.repeat(28) + '!'`. Nobody writes that test unless they know
the bug class.

**★ Can you put a timeout on a regex in Node?**
Not directly — Node 24 has no regex timeout, and `setTimeout` or `AbortSignal` cannot
interrupt synchronous code. The options are a `worker_threads` worker you can
`terminate()`, or a non-backtracking engine like `re2`.

**What is the cheapest mitigation?**
A length cap, checked before the match. Input length is the exponent, so bounding it
bounds the cost: the same vulnerable pattern costs 1 ms at 16 characters, 8 ms at 20, and
120 ms at 24 — all verified. Reject over-long input rather than truncating it.

**How would you find these in an existing codebase?**
Grep for nested quantifiers in your own patterns and triage the ones reachable from user
input; run `npm audit` for the dependency side; and alert on event-loop lag, which is
what the attack looks like in production.

---

← Prev: [Prototype pollution](./13-prototype-pollution.md) · Next → [Deserialization, open redirects, mass assignment](./15-deserialization-redirects-mass-assignment.md)
