import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import chromiumBinary from '@sparticuz/chromium'
import { chromium } from 'playwright'

const baseUrl=process.env.BASE_URL||'http://127.0.0.1:5173'
const browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage']})
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X2NDWQAAAABJRU5ErkJggg==','base64')
const initialScenes=[
 {id:'scene-1',mission_project_id:'project-1',position:0,title:'Ankunft',scene_type:'narrative',layout_template:'split',content:{message:'Willkommen im Archiv.',speaker:'Archivarin',assignment:'',material:'',socialForm:'',time:'',help:'',readiness:'',media:{kind:'external-url',url:'https://example.test/public.png',alt:'Leuchtendes Archiv'}},settings:{accent:'#35d8f3',textAlign:'left',dimming:'medium',showOptional:true,manualContinue:false}},
 {id:'scene-2',mission_project_id:'project-1',position:1,title:'Recherche',scene_type:'assignment',layout_template:'text',content:{message:'',speaker:'Missionsleitung',assignment:'Findet drei Hinweise.\nNotiert eure Belege.',assignmentStepsEnabled:true,steps:['Hinweise finden\nund markieren','Belege notieren','Ergebnis prüfen'],stepDisplay:'current',material:'Forscherkarten',socialForm:'Teams',time:'10 Minuten',help:'Vergleicht eure Funde.',readiness:'',media:{kind:'external-url',url:'https://example.test/missing.png',alt:'Fehlendes Bild'}},settings:{accent:'#ff9d3b',textAlign:'left',dimming:'light',showOptional:true,manualContinue:false}},
 {id:'scene-3',mission_project_id:'project-1',position:2,title:'Sammelpunkt',scene_type:'transition',layout_template:'media',content:{message:'Kommt wieder zusammen.',speaker:'Bordcomputer',assignment:'',material:'',socialForm:'',time:'',help:'',readiness:'Wir sind bereit',media:{kind:'external-url',url:'',alt:''}},settings:{accent:'#7fc69f',textAlign:'center',dimming:'strong',showOptional:true,manualContinue:true}},
]

