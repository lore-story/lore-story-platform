import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { SCENE_TYPES } from './model'

export default function ScenePreview({ scene, editing = false, onChange = () => {}, size = 'desktop' }) {
  const [imageFailed, setImageFailed] = useState(false)
  const setContent = patch => onChange({ ...scene, content: { ...scene.content, ...patch } })
  const primaryKey = scene.scene_type === 'assignment' ? 'assignment' : 'message'
  const primaryLabel = scene.scene_type === 'assignment' ? 'Arbeitsauftrag' : 'Nachricht'
  const primary = scene.content[primaryKey] || ''
  const tooLong = primary.length > (scene.scene_type === 'assignment' ? 700 : 420) || primary.split('\n').length > 12
  const medium = scene.content.media
  const image = medium?.url && !imageFailed ? <img src={medium.url} alt={medium.alt || ''} onLoad={() => setImageFailed(false)} onError={() => setImageFailed(true)}/> : <div className="scene-image-placeholder"><ImageOff/><span>{medium?.url ? 'Bild konnte nicht geladen werden' : 'Optionales Bild'}</span></div>
  return <article className={`scene-preview scene-layout-${scene.layout_template} preview-${size} dim-${scene.settings.dimming}`} style={{ '--scene-accent': scene.settings.accent, textAlign: scene.settings.textAlign }} data-testid="scene-preview">
    <header><small>LEHRERTAFEL · {SCENE_TYPES[scene.scene_type]}</small>{editing ? <input aria-label="Szenentitel" value={scene.title} maxLength="100" onChange={event => onChange({ ...scene, title: event.target.value })}/> : <h2>{scene.title}</h2>}</header>
    <div className="scene-preview-grid">
      <section className="scene-copy">
        {scene.scene_type === 'narrative' && scene.settings.showOptional && (editing ? <input aria-label="Sprecherbezeichnung" placeholder="Sprecher:in (optional)" value={scene.content.speaker || ''} onChange={event => setContent({ speaker: event.target.value })}/> : scene.content.speaker && <strong>{scene.content.speaker}</strong>)}
        {editing ? <label>{primaryLabel}<textarea aria-label={primaryLabel} rows="7" value={primary} onChange={event => setContent({ [primaryKey]: event.target.value })}/><small>{primary.length} Zeichen · empfohlen: höchstens {scene.scene_type === 'assignment' ? 700 : 420} Zeichen und 12 Zeilen</small></label> : <p className="scene-primary">{primary || 'Noch kein Inhalt'}</p>}
        {tooLong && <p className="content-warning" role="alert">Der Inhalt ist für die Tafel sehr lang. Bitte kürzen oder auf mehrere Szenen verteilen.</p>}
        {scene.scene_type === 'assignment' && scene.settings.showOptional && <div className="assignment-extras">{['material','socialForm','time','help'].map(key => editing ? <input key={key} aria-label={{material:'Material',socialForm:'Sozialform',time:'Zeitangabe',help:'Hilfestellung'}[key]} placeholder={{material:'Material (optional)',socialForm:'Sozialform (optional)',time:'Zeit (optional)',help:'Hilfestellung (optional)'}[key]} value={scene.content[key] || ''} onChange={event => setContent({ [key]: event.target.value })}/> : scene.content[key] && <span key={key}>{scene.content[key]}</span>)}</div>}
        {scene.scene_type === 'transition' && scene.settings.showOptional && (editing ? <input aria-label="Bereitschaftsschritt" placeholder="Bereitschaftsschritt (optional)" value={scene.content.readiness || ''} onChange={event => setContent({ readiness: event.target.value })}/> : scene.content.readiness && <strong>{scene.content.readiness}</strong>)}
      </section>
      {scene.scene_type === 'narrative' && scene.layout_template !== 'text' && <figure>{image}</figure>}
    </div>
    {scene.scene_type === 'transition' && scene.settings.manualContinue && <button className="scene-continue" type="button">Weiter</button>}
  </article>
}
