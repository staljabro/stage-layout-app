export const LIBRARY_PROFILES = ['empire', 'external'];
export const assetProfiles = (item) => Array.isArray(item.profiles) ? item.profiles :
  item.schema === 'stageplot-stage@1' || item.stageplotPublished === true ? ['empire'] : [];
export const belongsToProfile = (item, profile) => assetProfiles(item).includes(profile);
export const isPublishedItem = (item) => assetProfiles(item).length > 0;
export const validProfiles = (profiles) => profiles === undefined ||
  (Array.isArray(profiles) && profiles.every(profile => LIBRARY_PROFILES.includes(profile)) && new Set(profiles).size === profiles.length);
export const withProfile = (item, profile, enabled) => ({
  ...item, profiles: LIBRARY_PROFILES.filter(candidate => candidate === profile ? enabled : belongsToProfile(item, candidate)),
});
export const profileItem = (item, profile) => profile === 'external' ? { ...item, stockQuantity: null } : item;
export const isEquipmentItem = (item) => !item.editor?.advancedShapeRole;

export const unpublishItem = (item) => ({ ...item, profiles: [], stageplotPublished: false });