async function installMock(page){
 await page.addInitScript(({project,scenes})=>{
  const listeners=new Set(),user={id:'11111111-1111-1111-1111-111111111111',email:'teacher@example.test',is_anonymous:false,email_confirmed_at:'2026-01-01'}
  let projectRow=project,sceneRows=scenes,mediaRows=[]
  window.__workshop={saveCount:0,sessionWrites:0,uploads:[],signed:[],get scenes(){return sceneRows},get project(){return projectRow},get media(){return mediaRows}}
  const response=(data,error=null)=>({data,error})
  function query(table,operation='select',payload=null){
   const q={filters:{},select(){return q},eq(k,v){q.filters[k]=v;return q},order(){return q},limit(){return q},insert(v){return query(table,'insert',v)},update(v){return query(table,'update',v)},delete(){return query(table,'delete')},async single(){return run(true)},async maybeSingle(){return run(true)},then(ok,bad){return run(false).then(ok,bad)}}
   async function run(single){
    if(table==='mission_sessions'&&operation!=='select')window.__workshop.sessionWrites++
    if(table==='mission_projects'){
     if(operation==='select')return response(single?projectRow:[projectRow])
     if(operation==='update'){projectRow={...projectRow,...payload,updated_at:new Date().toISOString()};window.__workshop.saveCount++;return response(projectRow)}
    }
    if(table==='mission_scenes'){
     if(operation==='select')return response(sceneRows)
     if(operation==='delete'){sceneRows=[];return response(null)}
     if(operation==='insert'){sceneRows=payload.map(x=>({...x}));return response(payload)}
    }
    if(table==='mission_media'){
     if(operation==='select')return response(mediaRows)
     if(operation==='insert'){const row={id:`media-${mediaRows.length+1}`,created_at:new Date().toISOString(),...payload};mediaRows.unshift(row);return response(single?row:[row])}
     if(operation==='delete'){mediaRows=mediaRows.filter(x=>x.id!==q.filters.id);return response(null)}
    }
    if(table==='loreboards')return response(single?null:[])
    return response(single?null:[])
   } return q
  }
  window.__LORE_SUPABASE__={auth:{async getSession(){return response({session:{user,access_token:'mock'}})},onAuthStateChange(cb){listeners.add(cb);return{data:{subscription:{unsubscribe:()=>listeners.delete(cb)}}}},async signOut(){return response(null)}},from(table){return query(table)},storage:{from(){return{async upload(path,file){window.__workshop.uploads.push({path,type:file.type,size:file.size});return response({path})},async createSignedUrl(path){const signedUrl=`https://signed.example.test/${path}?token=temporary`;window.__workshop.signed.push({path,signedUrl});return response({signedUrl})},async remove(){return response([])}}}}}
 },{project:{id:'project-1',owner_id:'11111111-1111-1111-1111-111111111111',title:'Archiv-Testmission',description:'E2E',status:'draft',audience_level:'class-3-6',availability_type:'free',world_id:null,subject:null,estimated_minutes:30,schema_version:2,created_at:'2026-09-18T10:00:00Z',updated_at:'2026-09-18T10:00:00Z'},scenes:initialScenes})
 await page.route('https://example.test/public.png',route=>route.fulfill({status:200,contentType:'image/png',body:png}))
 await page.route('https://example.test/missing.png',route=>route.fulfill({status:404,body:'missing'}))
 await page.route(/https:\/\/signed\.example\.test\/.*/,route=>route.fulfill({status:200,contentType:'image/png',body:png}))
}
async function openEditor(page){
 await installMock(page);await page.goto(baseUrl,{waitUntil:'networkidle'});await page.locator('.platform > aside nav').getByRole('button',{name:'Werkstatt',exact:true}).click();await page.getByRole('button',{name:/Bearbeiten/}).click();await page.getByLabel('Missionsname').waitFor()
}
async function layoutChecks(page,width,height,name){
 await page.setViewportSize({width,height});await openEditor(page);await page.waitForTimeout(100)
 const metrics=await page.evaluate(()=>{const root=document.documentElement,editor=document.querySelector('.mission-editor'),workspace=document.querySelector('.scene-workspace'),rail=document.querySelector('.desktop-rail .scene-rail'),props=document.querySelector('.desktop-properties .workshop-properties');const scrollables=[...document.querySelectorAll('.mission-editor *')].filter(el=>{const s=getComputedStyle(el);return /(auto|scroll)/.test(s.overflowY)&&el.scrollHeight>el.clientHeight+1}).map(el=>el.className);return{pageScroll:root.scrollHeight>innerHeight+1||root.scrollWidth>innerWidth+1,editor:{w:editor.getBoundingClientRect().width,h:editor.getBoundingClientRect().height},workspace:workspace.getBoundingClientRect().width,railScroll:rail?rail.scrollHeight>rail.clientHeight+1:false,propsScroll:props?props.scrollHeight>props.clientHeight+1:false,scrollables}})
 assert.equal(metrics.pageScroll,false,`${name}: whole page must not scroll`);assert.equal(metrics.editor.h,height);assert.ok(metrics.workspace>Math.min(320,width*.25),`${name}: workspace is too narrow (${metrics.workspace}px)`);if(width>1200){assert.equal(metrics.railScroll,false);assert.ok(metrics.scrollables.length<=1,`${name}: nested scrolling: ${metrics.scrollables}`)}const clipped=await page.locator('.mission-stage button').evaluateAll(nodes=>nodes.filter(el=>{const r=el.getBoundingClientRect(),host=el.closest('.mission-stage').getBoundingClientRect();return r.bottom>host.bottom+1||r.right>host.right+1}).length);assert.equal(clipped,0,`${name}: stage controls are clipped`)
 await page.screenshot({path:`artifacts/workshop-stage2-${name}.png`,fullPage:false})
 if(width<=1024){await page.getByRole('button',{name:'Szenen',exact:true}).click();assert.equal(await page.locator('.tablet-drawer.left').count(),1);assert.equal(await page.locator('.tablet-drawer.right').count(),0);await page.getByRole('button',{name:'Eigenschaften',exact:true}).click();assert.equal(await page.locator('.tablet-drawer.left').count(),0);assert.equal(await page.locator('.tablet-drawer.right').count(),1);const box=await page.locator('.tablet-drawer.right').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width)}
 return metrics
}

