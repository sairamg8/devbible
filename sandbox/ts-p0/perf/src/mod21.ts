export interface Row21 { id: string; qty: number; tags: string[] }
export function total21(rows: Row21[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample21: Row21 = { id: 'r21', qty: 21, tags: ['a', 'b'] };
