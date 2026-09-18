import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Maximize, X } from 'lucide-react'
import MissionStage from './MissionStage'
export default function TestRun({project,onBack,resolveMedia,startIndex=0}) {
 const [index,setIndex]=useState(startIndex),[ended,setEnded]=useState(false),[ready,setReady]=useState(false)
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';const escape=e=>{if(e.key==='Escape')onBack()};window.addEventListener('keydown',escape);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',escape)}},[onBack])
 const next=()=>index===project.scenes.length-1?setEnded(true):(setIndex(index+1),setReady(false))
 if(ended)return createPortal(<main className="test-run end-screen"><div><small>INTERNER TESTLAUF</small><h1>Testlauf beendet</h1><p>Es wurde keine echte Missionssitzung erstellt.</p><button onClick={onBack}>Zurück zum Editor</button><button onClick={()=>{setIndex(startIndex);setEnded(false)}}>Erneut testen</button></div></main>,document.body)
 const scene=project.scenes[index]
 const readinessRequired=scene.scene_type==='transition'&&!!scene.content.readiness, blocked=readinessRequired&&!ready
 return createPortal(<main className="test-run" data-testid="test-run-overlay"><header><button onClick={onBack}><X/> Testlauf beenden</button><span><strong>Entwurf · Mission testen</strong><small>Kein echter Start, keine Schülergeräte</small></span><button onClick={()=>document.documentElement.requestFullscreen?.()}><Maximize/> Vollbild</button></header><section><MissionStage scene={scene} worldId={project.world_id||'astra'} resolveMedia={resolveMedia} continueDisabled={blocked} onContinue={next}/>{readinessRequired&&<button className={`readiness-test ${ready?'ready':''}`} onClick={()=>setReady(!ready)}>{ready?'Bereit ✓':scene.content.readiness}</button>}</section><footer><button disabled={index===0} onClick={()=>{setIndex(index-1);setReady(false)}}><ArrowLeft/> Zurück</button><span>Szene {index+1} / {project.scenes.length}</span>{!scene.settings.manualContinue&&<button disabled={blocked} onClick={next}>{index===project.scenes.length-1?'Test beenden':'Weiter'} <ArrowRight/></button>}</footer></main>,document.body)
}
