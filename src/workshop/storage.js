import { MEDIA_BUCKET, validateImageFile } from './model'

const safeName = name => name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
export function createMissionMediaStorage(supabase, userId) {
  const signedUrl = async path => (await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600)).data?.signedUrl || ''
  return {
    async list() {
      const { data, error } = await supabase.from('mission_media').select('*').order('created_at', { ascending: false })
      if (error) throw new Error('Die Medien konnten nicht geladen werden.')
      return Promise.all((data || []).map(async item => ({ ...item, url: await signedUrl(item.storage_path) })))
    },
    async resolve(media) { return media?.kind === 'storage' && media.path ? signedUrl(media.path) : media?.url || '' },
    async upload(file, title = file.name, onProgress = () => {}) {
      const invalid = validateImageFile(file); if (invalid) throw new Error(invalid)
      const path = `${userId}/${globalThis.crypto.randomUUID()}-${safeName(file.name)}`
      onProgress(10)
      const result = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
      if (result.error) throw new Error('Upload fehlgeschlagen. Bitte versuche es erneut.')
      onProgress(75)
      const { data, error } = await supabase.from('mission_media').insert({ owner_id: userId, storage_path: path, file_name: file.name, title, mime_type: file.type, byte_size: file.size }).select().single()
      if (error) { await supabase.storage.from(MEDIA_BUCKET).remove([path]); throw new Error('Das Medium konnte nicht gespeichert werden.') }
      onProgress(100); return { ...data, url: await signedUrl(path) }
    },
    async remove(item) {
      const storage = await supabase.storage.from(MEDIA_BUCKET).remove([item.storage_path]); if (storage.error) throw new Error('Das Bild konnte nicht gelöscht werden.')
      const record = await supabase.from('mission_media').delete().eq('id', item.id); if (record.error) throw new Error('Der Medieneintrag konnte nicht gelöscht werden.')
    },
  }
}
