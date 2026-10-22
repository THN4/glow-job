import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { AddApplicationForm, type NewApplicationInput } from '../components/shared/AddApplicationForm'
import { ApplicationDetailsPanel } from '../components/shared/ApplicationDetailsPanel'
import { ApplicationsHeader } from '../components/shared/ApplicationsHeader'
import { ApplicationsTabs } from '../components/shared/ApplicationsTabs'
import { CompaniesTab } from '../components/companies/CompaniesTab'
import type { CompanyOpening } from '../data/companyOpenings'
import { MyApplicationsTab } from '../components/my-applications/MyApplicationsTab'
import { CareerRecommendationsTab } from '../components/recommendations/CareerRecommendationsTab'
import { useRoadmapCounts } from '../../roadmap/useRoadmapCounts'
import { roadmapSummary } from '../../roadmap/data/roadmapMockData'
import { useApplicationFilters } from '../hooks/useApplicationFilters'
import { applicationsApi, applicationsKey, type ApplicationInput } from '../api'
import { getSavedProfileId } from '../../resume/api'
import type { ApplicationEntry, ApplicationTabKey, CareerPathRecommendation } from '../type'

function toInput(application: NewApplicationInput | ApplicationEntry): ApplicationInput {
  return {
    company: application.company,
    role: application.role,
    status: application.status,
    nextStep: application.nextStep,
    jobUrl: application.jobUrl ?? '',
    applicationDate: application.applicationDate ?? '',
    jobDescription: application.jobDescription ?? '',
    location: application.location ?? '',
    rejectionCategory: 'rejectionCategory' in application ? application.rejectionCategory ?? null : null,
    rejectionReason: 'rejectionReason' in application ? application.rejectionReason ?? '' : '',
  }
}

