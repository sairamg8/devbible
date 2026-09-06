/**
 * The theme paginator, plus one quiet row: the next page in this track the reader
 * has not opened yet that survives their tier floor.
 *
 * The theme's own previous/next moves one page at a time through the sidebar in
 * document order, which is the wrong granularity once a floor is set — at a
 * Master-only floor the very next page is usually hidden, and following the arrow
 * lands the reader on something they deliberately chose not to study. This row is
 * the straight line through a track: it is what turns 2,240 sidebar entries into
 * a reading order the reader can just keep following.
 *
 * With Study Mode off (floor `'w'`, the default) it degrades into "the next page
 * you have not read", which is still the useful thing after arriving by search.
 *
 * It is added BESIDE the original paginator rather than replacing it. Previous /
 * next is the honest map of the corpus and stays exactly where readers expect it;
 * this is a suggestion layered on top, and the two disagreeing is the point.
 */

import React, {useEffect, useMemo, useSyncExternalStore} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Paginator from '@theme-original/DocItem/Paginator';
import {useDoc, useDocsSidebar} from '@docusaurus/plugin-content-docs/client';
import {isAtOrAbove, tierByCode} from '@site/src/data/tiers.mjs';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  hydrate,
} from '@site/src/components/StudyMode/store';
import styles from '../studyMode.module.css';

/**
 * Every link and category in the sidebar, in the order they are rendered.
 *
 * Categories are kept even though they can never be a *target* (see
 * `findNextUnread`) because they can be the reader's current POSITION: a topic's
 * `README.md` is a real, badged page, and in the sidebar it is the category its
 * chunks live under, not a link. Dropping categories here would lose the reader's
 * place on every topic index page in the corpus.
 *
 * `html` items are decoration and are dropped.
 */
function flatten(items, out = []) {
  for (const item of items) {
    if (item.type === 'category') {
      out.push(item);
      flatten(item.items ?? [], out);
    } else if (item.type === 'link') {
      out.push(item);
    }
  }
  return out;
}

/**
 * Does this flattened entry represent the page currently being read?
 *
 * `href` is the primary key rather than `docId`, and deliberately so: it is the
 * one identifier BOTH shapes carry. Docusaurus builds a link item's `href` from
 * the very same `permalink` field this compares it against (`props.js`
 * `toSidebarDocItemLinkProp`), so the match is exact, not approximate — and a
 * category built from a `link: {type: 'doc'}` gets that doc's permalink as its
 * `href` while its `docId` is discarded in the same function. The `docId` arm is
 * the belt to that braces, and costs one comparison.
 *
 * 🔴 Both sides are null-guarded before being compared, and that is not padding.
 * `href` is OPTIONAL on a category — a plain grouping with no index page has
 * none — so a bare `item.href === permalink` reports a match the moment both
 * happen to be undefined, and every href-less category in the tree becomes "the
 * page you are on". The first such category in the sidebar would then anchor the
 * walk, and the row would point at the top of the track from anywhere.
 */
function isCurrent(item, docId, permalink) {
  return (
    (item.href != null && item.href === permalink) ||
    (item.docId != null && item.docId === docId)
  );
}

/**
 * Walk forward from the current page to the first unread page that clears the
 * floor. Returns `{item, tier, skipped}`, or null when there is nothing left.
 *
 * ── Why only link items can be the target ───────────────────────────────────
 * 🔴 `PropSidebarItemCategory` carries no `docId` — Docusaurus destructures the
 * category's `link` away when it builds the browser payload, keeping only the
 * resolved `href`. The store keys `visited` by doc id, so for a category there is
 * simply no way to ask "has this been read?" and a category offered here would be
 * re-offered forever. The cost is that topic index pages never appear as the
 * target; they are one click away as the category heading above their chunks, and
 * the reader passes through them on the way in.
 *
 * Unlisted docs are skipped for a different reason: `isVisibleSidebarItem` hides
 * them from the sidebar unless they are the active page, so pointing at one would
 * send the reader somewhere the navigation does not admit exists.
 *
 * ── `skipped` ───────────────────────────────────────────────────────────────
 * Counts ONLY the pages the tier floor hid on the way — not the ones already
 * read. Pages behind the reader are finished, not skipped; conflating the two
 * would report a huge number to someone who has simply been reading. This is why
 * the count is accumulated inside the same forward walk instead of a second pass:
 * the walk already visits exactly the range in question.
 *
 * A missing current page (index -1) returns null rather than falling through to
 * `index + 1 === 0`, which would silently answer with the first unread page of
 * the whole track no matter where the reader actually is.
 */
