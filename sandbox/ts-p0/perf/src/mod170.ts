export interface Row170 { id: string; qty: number; tags: string[] }
export function total170(rows: Row170[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample170: Row170 = { id: 'r170', qty: 170, tags: ['a', 'b'] };
