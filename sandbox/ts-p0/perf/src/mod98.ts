export interface Row98 { id: string; qty: number; tags: string[] }
export function total98(rows: Row98[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample98: Row98 = { id: 'r98', qty: 98, tags: ['a', 'b'] };
