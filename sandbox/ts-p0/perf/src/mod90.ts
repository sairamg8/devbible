export interface Row90 { id: string; qty: number; tags: string[] }
export function total90(rows: Row90[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample90: Row90 = { id: 'r90', qty: 90, tags: ['a', 'b'] };
