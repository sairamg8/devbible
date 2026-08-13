export interface Row212 { id: string; qty: number; tags: string[] }
export function total212(rows: Row212[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample212: Row212 = { id: 'r212', qty: 212, tags: ['a', 'b'] };
