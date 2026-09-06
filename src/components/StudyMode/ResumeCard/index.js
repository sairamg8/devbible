import React, {useEffect, useSyncExternalStore} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {useBaseUrlUtils} from '@docusaurus/useBaseUrl';
import {useLocation} from '@docusaurus/router';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  hydrate,
  clearProgress,
} from '../store';
import styles from './styles.module.css';

/**
 * "Pick up where you left off" for the technology the reader is currently in.
 *
 * One track, never a list. A reader who has opened twelve technologies does not
 * want twelve resume links stacked above the page tree of the one they are
 * looking at; the sidebar is scoped to a single track and so is this.
 *
 * ── Finding the track ────────────────────────────────────────────────────────
 * From the ROUTE, the same way `TechPicker` does it: slice the resolved
 * `/docs/` base off `pathname` and take the first segment. Verified against
 * that component, which has shipped this since the navbar dropdown replaced the
 * technology rail.
 *
 * Two other routes were available and both are worse:
 *
 *   `useDocsSidebar().name` — the sidebar is named `<track>Sidebar`, but
 *   camelCased and therefore LOSSY: `real-world` → `realworldSidebar` and
 *   `eslint-oxlint` → `eslintOxlintSidebar`, neither of which can be turned
 *   back into the folder without a lookup table that would then have to be kept
 *   in step with `sidebars.js`.
 *
 *   The doc id from the page — correct, but only the page has it, and this
 *   component renders in the sidebar wrapper.
 *
 * The route's first segment IS the folder, which is exactly what `trackOf()`
 * takes off a doc id, so the key this looks up under is the key the store
 * wrote — no mapping, nothing to drift. Slicing the resolved base rather than a
 * literal `'/docs/'` is what keeps it working under the deployed
 * `baseUrl: '/devbible/'`, which the dev server does not use.
 *
 * ── 🔴 What it must not do ───────────────────────────────────────────────────
 * Render anything before hydration, when there is no resume point for this
 * track, or when the resume point is the page being read. Nothing is a fine
 * answer; a wrong or premature card is not, and the store is at its defaults
 * until an effect has read localStorage.
 *
 * It also renders on one route per track rather than on every page — see the
 * jitter note beside `atTrackRoot` below, which is the reason.
 */

/**
 * Route comparison. `trailingSlash: false` in the site config, so a permalink
 * and a pathname should already agree — but a reader who typed the URL with a
 * slash, or a redirect that added one, must not get a card offering to take
 * them to the page they are already reading.
 */
function samePage(a, b) {
  const trim = (value) => (value.length > 1 ? value.replace(/\/$/, '') : value);
  return trim(a) === trim(b);
}

export default function ResumeCard() {
  const {resume, hydrated} = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const {pathname} = useLocation();
  const {withBaseUrl} = useBaseUrlUtils();

  useEffect(() => {
    hydrate();
  }, []);

  const docsBase = withBaseUrl('/docs/');
  const inside = pathname.startsWith(docsBase)
    ? pathname.slice(docsBase.length).replace(/\/$/, '')
    : '';
  const track = inside.split('/')[0];

  /*
   * 🔴 The card shows at the track's front door and nowhere else — `/docs/java`,
   * the page `docs/java/README.md` renders and the technology dropdown links to.
   *
   * Not a placement preference, a jitter fix. `markVisited` runs from the doc
   * page in an effect, and effects run AFTER the browser has painted. Walk from
   * page A to page B inside a track and the sequence is: route changes, this
   * sidebar re-renders while `resume` still says A, a card for A is painted
   * above the tree, the effect fires, `resume` becomes B, the card unmounts.
   * One painted frame and two layout shifts of the whole tree, on every single
   * navigation. Restricting the card to the one route the reader arrives at
   * asking "where was I?" removes the sequence rather than papering over it.
   *
   * The narrowing costs nothing either: everywhere else in the track, the page
   * the reader is looking at either is already the resume point or is about to
   * be one paint later, so the guard below would hide the card there anyway.
   *
   * If page visits ever stop being recorded for deeper pages, widen this to
   * `inside !== ''` and the guard below still keeps the card honest.
   */
  const atTrackRoot = inside !== '' && inside === track;
  const entry = hydrated && atTrackRoot ? resume[track] : null;

  /*
   * `permalink` is what makes the card renderable at all. It is stored rather
   * than rebuilt from the doc id because the two are not the same string: route
   * generation drops the numeric ordering prefixes (`pages/01-lambdas-…` is
   * served as `pages/lambdas-…`), so anything reconstructed from an id 404s.
   * An entry without one predates the field, or came back mangled from storage
   * the reader edited — either way, skip it rather than guess. The store parses
   * localStorage defensively for the same reason and this is the other half of
   * it: the shapes inside `resume` are never validated there.
   */
  if (typeof entry?.permalink !== 'string') {
    return null;
  }

  /*
   * A Docusaurus permalink already carries the baseUrl, and `withBaseUrl` will
   * not add it twice — `addBaseUrl` returns the url untouched when it already
   * starts with the base. Putting it through anyway costs nothing and makes the
   * comparison below sound whichever form the writer stored, instead of this
   * component and the page that fills `resume` having to agree by convention.
   */
  const href = withBaseUrl(entry.permalink);

  /*
   * 🔴 Never offer to take the reader where they already are. `markVisited`
   * runs on the doc page itself, so the moment a page is opened it BECOMES the
   * track's resume point — and this route is a page like any other. A reader
   * whose last visit to the track was its front door would otherwise be handed
   * a card pointing at the screen they are looking at.
   */
  if (samePage(href, pathname)) {
    return null;
  }

  /*
   * Named for what it destroys. "Clear" on its own is announced with no object
   * at all, and this throws away the whole track's visited set — the read marks
   * in the tree go with it. Opens with the visible word so it stays sayable.
   */
  const clearLabel = `Clear reading progress for ${track}`;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Continue</span>
        <button
          type="button"
          className={clsx('clean-btn', styles.clear)}
          title={`Forget which ${track} pages have been read`}
          aria-label={clearLabel}
          onClick={() => clearProgress(track)}>
          Clear
        </button>
      </div>
      <Link to={href} className={styles.title}>
        {/* Titles are stored at visit time; a page renamed since then shows its
            old name until it is opened again, which is better than no card. */}
        {entry.title || 'the page you were reading'}
      </Link>
    </div>
  );
}
