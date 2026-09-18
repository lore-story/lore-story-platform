import { useEffect, useState } from 'react'
import { ImageOff, LoaderCircle } from 'lucide-react'
import { SCENE_TYPES } from './model'

function SceneImage({ media, resolveMedia }) {
  const [state,setState]=useState({loading:!!(media?.url||media?.path),url:'',failed:false})
  useEffect(()=>{let alive=true;setState({loading:!!(media?.url||media?.path),url:'',failed:false});Promise.resolve(resolveMedia?resolveMedia(media):media?.url||'').then(url=>alive&&setState({loading:false,url,failed:!url})).catch(()=>alive&&setState({loading:false,url:'',failed:true}));return()=>{alive=false}},[media?.url,media?.path,resolveMedia])
  if(state.loading)return <div className="scene-image-placeholder" role="status"><LoaderCircle className="spin"/><span>Bild wird geladen …</span></div>
  if(!state.url||state.failed)return <div className="scene-image-placeholder"><ImageOff/><span>{media?.url||media?.path?'Bild konnte nicht geladen werden':'Noch kein Bild ausgewählt'}</span></div>
  return <img src={state.url} alt={media.alt||'Szenenbild'} onError={()=>setState(current=>({...current,failed:true}))}/>
}
export default function ScenePreview({ scene, editing=false, onChange=()=>{}, size='desktop', resolveMedia, onContinue }) {
  const setContent=patch=>onChange({...scene,content:{...scene.content,...patch}}), key=scene.scene_type==='assignment'?'assignment':'message', label=scene.scene_type==='assignment'?'Arbeitsauftrag':'Nachricht', primary=scene.content[key]||'', media=scene.content.media
  const hasMedia=media?.url||media?.path
  return <article className={`scene-preview scene-kind-${scene.scene_type} scene-layout-${scene.layout_template} preview-${size} dim-${scene.settings.dimming}`} style={{'--scene-accent':scene.settings.accent,textAlign:scene.settings.textAlign}} data-testid="scene-preview">
    <header><small>{SCENE_TYPES[scene.scene_type]}</small>{editing?<input aria-label="Szenentitel" value={scene.title} onChange={e=>onChange({...scene,title:e.target.value})}/>:<h2>{scene.title}</h2>}</header>
    <div className="scene-preview-grid"><section className="scene-copy">
      {scene.scene_type==='narrative'&&(editing?<input aria-label="Sprecherbezeichnung" placeholder="Sprecher:in" value={scene.content.speaker||''} onChange={e=>setContent({speaker:e.target.value})}/>:scene.content.speaker&&<strong className="speaker">{scene.content.speaker}</strong>)}
      {editing?<label>{label}<textarea aria-label={label} rows="6" value={primary} onChange={e=>setContent({[key]:e.target.value})}/></label>:<p className="scene-primary">{primary||'Noch kein Inhalt'}</p>}
      {scene.scene_type==='assignment'&&<div className="assignment-extras">{['material','socialForm','time','help'].map(field=>editing?<input key={field} aria-label={{material:'Material',socialForm:'Sozialform',time:'Zeit',help:'Hilfestellung'}[field]} placeholder={{material:'Material',socialForm:'Sozialform',time:'Zeit',help:'Hilfestellung'}[field]} value={scene.content[field]||''} onChange={e=>setContent({[field]:e.target.value})}/>:scene.content[field]&&<span key={field}>{scene.content[field]}</span>)}</div>}
      {scene.scene_type==='transition'&&(editing?<input aria-label="Bereitschaftsschritt" placeholder="Bereitschaftsschritt" value={scene.content.readiness||''} onChange={e=>setContent({readiness:e.target.value})}/>:scene.content.readiness&&<strong className="readiness">{scene.content.readiness}</strong>)}
    </section><figure className={!hasMedia?'empty-media':''}><SceneImage media={media} resolveMedia={resolveMedia}/>{scene.content.caption&&<figcaption>{scene.content.caption}</figcaption>}</figure></div>
    {scene.scene_type==='transition'&&scene.settings.manualContinue&&<button className="scene-continue" type="button" onClick={onContinue}>Weiter</button>}
  </article>
}
