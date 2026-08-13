export interface Row268 { id: string; qty: number; tags: string[] }
export function total268(rows: Row268[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample268: Row268 = { id: 'r268', qty: 268, tags: ['a', 'b'] };
