/** Draws a stylised Canadian flag onto a canvas (procedural, no external asset). */
export function drawCanadianFlag(width = 512, height = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#d52b1e';
  ctx.fillRect(0, 0, width / 4, height);
  ctx.fillRect((width * 3) / 4, 0, width / 4, height);
  // Stylised 11-point maple leaf
  const cx = width / 2;
  const cy = height / 2;
  const s = height / 2.6;
  const pts: [number, number][] = [
    [0, -1], [0.14, -0.62], [0.42, -0.72], [0.34, -0.36], [0.72, -0.5], [0.58, -0.12], [0.92, 0.02], [0.44, 0.34], [0.5, 0.56], [0.1, 0.4], [0.08, 1.0],
  ];
  ctx.beginPath();
  const all = [...pts, ...[...pts].reverse().slice(1).map(([x, y]) => [-x, y] as [number, number])];
  all.forEach(([x, y], i) => {
    const px = cx + x * s;
    const py = cy + y * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
  return c;
}
