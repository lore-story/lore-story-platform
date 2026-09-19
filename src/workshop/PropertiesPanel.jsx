import { useEffect, useId, useState } from 'react'
import { ChevronDown, ChevronUp, ImageOff } from 'lucide-react'
import { normalizeAssignmentSteps, normalizeMediaPresentation } from './model'
import SceneTypeSelector from './SceneTypeSelector'
import LayoutSelector from './LayoutSelector'
import MediaUpload from './MediaUpload'
import MediaLibrary from './MediaLibrary'

const INITIAL_OPEN = { content: true, media: false, tools: false, library: false }

function useNarrowPanel() {
 const [narrow,setNarrow]=useState(()=>globalThis.matchMedia?.('(max-width: 1200px)').matches??false)
 useEffect(()=>{const query=globalThis.matchMedia?.('(max-width: 1200px)');if(!query)return;const update=()=>setNarrow(query.matches);update();query.addEventListener?.('change',update);return()=>query.removeEventListener?.('change',update)},[])
 return narrow
}

function Accordion({name,label,open,onToggle,children}) {
 const id=useId(), buttonId=`accordion-button-${id}`, panelId=`accordion-panel-${id}`
 return <section className={`property-accordion property-accordion-${name} ${open?'open':''}`}>
  <h3><button id={buttonId} type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle}><span>{label}</span>{open?<ChevronUp aria-hidden="true"/>:<ChevronDown aria-hidden="true"/>}</button></h3>
  <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="property-accordion-content">{children}</div>
 </section>
}

function MediumThumbnail({media,storage,isVideo}) {
 const [url,setUrl]=useState(media.url||'')
 useEffect(()=>{let current=true;if(media.path)Promise.resolve(storage.resolve(media)).then(value=>{if(current)setUrl(value)}).catch(()=>{if(current)setUrl('')});return()=>{current=false}},[media.path,media.url,storage])
 return <div className="current-medium-preview">{url?(isVideo?<video src={url} muted aria-label="Videovorschau"/>:<img src={url} alt=""/>):<ImageOff aria-label="Vorschau nicht verfügbar"/>}</div>
}

