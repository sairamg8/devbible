export interface Row72 { id: string; qty: number; tags: string[] }
export function total72(rows: Row72[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample72: Row72 = { id: 'r72', qty: 72, tags: ['a', 'b'] };
