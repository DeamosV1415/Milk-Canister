/**
 * Catmull-Rom through the points, converted to cubic beziers. A raw polyline
 * of sensor samples looks jagged and anxious; a smoothed curve reads as a
 * trend, which is what is actually being communicated.
 */
export function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return ""
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)},${c2x.toFixed(2)} ${c2y.toFixed(2)},${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}
