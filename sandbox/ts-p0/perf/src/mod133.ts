export interface Row133 { id: string; qty: number; tags: string[] }
export function total133(rows: Row133[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample133: Row133 = { id: 'r133', qty: 133, tags: ['a', 'b'] };
