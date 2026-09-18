import { BookOpen, ClipboardList, Route } from 'lucide-react'
import { changeSceneType, SCENE_TYPES } from './model'

const descriptions = { narrative: 'Führt durch Handlung und Dialog.', assignment: 'Zeigt eine konkrete Aufgabe für die Klasse.', transition: 'Sammelt die Gruppe und führt weiter.' }
const icons = { narrative: BookOpen, assignment: ClipboardList, transition: Route }
export default function SceneTypeSelector({ scene, onChange }) {
  const choose = type => {
    if (type === scene.scene_type) return
    const hasText = Object.values(scene.content || {}).some(value => typeof value === 'string' && value.trim())
    if (hasText && !window.confirm('Szenentyp wechseln? Deine bisherigen Inhalte bleiben erhalten.')) return
    onChange(changeSceneType(scene, type))
  }
  return <fieldset className="type-selector"><legend>Szenentyp</legend>{Object.entries(SCENE_TYPES).map(([type,label])=>{const Icon=icons[type];return <button type="button" className={scene.scene_type===type?'active':''} aria-pressed={scene.scene_type===type} key={type} onClick={()=>choose(type)}><Icon/><span><strong>{label}</strong><small>{descriptions[type]}</small></span></button>})}</fieldset>
}
