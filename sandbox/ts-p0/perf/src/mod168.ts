export interface Row168 { id: string; qty: number; tags: string[] }
export function total168(rows: Row168[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample168: Row168 = { id: 'r168', qty: 168, tags: ['a', 'b'] };
