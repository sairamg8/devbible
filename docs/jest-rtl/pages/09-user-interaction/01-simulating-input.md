---
title: "User Interaction: `fireEvent` vs `@testing-library/user-event`"
sidebar_label: "User Interaction"
sidebar_position: 1
---

# 🧪 User Interaction: `fireEvent` vs `@testing-library/user-event`

## 1. Under-The-Hood Mechanics

Both APIs simulate user input, but at genuinely different levels of realism — `fireEvent` dispatches a single, isolated DOM event; `user-event` simulates the **full sequence** of events a real browser would fire for a given interaction.

```
fireEvent.click(button)
        │
        ▼
Dispatches EXACTLY ONE event: 'click' — nothing else

userEvent.click(button)   (via a userEvent.setup() instance)
        │
        ▼
Dispatches the FULL REALISTIC SEQUENCE a real click involves:
  pointerdown → mousedown → focus → pointerup → mouseup → click
  (plus, for a text input's .type(): individual keydown/keypress/input/keyup EVENTS per character)
```

### Why the Difference Matters
A component relying on a `focus` event (e.g. showing a tooltip, or a form validation library hooking into `onFocus`/`onBlur`) will not react correctly to `fireEvent.click()` alone, since that only dispatches the bare `click` event — no `focus` event ever fires. `userEvent.click()` fires the complete, realistic sequence, so any component logic depending on intermediate events in that sequence (focus, pointer events) behaves in tests the way it actually would for a real user, not just for the narrow, single event `fireEvent` provides.

### `userEvent.setup()`: The Modern API Pattern
```javascript
const user = userEvent.setup(); // returns a BOUND instance, configured once per test
await user.click(button);          // every interaction method is now async — MUST be awaited
await user.type(input, 'hello');
```
Every `user-event` interaction method returns a Promise (since realistic interaction sequences involve real, if tiny, timing between events) — forgetting to `await` them means the test proceeds to its assertions before the full interaction sequence has actually completed.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Form Validation Test Passing With `fireEvent` While the Actual Feature Was Broken for Real Users.
A form's validation logic was wired to the input's `onBlur` handler (validate when the user leaves the field). A test using `fireEvent.change(input, { target: { value: 'invalid-email' } })` passed, because `fireEvent.change` only dispatches a `change` event — it never fires `blur`, so the validation logic never actually ran during the test, and the test's assertion (checking for an error message) was written to not require it, masking the gap. Switching to `await user.type(input, 'invalid-email'); await user.tab();` (moving focus away, firing a real `blur` event as part of the realistic interaction sequence) correctly exercised the validation logic exactly as a real user's interaction would, revealing that the actual feature had a genuine bug unrelated to the test itself.

---

## 3. Production-Grade Code Example

```tsx
// user-event — the realistic, recommended default for nearly all interaction testing
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('validates email format on blur', async () => {
  const user = userEvent.setup();
  render(<SignupForm />);

  const emailInput = screen.getByLabelText(/email/i);
  await user.type(emailInput, 'not-a-valid-email'); // realistic keydown/input/keyup per character
  await user.tab(); // moves focus away — fires a REAL blur event, triggering validation

  expect(await screen.findByText(/please enter a valid email/i)).toBeInTheDocument();
});

test('submits the form with valid data', async () => {
  const user = userEvent.setup();
  const handleSubmit = jest.fn();
  render(<SignupForm onSubmit={handleSubmit} />);

  await user.type(screen.getByLabelText(/email/i), 'alex@acme.com');
  await user.type(screen.getByLabelText(/password/i), 'securepassword123');
  await user.click(screen.getByRole('button', { name: /sign up/i }));

  expect(handleSubmit).toHaveBeenCalledWith({ email: 'alex@acme.com', password: 'securepassword123' });
});
```

```tsx
// fireEvent — appropriate for low-level, single-event scenarios where full realism isn't needed
import { fireEvent, render, screen } from '@testing-library/react';

test('scroll handler fires on scroll event', () => {
  const handleScroll = jest.fn();
  render(<ScrollableList onScroll={handleScroll} />);

  fireEvent.scroll(screen.getByTestId('scroll-container'), { target: { scrollY: 100 } });
  // fireEvent is appropriate here — there's no "realistic sequence" for a raw scroll event
  // the way there is for click/type; user-event has no scroll-specific higher-level equivalent
  expect(handleScroll).toHaveBeenCalled();
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `fireEvent` for Interactions Where the Full Event Sequence Matters
```tsx
// ❌ MISSES REAL BEHAVIOR: only fires 'click' — no focus, no pointer events — a component
// relying on any of those intermediate events won't behave correctly in this test
fireEvent.click(button);

// ✅ CORRECT: user-event fires the complete, realistic sequence real browsers produce
await userEvent.setup().click(button);
```

### ⚠️ Pitfall 2: Forgetting to `await` a `user-event` Method
```tsx
// ❌ WRONG: user-event methods return Promises — without awaiting, the test's next line
// (an assertion) can run BEFORE the interaction sequence has actually finished
user.click(button); // missing await
expect(screen.getByText('Success')).toBeInTheDocument(); // may run TOO EARLY, before click's effects settle

// ✅ CORRECT: always await every user-event interaction call
await user.click(button);
expect(screen.getByText('Success')).toBeInTheDocument();
```

### ⚠️ Pitfall 3: Using `fireEvent.change()` to Simulate Typing Instead of `user.type()`
```tsx
// ❌ MISSES REAL BEHAVIOR: fireEvent.change sets the ENTIRE value in one synthetic event —
// no individual keydown/input events fire per character, so any component logic reacting
// to KEYSTROKES specifically (a character counter updating live, a masked input formatter)
// won't be correctly exercised by this test
fireEvent.change(input, { target: { value: 'hello' } });

// ✅ CORRECT: user.type() simulates individual keystrokes, exactly like real typing
await user.type(input, 'hello');
```
