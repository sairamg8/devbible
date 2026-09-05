import React, {useEffect, useRef} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useLocation} from '@docusaurus/router';
import {LAYERS} from '@site/src/data/stack';
import {summarise} from '@site/src/data/progress';
import styles from './styles.module.css';

/**
 * The technology rail — every written track, grouped by layer, permanently beside
 * the page tree.
 *
 * It exists because the navbar carries no items (`navbar.items: []` in
 * `docusaurus.config.js`, deliberately — the homepage is the picker). The cost of
 * that was invisible until measured: inside `/docs/java` there is no route to
 * `/docs/react` at all except back to the homepage and re-pick. For a reference
 * where React, Next.js and TypeScript cite each other constantly, that was the
 * single most expensive thing about the old navigation.
 *
 * Built from `src/data/stack.js` and `progress.js`, the same two files the
 * homepage reads — so a technology added there appears here without anyone
 * remembering this file exists.
 *
 * Parked entries (GraphQL, tRPC, Kubernetes) are skipped: they carry no `key`
 * because they have no pages, and a rail is a set of destinations.
 *
 * The page count beside each name answers "how big is the thing I am about to
 * enter", which is most of why a rail beats a dropdown. It comes from
 * `summarise(key).pagesWritten`, which since 2026-09-05 is generated from disk by
 * `scripts/page-counts.mjs` — so it is the same number the homepage card prints,
 * and neither can drift from the files.
 */

/**
 * Resolved once at module scope. `LAYERS` and `LANGUAGES` are both static build-
 * time data, so there is nothing per-render to do — and doing it here means the
 * page-count lookups happen once for the whole session rather than on every
 * sidebar render.
 */
const GROUPS = LAYERS.filter((layer) => !layer.parked)
  .map((layer) => ({
    name: layer.name,
    items: layer.items
      .filter((item) => item.key)
      .map((item) => {
        const data = summarise(item.key);
        return {
          key: item.key,
          // `short` exists only for the handful of labels too long for this
          // column; everything else uses the canonical name from progress.js.
          label: item.short ?? data.label,
          to: data.docsPath,
          pages: data.pagesWritten,
        };
      }),
  }))
  .filter((layer) => layer.items.length > 0);

export default function TechRail() {
  const {pathname} = useLocation();
  const docsBase = useBaseUrl('/docs/');
  const railRef = useRef(null);
  const activeRef = useRef(null);

  /**
   * Which technology we are in, taken from the route rather than from any
   * component state — the rail has to be right on a cold load and after a
   * client-side navigation, and the URL is the only thing true in both cases.
   *
   * `/devbible/docs/java/pages/…` → `java`. Splitting on the resolved docs base
   * rather than a hard-coded `/docs/` keeps this working under the `baseUrl` the
   * site is actually deployed at (`/devbible/`), which is not the dev server's.
   */
  const activeKey = pathname.startsWith(docsBase)
    ? pathname.slice(docsBase.length).split('/')[0]
    : null;

  /**
   * Scroll the current technology into view on mount.
   *
   * Twenty-nine entries do not fit a viewport-height column, and Java — the
   * biggest track in the corpus — sits in the seventh group. Without this the
   * rail opens showing Frontend and the reader has to scroll to discover their
   * own position. `block: 'nearest'` so an item already visible does not jump.
   *
   * Deliberately not in the dependency-free path: it runs when the active item
   * changes, which after a client-side navigation between technologies is exactly
   * when the rail needs to move.
   */
  useEffect(() => {
    const el = activeRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;

    const item = el.getBoundingClientRect();
    const box = rail.getBoundingClientRect();
    if (item.top >= box.top && item.bottom <= box.bottom) return;

    rail.scrollTop += item.top - box.top - box.height / 2 + item.height / 2;
  }, [activeKey]);

  return (
    <nav ref={railRef} className={styles.rail} aria-label="Technologies">
      {GROUPS.map((group) => (
        <React.Fragment key={group.name}>
          <div className={styles.group}>{group.name}</div>
          <ul className={styles.list}>
            {group.items.map((item) => {
              const active = item.key === activeKey;
              return (
                <li key={item.key}>
                  <Link
                    ref={active ? activeRef : undefined}
                    to={item.to}
                    className={clsx(styles.item, active && styles.active)}
                    aria-current={active ? 'page' : undefined}>
                    <span className={styles.label}>{item.label}</span>
                    <span className={styles.count}>{item.pages.toLocaleString()}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </React.Fragment>
      ))}
    </nav>
  );
}
