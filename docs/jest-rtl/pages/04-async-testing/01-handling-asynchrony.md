---
title: "Async Testing: `async`/`await`, `.resolves`/`.rejects` & the Legacy `done` Callback"
sidebar_label: "Async Testing"
sidebar_position: 1
---

# 🧪 Async Testing: `async`/`await`, `.resolves`/`.rejects` & the Legacy `done` Callback

## 1. Under-The-Hood Mechanics

Jest needs an explicit signal that a test involves asynchronous work — without one, a test function that returns before an async operation actually completes is reported as **passing**, regardless of what happens afterward, since Jest has no way to know to wait for it.

```
test('description', async () => {
  await somethingAsync();   // Jest AWAITS the returned promise before considering the test complete
});

test('description', () => {
  return promise;              // returning a promise ALSO signals "wait for this" — works without async/await too
});

test('description', () => {
  somethingAsync();              // ❌ NEITHER awaited NOR returned — Jest has NO IDEA this is async,
});                                  // reports PASS immediately, regardless of what the promise eventually does
```

### `.resolves`/`.rejects`: Matcher-Level Promise Unwrapping
```javascript
await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alex' }); // unwraps the FULFILLED value, then matches
await expect(fetchUser(-1)).rejects.toThrow('Invalid user id');           // unwraps the REJECTION, then matches
```
These read cleanly for the common "assert this promise resolves/rejects with X" pattern — but still require their own `await`, since `.resolves`/`.rejects` themselves return a promise-wrapped assertion, not a synchronous one.

### The Legacy `done` Callback: Mostly Superseded
```javascript
test('legacy async pattern', (done) => {
  fetchData((result) => {
    expect(result).toBe('data');
    done(); // MUST be called manually, or the test times out
  });
});
```
Used for callback-based (pre-Promise) async APIs — largely superseded by `async`/`await` for genuinely Promise-based code, but still relevant for legacy callback-style APIs that have no Promise equivalent to `await` at all.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Test Suite Reporting 100% Passing While a Real Regression Silently Broke Data Fetching.
A test asserting a data-fetching function's behavior forgot to `await` (or `return`) the promise — the test function returned synchronously before the actual assertion inside a `.then()` callback ever ran, so Jest marked the test "passed" immediately, regardless of what the assertion inside the unawaited promise chain actually found. A genuine regression (the function had started throwing) went completely undetected by CI for weeks, since the test was structurally incapable of ever failing — it wasn't asserting anything Jest was actually waiting to observe.

---

## 3. Production-Grade Code Example

```javascript
// The async testing bug from the scenario, and its fix
// ❌ BROKEN: the test function returns BEFORE the assertion inside .then() ever runs —
// Jest considers the test complete (and passing) the instant the synchronous body finishes
test('fetchUser resolves with user data', () => {
  fetchUser(1).then((user) => {
    expect(user.name).toBe('Alex'); // this NEVER actually gets checked before the test is marked "passed"
  });
});

// ✅ FIXED: async/await ensures Jest actually waits for the assertion to run
test('fetchUser resolves with user data', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Alex');
});
```

```javascript
// .resolves/.rejects for concise promise-outcome assertions
test('fetchUser resolves with correct data', async () => {
  await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alex' });
});

test('fetchUser rejects for an invalid id', async () => {
  await expect(fetchUser(-1)).rejects.toThrow('Invalid user id');
});
```

```javascript
// Legacy done callback — for a genuinely callback-based (non-Promise) API
test('legacy callback-based API', (done) => {
  legacyFetchWithCallback((err, result) => {
    try {
      expect(err).toBeNull();
      expect(result).toEqual({ status: 'ok' });
      done(); // signals completion — REQUIRED, or Jest times out waiting
    } catch (assertionError) {
      done(assertionError); // pass the error to done() so Jest reports the ACTUAL assertion failure, not a timeout
    }
  });
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting to `await`/`return` a Promise, Producing a Test That Can Never Fail
```javascript
// ❌ CRITICAL BUG: exactly the scenario above — a test with NO await/return around async
// work provides ZERO actual verification, despite looking like a real test in the test file
test('validates input', () => {
  validateAsync(input).then((result) => { expect(result.valid).toBe(true); }); // silently never checked
});

// ✅ CORRECT: always await or return the promise chain containing assertions
test('validates input', async () => {
  const result = await validateAsync(input);
  expect(result.valid).toBe(true);
});
```

### ⚠️ Pitfall 2: Forgetting `done(error)` in a Try/Catch, Producing a Confusing Timeout Instead of a Clear Failure
```javascript
// ❌ CONFUSING: if the assertion inside the callback throws, and it's NOT caught and passed
// to done(), Jest doesn't see the actual assertion error — it just times out after the default
// timeout period, with an unhelpful "Exceeded timeout" message instead of the real failure reason
test('legacy pattern without proper error handling', (done) => {
  legacyFetch((result) => {
    expect(result).toBe('unexpected'); // if this throws, done() never gets called AT ALL
    done();
  });
});

// ✅ CORRECT: wrap in try/catch, passing any caught error to done() so the REAL failure surfaces
test('legacy pattern with proper error handling', (done) => {
  legacyFetch((result) => {
    try {
      expect(result).toBe('expected');
      done();
    } catch (err) {
      done(err); // Jest reports the ACTUAL assertion failure, not a generic timeout
    }
  });
});
```

### ⚠️ Pitfall 3: Mixing `done` and `async` in the Same Test Function
```javascript
// ❌ WRONG: an async function that ALSO takes a `done` parameter confuses Jest's completion
// detection — it doesn't know whether to wait for the returned promise or for done() to be called
test('confusing mixed pattern', async (done) => { // ❌ don't do this
  const result = await fetchData();
  expect(result).toBe('data');
  done(); // redundant AND potentially causes unexpected behavior
});

// ✅ CORRECT: pick ONE pattern — async/await for Promise-based code, done for genuinely
// callback-only APIs — never both in the same test function
```
