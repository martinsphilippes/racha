// Papéis de plataforma. O dono é identificado pelo e-mail da conta (também fixado em firestore.rules).
export const OWNER_EMAILS = ['martinsphilippes@gmail.com']

export type PlatformRole = 'owner' | 'organizer' | 'athlete'

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  owner: 'Dono',
  organizer: 'Organizador',
  athlete: 'Atleta',
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email && OWNER_EMAILS.includes(email.trim().toLowerCase()))
}

export function canOrganize(role: PlatformRole | null | undefined): boolean {
  return role === 'owner' || role === 'organizer'
}
