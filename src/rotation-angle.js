export const wholeDegrees=value=>Number.isFinite(Number(value))?Math.round(Number(value))||0:0
export function wholeDegreesWithin(value,min=-Infinity,max=Infinity) {
  return Math.max(Math.ceil(min),Math.min(Math.floor(max),wholeDegrees(value)))
}
