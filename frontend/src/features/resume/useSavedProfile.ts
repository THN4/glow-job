import { useQuery } from '@tanstack/react-query'
import { getSavedProfileId, getSessionId, loadSavedProfile } from './api'

export function useSavedProfile() {
  return useQuery({
    queryKey: ['saved-profile', getSessionId(), getSavedProfileId()],
    queryFn: async () => {
      const saved = await loadSavedProfile()
      if (!saved) throw new Error('Could not load your saved profile. Please try again.')
      return saved
    },
    enabled: Boolean(getSavedProfileId()),
  })
}
