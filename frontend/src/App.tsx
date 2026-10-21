import { OnboardingFlow } from './features/onboarding/state/OnboardingFlow'
import { OnboardingProvider } from './features/onboarding/state/OnboardingProvider'

function App() {
  return (
    <OnboardingProvider>
      <OnboardingFlow />
    </OnboardingProvider>
  )
}

export default App