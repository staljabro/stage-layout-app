export const isPublishedItem = (item) => item.stageplotPublished === true;
export const isEquipmentItem = (item) => !item.editor?.advancedShapeRole;

export const unpublishItem = (item) => ({ ...item, stageplotPublished: false });
