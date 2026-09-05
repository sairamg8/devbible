import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import TechPicker from '@site/src/components/TechPicker';

/**
 * Registers the technology picker as a navbar item type, so
 * `docusaurus.config.js` can place it with one line:
 *
 *   items: [{type: 'custom-techPicker', position: 'left'}]
 *
 * A plain `type: 'dropdown'` in the config would have worked mechanically, but it
 * takes a literal array of links — which means restating all 29 technologies and
 * their hrefs in a second place. That list already exists in
 * `src/data/stack.js` and `src/data/progress.js`, and a restated copy is the kind
 * that silently drifts: a track added to the homepage would simply be missing
 * from the navbar and nothing would fail. A component reads the real list.
 *
 * `custom-` prefix is Docusaurus's own convention for user-registered types.
 */
export default {
  ...ComponentTypes,
  'custom-techPicker': TechPicker,
};
