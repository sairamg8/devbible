export interface Row272 { id: string; qty: number; tags: string[] }
export function total272(rows: Row272[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample272: Row272 = { id: 'r272', qty: 272, tags: ['a', 'b'] };
