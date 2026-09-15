const AUTH_MESSAGES = {
  'Invalid login credentials': 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  'Email not confirmed': 'Bitte bestätige zuerst deine E-Mail-Adresse.',
  'User already registered': 'Für diese E-Mail-Adresse besteht bereits ein Konto.',
  'Password should be at least 6 characters': 'Das Passwort muss mindestens 6 Zeichen lang sein.',
}

export function authErrorMessage(error) {
  return AUTH_MESSAGES[error?.message] || 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.'
}
export async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}
export async function signUp(client, email, password) {
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  return { session: data.session, confirmationRequired: !data.session }
}