export function ApplicationsPage() {
  const queryClient = useQueryClient()
  const profileId = getSavedProfileId()
  const hasProfile = Boolean(profileId)
  const query = useQuery({
    queryKey: applicationsKey(),
    queryFn: applicationsApi.list,
    enabled: hasProfile,
    retry: false,
    staleTime: 30_000,
  })
  const applications = query.data ?? []
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab: ApplicationTabKey = requestedTab === 'companies' || requestedTab === 'recommendations' ? requestedTab : 'my-applications'
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingApplication, setEditingApplication] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<ApplicationEntry | null>(null)
  const [selectedCompanyOpening, setSelectedCompanyOpening] = useState<CompanyOpening | null>(null)
  const [selectedCareerPath, setSelectedCareerPath] = useState<CareerPathRecommendation | null>(null)
  const [companySaveError, setCompanySaveError] = useState<string | null>(null)
  const roadmap = useRoadmapCounts()
  const filters = useApplicationFilters(applications)
  const showRecommendationList = activeTab === 'recommendations' && !selectedCareerPath
  const createMutation = useMutation({
    mutationFn: applicationsApi.create,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: applicationsKey() }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApplicationInput }) => applicationsApi.update(id, input),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: applicationsKey() }),
  })
  const selectedRecord = selectedApplication
    ? applications.find((application) => application.id === selectedApplication.id) ?? selectedApplication
    : null

  async function saveApplication(input: NewApplicationInput) {
    if (editingApplication && selectedRecord) {
      const saved = await updateMutation.mutateAsync({ id: selectedRecord.id, input: toInput({ ...selectedRecord, ...input }) })
      setSelectedApplication(saved)
      setEditingApplication(false)
    } else {
      await createMutation.mutateAsync(toInput(input))
      setSelectedApplication(null)
    }
    setShowAddForm(false)
    setSearchParams({}, { replace: true })
  }

  async function updateApplication(updatedApplication: ApplicationEntry) {
    const saved = await updateMutation.mutateAsync({ id: updatedApplication.id, input: toInput(updatedApplication) })
    setSelectedApplication(saved)
  }

  async function addCompanyOpening(opening: CompanyOpening) {
    setCompanySaveError(null)
    if (applications.some((application) => application.company === opening.company && application.role === opening.role)) {
      setSearchParams({}, { replace: true })
      return
    }
    try {
      const saved = await createMutation.mutateAsync(toInput({
        company: opening.company,
        role: opening.role,
        status: 'wishlist',
        nextStep: '',
        jobUrl: '',
        applicationDate: '',
        jobDescription: '',
        location: opening.location === 'Not specified' ? '' : opening.location,
      }))
      setSelectedApplication(saved)
      setSearchParams({}, { replace: true })
    } catch (error) {
      setCompanySaveError(error instanceof Error ? error.message : 'Could not save this opening.')
    }
  }

  const saveError = createMutation.error instanceof Error
    ? createMutation.error.message
    : updateMutation.error instanceof Error ? updateMutation.error.message : null

  return (
    <section aria-label="Applications" className={`mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-5 pb-4 ${showRecommendationList ? 'lg:min-h-[calc(100dvh-3rem)]' : ''}`}>
      <ApplicationsHeader
        formOpen={showAddForm}
        detailOpen={Boolean(selectedRecord)}
        detailLabel={selectedRecord ? `${selectedRecord.company} / ${selectedRecord.role}` : undefined}
        onBack={() => setSelectedApplication(null)}
        activeTab={activeTab}
        targetRole={roadmapSummary.targetRole}
        duration={roadmapSummary.duration}
        titleOverride={activeTab === 'companies' ? selectedCompanyOpening?.role : activeTab === 'recommendations' ? selectedCareerPath?.title : undefined}
        subtitleOverride={activeTab === 'companies' && selectedCompanyOpening
          ? `${selectedCompanyOpening.company} · ${selectedCompanyOpening.location} · ${selectedCompanyOpening.workStyle} · ${selectedCompanyOpening.experience}`
          : activeTab === 'recommendations' && selectedCareerPath
            ? `Career path · ${selectedCareerPath.summary}`
            : undefined}
        backLabel={selectedRecord ? 'Back to Applications' : undefined}
      />
      <ApplicationsTabs
        activeTab={activeTab}
        showAddApplication={hasProfile && !showAddForm && activeTab === 'my-applications'}
        onAddApplication={() => { setSelectedApplication(null); setEditingApplication(false); setShowAddForm(true) }}
        onChange={(tab) => {
          setSearchParams(tab === 'my-applications' ? {} : { tab })
          setShowAddForm(false)
          setEditingApplication(false)
          setSelectedApplication(null)
          setSelectedCompanyOpening(null)
          setSelectedCareerPath(null)
        }}
      />

      <div
        id="applications-tabpanel"
        role="tabpanel"
        aria-labelledby={`applications-tab-${activeTab}`}
        className={`min-w-0 ${showRecommendationList ? 'flex flex-1 flex-col' : ''}`}
      >
        {activeTab === 'my-applications' && !hasProfile && (
          <div className="rounded-xl border border-blue-100 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Save your profile to start tracking applications</h2>
            <p className="mt-2 text-sm text-slate-600">Your application records are attached to your saved profile.</p>
            <Link to="/onboarding" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Go to onboarding</Link>
          </div>
        )}
        {activeTab === 'my-applications' && hasProfile && query.isLoading && (
          <p role="status" className="rounded-xl border border-blue-100 bg-white p-8 text-center text-sm text-slate-600">Loading your applications…</p>
        )}
        {activeTab === 'my-applications' && hasProfile && query.isError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-rose-700">{query.error instanceof Error ? query.error.message : 'Could not load your applications.'}</p>
            <button type="button" onClick={() => query.refetch()} className="mt-3 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Try again</button>
          </div>
        )}
        {showAddForm && activeTab === 'my-applications' && hasProfile && (
          <AddApplicationForm
            initialApplication={editingApplication ? selectedRecord ?? undefined : undefined}
            onCancel={() => { setShowAddForm(false); setEditingApplication(false) }}
            onSave={saveApplication}
            isSaving={createMutation.isPending || updateMutation.isPending}
            saveError={saveError}
          />
        )}
        {!showAddForm && !selectedRecord && activeTab === 'my-applications' && hasProfile && query.isSuccess && (
          applications.length ? (
            <MyApplicationsTab
              allApplications={applications}
              filteredApplications={filters.filteredApplications}
              query={filters.query}
              status={filters.status}
              dateFilter={filters.dateFilter}
              onQueryChange={filters.setQuery}
              onStatusChange={filters.setStatus}
              onDateChange={filters.setDateFilter}
              onView={setSelectedApplication}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-blue-200 bg-white p-10 text-center">
              <h2 className="text-lg font-bold text-slate-900">No applications saved yet</h2>
              <p className="mt-2 text-sm text-slate-600">Add a role to keep its status, dates and notes in your tracker.</p>
              <button type="button" onClick={() => setShowAddForm(true)} className="mt-4 min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Add your first application</button>
            </div>
          )
        )}
        {!showAddForm && selectedRecord && activeTab === 'my-applications' && (
          <ApplicationDetailsPanel
            application={selectedRecord}
            onUpdate={updateApplication}
            onEdit={() => { setEditingApplication(true); setShowAddForm(true) }}
          />
        )}
        {activeTab === 'recommendations' && <CareerRecommendationsTab selectedPath={selectedCareerPath} onSelectPath={setSelectedCareerPath} roadmapNodes={roadmap.nodes} />}
        {activeTab === 'companies' && <>
          {companySaveError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{companySaveError}</p>}
          <CompaniesTab applications={applications} selectedOpening={selectedCompanyOpening} onSelectedOpeningChange={setSelectedCompanyOpening} onAddOpening={addCompanyOpening} roadmapNodes={roadmap.nodes} />
        </>}
      </div>
    </section>
  )
}