function findNextUnread(flat, docId, permalink, visited, floor) {
  const index = flat.findIndex((item) => isCurrent(item, docId, permalink));
  if (index === -1) {
    return null;
  }

  let skipped = 0;

  for (let i = index + 1; i < flat.length; i += 1) {
    const item = flat[i];
    if (item.type !== 'link' || !item.docId || item.unlisted) {
      continue;
    }
    if (visited.has(item.docId)) {
      continue;
    }

    // `customProps.tier` is attached at config load by `decorateSidebarItems`
    // in scripts/tier-map.mjs. `isAtOrAbove` treats a null tier as always
    // visible, so an unbadged page is a valid target rather than a hole.
    const tier = item.customProps?.tier ?? null;
    if (!isAtOrAbove(tier, floor)) {
      skipped += 1;
      continue;
    }

    return {item, tier, skipped};
  }

  return null;
}

export default function DocItemPaginatorWrapper(props) {
  const {metadata} = useDoc();
  const sidebar = useDocsSidebar();
  const {floor, visited, hydrated} = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Idempotent, and cheap after the first call. It is here as well as in
  // DocItem/Layout so this component is correct on its own terms rather than
  // because of where it happens to sit in the tree.
  useEffect(() => {
    hydrate();
  }, []);

  /**
   * 🔴 Memoised on the SIDEBAR OBJECT, which is stable for a whole track.
   *
   * `useDocRootMetadata` reads `versionMetadata.docsSidebars[sidebarName]` — one
   * array per sidebar, held by the version metadata module — and
   * `DocsSidebarProvider` memoises `{name, items}` on `[name, items]`. So this
   * identity survives every doc-to-doc navigation inside a track and changes only
   * when the reader crosses into another technology's sidebar.
   *
   * That is the whole point of keying on it: the largest of these sidebars is
   * 2,240 items, and the visited set below changes on EVERY page open while the
   * tree changes once per track. Keying the flatten on anything that moves with
   * the reader would rebuild the list thousands of times a session.
   */
  const flat = useMemo(() => flatten(sidebar?.items ?? []), [sidebar]);

  // The forward walk is a plain scan over an array that already exists — no
  // allocation, and it stops at the first hit — so it is fine to redo it
  // whenever the visited set or the floor moves.
  const next = useMemo(
    () =>
      hydrated
        ? findNextUnread(flat, metadata.id, metadata.permalink, visited, floor)
        : null,
    [flat, metadata.id, metadata.permalink, visited, floor, hydrated],
  );

  // Nothing before hydration: the server render and the first client paint must
  // agree, and until localStorage has been read this component would claim every
  // page is unread. Nothing at the end of a track either — an empty row saying
  // nothing is worse than no row.
  if (!next) {
    return <Paginator {...props} />;
  }

  const tier = next.tier ? tierByCode(next.tier) : null;

  return (
    <>
      <Paginator {...props} />
      <div className={styles.nextUnread}>
        <span className={styles.label}>Next unread</span>
        <Link className={styles.link} to={next.item.href}>
          {next.item.label}
        </Link>
        {tier && (
          <span className={clsx('db-tier', `t-${tier.slug}`)}>{tier.label}</span>
        )}
        {next.skipped > 0 && (
          // A template literal rather than mixed JSX text, so the spaces around
          // the count are in the source instead of at the mercy of how the
          // formatter happens to wrap this line.
          <span className={styles.skipped}>
            {`skipping ${next.skipped} page${next.skipped === 1 ? '' : 's'} below your floor`}
          </span>
        )}
      </div>
    </>
  );
}
