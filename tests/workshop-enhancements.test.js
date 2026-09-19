import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { URL } from 'node:url'
import { normalizeAssignmentSteps } from '../src/workshop/model.js'

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8')

test('assignment steps are structured, multiline-safe and retain a required step',()=>{
 assert.deepEqual(normalizeAssignmentSteps({steps:['Erste Zeile\nZweite Zeile','Prüfen']}),['Erste Zeile\nZweite Zeile','Prüfen'])
 assert.deepEqual(normalizeAssignmentSteps({assignment:'Bisheriger Auftrag'}),['Bisheriger Auftrag'])
 const panel=read('src/workshop/PropertiesPanel.jsx')
 for(const text of ['Schritt hinzufügen','Löschen','nach oben','nach unten','Nur aktuellen Schritt zeigen','Alle Schritte zeigen und aktuellen hervorheben'])assert.match(panel,new RegExp(text))
 assert.match(panel,/disabled=\{steps\.length===1\}/)
})

test('test run owns per-scene step progress and readiness label is button-only',()=>{
 const run=read('src/workshop/TestRun.jsx'),stage=read('src/workshop/MissionStage.jsx')
 assert.match(run,/sceneSteps\[scene\.id\]/)
 assert.match(run,/Bereit gemeldet/)
 assert.doesNotMatch(stage,/className="readiness"/)
 assert.match(stage,/Schritt \{step\+1\} von \{steps\.length\}/)
 assert.match(stage,/step-display-/)
})

test('speaker is shared by all scene types and empty values render no node',()=>{
 const panel=read('src/workshop/PropertiesPanel.jsx'),stage=read('src/workshop/MissionStage.jsx')
 for(const label of ['Sprecher','Auftrag von','Absender'])assert.match(panel,new RegExp(label))
 assert.match(stage,/scene\.content\.speaker\?\.trim\(\)&&/)
})

test('media accordion is closed by default, counted and explicitly opened by change action',()=>{
 const panel=read('src/workshop/PropertiesPanel.jsx')
 assert.match(panel,/useState\(false\)/)
 assert.match(panel,/Meine Medien · \{mediaItems\.length\}/)
 assert.match(panel,/Medium ändern/)
 assert.match(panel,/onClick=\{\(\)=>setMediaOpen\(true\)\}/)
 assert.match(panel,/Aktuelles Medium/)
})

test('stage grid and media viewport share a clipped fixed row',()=>{
 const css=read('src/styles.css')
 assert.match(css,/grid-auto-rows:minmax\(0,1fr\)/)
 assert.match(css,/\.mission-stage \.scene-copy,\.mission-stage figure\{height:100%;max-height:100%;min-height:0;overflow:hidden/)
 assert.match(css,/contain:layout paint/)
})