export default function PropertiesPanel({scene,onChange,storage,mediaItems,onMediaChanged,usedPaths,onClose}) {
 const [opened,setOpened]=useState(INITIAL_OPEN), narrow=useNarrowPanel()
 useEffect(()=>{if(narrow)setOpened(current=>{const first=['content','media','tools','library'].find(name=>current[name])||'content';return {content:false,media:false,tools:false,library:false,[first]:true}})},[narrow])
 const update=patch=>onChange({...scene,...patch}), setting=patch=>update({settings:{...scene.settings,...patch}}), content=patch=>update({content:{...scene.content,...patch}}), media=normalizeMediaPresentation(scene.content.media)
 const mediaChange=patch=>content({media:{...media,...patch}})
 const openOnly=name=>setOpened(current=>narrow?{content:false,media:false,tools:false,library:false,[name]:true}:{...current,[name]:true})
 const toggle=name=>setOpened(current=>{const next=!current[name];return narrow&&next?{content:false,media:false,tools:false,library:false,[name]:true}:{...current,[name]:next}})
 const use=item=>{content({media:normalizeMediaPresentation({kind:'storage',path:item.storage_path,alt:item.title||item.file_name,type:item.mime_type?.startsWith('video/')?'video':'image',mimeType:item.mime_type})});setOpened(current=>({...current,library:false,media:true}))}
 const remove=()=>content({media:{kind:'external-url',url:'',alt:''}})
 const key=scene.scene_type==='assignment'?'assignment':'message', hasMedia=!!(media.url||media.path), isVideo=media.type==='video'||media.mimeType?.startsWith('video/')
 const filename=media.path?.split('/').pop()||media.url?.split('/').pop()?.split('?')[0]||media.alt||'Medium'
 const steps=normalizeAssignmentSteps(scene.content), updateSteps=next=>content({steps:next})
 const changeStep=(index,value)=>updateSteps(steps.map((step,i)=>i===index?value:step))
 const moveStep=(index,direction)=>{const target=index+direction;if(target<0||target>=steps.length)return;const next=[...steps];[next[index],next[target]]=[next[target],next[index]];updateSteps(next)}
 const speakerLabel={narrative:'Sprecher',assignment:'Auftrag von',transition:'Absender'}[scene.scene_type]
 const activeTools=(scene.scene_type==='assignment'&&scene.content.assignmentStepsEnabled?1:0)+(scene.scene_type==='transition'&&scene.content.readiness?1:0)+(scene.scene_type==='transition'&&scene.settings.manualContinue?1:0)
 const toolsLabel=`Werkzeuge${activeTools?` · ${activeTools} aktiv`:''}`
 return <aside className="workshop-properties" aria-label="Szeneneigenschaften"><header><h2>Eigenschaften</h2>{onClose&&<button onClick={onClose} aria-label="Eigenschaften schließen">×</button>}</header>
  <Accordion name="content" label="Inhalt" open={opened.content} onToggle={()=>toggle('content')}>
   <SceneTypeSelector scene={scene} onChange={onChange}/><label>Titel<input value={scene.title} onChange={e=>update({title:e.target.value})}/></label><label>{speakerLabel}<input placeholder="Optional" value={scene.content.speaker||''} onChange={e=>content({speaker:e.target.value})}/></label><label>{scene.scene_type==='assignment'?'Lernauftrag':scene.scene_type==='transition'?'Übergangsnachricht':'Nachricht'}<textarea rows="5" value={scene.content[key]||''} onChange={e=>content({[key]:e.target.value})}/></label>
   {scene.scene_type==='assignment'&&scene.content.assignmentStepsEnabled&&<section className="step-editor"><h4>Arbeitsschritte</h4><ol>{steps.map((step,index)=><li key={index}><textarea aria-label={`Arbeitsschritt ${index+1}`} rows="2" value={step} onChange={e=>changeStep(index,e.target.value)}/><div><button type="button" aria-label={`Schritt ${index+1} nach oben`} disabled={index===0} onClick={()=>moveStep(index,-1)}>↑</button><button type="button" aria-label={`Schritt ${index+1} nach unten`} disabled={index===steps.length-1} onClick={()=>moveStep(index,1)}>↓</button><button type="button" disabled={steps.length===1} onClick={()=>updateSteps(steps.filter((_,i)=>i!==index))}>Löschen</button></div></li>)}</ol><button type="button" onClick={()=>updateSteps([...steps,''])}>Schritt hinzufügen</button></section>}
   <label>Textausrichtung<select value={scene.settings.textAlign||'left'} onChange={e=>setting({textAlign:e.target.value})}><option value="left">Links</option><option value="center">Zentriert</option><option value="right">Rechts</option></select></label>
  </Accordion>
  <Accordion name="media" label="Medien" open={opened.media} onToggle={()=>toggle('media')}>
   {!hasMedia?<div className="media-empty"><ImageOff aria-hidden="true"/><p>Noch kein Medium ausgewählt.</p><button type="button" onClick={()=>openOnly('library')}>Medium auswählen</button></div>:<><div className="current-medium"><MediumThumbnail media={media} storage={storage} isVideo={isVideo}/><span><strong>{filename}</strong><small>{isVideo?'Video':'Bild'}</small></span><button type="button" onClick={()=>openOnly('library')}>Medium ändern</button><button type="button" onClick={remove}>Medium entfernen</button></div>
    <LayoutSelector value={scene.layout_template} hasImage={hasMedia} onChange={layout_template=>update({layout_template})}/><label>Alternativtext<input value={media.alt||''} onChange={e=>mediaChange({alt:e.target.value})}/></label><label>Einpassung<select value={media.fit} onChange={e=>mediaChange({fit:e.target.value})}><option value="cover">Fläche füllen</option><option value="contain">Ganzes Medium zeigen</option></select></label><div className="focus-controls"><label>Horizontale Fokusposition<input aria-label="Horizontale Fokusposition" type="range" min="0" max="100" value={media.positionX} onChange={e=>mediaChange({positionX:Number(e.target.value)})}/></label><label>Vertikale Fokusposition<input aria-label="Vertikale Fokusposition" type="range" min="0" max="100" value={media.positionY} onChange={e=>mediaChange({positionY:Number(e.target.value)})}/></label></div><div className="crop-controls"><button type="button" aria-label="Zoom verkleinern" onClick={()=>mediaChange({zoom:Math.max(1,media.zoom-.1)})}>−</button><input aria-label="Zoom" type="range" min="1" max="2" step=".05" value={media.zoom} onChange={e=>mediaChange({zoom:Number(e.target.value)})}/><button type="button" aria-label="Zoom vergrößern" onClick={()=>mediaChange({zoom:Math.min(2,media.zoom+.1)})}>+</button><button type="button" onClick={()=>mediaChange({positionX:50,positionY:50,zoom:1})}>Zurücksetzen</button></div>
    {isVideo&&<fieldset className="video-settings"><legend>Videoeinstellungen</legend><label>Wiedergabe<select value={media.autoplay?'autoplay':'manual'} onChange={e=>mediaChange({autoplay:e.target.value==='autoplay',playback:e.target.value==='manual'?'manual':'automatic',muted:e.target.value==='autoplay'?true:media.muted})}><option value="manual">Manuell starten</option><option value="autoplay">Autoplay</option></select></label><label className="check-row"><input type="checkbox" checked={media.loop} onChange={e=>mediaChange({loop:e.target.checked})}/> Loop aktivieren</label><label className="check-row"><input type="checkbox" checked={media.muted} onChange={e=>mediaChange({muted:e.target.checked})}/> Stumm</label><label>Poster (URL)<input value={media.poster||''} onChange={e=>mediaChange({poster:e.target.value})}/></label><small>Bei aktivierter Einstellung „Bewegung reduzieren“ startet das Video nicht automatisch.</small></fieldset>}
   </>}
  </Accordion>
  <Accordion name="tools" label={toolsLabel} open={opened.tools} onToggle={()=>toggle('tools')}>
   {scene.scene_type==='assignment'?<><label className="check-row"><input type="checkbox" checked={!!scene.content.assignmentStepsEnabled} onChange={e=>content({assignmentStepsEnabled:e.target.checked,steps:e.target.checked?steps:scene.content.steps})}/> Auftrag in Schritte gliedern</label>{scene.content.assignmentStepsEnabled&&<label>Darstellungsmodus<select value={scene.content.stepDisplay||'current'} onChange={e=>content({stepDisplay:e.target.value})}><option value="current">Nur aktuellen Schritt zeigen</option><option value="all">Alle Schritte zeigen und aktuellen hervorheben</option></select></label>}</>:scene.scene_type==='transition'?<><label className="check-row"><input type="checkbox" checked={!!scene.content.readiness} onChange={e=>content({readiness:e.target.checked?(scene.content.readiness||'Bereit'):''})}/> Bereitschaft erforderlich</label>{scene.content.readiness&&<label>Buttonbeschriftung<input value={scene.content.readiness} onChange={e=>content({readiness:e.target.value})}/></label>}<label className="check-row"><input type="checkbox" checked={scene.settings.manualContinue} onChange={e=>setting({manualContinue:e.target.checked})}/> Manuellen Weiter-Button zeigen</label></>:<p className="tools-empty">Für diese Szene ist noch kein Werkzeug aktiviert.</p>}
  </Accordion>
  <Accordion name="library" label={`Medienbibliothek · ${mediaItems.length}`} open={opened.library} onToggle={()=>toggle('library')}>
   <MediaUpload storage={storage} onUploaded={item=>{onMediaChanged(item);use(item)}}/><MediaLibrary items={mediaItems} usedPaths={usedPaths} onUse={use} onDelete={async item=>{if(window.confirm(`„${item.title||item.file_name}“ dauerhaft löschen?`)){await storage.remove(item);onMediaChanged()}}}/>
  </Accordion>
 </aside>
}
