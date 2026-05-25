const key = 'fbls-admin-auth'

const saved =
  typeof localStorage === 'undefined'
    ? null
    : JSON.parse(localStorage.getItem(key) || 'null')

export const auth = $state<{
  expiresAt: string
  token: string
}>({
  expiresAt: saved?.expiresAt || '',
  token: saved?.token || ''
})

export const setAuth = (next: { expiresAt: string; token: string } | null) => {
  auth.expiresAt = next?.expiresAt || ''
  auth.token = next?.token || ''
  if (next) localStorage.setItem(key, JSON.stringify(next))
  else localStorage.removeItem(key)
}

export const isAuthed = () =>
  !!auth.token && !!auth.expiresAt && new Date(auth.expiresAt).getTime() > Date.now()
