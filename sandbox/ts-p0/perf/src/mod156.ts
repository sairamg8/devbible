export interface Row156 { id: string; qty: number; tags: string[] }
export function total156(rows: Row156[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample156: Row156 = { id: 'r156', qty: 156, tags: ['a', 'b'] };
