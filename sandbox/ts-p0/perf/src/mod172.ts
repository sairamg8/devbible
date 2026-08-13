export interface Row172 { id: string; qty: number; tags: string[] }
export function total172(rows: Row172[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample172: Row172 = { id: 'r172', qty: 172, tags: ['a', 'b'] };
