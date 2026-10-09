import { useState } from 'react'
import { AddApplicationForm, type NewApplicationInput } from '../components/shared/AddApplicationForm'
import { ApplicationDetailsPanel } from '../components/shared/ApplicationDetailsPanel'
import { ApplicationsHeader } from '../components/shared/ApplicationsHeader'
import { ApplicationsTabs } from '../components/shared/ApplicationsTabs'
import { CompaniesTab, type CompanyOpening } from '../components/companies/CompaniesTab'
import { MyApplicationsTab } from '../components/my-applications/MyApplicationsTab'
import { CareerRecommendationsTab } from '../components/recommendations/CareerRecommendationsTab'
import { applicationsMockData } from '../data/applicationsMockData'
import { useApplicationFilters } from '../hooks/useApplicationFilters'
import type { ApplicationEntry, ApplicationTabKey, CareerPathRecommendation } from '../type'

export function ApplicationsPage() {
  const [applications, setApplications] = useState(applicationsMockData)
  const [activeTab, setActiveTab] = useState<ApplicationTabKey>('my-applications')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingApplication, setEditingApplication] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<ApplicationEntry | null>(null)
  const [selectedCompanyOpening, setSelectedCompanyOpening] = useState<CompanyOpening | null>(null)
  const [selectedCareerPath, setSelectedCareerPath] = useState<CareerPathRecommendation | null>(null)
  const filters = useApplicationFilters(applications)

  function addApplication(input: NewApplicationInput) {
    const today = new Date()
    const dateISO = input.applicationDate || today.toISOString().slice(0, 10)
    const relevantDate = input.applicationDate
      ? new Date(`${input.applicationDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const applicationFields = {
      ...input,
      relevantDate: `${input.applicationDate ? 'Applied' : 'Added'} ${relevantDate}`,
      relevantDateISO: dateISO,
    }
    if (editingApplication && selectedApplication) {
      const updatedApplication: ApplicationEntry = { ...selectedApplication, ...applicationFields }
      setApplications((current) => current.map((application) => application.id === updatedApplication.id ? updatedApplication : application))
      setSelectedApplication(updatedApplication)
      setEditingApplication(false)
    } else {
      const newApplication: ApplicationEntry = { ...applicationFields, id: crypto.randomUUID() }
      setApplications((current) => [newApplication, ...current])
      setSelectedApplication(null)
    }
    setShowAddForm(false)
    setActiveTab('my-applications')
  }

  function updateApplication(updatedApplication: ApplicationEntry) {
    setApplications((current) => current.map((application) => application.id === updatedApplication.id ? updatedApplication : application))
    setSelectedApplication(updatedApplication)
  }

  function addCompanyOpening(opening: CompanyOpening) {
    if (applications.some((application) => application.company === opening.company && application.role === opening.role)) {
      setActiveTab('my-applications')
      return
    }
    addApplication({
      company: opening.company,
      role: opening.role,
      status: 'wishlist',
      nextStep: '',
      jobUrl: '',
      applicationDate: '',
      jobDescription: `Sample saved description · ${opening.jobDescription}\n\nRequired skills\n${opening.requiredSkills.join(' · ')}\n\nPreferred skills\n${opening.preferredSkills.join(' · ')}`,
    })
  }

  return (
    <section aria-label="Applications" className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-5 pb-4">
      <ApplicationsHeader
        onAddApplication={() => { setSelectedApplication(null); setEditingApplication(false); setShowAddForm(true) }}
        formOpen={showAddForm}
        detailOpen={Boolean(selectedApplication)}
        detailLabel={selectedApplication ? `${selectedApplication.company} / ${selectedApplication.role}` : undefined}
        onBack={() => {
          if (activeTab === 'companies') setSelectedCompanyOpening(null)
          else if (activeTab === 'recommendations') setSelectedCareerPath(null)
          else setSelectedApplication(null)
        }}
        activeTab={activeTab}
        titleOverride={activeTab === 'companies' ? selectedCompanyOpening?.role : activeTab === 'recommendations' ? selectedCareerPath?.title : undefined}
        subtitleOverride={activeTab === 'companies' && selectedCompanyOpening
          ? `${selectedCompanyOpening.company} · ${selectedCompanyOpening.location} · ${selectedCompanyOpening.workStyle} · ${selectedCompanyOpening.experience}`
          : activeTab === 'recommendations' && selectedCareerPath
            ? `Career path · ${selectedCareerPath.summary}`
            : undefined}
        backLabel={activeTab === 'companies' && selectedCompanyOpening
          ? 'Back to Companies'
          : activeTab === 'recommendations' && selectedCareerPath
            ? 'Back to Recommendations'
            : selectedApplication ? 'Back to Applications' : undefined}
      />
      <ApplicationsTabs
        activeTab={activeTab}
        onChange={(tab) => {
          setActiveTab(tab)
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
        className="min-w-0"
      >
        {showAddForm && activeTab === 'my-applications' && (
          <AddApplicationForm
            initialApplication={editingApplication ? selectedApplication ?? undefined : undefined}
            onCancel={() => {
              setShowAddForm(false)
              setEditingApplication(false)
            }}
            onSave={addApplication}
          />
        )}
        {!showAddForm && !selectedApplication && activeTab === 'my-applications' && (
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
        )}
        {!showAddForm && selectedApplication && activeTab === 'my-applications' && (
          <ApplicationDetailsPanel
            application={selectedApplication}
            onUpdate={updateApplication}
            onEdit={() => { setEditingApplication(true); setShowAddForm(true) }}
          />
        )}
        {activeTab === 'recommendations' && <CareerRecommendationsTab selectedPath={selectedCareerPath} onSelectPath={setSelectedCareerPath} />}
        {activeTab === 'companies' && <CompaniesTab applications={applications} selectedOpening={selectedCompanyOpening} onSelectedOpeningChange={setSelectedCompanyOpening} onAddOpening={addCompanyOpening} />}
      </div>

    </section>
  )
}
