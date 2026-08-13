export interface Row149 { id: string; qty: number; tags: string[] }
export function total149(rows: Row149[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample149: Row149 = { id: 'r149', qty: 149, tags: ['a', 'b'] };
