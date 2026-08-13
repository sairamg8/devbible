export interface Row48 { id: string; qty: number; tags: string[] }
export function total48(rows: Row48[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample48: Row48 = { id: 'r48', qty: 48, tags: ['a', 'b'] };
