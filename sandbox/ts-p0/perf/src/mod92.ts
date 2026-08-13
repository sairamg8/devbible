export interface Row92 { id: string; qty: number; tags: string[] }
export function total92(rows: Row92[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample92: Row92 = { id: 'r92', qty: 92, tags: ['a', 'b'] };
