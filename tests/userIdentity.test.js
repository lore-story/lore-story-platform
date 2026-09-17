import test from 'node:test'
import assert from 'node:assert/strict'
import { userDisplayName, userInitials } from '../src/userIdentity.js'

test('priorisiert full_name, display_name und name für Anzeige und Initialen', () => {
  assert.equal(userDisplayName({ user_metadata: { full_name: 'Ada Lovelace', display_name: 'Ignored' } }), 'Ada Lovelace')
  assert.equal(userInitials({ user_metadata: { display_name: 'Mina Muster' } }), 'MM')
  assert.equal(userDisplayName({ user_metadata: { name: 'Sam Stern' } }), 'Sam Stern')
})

test('formatiert ausschließlich den E-Mail-Lokalteil als Fallback', () => {
  const user = { email: 'lea-muster.schule@example.test', user_metadata: {} }
  assert.equal(userDisplayName(user), 'Lea Muster Schule')
  assert.equal(userInitials(user), 'LS')
  assert.equal(userDisplayName({}), '')
  assert.equal(userInitials({}), '?')
})
