---
title: "Async Testing: Promises, async/await, expect.assertions & Microtasks"
sidebar_label: "Async Testing"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against Jest 29.7 / 30.x documentation — [Testing Asynchronous Code](https://jestjs.io/docs/asynchronous).

Jest requires explicit asynchronous signals to await microtasks and macrotasks before completing a test, using `async`/`await`, Promise returns, `.resolves`/`.rejects` matchers, and `expect.assertions()` verification counts.

---

## 1. Under-The-Hood Mechanics

When a test function finishes its synchronous execution block, Jest checks whether it returned a Promise:

```
Case A: Returned Promise / `async () => {}`
  Test function invoked ──► Returns Promise
                              │
                              ▼
                          Jest awaits Promise resolution
                              ├── Resolved ──► Test PASSES (if no assertions failed)
                              └── Rejected ──► Test FAILS with error trace

Case B: Unreturned Promise / Missing await
  Test function invoked ──► Returns undefined (synchronously)
                              │
                              ▼
                          Jest marks test PASSED immediately
                          (In-flight Promise executes afterward; errors become Unhandled Rejections)

Case C: Legacy `done` Callback (`(done) => {}`)
  Jest checks `fn.length > 0`. Awaits `done()` invocation or fails on timeout (default 5000ms).
```

### Matcher-Level Promise Handling
- `await expect(promise).resolves.toEqual(...)`: Unwraps the fulfilled value from the Promise before running the matcher.
- `await expect(promise).rejects.toThrow(...)`: Catches rejection errors and asserts on the error instance or message.
- `expect.assertions(N)`: Enforces that exactly `N` assertions run. Essential when testing error callbacks to prevent false passes when code fails to throw.

---

## 2. Real-World Engineering Scenario

**Scenario**: Verifying token refresh failure handling in an HTTP interceptor without creating silent false-positive passes.

An authentication middleware refreshes an expired JWT. If the refresh endpoint returns 401, the client must reject with an `AuthSessionExpiredError`. If the test uses a `try/catch` block without `expect.assertions(1)`, and the function unexpectedly *succeeds* without throwing, execution skips the `catch` block entirely and passes silently. `expect.assertions(1)` forces the test to fail because zero assertions executed.

---

## 3. Production-Grade Code Example

```typescript
// authService.test.ts
import { refreshToken, fetchUserProfile, AuthSessionExpiredError } from './authService';

describe('Asynchronous Authentication Suite', () => {
  test('resolves user profile using async/await', async () => {
    const profile = await fetchUserProfile('usr_123');
    expect(profile).toEqual({
      id: 'usr_123',
      name: 'Sarah Connor',
      role: 'ADMIN',
    });
  });

  test('resolves profile using .resolves matcher unwrap', async () => {
    await expect(fetchUserProfile('usr_123')).resolves.toHaveProperty('role', 'ADMIN');
  });

  test('rejects with typed error on session expiration using .rejects', async () => {
    await expect(refreshToken('expired_token')).rejects.toThrow(AuthSessionExpiredError);
  });

  test('asserts error payload using try/catch with expect.assertions', async () => {
    // Guards against false passes: MUST run exactly 2 assertions
    expect.assertions(2);

    try {
      await refreshToken('malformed_token');
    } catch (error: any) {
      expect(error).toBeInstanceOf(AuthSessionExpiredError);
      expect(error.code).toBe('AUTH_INVALID_TOKEN');
    }
  });

  test('handles legacy event emitter with done callback', (done) => {
    const eventStream = createMockEventStream();

    eventStream.on('data', (chunk) => {
      try {
        expect(chunk).toBe('payload_ready');
        done();
      } catch (err) {
        done(err); // Passes assertion failure directly to Jest
      }
    });

    eventStream.emit('data', 'payload_ready');
  });
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: Test passes on CI, but console logs `UnhandledPromiseRejection` after test completes
- **Cause**: An asynchronous function was called inside `test(...)` without `await` or `return`. The test marked itself complete while the promise was still executing on the microtask queue.
- **Fix**: Always mark test callbacks as `async () => { await ... }` or `return promise`.

### Symptom: `try/catch` error test passes even when the underlying bug causes the code to never throw
- **Cause**: The test calls an async function inside `try`, but when the function resolves unexpectedly, the `catch` block never executes, and no assertion runs.
- **Fix**: Place `expect.assertions(1)` or `expect.hasAssertions()` at the start of the test.

### Symptom: Test times out after 5000ms when testing with `(done) => {}`
- **Cause**: An assertion inside the callback threw an error, which prevented `done()` from being reached.
- **Fix**: Wrap the callback body in `try { ... done(); } catch (e) { done(e); }`, or migrate the API to Promise-based `async`/`await`.

---

## 5. Interview Questions & Deep Dives

### ★ 1. Why does `test('name', () => { fetchUser().then(res => expect(res).toBeDefined()); })` cause false passes?
**Answer**: Because the test callback does not return the Promise returned by `.then()`, Jest treats the test function as synchronous. The test exits immediately with code 0 (Pass). If the promise later rejects or the assertion fails, it happens after Jest has recorded the test result, resulting in an unhandled rejection warning rather than a reported test failure.

### ★ 2. What is the role of `expect.hasAssertions()` and `expect.assertions(N)`?
**Answer**: They verify that assertions actually executed during the test lifecycle. This is critical in conditional logic, catch blocks, and event callbacks. If an expected error path or event never fires, `expect.assertions(N)` ensures the test fails rather than exiting with zero executed assertions.

### 3. What is the execution difference between macrotasks (`setTimeout`) and microtasks (`Promise.resolve`) in Jest?
**Answer**: When an `async` test awaits a Promise, Node processes microtasks immediately before returning control to the runner. In contrast, macrotasks (`setTimeout`, `setInterval`) enter the timers queue. Jest's worker will not wait for macrotasks unless they are explicitly awaited, wrapped in a Promise, or fast-forwarded via fake timers (`jest.advanceTimersByTime`).

### 4. What happens if you mix `async () => {}` syntax with the `done` callback argument?
**Answer**: Supplying `done` tells Jest to wait for `done()` to be called, while `async` tells Jest to wait for the returned Promise to resolve. If `done()` is called while the promise is still resolving, or vice versa, Jest throws a `Jest: Done and Promise referred to in the same test` error.

---

## Where this connects

- **Previous**: [03 · Mocking](../03-mocking/01-jest-mock-functions.md) — Asynchronous mock function resolution (`mockResolvedValue`).
- **Next**: [05 · Snapshot Testing](../05-snapshot-testing/01-snapshot-mechanics.md) — Snapshot testing mechanics and serializers.
- **RTL Async**: [10 · Async Utilities](../10-async-utilities/01-waiting-for-updates.md) — Waiting for DOM mutations with `waitFor` and `findBy`.
