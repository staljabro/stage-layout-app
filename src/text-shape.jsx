import { textLayout } from './text-layout.js';
export function TextArtwork({ item }) {
  const layout = textLayout(item);
  return <text fill={item.fill} stroke="none" fontFamily="Arial, sans-serif" fontSize={item.fontSize} fontWeight={item.bold ? 'bold' : 'normal'} fontStyle={item.italic ? 'italic' : 'normal'} xmlSpace="preserve">{layout.lines.map((line, index) => <tspan key={index} x={layout.offsets[index] + (item.textAlign === 'right' ? layout.width - layout.widths[index] : item.textAlign === 'center' ? (layout.width - layout.widths[index]) / 2 : 0)} y={layout.baseline + index * layout.step}>{line || ' '}</tspan>)}</text>;
}
