export interface Row81 { id: string; qty: number; tags: string[] }
export function total81(rows: Row81[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample81: Row81 = { id: 'r81', qty: 81, tags: ['a', 'b'] };
