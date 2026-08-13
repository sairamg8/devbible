export interface Row9 { id: string; qty: number; tags: string[] }
export function total9(rows: Row9[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample9: Row9 = { id: 'r9', qty: 9, tags: ['a', 'b'] };
