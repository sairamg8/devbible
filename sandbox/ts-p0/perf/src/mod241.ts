export interface Row241 { id: string; qty: number; tags: string[] }
export function total241(rows: Row241[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample241: Row241 = { id: 'r241', qty: 241, tags: ['a', 'b'] };
