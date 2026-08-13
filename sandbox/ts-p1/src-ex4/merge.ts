interface Box { width: number }
interface Box { height: number }        // merges
const b: Box = { width: 1, height: 2 };
const missing: Box = { width: 1 };      // ERROR: height missing — proves the merge

type TBox = { width: number };
type TBox = { height: number };         // ERROR: duplicate identifier
