export interface Row255 { id: string; qty: number; tags: string[] }
export function total255(rows: Row255[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample255: Row255 = { id: 'r255', qty: 255, tags: ['a', 'b'] };
