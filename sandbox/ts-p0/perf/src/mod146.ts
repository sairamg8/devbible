export interface Row146 { id: string; qty: number; tags: string[] }
export function total146(rows: Row146[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample146: Row146 = { id: 'r146', qty: 146, tags: ['a', 'b'] };
