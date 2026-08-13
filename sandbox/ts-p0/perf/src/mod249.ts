export interface Row249 { id: string; qty: number; tags: string[] }
export function total249(rows: Row249[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample249: Row249 = { id: 'r249', qty: 249, tags: ['a', 'b'] };
