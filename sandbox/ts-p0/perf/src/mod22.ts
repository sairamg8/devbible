export interface Row22 { id: string; qty: number; tags: string[] }
export function total22(rows: Row22[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample22: Row22 = { id: 'r22', qty: 22, tags: ['a', 'b'] };
