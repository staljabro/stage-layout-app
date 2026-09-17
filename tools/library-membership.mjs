export const isPublishedItem = (item) => item.stageplotPublished === true;

export const unpublishItem = (item) => ({ ...item, stageplotPublished: false });
