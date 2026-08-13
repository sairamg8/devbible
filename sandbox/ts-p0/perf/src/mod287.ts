export interface Row287 { id: string; qty: number; tags: string[] }
export function total287(rows: Row287[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample287: Row287 = { id: 'r287', qty: 287, tags: ['a', 'b'] };
