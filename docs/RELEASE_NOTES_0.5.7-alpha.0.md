# Stageplot 0.5.7-alpha.0

This release concentrates on safer layout editing, clearer review history and deployment reliability.

## Layout editing

- Stage authors can mark installed equipment as editable in layouts. Layout users must explicitly enable **Edit stage assets** before moving it; installed assets remain non-deletable and authored groups stay together.
- Editable Stage and Overhead assets appear in the layout layer list with default, moved and hidden status. Selected or all editable assets can be reset to their source positions.
- Multi-item equipment controls now align every edge or centre and distribute horizontally or vertically. Mixed-size items use equal physical gaps and equipment groups remain rigid.
- The toolbar includes a mode-aware keyboard shortcut reference, also opened with `?`.

## Validation and revisions

- Live layout checks report boundary violations, equipment collisions, stock shortfalls, moved installed assets, hidden stage parts and outdated source stages.
- The editor summarises unsaved equipment, installed-asset, visibility and notes changes.
- **Save version** creates a labelled layout milestone. Saved revision history shows what changed, marks the current revision and previews the effect of restoration before creating a new recoverable revision.

## Libraries and ownership

- App Owners can permanently remove obsolete archived equipment from **Import & restore** without affecting published or owned equipment.

## Quality and deployment

- Large-layout validation now rejects most collision pairs using rotated bounding boxes before detailed polygon checks.
- The editor contains dense controls on tablet-width screens and improves dialog focus management, focus visibility, toolbar labels and live announcements.
- Browser coverage includes editable installed assets, layout arrangement tools, revision previews, shortcut focus and responsive containment.
- The container build copies every API runtime dependency, and the GitHub workflow verifies the application before publishing the frontend and API images.
