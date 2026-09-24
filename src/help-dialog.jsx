import { useEffect } from 'react'
import { APP_VERSION, GITHUB_REPOSITORY_URL } from './version.js'

export function HelpDialog({ title, subtitle, onClose, children }) {
  useEffect(()=>{
    const close=event=>{if(event.key==='Escape')onClose()}
    window.addEventListener('keydown',close)
    return ()=>window.removeEventListener('keydown',close)
  },[onClose])
  return <div className="help-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-dialog-title">
      <div className="help-header"><div><p>HELP &amp; GUIDE</p><h2 id="help-dialog-title">{title}</h2>{subtitle&&<span>{subtitle}</span>}</div><button autoFocus aria-label="Close help" onClick={onClose}>&times;</button></div>
      <div className="help-body">{children}</div>
    </section>
  </div>
}

export function StageplotHelp({ onClose }) {
  return <HelpDialog title="Using Stageplot" subtitle="Build, validate, save and share a top-down stage layout." onClose={onClose}>
    <section><h3>1. Start a project</h3><p>Choose a stage from the opening window or enter a custom rectangular space. A stage-locked link only offers its designated stage. <b>New project</b> clears the equipment and returns to the stage picker; <b>Clear stage</b> removes equipment but keeps the current stage.</p></section>
    <section><h3>2. Navigate the canvas</h3><ul><li>Scroll over the canvas to zoom toward the pointer.</li><li>Middle-drag to pan. Use <b>Fit stage to viewport</b> to recenter.</li><li>Left-drag empty canvas to select only items fully enclosed by the marquee.</li></ul></section>
    <section><h3>3. Add and arrange equipment</h3><p>Click equipment in the lower library to place it at the viewport centre, or drag it to an exact location. Drag an item to move it and use its lower rotation handle to turn it. Additional configured handles rotate articulated parts such as stand tops.</p><p>The <b>Custom</b> tab contains project-only tools. Choose <b>Custom staging - Prostage</b>, then drag across the canvas to draw a deck in whole-metre increments. Its inspector controls dimensions, height annotation and colours. Drag or click <b>Custom Text</b> to add an editable label.</p><p>Collision-aware dragging stops at the nearest valid position and slides along obstacles. Items configured with snap points snap corner-to-corner when points are within 30 cm.</p></section>
    <section><h3>4. Selection and layers</h3><ul><li>Click a layer to select it. Shift-click layers to add or remove them from the selection.</li><li>Create folders at the bottom of the Layers panel and double-click a folder name to rename it inline. Drop a selected layer onto a folder to move the complete selection, reorder children, collapse the folder, or drag the whole folder through the stack.</li><li>Click a folder name to select all its contents; Shift-click to add or remove the folder contents.</li><li>Use the eye beside a layer or folder to hide it while working behind it. Hidden items retain collision.</li><li>Staging-group equipment is placed at the back of the stack by default.</li></ul></section>
    <section><h3>5. Inspector controls</h3><p>Select an item to edit its name, position, rotation, label, articulated controls, equipment-collision override and any toggleable artwork parts. A multi-selection exposes shared visibility, label, collision and compatible toggleable-part settings. An X means selected items currently have different values; clicking it turns the setting on for all.</p><p>With nothing selected, the canvas inspector contains optional stage-part visibility, stage dimensions, viewport fitting, stage links and global controls for equipment collision, stage/zone collision and corner snapping. Hiding a toggleable solid stage part also disables its collision. Turn off a placed item’s equipment collision to put equipment on top of decks without disabling stage or visible solid-zone boundaries.</p></section>
    <section><h3>6. Save and export</h3><ul><li><b>Save</b> downloads a small <code>.stageplot</code> project containing asset references and placement settings.</li><li><b>Open</b> restores a project using the latest library artwork. Missing assets are omitted.</li><li>If enabled collision items overlap or lie outside the usable stage, Save warns before continuing.</li><li><b>Export PDF</b> opens the print dialog; choose Save as PDF.</li><li>The current tab is recovered after an accidental refresh, but a downloaded project is the durable copy.</li></ul></section>
    <section><h3>Keyboard</h3><p><b>Delete</b> or <b>Backspace</b> removes the current selection. The toolbar Undo button restores recent editing changes.</p></section>
    <HelpFooter />
  </HelpDialog>
}

