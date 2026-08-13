export interface Row252 { id: string; qty: number; tags: string[] }
export function total252(rows: Row252[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample252: Row252 = { id: 'r252', qty: 252, tags: ['a', 'b'] };
