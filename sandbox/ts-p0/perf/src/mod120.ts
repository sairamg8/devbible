export interface Row120 { id: string; qty: number; tags: string[] }
export function total120(rows: Row120[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample120: Row120 = { id: 'r120', qty: 120, tags: ['a', 'b'] };
