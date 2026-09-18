import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { validateImageFile } from './model'
export default function MediaUpload({ storage, onUploaded }) {
  const input=useRef(), [progress,setProgress]=useState(0), [error,setError]=useState(''), [busy,setBusy]=useState(false)
  const choose=async event=>{const file=event.target.files?.[0];if(!file)return;const invalid=validateImageFile(file);if(invalid){setError(invalid);event.target.value='';return}setBusy(true);setError('');try{const item=await storage.upload(file,file.name,setProgress);onUploaded(item)}catch(cause){setError(cause.message)}finally{setBusy(false);event.target.value=''}}
  return <div className="media-upload"><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={choose}/><button type="button" disabled={busy} onClick={()=>input.current.click()}><Upload/> {busy?'Bild wird hochgeladen …':'Bild hochladen'}</button>{busy&&<progress value={progress} max="100">{progress}%</progress>}{error&&<small role="alert">{error}</small>}<small>JPEG, PNG oder WebP · maximal 10 MB</small></div>
}
