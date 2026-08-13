export interface Row158 { id: string; qty: number; tags: string[] }
export function total158(rows: Row158[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample158: Row158 = { id: 'r158', qty: 158, tags: ['a', 'b'] };
