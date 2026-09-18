export const PROJECT_SCHEMA_VERSION = 2
export const PROJECT_STATUSES = Object.freeze({ draft: 'Entwurf', review: 'Bereit zur Prüfung', published: 'Veröffentlicht' })
export const AUDIENCE_LEVELS = Object.freeze({ 'class-1-2': 'Klasse 1–2', 'class-3-6': 'Klasse 3–6', 'class-7-12': 'Klasse 7–12', custom: 'Benutzerdefiniert' })
export const SCENE_TYPES = Object.freeze({ narrative: 'Erzählung', assignment: 'Lernauftrag', transition: 'Übergang' })
export const LAYOUTS = Object.freeze({ text: 'Fokus: Text', media: 'Fokus: Medium', split: 'Geteilt: Text und Medium' })
export const ACCENTS = ['#35d8f3', '#ff9d3b', '#7fc69f', '#ad96e5']
export const MEDIA_BUCKET = 'mission-draft-media'
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm']
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024

export function validateMediaFile(file) {
  if (!file) return 'Bitte wähle eine Datei.'
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return file.size > MAX_IMAGE_BYTES ? 'Das Bild darf höchstens 10 MB groß sein.' : ''
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return file.size > MAX_VIDEO_BYTES ? 'Das Video darf höchstens 100 MB groß sein.' : ''
  return 'Bitte wähle eine JPEG-, PNG-, WebP-, MP4- oder WebM-Datei.'
}

export function validateImageFile(file) {
  if (!file || !ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Bitte wähle eine JPEG-, PNG- oder WebP-Datei.'
  if (file.size > MAX_IMAGE_BYTES) return 'Das Bild darf höchstens 10 MB groß sein.'
  return ''
}

export function normalizeMediaPresentation(media={}) {
  const normalized={ fit:'cover',positionX:50,positionY:50,zoom:1,autoplay:false,loop:false,playback:'manual',muted:true,...media }
  return { ...normalized,fit:normalized.fit==='contain'?'contain':'cover',positionX:Math.max(0,Math.min(100,Number(normalized.positionX)||0)),positionY:Math.max(0,Math.min(100,Number(normalized.positionY)||0)),zoom:Math.max(1,Math.min(2,Number(normalized.zoom)||1)) }
}

export function changeSceneType(scene, sceneType) {
  if (!SCENE_TYPES[sceneType]) return scene
  return { ...scene, scene_type: sceneType, content: { ...createScene(0, sceneType).content, ...scene.content } }
}

export const createScene = (position = 0, type = 'narrative') => ({
  id: globalThis.crypto.randomUUID(), position, title: `Szene ${position + 1}`, scene_type: type, layout_template: 'text',
  content: { message: '', speaker: '', assignment: '', material: '', socialForm: '', time: '', help: '', readiness: '', media: normalizeMediaPresentation({ kind: 'external-url', url: '', alt: '', type:'image' }) },
  settings: { accent: ACCENTS[0], textAlign: 'left', dimming: 'medium', showOptional: true, manualContinue: false },
})

export const createProject = metadata => ({
  id: globalThis.crypto.randomUUID(), title: metadata.title.trim(), description: metadata.description.trim(), status: 'draft',
  audience_level: metadata.audience_level, availability_type: metadata.availability_type,
  world_id: metadata.availability_type === 'world' ? metadata.world_id : null,
  subject: metadata.subject?.trim() || null, estimated_minutes: metadata.estimated_minutes ? Number(metadata.estimated_minutes) : null,
  schema_version: PROJECT_SCHEMA_VERSION, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), scenes: [createScene()],
})

export const normalizePositions = scenes => scenes.map((scene, position) => ({ ...scene, position }))
export const addScene = scenes => normalizePositions([...scenes, createScene(scenes.length)])
export const duplicateScene = (scenes, index) => normalizePositions([...scenes.slice(0, index + 1), { ...globalThis.structuredClone(scenes[index]), id: globalThis.crypto.randomUUID(), title: `${scenes[index].title} (Kopie)` }, ...scenes.slice(index + 1)])
export const deleteScene = (scenes, index) => scenes.length === 1 ? scenes : normalizePositions(scenes.filter((_, item) => item !== index))
export const moveScene = (scenes, index, direction) => { const target = index + direction; if (target < 0 || target >= scenes.length) return scenes; const next = [...scenes]; [next[index], next[target]] = [next[target], next[index]]; return normalizePositions(next) }

export function validateMetadata(value) {
  const errors = {}
  if (!value.title?.trim()) errors.title = 'Bitte gib der Mission einen Titel.'
  if (!AUDIENCE_LEVELS[value.audience_level]) errors.audience_level = 'Bitte wähle eine Zielgruppe.'
  if (!['free', 'world'].includes(value.availability_type)) errors.availability_type = 'Bitte wähle eine Zuordnung.'
  if (value.availability_type === 'world' && !value.world_id) errors.world_id = 'Bitte wähle eine Welt.'
  if (value.estimated_minutes && (Number(value.estimated_minutes) < 1 || Number(value.estimated_minutes) > 600)) errors.estimated_minutes = 'Die Dauer muss zwischen 1 und 600 Minuten liegen.'
  return errors
}
