export interface Row258 { id: string; qty: number; tags: string[] }
export function total258(rows: Row258[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample258: Row258 = { id: 'r258', qty: 258, tags: ['a', 'b'] };
