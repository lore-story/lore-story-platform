import { useState } from 'react'
import { ArrowLeft, ArrowRight, Maximize } from 'lucide-react'
import ScenePreview from './ScenePreview'
export default function TestRun({project,onBack,resolveMedia}) {
 const [index,setIndex]=useState(0),[ended,setEnded]=useState(false),[ready,setReady]=useState(false)
 const next=()=>index===project.scenes.length-1?setEnded(true):(setIndex(index+1),setReady(false))
 if(ended)return <main className="test-run end-screen"><div><small>INTERNER TESTLAUF</small><h1>Testlauf beendet</h1><p>Es wurde keine echte Missionssitzung erstellt.</p><button onClick={onBack}>Zurück zum Editor</button><button onClick={()=>{setIndex(0);setEnded(false)}}>Erneut testen</button></div></main>
 const scene=project.scenes[index]
 return <main className="test-run"><header><button onClick={onBack}><ArrowLeft/> Zurück zum Editor</button><span><strong>Entwurf · Mission testen</strong><small>Kein echter Start, keine Schülergeräte</small></span><button onClick={()=>document.documentElement.requestFullscreen?.()}><Maximize/> Vollbild</button></header><section><ScenePreview scene={scene} resolveMedia={resolveMedia} onContinue={next}/>{scene.scene_type==='transition'&&scene.content.readiness&&<button className={`readiness-test ${ready?'ready':''}`} onClick={()=>setReady(!ready)}>{ready?'Bereit ✓':scene.content.readiness}</button>}</section><footer><button disabled={index===0} onClick={()=>setIndex(index-1)}><ArrowLeft/> Zurück</button><span>Szene {index+1} / {project.scenes.length}</span>{!scene.settings.manualContinue&&<button onClick={next}>{index===project.scenes.length-1?'Test beenden':'Weiter'} <ArrowRight/></button>}</footer></main>
}
