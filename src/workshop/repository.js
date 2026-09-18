import { normalizePositions } from './model'

const projectColumns = 'id,owner_id,title,description,status,audience_level,availability_type,world_id,subject,estimated_minutes,schema_version,created_at,updated_at'
const explain = () => new Error('Die Änderungen konnten gerade nicht gespeichert werden. Sie bleiben in diesem Fenster erhalten.')
const unwrap = ({ data, error }) => { if (error) throw explain(); return data }

export function createMissionProjectRepository(supabase) {
  return {
    async list() { return unwrap(await supabase.from('mission_projects').select(projectColumns).order('updated_at', { ascending: false })) || [] },
    async load(id) {
      const project = unwrap(await supabase.from('mission_projects').select(projectColumns).eq('id', id).single())
      const scenes = unwrap(await supabase.from('mission_scenes').select('*').eq('mission_project_id', id).order('position')) || []
      return { ...project, scenes }
    },
    async create(project) {
      const { scenes, ...row } = project
      const created = unwrap(await supabase.from('mission_projects').insert(row).select(projectColumns).single())
      unwrap(await supabase.from('mission_scenes').insert(scenes.map(({ id, ...scene }) => ({ ...scene, id, mission_project_id: created.id }))))
      return { ...created, scenes }
    },
    async save(project) {
      const { scenes } = project
      const row = { id: project.id, title: project.title, description: project.description, status: project.status, audience_level: project.audience_level, availability_type: project.availability_type, world_id: project.world_id, subject: project.subject, estimated_minutes: project.estimated_minutes, schema_version: project.schema_version }
      const saved = unwrap(await supabase.from('mission_projects').update({ ...row, updated_at: new Date().toISOString() }).eq('id', project.id).select(projectColumns).single())
      const normalized = normalizePositions(scenes)
      unwrap(await supabase.from('mission_scenes').delete().eq('mission_project_id', project.id))
      unwrap(await supabase.from('mission_scenes').insert(normalized.map(scene => ({ ...scene, mission_project_id: project.id }))))
      return { ...saved, scenes: normalized }
    },
    async remove(id) { unwrap(await supabase.from('mission_projects').delete().eq('id', id)) },
    async duplicate(id) {
      const source = await this.load(id)
      const copy = { ...source, id: globalThis.crypto.randomUUID(), title: `${source.title} (Kopie)`, status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), scenes: source.scenes.map(scene => ({ ...scene, id: globalThis.crypto.randomUUID() })) }
      delete copy.owner_id
      return this.create(copy)
    },
  }
}
