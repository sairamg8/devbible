---
title: "03.1 · debounce"
sidebar_label: "01 · debounce"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`clearTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout), [`Function.prototype.apply()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply), [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise). Documentation-validated; **no timings**.

**Debounce waits for quiet.** Calls reset a timer; the function runs only once the calls stop for
`wait` milliseconds. That is the whole definition, and everything difficult about implementing it
is in the four features an interviewer adds afterwards.

## The five-line version

```js
function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
```

🔴 **`function`, not an arrow, so `this` can be forwarded** — and `fn.apply(this, args)` inside an
*arrow* callback, so that arrow inherits the outer `this` we just captured. Getting either wrong
breaks `obj.method` usage, and it is the most common bug in the five-line version.

🔴 **`clearTimeout` before setting the new one** — that is what makes it debounce rather than
throttle. Omitting it queues one call per invocation, which is the opposite of the intent.

**Where it belongs:** a search box that should query once the user stops typing, a resize handler,
a form autosave, validation on input.

## Adding the features

```js
function debounce(fn, wait, { leading = false, trailing = true } = {}) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let result;

  function invoke() {
    timer = null;
    if (trailing && lastArgs) {
      result = fn.apply(lastThis, lastArgs);
      lastArgs = lastThis = null;                 // 🔴 release — see below
    }
  }

  function debounced(...args) {
    const isFirstCall = timer === null;
    lastArgs = args;
    lastThis = this;

    if (leading && isFirstCall) {
      result = fn.apply(this, args);
      lastArgs = lastThis = null;                 // consumed by the leading call
    }

    clearTimeout(timer);
    timer = setTimeout(invoke, wait);
    return result;                                // ⚠️ the PREVIOUS result — see below
  }

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
    lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    if (timer) { clearTimeout(timer); invoke(); }
    return result;
  };

  debounced.pending = () => timer !== null;

  return debounced;
}
```

**`leading` and `trailing`** — fire on the first call of a burst, on the last, or both. `leading:
true, trailing: false` gives "act immediately, then ignore until quiet", which is the right
behaviour for a submit button. The default (`trailing` only) is right for a search box.

⚠️ **`leading: true, trailing: true` fires twice for a burst of two or more** and once for a
single call — which is usually not what people expect. Real libraries handle it by tracking whether
more than one call occurred; saying that the combination is subtle is better than pretending it is
obvious.

**`cancel`** — required for cleanup. A pending timer holds `lastThis` and `lastArgs`, so a
debounced handler on an unmounted component keeps that component's data alive
([Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md)). 🔴 **Every debounced
handler attached to a component or a listener needs a `cancel` in its teardown** — this is the
practical reason `cancel` exists, not test convenience.

**`flush`** — run the pending call now. Useful on form submit: flush the debounced validation
before reading the result.

## The return value problem

🔴 **A debounced function cannot return the function's result**, because it has not run yet. The
version above returns the *previous* result, which is what Lodash does and is honest but rarely
useful.

**The modern answer is a promise:**

```js
function debounceAsync(fn, wait) {
  let timer, resolveList = [];

  return function (...args) {
    clearTimeout(timer);
    return new Promise((resolve, reject) => {
      resolveList.push({ resolve, reject });
      timer = setTimeout(async () => {
        const pending = resolveList;
        resolveList = [];
        try {
          const value = await fn.apply(this, args);
          pending.forEach((p) => p.resolve(value));      // 🔴 every caller resolves
        } catch (err) {
          pending.forEach((p) => p.reject(err));
        }
      }, wait);
    });
  };
}
```

⚠️ **Every suppressed call still gets a promise, and they all resolve with the *one* result that
eventually ran.** The alternative — rejecting the superseded calls — produces unhandled rejections
unless every caller catches, so resolving them all is the safer default. **Say which semantics you
chose**; there is no universally right answer, and knowing that is the point.

## The two traps

🔴 **Creating the debounced function inside a render or a loop debounces nothing.**

