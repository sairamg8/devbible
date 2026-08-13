export interface Row49 { id: string; qty: number; tags: string[] }
export function total49(rows: Row49[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample49: Row49 = { id: 'r49', qty: 49, tags: ['a', 'b'] };
