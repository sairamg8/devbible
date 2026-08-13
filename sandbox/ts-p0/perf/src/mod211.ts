export interface Row211 { id: string; qty: number; tags: string[] }
export function total211(rows: Row211[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample211: Row211 = { id: 'r211', qty: 211, tags: ['a', 'b'] };
