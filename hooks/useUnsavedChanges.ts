'use client'

import { useEffect, useCallback } from 'react'

export function useUnsavedChanges(hasChanges: boolean) {
  // ── Browser tab close / refresh / external navigation ──────────────
  useEffect(() => {
    if (!hasChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers ignore custom messages but require this to show dialog
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  // ── In-app navigation via Next.js router ───────────────────────────
  // Returns a confirm function the component can call before router.push
  const confirmNavigation = useCallback(() => {
    if (!hasChanges) return true
    return window.confirm(
      'You have unsaved changes. Are you sure you want to leave?'
    )
  }, [hasChanges])

  return { confirmNavigation }
}
