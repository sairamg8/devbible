export interface Row199 { id: string; qty: number; tags: string[] }
export function total199(rows: Row199[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample199: Row199 = { id: 'r199', qty: 199, tags: ['a', 'b'] };
