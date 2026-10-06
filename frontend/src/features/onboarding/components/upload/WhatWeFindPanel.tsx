import { useId } from 'react'
import { Award, BriefcaseBusiness, Code2, GraduationCap, NotebookText, Wrench } from 'lucide-react'
import { uploadCopy } from '../../../../lib/uploadConstants'
import { FindItem } from './FindItem'

const icons = { education: GraduationCap, skills: Code2, experience: BriefcaseBusiness, projects: NotebookText, certifications: Award, tools: Wrench }

export function WhatWeFindPanel() {
  const titleId = useId()
  return (
    <aside aria-labelledby={titleId} className="rounded-xl border border-border bg-panel p-5 sm:p-7 xl:min-h-160">
      <h2 id={titleId} className="text-2xl font-bold leading-7 text-foreground">{uploadCopy.find.title}</h2>
      <p className="mt-3 text-base leading-5 text-muted-foreground">{uploadCopy.find.description}</p>
      <ul className="mt-5 space-y-6">
        {uploadCopy.find.items.map(({ category, ...item }) => <FindItem key={category} icon={icons[category]} {...item} />)}
      </ul>
    </aside>
  )
}
