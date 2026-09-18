import { ACCENTS, LAYOUTS, SCENE_TYPES } from './model'

export default function PropertiesPanel({ scene, onChange }) {
  const update = patch => onChange({ ...scene, ...patch })
  const setting = patch => update({ settings: { ...scene.settings, ...patch } })
  const content = patch => update({ content: { ...scene.content, ...patch } })
  const media = scene.content.media || { kind: 'external-url', url: '', alt: '' }
  return <aside className="workshop-properties" aria-label="Szeneneigenschaften"><h2>Eigenschaften</h2>
    <label>Szenentyp<select value={scene.scene_type} onChange={event => update({ scene_type: event.target.value })}>{Object.entries(SCENE_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <fieldset><legend>Layoutvorlage</legend>{Object.entries(LAYOUTS).map(([value,label])=><label className="radio-tile" key={value}><input type="radio" name="layout" checked={scene.layout_template === value} onChange={() => update({ layout_template: value })}/>{label}</label>)}</fieldset>
    <fieldset><legend>Akzentfarbe</legend><div className="accent-palette">{ACCENTS.map(value=><button aria-label={`Akzentfarbe ${value}`} aria-pressed={scene.settings.accent === value} type="button" key={value} style={{ background: value }} onClick={() => setting({ accent: value })}/>)}</div></fieldset>
    <label>Textausrichtung<select value={scene.settings.textAlign} onChange={event => setting({ textAlign: event.target.value })}><option value="left">Links</option><option value="center">Zentriert</option></select></label>
    <label>Hintergrund<select value={scene.settings.dimming} onChange={event => setting({ dimming: event.target.value })}><option value="light">Leicht</option><option value="medium">Mittel</option><option value="strong">Stark</option></select></label>
    <label className="check-row"><input type="checkbox" checked={scene.settings.showOptional} onChange={event => setting({ showOptional: event.target.checked })}/> Optionale Felder anzeigen</label>
    {scene.scene_type === 'transition' && <label className="check-row"><input type="checkbox" checked={scene.settings.manualContinue} onChange={event => setting({ manualContinue: event.target.checked })}/> Manuellen Weiter-Button zeigen</label>}
    {scene.scene_type === 'narrative' && <fieldset><legend>Öffentliches Bild</legend><label>Medien-URL<input type="url" value={media.url} placeholder="https://…" onChange={event => content({ media: { ...media, url: event.target.value } })}/></label><label>Alternativtext<input value={media.alt} onChange={event => content({ media: { ...media, alt: event.target.value } })}/></label>{media.url && <button type="button" onClick={() => content({ media: { ...media, url: '', alt: '' } })}>Bild entfernen</button>}<small>Nur öffentliche HTTPS-Adressen. Upload folgt in einer späteren Stufe.</small></fieldset>}
  </aside>
}
