import React, {useEffect, useId, useSyncExternalStore} from 'react';
import clsx from 'clsx';
import {ALL_TIERS, TIERS} from '@site/src/data/tiers.mjs';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  hydrate,
  setTierFloor,
} from '../store';
import styles from './styles.module.css';

/**
 * The tier floor — Study Mode's one control.
 *
 * Four stops in ranking order. Picking one says "show me this tier and
 * everything above it"; the sidebar tree does the hiding, this only sets the
 * number. It is a THRESHOLD, not four independent checkboxes, which is why the
 * markup is a radiogroup: exactly one stop is ever chosen.
 *
 * ── Why native radios rather than buttons ────────────────────────────────────
 * A radiogroup owes the keyboard arrow-key movement with a roving tab stop —
 * Tab enters the group once and lands on the chosen stop, arrows change the
 * choice. Reimplementing that over <button aria-pressed> is thirty lines of
 * keydown handling that browsers already ship, and `aria-pressed` would also
 * lie: with the floor at Know, three stops are lit, but only one of them is
 * *chosen*, and a screen reader hearing "pressed" three times cannot tell which.
 * So the inputs are real, `useId` gives them a group name that survives
 * hydration, and they are hidden with clip rather than `display: none` — which
 * would take them out of the tab order and out of the accessibility tree.
 *
 * ── 🔴 No counts here ────────────────────────────────────────────────────────
 * The obvious next feature is "Master (412)" next to each stop. It is not
 * affordable: a surviving-page count is a walk of the whole item tree, and
 * Java's sidebar alone is 2,240 items — four walks on every render of a control
 * that lives in a sticky column. The tree already walks itself once to filter;
 * if counts are ever wanted they belong there, computed in that same pass.
 *
 * ── 🔴 Hydration ─────────────────────────────────────────────────────────────
 * The floor comes from the store, which is at its defaults on the server AND on
 * the first client render; `hydrate()` runs in an effect. Reading localStorage
 * during render instead would paint a different control than the server sent
 * and React would throw the sidebar away. One unfiltered frame is the price.
 */

/**
 * The stops, resolved once — `TIERS` is build-time data.
 *
 * The widest stop is relabelled. As a FLOOR, `w` does not mean "when-needed
 * pages"; it means no floor at all, and calling it "When needed" would read as
 * one more filter rather than as the way out of filtering. Derived from
 * `ALL_TIERS` rather than from the last index, so it stays correct if a fifth
 * tier is ever appended.
 */
const STOPS = TIERS.map((tier) => {
  const widest = tier.code === ALL_TIERS;
  return {
    code: tier.code,
    slug: tier.slug,
    label: widest ? 'All' : tier.label,
    // Doubles as the tooltip and as each radio's accessible name, so it has to
    // open with the visible word — a speech-input user says what they see.
    hint: widest
      ? 'All tiers — Study Mode off, nothing is hidden'
      : `${tier.label} and above — ${tier.blurb}`,
  };
});

export default function TierFilter() {
  const {floor} = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const name = useId();

  useEffect(() => {
    hydrate();
  }, []);

  const floorIndex = STOPS.findIndex((stop) => stop.code === floor);
  const filtering = floor !== ALL_TIERS;

  return (
    <div
      className={styles.bar}
      role="radiogroup"
      aria-label="Study Mode: the lowest tier to show">
      {STOPS.map((stop, index) => {
        /*
         * Three chip states, and the third is the point of the control.
         *
         * `included`  a floor is set and this tier survives it — the chip wears
         *             the real badge colour the reader sees on every page, so
         *             the row is the same vocabulary, not a second one.
         * `excluded`  a floor is set and this tier is being hidden — faded.
         * `resting`   no floor is set. Everything is visible, so nothing is lit
         *             and nothing is faded; the row is inert and the chosen
         *             stop carries the site's quiet active tint instead. A row
         *             of four lit badges would announce a filter that is not
         *             running.
         *
         * While filtering, the chosen stop is the LAST lit one — the boundary
         * is the marker, so it takes no extra ring. Resting, there is no
         * boundary to read, which is why `chosen` is styled only there.
         */
        const chosen = index === floorIndex;
        const included = filtering && index <= floorIndex;

        return (
          <label key={stop.code} className={styles.stop} title={stop.hint}>
            <input
              type="radio"
              className={styles.input}
              name={name}
              value={stop.code}
              checked={chosen}
              aria-label={stop.hint}
              onChange={() => setTierFloor(stop.code)}
            />
            <span
              className={clsx(
                'db-tier',
                styles.chip,
                included && `t-${stop.slug}`,
                filtering && !included && styles.excluded,
                !filtering && styles.resting,
                !filtering && chosen && styles.chosen,
              )}>
              {stop.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
