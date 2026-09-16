export function isSessionCurrent(
  claimSessionId: string | null | undefined,
  activeSessionId: string | null | undefined,
): boolean {
  if (!activeSessionId) return true
  return claimSessionId === activeSessionId
}

export function hasPasswordLogin(identities: ReadonlyArray<{ provider: string }> | null | undefined): boolean {
  return Boolean(identities?.some((identity) => identity.provider === 'email'))
}
