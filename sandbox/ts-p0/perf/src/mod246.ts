export interface Row246 { id: string; qty: number; tags: string[] }
export function total246(rows: Row246[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample246: Row246 = { id: 'r246', qty: 246, tags: ['a', 'b'] };
