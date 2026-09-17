export const selectionBox = (start, end) => ({ x: Math.min(start.x,end.x), y: Math.min(start.y,end.y), right: Math.max(start.x,end.x), bottom: Math.max(start.y,end.y) });
export const containsBounds = (box,bounds) => Boolean(bounds && bounds.x >= box.x && bounds.y >= box.y && bounds.right <= box.right && bounds.bottom <= box.bottom);
export function enclosedItems(items, box, getBounds) {
  return items.filter(item => {
    const members = item.editorGroupId ? items.filter(member=>member.editorGroupId===item.editorGroupId) : [item];
    return members.every(member=>containsBounds(box,getBounds(member)));
  }).map(item=>item.id);
}