await mkdir('artifacts',{recursive:true})
try{
 for(const [w,h,n] of [[1920,1080,'1920x1080'],[1440,1000,'1440x1000'],[1366,768,'1366x768'],[1024,1366,'1024x1366']]){const p=await browser.newPage({viewport:{width:w,height:h},hasTouch:w===1024});await layoutChecks(p,w,h,n);if(w===1024)assert.equal(await p.locator('.mission-media-viewport').evaluate(el=>getComputedStyle(el).touchAction),'none');await p.close()}
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(8000);page.on('dialog',dialog=>dialog.accept());await openEditor(page)
 const preview=page.getByTestId('mission-stage');assert.equal(await preview.locator('img[alt="Leuchtendes Archiv"]').count(),1)
 for(const [typeName,kind] of [['Erzählung','narrative'],['Lernauftrag','assignment'],['Übergang','transition']]){
  await page.locator('.type-selector').getByRole('button',{name:new RegExp(typeName)}).click();if(await page.getByText('Szenentyp wechseln?').count())await page.getByText('OK').click();assert.equal(await preview.evaluate((el,k)=>el.classList.contains(`scene-kind-${k}`),kind),true)
  for(const [layoutName,layout] of [['Fokus: Text','text'],['Geteilt: Text und Medium','split'],['Fokus: Medium','media']]){await page.locator('.layout-selector').getByRole('button',{name:new RegExp(layoutName)}).click();const boxes=await preview.evaluate(el=>{const copy=el.querySelector('.scene-copy').getBoundingClientRect(),media=el.querySelector('figure').getBoundingClientRect(),style=getComputedStyle(el);return{layout:el.dataset.layout,copy:copy.width,media:media.width,copyHeight:copy.height,mediaHeight:media.height,stageBottom:el.getBoundingClientRect().bottom,mediaBottom:media.bottom,color:style.color,background:style.backgroundColor}});assert.ok(Math.abs(boxes.copyHeight-boxes.mediaHeight)<2,`${kind} aligned height`);assert.ok(boxes.mediaBottom<=boxes.stageBottom+1,`${kind} media overflow`);if(layout==='text')assert.ok(boxes.copy>boxes.media*1.7,`${kind} text focus ratio`);if(layout==='split')assert.ok(Math.abs(boxes.copy-boxes.media)<5,`${kind} split ratio`);if(layout==='media')assert.ok(boxes.media>boxes.copy*1.8,`${kind} media focus ratio ${JSON.stringify(boxes)}`);if(kind==='assignment'){assert.notEqual(boxes.background,'rgb(248, 251, 255)');assert.notEqual(boxes.color,'rgb(22, 41, 58)')}await page.screenshot({path:`artifacts/workshop-${kind}-${layout}.png`,fullPage:false})}
  if(kind==='transition')assert.equal(await page.getByText('Bereitschaft erforderlich',{exact:true}).count(),1)
 }
 for(const [label,value] of [['Links','left'],['Zentriert','center'],['Rechts','right']]){await page.getByLabel('Textausrichtung').selectOption(value);assert.equal(await preview.evaluate(el=>getComputedStyle(el.querySelector('.scene-copy')).textAlign),value)}
 await page.getByRole('button',{name:/Szenen schließen/}).count() // desktop close intentionally hidden
 await page.locator('.desktop-rail .scene-select').nth(1).click();await page.getByText('Medium konnte nicht geladen werden').waitFor()
 await page.locator('.desktop-rail .scene-select').nth(0).click();await page.locator('.workshop-properties details').evaluate(el=>el.open=true);assert.equal(await page.getByText('Meine Medien · 0').count(),1);assert.equal(await page.locator('.media-library').count(),0);await page.locator('.media-accordion-toggle').click()
 const chooser=page.locator('.media-upload input[type=file]');await chooser.setInputFiles({name:'lokal.png',mimeType:'image/png',buffer:png});await page.getByText(/Aktuelles Medium:/).waitFor()
 const upload=await page.evaluate(()=>window.__workshop.uploads[0]);assert.match(upload.path,/^11111111-1111-1111-1111-111111111111\//);assert.equal(upload.type,'image/png');const media=await page.evaluate(()=>window.__workshop.media[0]);assert.equal(media.storage_path,upload.path);assert.equal('signed_url' in media,false);assert.ok((await page.evaluate(()=>window.__workshop.signed)).some(x=>x.path===upload.path))
 await page.waitForTimeout(900);assert.equal((await page.evaluate(()=>window.__workshop.scenes[0].content.media.path)),upload.path);await page.getByLabel('Horizontaler Fokus').fill('18');await page.getByLabel('Vertikaler Fokus').fill('82');await page.getByRole('slider',{name:'Zoom',exact:true}).fill('1.5');const focus=await preview.locator('.mission-media-viewport').evaluate(el=>({x:el.dataset.positionX,y:el.dataset.positionY,zoom:el.dataset.zoom,position:el.querySelector('img').style.objectPosition,transform:el.querySelector('img').style.transform}));assert.deepEqual(focus,{x:'18',y:'82',zoom:'1.5',position:'18% 82%',transform:'scale(1.5)'});await page.getByRole('button',{name:'Ausschnitt zurücksetzen'}).click();assert.equal(await preview.locator('.mission-media-viewport').getAttribute('data-position-x'),'50')
 await page.getByRole('button',{name:'Medium entfernen'}).click();await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>window.__workshop.scenes[0].content.media.path),undefined)
 await page.locator('.desktop-rail .scene-select').nth(0).click();await page.waitForTimeout(900);const before=await page.evaluate(()=>({scenes:JSON.stringify(window.__workshop.scenes),saves:window.__workshop.saveCount,sessions:window.__workshop.sessionWrites}));await page.getByRole('button',{name:'Mission testen'}).click();assert.match(await page.getByText(/Szene 1 \/ 3/).innerText(),/Szene 1/);assert.equal(await page.getByText('Ankunft').count(),1);assert.equal(await page.locator('.platform > aside').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true)
 await page.getByRole('button',{name:/Weiter/}).click();assert.match(await page.getByText(/Szene 2 \/ 3/).innerText(),/Szene 2/);assert.equal(await page.getByText('Schritt 1 von 3').count(),1);await page.getByRole('button',{name:'Nächster Arbeitsschritt'}).click();assert.equal(await page.getByText('Schritt 2 von 3').count(),1);await page.getByRole('button',{name:/Zurück/}).last().click();assert.match(await page.getByText(/Szene 1 \/ 3/).innerText(),/Szene 1/);await page.getByRole('button',{name:/Weiter/}).click();assert.equal(await page.getByText('Schritt 2 von 3').count(),1);await page.getByRole('button',{name:/Weiter/}).click();assert.equal(await page.locator('.scene-continue').isDisabled(),true);await page.getByRole('button',{name:'Wir sind bereit'}).click();await page.getByRole('button',{name:'Bereit gemeldet'}).waitFor();assert.equal(await page.locator('.scene-continue').isEnabled(),true);await page.locator('.scene-continue').click();await page.getByRole('heading',{name:'Testlauf beendet'}).waitFor();assert.equal(await page.evaluate(()=>window.__workshop.sessionWrites),before.sessions);assert.equal(await page.evaluate(()=>JSON.stringify(window.__workshop.scenes)),before.scenes);assert.equal(await page.evaluate(()=>window.__workshop.saveCount),before.saves);await page.getByRole('button',{name:'Zurück zum Editor'}).click();await page.getByLabel('Missionsname').waitFor()
 console.log('Workshop E2E, media, test run, and layouts at 1920x1080, 1440x1000, 1024x1366 passed.')
}finally{await browser.close()}
