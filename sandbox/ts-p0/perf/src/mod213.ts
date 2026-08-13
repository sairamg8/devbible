export interface Row213 { id: string; qty: number; tags: string[] }
export function total213(rows: Row213[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample213: Row213 = { id: 'r213', qty: 213, tags: ['a', 'b'] };
