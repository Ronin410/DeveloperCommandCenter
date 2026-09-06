'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AuthenticatedUser } from '@/types/domain';

interface SessionValue {
  user: AuthenticatedUser;
  csrfToken: string;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Makes the current user and CSRF token available to client components.
 * The token is per-session and required by every mutating request.
 */
export function SessionProvider({ value, children }: { value: SessionValue; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
