export interface Row271 { id: string; qty: number; tags: string[] }
export function total271(rows: Row271[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample271: Row271 = { id: 'r271', qty: 271, tags: ['a', 'b'] };
