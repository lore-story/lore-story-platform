export const STORY_SLUG = 'lore-astra-notruf-aus-dem-all'
export const STORY_TITLE = 'Notruf aus dem All'
export const CALLSIGNS = Object.freeze(['Astrofuchs','Blitzbär','Cosmo','Dämmerfalke','Echowolf','Flinkstern','Funkelfisch','Galaxie','Himmelsluchs','Ionenigel','Komet','Lichtlöwe','Meteor','Mondmotte','Nebelpanda','Nova','Orbit','Polarstern','Quasar','Rakete','Saturn','Sirius','Solaris','Sternenhirsch','Sternenkatze','Supernova','Titan','Umlauf','Vega','Weltraumwal'])
export const missionErrorMessage = error => ({ INVALID_CODE:'Dieser Sitzungscode ist ungültig oder die Mission ist beendet.', JOINING_CLOSED:'Der Zugang zu dieser Mission ist gerade geschlossen.', CALLSIGN_TAKEN:'Dieses Rufzeichen wurde gerade vergeben. Bitte wähle ein anderes.', INVALID_CALLSIGN:'Dieses Rufzeichen kann nicht verwendet werden.', PARTICIPANT_REMOVED:'Du wurdest aus dieser Mission entfernt. Bitte wende dich an die Lehrkraft.', ANONYMOUS_AUTH_REQUIRED:'Der anonyme Zugang konnte nicht hergestellt werden.' }[error?.message] || 'Supabase ist vorübergehend nicht erreichbar. Bitte versuche es erneut.')
export function createMissionRepository(client, user) {
 const teacherId=user.id
 return {
  async list(){const {data,error}=await client.from('mission_sessions').select('id,story_slug,title,join_code,status,joining_open,current_scene_id,created_at,started_at,completed_at,updated_at').eq('story_slug',STORY_SLUG).order('created_at',{ascending:false});if(error)throw error;return data||[]},
  async create(loreboardId=null){const {data,error}=await client.from('mission_sessions').insert({teacher_id:teacherId,loreboard_id:loreboardId,story_slug:STORY_SLUG,title:STORY_TITLE,state:{stage:1}}).select('id,story_slug,title,join_code,status,joining_open,current_scene_id,created_at,started_at,completed_at,updated_at').single();if(error)throw error;return data},
  async update(id,patch){const {data,error}=await client.from('mission_sessions').update(patch).eq('id',id).neq('status','completed').select('id,story_slug,title,join_code,status,joining_open,current_scene_id,created_at,started_at,completed_at,updated_at').single();if(error)throw error;return data},
  async participants(id){const {data,error}=await client.from('mission_participants').select('*').eq('session_id',id).order('callsign');if(error)throw error;return data||[]},
  async remove(id){const {error}=await client.from('mission_participants').update({status:'removed',removed_at:new Date().toISOString(),ready_scene_id:null}).eq('id',id);if(error)throw error},
  subscribe(id,onChange,onStatus){const channel=client.channel(`mission:${id}`).on('postgres_changes',{event:'*',schema:'public',table:'mission_sessions',filter:`id=eq.${id}`},onChange).on('postgres_changes',{event:'*',schema:'public',table:'mission_participants',filter:`session_id=eq.${id}`},onChange).subscribe(onStatus);return()=>client.removeChannel(channel)}
 }
}
export const readyCount=(participants,scene)=>participants.filter(p=>p.status!=='removed'&&p.ready_scene_id===scene).length
