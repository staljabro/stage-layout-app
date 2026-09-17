const FONT = 'Arial, sans-serif';
let context;
export function textLayout(item) {
  context ||= document.createElement('canvas').getContext('2d');
  context.font = `${item.italic ? 'italic ' : ''}${item.bold ? 'bold ' : ''}100px ${FONT}`;
  const lines = String(item.text ?? 'Text').split('\n');
  const metrics = lines.map(line => context.measureText(line || ' '));
  const scale = (item.fontSize || .2) / 100;
  const ascent = Math.max(...metrics.map(m => m.actualBoundingBoxAscent), 0);
  const descent = Math.max(...metrics.map(m => m.actualBoundingBoxDescent), 0);
  const offsets = metrics.map(m => Math.max(0, m.actualBoundingBoxLeft) * scale);
  const widths = metrics.map((m,index) => Math.max(m.width, m.actualBoundingBoxRight) * scale + offsets[index]);
  const width = Math.max(.01, ...widths);
  const step = (item.fontSize || .2) * (item.lineSpacing || 1.2);
  return { lines, widths, offsets, width, height: Math.max(.01, (ascent + descent) * scale + (lines.length - 1) * step), baseline: ascent * scale, step };
}
export function sizeText(item) {
  const { width, height } = textLayout(item);
  return { ...item, width, height };
}
export function textSvg(item) {
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const layout = textLayout(item);
  return `<text fill="${escape(item.fill)}" stroke="none" font-family="${FONT}" font-size="${item.fontSize}" font-weight="${item.bold ? 'bold' : 'normal'}" font-style="${item.italic ? 'italic' : 'normal'}" xml:space="preserve">${layout.lines.map((line,index) => `<tspan x="${layout.offsets[index] + (item.textAlign === 'right' ? layout.width - layout.widths[index] : item.textAlign === 'center' ? (layout.width - layout.widths[index])/2 : 0)}" y="${layout.baseline + index*layout.step}">${escape(line || ' ')}</tspan>`).join('')}</text>`;
}
