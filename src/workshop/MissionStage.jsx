import { useEffect, useRef, useState } from 'react'
import { ImageOff, LoaderCircle } from 'lucide-react'
import { SCENE_TYPES, normalizeMediaPresentation } from './model'
import { worldTokenStyle } from './worldTokens'

export function MissionMedia({media,resolveMedia,editable=false,onMediaChange=()=>{}}) {
  const normalized=normalizeMediaPresentation(media), [state,setState]=useState({loading:!!(media?.url||media?.path),url:'',failed:false}), start=useRef(null), video=normalized.type==='video'||normalized.mimeType?.startsWith('video/')
  useEffect(()=>{let alive=true;setState({loading:!!(media?.url||media?.path),url:'',failed:false});Promise.resolve(resolveMedia?resolveMedia(media):media?.url||'').then(url=>alive&&setState({loading:false,url,failed:!url})).catch(()=>alive&&setState({loading:false,url:'',failed:true}));return()=>{alive=false}},[media?.url,media?.path,resolveMedia])
  const position={objectFit:normalized.fit,objectPosition:`${normalized.positionX}% ${normalized.positionY}%`,transform:`scale(${normalized.zoom})`}
  const pointerDown=e=>{if(!editable)return;e.currentTarget.setPointerCapture(e.pointerId);start.current={x:e.clientX,y:e.clientY,px:normalized.positionX,py:normalized.positionY}}
  const pointerMove=e=>{if(!start.current)return;const box=e.currentTarget.getBoundingClientRect();onMediaChange({...normalized,positionX:Math.max(5,Math.min(95,start.current.px+(e.clientX-start.current.x)/box.width*100)),positionY:Math.max(5,Math.min(95,start.current.py+(e.clientY-start.current.y)/box.height*100))})}
  const pointerUp=()=>{start.current=null}
  if(state.loading)return <div className="scene-media-placeholder" role="status"><LoaderCircle className="spin"/><span>Medium wird geladen …</span></div>
  if(!state.url||state.failed)return <div className="scene-media-placeholder"><ImageOff/><span>{media?.url||media?.path?'Medium konnte nicht geladen werden':'Noch kein Medium ausgewählt'}</span></div>
  const common={src:state.url,style:position,onError:()=>setState(current=>({...current,failed:true}))}
  return <div className={`mission-media-viewport ${editable?'is-editable':''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label={editable?'Bildausschnitt verschieben':undefined} tabIndex={editable?0:undefined} onKeyDown={e=>{if(!editable||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();onMediaChange({...normalized,positionX:Math.max(5,Math.min(95,normalized.positionX+(e.key==='ArrowLeft'?-2:e.key==='ArrowRight'?2:0))),positionY:Math.max(5,Math.min(95,normalized.positionY+(e.key==='ArrowUp'?-2:e.key==='ArrowDown'?2:0)))})}}>{video?<Video {...common} media={normalized}/>:<img {...common} alt={media.alt||'Szenenbild'}/>}</div>
}

function Video({media,...props}) {
 const ref=useRef(), [reduced,setReduced]=useState(false)
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);update();query.addEventListener?.('change',update);return()=>query.removeEventListener?.('change',update)},[])
 return <video ref={ref} {...props} aria-label={media.alt||'Szenenvideo'} controls={media.playback==='manual'} autoPlay={media.autoplay&&!reduced} loop={media.loop} muted={media.autoplay||media.muted} playsInline poster={media.poster||undefined}/>
}

export default function MissionStage({scene,worldId='astra',resolveMedia,onContinue,editableMedia=false,onMediaChange}) {
 const key=scene.scene_type==='assignment'?'assignment':'message', media=scene.content.media, hasMedia=media?.url||media?.path
 return <div className="mission-stage-frame" data-testid="mission-stage-frame"><article className={`mission-stage scene-kind-${scene.scene_type} scene-layout-${scene.layout_template}`} style={worldTokenStyle(worldId)} data-testid="mission-stage" data-scene-structure={scene.scene_type}>
  <header><small>{SCENE_TYPES[scene.scene_type]}</small><h2>{scene.title}</h2></header>
  <div className="mission-stage-grid"><section className="scene-copy">
   {scene.scene_type==='narrative'&&scene.content.speaker&&<strong className="speaker">{scene.content.speaker}</strong>}
   <p className="scene-primary">{scene.content[key]||'Noch kein Inhalt'}</p>
   {scene.scene_type==='assignment'&&<div className="assignment-extras">{['material','socialForm','time','help'].map(field=>scene.content[field]&&<span key={field}>{scene.content[field]}</span>)}</div>}
   {scene.scene_type==='transition'&&scene.content.readiness&&<strong className="readiness">{scene.content.readiness}</strong>}
  </section><figure className={!hasMedia?'empty-media':''}><MissionMedia media={media} resolveMedia={resolveMedia} editable={editableMedia} onMediaChange={onMediaChange}/>{scene.content.caption&&<figcaption>{scene.content.caption}</figcaption>}</figure></div>
  {scene.scene_type==='transition'&&scene.settings.manualContinue&&<button className="scene-continue" type="button" onClick={onContinue}>Weiter</button>}
 </article></div>
}
