export interface Row130 { id: string; qty: number; tags: string[] }
export function total130(rows: Row130[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample130: Row130 = { id: 'r130', qty: 130, tags: ['a', 'b'] };
