const KEY = Symbol('key');            // typeof KEY is `typeof KEY` (unique symbol)
let loose = Symbol('loose');          // widens to `symbol`

interface Registry { [KEY]: string }
const r: Registry = { [KEY]: 'ok' };

// a `let` symbol as a computed key: measured, NOT an error on 7.0.2
interface Maybe { [loose]: string }

// where it DOES bite: a plain `symbol` cannot be a type-position key in a type alias
type Alias = { [loose]: string };
