export interface Row220 { id: string; qty: number; tags: string[] }
export function total220(rows: Row220[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample220: Row220 = { id: 'r220', qty: 220, tags: ['a', 'b'] };