export function StudioHelp({ onClose }) {
  return <HelpDialog title="Using Shape Studio" subtitle="Maintain the equipment and stage libraries used by Stageplot." onClose={onClose}>
    <section><h3>1. Equipment or stage</h3><p>Choose <b>New item</b>, then create equipment or a stage. Equipment fields display centimetres; stage editing uses metres. Canvas dimensions describe the real-world footprint and do not scale existing artwork.</p></section>
    <section><h3>2. Canvas navigation and selection</h3><ul><li>Scroll to zoom and middle-drag to pan.</li><li>Left-drag empty canvas to marquee-select fully enclosed assets.</li><li>Use Standard snapping for 10 cm increments, Advanced for 1 cm, or turn grid snapping off.</li><li>Delete or Backspace removes the current selection. Undo retains the last ten editing states.</li></ul></section>
    <section><h3>3. Build equipment artwork</h3><p>Add basic or advanced vector shapes from the left palette. Select a layer to edit its dimensions, position, colours, rotation and geometry. Rectangles, rounded rectangles, lines and triangles can be converted to editable vectors. Custom vectors are drawn point by point; Escape finishes the current path.</p><p>Group selected layers when they should transform together. Rotation parts add independent Stageplot rotation controls. A tripod-based rotation part uses the tripod convergence point as its pivot.</p></section>
    <section><h3>4. Equipment behaviour</h3><ul><li><b>Physical collision shape</b> includes that layer in the item footprint.</li><li><b>Toggleable in Stageplot</b> gives each placed instance a show/hide control for that artwork layer. Hiding artwork does not alter collision.</li><li><b>Corner snapping in Stageplot</b> adds snap points to all four item-canvas corners. It is off by default.</li><li>Use clear layer names: these names appear in the client’s Toggleable parts section.</li></ul></section>
    <section><h3>5. Draw a custom stage</h3><p>Edit the main stage boundary by dragging its nodes. Shift-click a segment to insert a node. Ctrl-click a straight segment to convert it to a Point on Arc curve. Curves support Point on Arc, Smooth and Bezier modes. The main boundary defines the clipped Stageplot area.</p><p>Add zones for scenery and annotations. Aesthetic zones are visual only; Solid zones also block equipment; Label zones remain visible outside the main stage. Zones can use a single fill or adjustable two-colour diagonal stripes. Zones and text marked <b>Toggleable in Stageplot</b> receive a per-project visibility control. Background images can be moved, resized, cropped with Ctrl-drag, aspect-locked, reordered and locked.</p></section>
    <section><h3>6. Layers and locks</h3><p>The top asset in the left list renders highest. Drag assets to change stacking order. Locking an asset removes its canvas handles and prevents accidental selection. The main stage remains below other stage assets.</p></section>
    <section><h3>7. Save and maintain the library</h3><p>Name the design, choose an equipment group where appropriate, then save it. When a name or edited item conflicts, choose whether to update the existing stable asset ID or save a new item. Use <b>Save stage as</b> to preserve an existing stage and create a new version.</p><p><b>Library</b> opens saved equipment and stages for editing, renaming or deletion. Equipment must be published to appear in Stageplot; custom shapes remain reusable Studio building blocks and do not appear in the client library.</p></section>
    <HelpFooter />
  </HelpDialog>
}

function HelpFooter(){return <footer className="help-footer"><span>Version {APP_VERSION}</span><a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer">Report a bug or request a feature on GitHub</a></footer>}