```js
// ❌ a new debounced function per render — each has its own timer, so none ever cancels another
function Search() {
  const onChange = debounce((e) => search(e.target.value), 300);
  return <input onChange={onChange} />;
}
```

The closure holding `timer` is recreated every time, so every keystroke gets a fresh timer that
fires. **The debounce must be created once** — in a `useMemo`/`useRef`, at module scope, or in a
constructor.

⚠️ **React pools nothing now, but the event object is still the browser's**, and a debounced
handler that reads `e.target.value` after the delay may read a changed input. **Capture the value
at call time**, not inside the delayed callback:

```js
const onChange = useMemo(() => debounce((value) => search(value), 300), []);
<input onChange={(e) => onChange(e.target.value)} />   // ✅ value captured now
```

## Gotchas

**Symptom:** `this` is `undefined` inside the debounced function
**Cause:** The wrapper was an arrow, or `fn(...)` was called instead of `fn.apply(this, args)`.
**Fix:** A regular `function` wrapper, and `apply` with the captured `this`.

**Symptom:** Every call fires after the delay
**Cause:** No `clearTimeout` before setting the new timer — that is a delayed call, not a debounce.
**Fix:** Clear first.

**Symptom:** Debouncing has no effect in a component
**Cause:** The debounced function is recreated on every render, so each call has its own timer.
**Fix:** Create it once — `useMemo`, `useRef`, module scope or a constructor.

**Symptom:** A component is not garbage-collected
**Cause:** A pending timer holding `lastThis`/`lastArgs`.
**Fix:** Call `cancel` in teardown.

**Symptom:** The delayed callback reads the wrong input value
**Cause:** It read from the event object after the delay.
**Fix:** Capture the value at call time.

**Symptom:** `leading: true, trailing: true` fires twice for two rapid calls
**Cause:** Both edges fire.
**Fix:** Expected — track whether more than one call occurred if that is not wanted.

**Symptom:** The debounced function returns `undefined`
**Cause:** The wrapped function has not run yet.
**Fix:** Return a promise, and decide whether superseded callers resolve or reject.

**Symptom:** Unhandled promise rejections from a debounced function
**Cause:** Superseded calls were rejected and not every caller catches.
**Fix:** Resolve them all with the eventual result, or document the rejection.

## Interview questions

**★ Implement `debounce`.**
Capture the timer in a closure; on each call `clearTimeout` then `setTimeout(() => fn.apply(this,
args), wait)`. The wrapper must be a **regular function** so `this` can be captured, and the
callback an **arrow** so it inherits that captured `this`.

**★ What is the difference between debounce and throttle in one sentence?**
Debounce waits for **quiet** — it runs once the calls stop. Throttle enforces a **rate** — it runs
at most once per interval while calls continue.

**★ Why does debouncing inside a component often do nothing?**
The debounced function is recreated on every render, so each call closes over a fresh timer and
nothing ever cancels anything. It must be created once — `useMemo`, `useRef`, module scope, or a
constructor.

**★ Why does a debounced function need `cancel`?**
A pending timer retains `this` and the arguments, so a handler on an unmounted component keeps that
component alive. `cancel` in teardown is the fix — the leak is the reason it exists, not testing
convenience.

**★ What can a debounced function return?**
Not the wrapped function's result — it has not run. Either the **previous** result (Lodash's
choice, honest but rarely useful) or a **promise** that resolves when the call eventually happens.
With a promise you must decide whether superseded callers resolve with the eventual value or
reject; rejecting risks unhandled rejections.

**★ What does `leading: true, trailing: true` do?**
Fires on both edges of a burst — twice for two or more rapid calls, once for a single call. It is
subtle enough that real libraries track the call count to make it sensible.

**Why capture the value rather than the event?**
Because the delayed callback runs later, when the input may have changed. Capture `e.target.value`
at call time and pass it in.

---

[Topic index](./README.md) · Next → [02 · throttle](./02-throttle.md)
