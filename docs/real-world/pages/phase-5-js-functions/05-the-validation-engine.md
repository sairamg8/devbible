---
title: "The form validation engine"
sidebar_label: "05 · The validation engine"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the zod v4 docs. Concept home:
> [chapter 3·02](../phase-3-express-api/02-the-validation-boundary.md)
> owns parse-don't-validate; [4·04](../phase-4-react-ui/04-useform-and-checkout.md)
> consumes this chapter's output.

## The problem

The shared schemas ([Phase 6's package](../../syllabus/02-frontend.md))
validate *shape*. Forms need three things zod alone doesn't give
ergonomically: **field-level rules with UX-grade messages** ("Postcode
doesn't match a US format" beats "Invalid input"), **cross-field rules**
(billing postcode must match the card country), and **async rules with
their own lifecycle** (email availability on signup — a server round
trip that must debounce, cancel, and never block typing). This chapter
is the thin engine that adds those over the schema, instead of beside
it — one source of truth, two layers of message quality.

## The implementation

```js
// src/lib/validation.js — rules compose OVER a zod schema
export function createValidator({schema, rules = [], asyncRules = []}) {
  return {
    /** Sync pass: schema first (shape is the floor), then rule refinements.
     *  Returns {values?, errors} — errors keyed by field path. */
    validate(input) {
      const parsed = schema.safeParse(input);
      const errors = {};
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors[issue.path.join('.')] ??= issue.message;
        }
        return {errors};                       // shape failed: rules don't run
      }
      for (const rule of rules) {
        const problem = rule(parsed.data);     // (values) => {field, message} | null
        if (problem) errors[problem.field] ??= problem.message;
      }
      return Object.keys(errors).length
        ? {errors}
        : {values: parsed.data, errors: {}};
    },

    /** Async pass: independent lifecycle — the form runs it per-field on
     *  blur, debounced, cancellable. */
    async validateAsync(field, value, {signal} = {}) {
      for (const rule of asyncRules) {
        if (rule.field !== field) continue;
        const message = await rule.check(value, {signal});
        if (message) return {field, message};
      }
      return null;
    },
  };
}
```

```js
// src/forms/signup.rules.js — the signup form's full definition
import {SignupSchema} from '../../shared/schemas.js';
import {api} from '../lib/api.js';

export const signupValidator = createValidator({
  schema: SignupSchema,
  rules: [
    ({password, email}) =>
      password && email && password.toLowerCase().includes(
        email.split('@')[0].toLowerCase())
        ? {field: 'password', message: 'Password must not contain your email name'}
        : null,
    ({password, password_confirm}) =>
      password_confirm && password !== password_confirm
        ? {field: 'password_confirm', message: 'Passwords do not match'}
        : null,
  ],
  asyncRules: [{
    field: 'email',
    check: async (email, {signal}) => {
      if (!email.includes('@')) return null;   // shape's job; don't double-report
      const {available} = await api(
        `/auth/email-available?email=${encodeURIComponent(email)}`, {signal});
      return available ? null : 'An account with this email already exists';
    },
  }],
});
```

The [4·04 form hook](../phase-4-react-ui/04-useform-and-checkout.md)
swaps its bare `schema.safeParse` for `validator.validate`, and wires
`validateAsync` to blur events through
[the debounced-value pattern](../phase-4-react-ui/02-usedebounce-and-search.md)
with an `AbortController` per field — the same lifecycle discipline as
every fetch in the app.

## The decisions

- **The schema is the floor, rules are the finish.** Shape failures
  short-circuit (a rule reading `password.length` on an absent password
  is a crash); rules then speak UX language over structurally valid
  data. Message quality layering — schema messages for machine-ish
  problems, rule messages for human ones — is the whole reason the
  engine exists.
- **Rules return `{field, message}`, not booleans** — a rule *locates*
  its complaint. Cross-field rules pick the field the user should fix
  (the confirm box, not the original), which is a UX decision the rule
  author makes once, not per form render.
- **Async rules are advisory and non-blocking.** Submit does not wait
  for the availability check — the server's unique constraint
  ([3·03's signup path](../phase-3-express-api/03-auth/01-sessions.md))
  is the enforcement, and its neutral response is the truth. The async
  rule exists to move the bad news earlier, not to be the gate. That is
  also why the endpoint can rate-limit it aggressively without
  correctness consequences.
- **The email-availability endpoint is a deliberate, priced oracle.**
  [3·03 kept login neutral](../phase-3-express-api/03-auth/01-sessions.md)
  about account existence; a signup availability check reveals the same
  fact. The judgment, made explicit: signup UX pain (form → submit →
  error → retype) outweighs the marginal enumeration surface *given*
  the endpoint is rate-limited per IP and returns nothing about *why*.
  Products that judge otherwise (banks) drop the async rule and keep
  the flow — the engine makes it one line either way.

## Gotchas

- **Symptom:** "passwords do not match" flashes while typing the
  confirmation. **Cause:** rules run on every keystroke via the render-
  time validate — correct — but the *display* gating slipped: 4·04 shows
  errors only for touched fields, and confirm shouldn't count as
  touched until blur. **Fix:** the display layer's touched map is the
  filter; the engine stays pure and always-computed. Engine computes,
  form curates — mixing those layers is the recurring bug.
- **Symptom:** the availability check reports taken for an email the
  user then successfully registers. **Cause:** stale response — the
  check raced a deletion, or the fast-typing user's earlier value's
  response landed late. **Fix:** the per-field `AbortController` (new
  check aborts the old) plus treating the async result as advisory —
  the submit path never trusts it, so the worst case is a transient
  wrong hint.
- **Symptom:** a rule silently stopped running after a schema rename.
  **Cause:** rules read `parsed.data` fields by name with no
  compile-time link — in JS. **Fix:** named as Phase 6's job: typing
  `rules` as `(values: z.infer<typeof Schema>) => …` turns the rename
  into a build error. Until then, the form's test suite exercises each
  rule — which it should anyway.

## Interview questions

1. **★ Why layer rules over the schema instead of writing everything as
   zod `.refine`s?** Refinements couple UX copy to the shared shape —
   the server would ship browser-facing prose, and every message tweak
   redeploys the API. Splitting keeps the *contract* shared and the
   *conversation* client-owned, at the cost of one thin engine. The
   test: the server never needs "passwords do not match" (it gets one
   password field); the rule genuinely belongs to the form.
2. **★ Why must async validation never gate submission?** Its answer is
   stale by construction (state changes between check and submit), so
   gating on it adds latency without adding truth — the database
   constraint is the only race-free check
   ([the same argument as stock](../phase-3-express-api/02-the-validation-boundary.md)).
   Async checks are UX prefetches of likely errors; enforcement lives
   where atomicity lives.
3. **What does the availability endpoint trade, and how is the trade
   bounded?** It leaks account existence — an enumeration oracle login
   deliberately avoids. Bounds: per-IP rate limiting, a response with
   no detail, and the option to remove it without touching enforcement.
   The interview point is not the answer but showing the trade was
   *seen*: security-relevant UX affordances should be decisions, not
   accidents.

---

← Prev: [The event bus](04-the-event-bus.md) ·
Next → **Money and dates with `Intl`** *(not written yet)*
