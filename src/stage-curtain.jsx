import {curtainPath,normaliseCurtain} from './stage-curtain.js'

export function CurtainArtwork({curtain,...props}) {
  const line=normaliseCurtain(curtain)
  return <g {...props} transform={`translate(${line.x} ${line.y}) rotate(${line.rotation})`}><path className="curtain-wave" d={curtainPath(line)} fill="none" stroke={line.color} strokeWidth={line.thickness} strokeOpacity={line.opacity} strokeLinecap="round" strokeLinejoin="round"/></g>
}
