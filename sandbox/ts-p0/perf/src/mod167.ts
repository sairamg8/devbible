export interface Row167 { id: string; qty: number; tags: string[] }
export function total167(rows: Row167[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample167: Row167 = { id: 'r167', qty: 167, tags: ['a', 'b'] };
