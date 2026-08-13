export interface Row286 { id: string; qty: number; tags: string[] }
export function total286(rows: Row286[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample286: Row286 = { id: 'r286', qty: 286, tags: ['a', 'b'] };
