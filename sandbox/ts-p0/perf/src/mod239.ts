export interface Row239 { id: string; qty: number; tags: string[] }
export function total239(rows: Row239[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample239: Row239 = { id: 'r239', qty: 239, tags: ['a', 'b'] };
