import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { validateMediaFile } from './model'
export default function MediaUpload({ storage, onUploaded }) {
  const input=useRef(), [progress,setProgress]=useState(0), [error,setError]=useState(''), [busy,setBusy]=useState(false)
  const choose=async event=>{const file=event.target.files?.[0];if(!file)return;const invalid=validateMediaFile(file);if(invalid){setError(invalid);event.target.value='';return}setBusy(true);setError('');try{const item=await storage.upload(file,file.name,setProgress);onUploaded(item)}catch(cause){setError(cause.message)}finally{setBusy(false);event.target.value=''}}
  return <div className="media-upload"><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={choose}/><button type="button" disabled={busy} onClick={()=>input.current.click()}><Upload/> {busy?'Medium wird hochgeladen …':'Bild oder Video hochladen'}</button>{busy&&<progress value={progress} max="100">{progress}%</progress>}{error&&<small role="alert">{error}</small>}<small>Bilder max. 10 MB · MP4/WebM max. 100 MB</small></div>
}
