export interface Row18 { id: string; qty: number; tags: string[] }
export function total18(rows: Row18[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample18: Row18 = { id: 'r18', qty: 18, tags: ['a', 'b'] };
