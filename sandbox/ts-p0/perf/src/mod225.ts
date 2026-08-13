export interface Row225 { id: string; qty: number; tags: string[] }
export function total225(rows: Row225[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample225: Row225 = { id: 'r225', qty: 225, tags: ['a', 'b'] };
