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

test('properties use four accessible accordions with the requested defaults',()=>{
 const panel=read('src/workshop/PropertiesPanel.jsx')
 for(const name of ['Inhalt','Medien','Werkzeuge','Medienbibliothek'])assert.match(panel,new RegExp(name))
 assert.match(panel,/INITIAL_OPEN = \{ content: true, media: false, tools: false, library: false \}/)
 assert.match(panel,/aria-expanded=\{open\}/);assert.match(panel,/aria-controls=\{panelId\}/);assert.match(panel,/aria-labelledby=\{buttonId\}/)
 assert.match(panel,/Medienbibliothek · \$\{mediaItems\.length\}/)
 assert.match(panel,/Medium ändern/)
 assert.match(panel,/openOnly\('library'\)/)
 assert.match(panel,/library:false,media:true/)
})

test('content, tools, video settings and library responsibilities stay separated',()=>{
 const panel=read('src/workshop/PropertiesPanel.jsx')
 const content=panel.slice(panel.indexOf('name="content"'),panel.indexOf('name="media"'))
 const media=panel.slice(panel.indexOf('name="media"'),panel.indexOf('name="tools"'))
 const tools=panel.slice(panel.indexOf('name="tools"'),panel.indexOf('name="library"'))
 const library=panel.slice(panel.indexOf('name="library"'))
 assert.match(content,/Arbeitsschritte/);assert.doesNotMatch(content,/Auftrag in Schritte gliedern/)
 assert.match(tools,/Auftrag in Schritte gliedern/);assert.match(tools,/Bereitschaft erforderlich/);assert.match(panel,/const activeTools=/)
 assert.match(media,/Videoeinstellungen/);assert.match(media,/Autoplay/);assert.doesNotMatch(library,/Videoeinstellungen|Autoplay|Loop aktivieren/)
 assert.match(panel,/narrow&&next/)
})

test('stage grid and media viewport share a clipped fixed row',()=>{
 const css=read('src/styles.css')
 assert.match(css,/grid-auto-rows:minmax\(0,1fr\)/)
 assert.match(css,/\.mission-stage \.scene-copy,\.mission-stage figure\{height:100%;max-height:100%;min-height:0;overflow:hidden/)
 assert.match(css,/contain:layout paint/)
})

test('all shared stage surfaces use the world radius and clip transformed media',()=>{
 const css=read('src/styles.css'), tokens=read('src/workshop/worldTokens.js')
 assert.match(tokens,/radius: 'clamp/)
 assert.match(css,/scene-kind-transition figure:not\(\.empty-media\)[^{]*\{[^}]*border-radius:var\(--mission-radius\)/)
 assert.match(css,/\.mission-media-viewport\{isolation:isolate;clip-path:inset\(0 round var\(--mission-radius\)\)/)
 assert.doesNotMatch(css,/scene-kind-transition figure:not\(\.empty-media\)[^{]*\{[^}]*border-radius:0/)
})
