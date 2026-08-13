export interface Row114 { id: string; qty: number; tags: string[] }
export function total114(rows: Row114[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample114: Row114 = { id: 'r114', qty: 114, tags: ['a', 'b'] };
