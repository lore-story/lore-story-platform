# Lore-Werkstatt – Stufe 1

## Datenmodell und sichere Einrichtung

Die versionierte Migration liegt unter `supabase/migrations/202609180001_lore_workshop_stage_1.sql`. Sie wird **nicht automatisch** auf ein entferntes Projekt angewendet. Vor der manuellen Ausführung per Supabase CLI oder SQL Editor muss sie zuerst in einem Staging-Projekt geprüft werden. `mission_projects` enthält Eigentümer, Metadaten, Status und Schemaversion; `mission_scenes` hält die eindeutig sortierten Szenen sowie versionierbare JSONB-Inhalte und Einstellungen. RLS beschränkt beide Tabellen auf die bestätigte, nicht anonyme Lehrkraft und deren eigene Entwürfe.

## Funktionsumfang

Stufe 1 unterstützt genau **Erzählung**, **Lernauftrag** und **Übergang**. Pro Szene stehen die festen Vorlagen **Fokus: Text**, **Fokus: Medium** und **Geteilt: Text und Medium** zur Verfügung. Anpassbar sind nur Akzent aus einer Palette, Textausrichtung, drei Abdunklungsstufen und optionale Felder. Bilder werden als gekapselte öffentliche URL plus Alternativtext referenziert; ein Upload findet nicht statt.

Die UI lädt und speichert ausschließlich über `workshop/repository.js`. Änderungen werden verzögert automatisch gespeichert. Der Editor zeigt ausstehende, laufende, erfolgreiche und fehlgeschlagene Speicherungen und warnt vor Navigation mit lokalen Änderungen. Die Vorschau erzeugt keine Missionssitzung und besitzt weder QR-Code noch Schülerbeitritt.

## Erweiterungspunkte und Grenzen

`schema_version`, JSONB-Felder und die Medienreferenz sind für spätere Datenmigrationen, Supabase Storage und eine Medienbibliothek vorbereitet. Bewusst verschoben sind Veröffentlichung in die Bibliothek, Medienupload, Quiz, Punkte, Ranglisten, Verzweigungen, Schülerantworten, gemeinsame Echtzeitspiele und die Übertragung an Schülergeräte. Die bestehende Astra-Mission bleibt unabhängig und wird nicht migriert.
