export interface Row234 { id: string; qty: number; tags: string[] }
export function total234(rows: Row234[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample234: Row234 = { id: 'r234', qty: 234, tags: ['a', 'b'] };
