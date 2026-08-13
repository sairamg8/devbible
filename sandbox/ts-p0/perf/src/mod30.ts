export interface Row30 { id: string; qty: number; tags: string[] }
export function total30(rows: Row30[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample30: Row30 = { id: 'r30', qty: 30, tags: ['a', 'b'] };
