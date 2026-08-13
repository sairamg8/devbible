export interface Row160 { id: string; qty: number; tags: string[] }
export function total160(rows: Row160[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample160: Row160 = { id: 'r160', qty: 160, tags: ['a', 'b'] };
