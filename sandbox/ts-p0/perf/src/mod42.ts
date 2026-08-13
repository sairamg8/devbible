export interface Row42 { id: string; qty: number; tags: string[] }
export function total42(rows: Row42[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample42: Row42 = { id: 'r42', qty: 42, tags: ['a', 'b'] };
