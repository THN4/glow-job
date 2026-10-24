import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock3, FileText, LoaderCircle, Sparkles, UploadCloud } from 'lucide-react'
import { extractCv, loadCareerMatch, loadCareerProfiles, loadSavedProfile, saveProfile, type CareerMatchResult, type CareerProfileOption, type CvItem, type CvProfile, type ExtractionResult } from '../api'

const sections: Array<{ key: keyof Pick<CvProfile, 'education' | 'technicalSkills' | 'softSkills' | 'experience' | 'projects' | 'certifications' | 'tools' | 'languages'>; title: string; fields: Array<{ key: string; label: string; multiline?: boolean; list?: boolean }> }> = [
  { key: 'education', title: 'การศึกษา', fields: [{ key: 'degree', label: 'วุฒิการศึกษา' }, { key: 'fieldOfStudy', label: 'สาขา' }, { key: 'institution', label: 'สถาบัน' }, { key: 'startDate', label: 'เริ่มต้น' }, { key: 'endDate', label: 'สิ้นสุด' }] },
  { key: 'technicalSkills', title: 'ทักษะทางเทคนิค', fields: [{ key: 'name', label: 'ชื่อทักษะ' }, { key: 'category', label: 'หมวดหมู่' }, { key: 'proficiency', label: 'ระดับ' }] },
  { key: 'softSkills', title: 'ทักษะด้านบุคลิกภาพ', fields: [{ key: 'name', label: 'ชื่อทักษะ' }] },
  { key: 'experience', title: 'ประสบการณ์ทำงาน', fields: [{ key: 'title', label: 'ตำแหน่ง' }, { key: 'organization', label: 'องค์กร' }, { key: 'location', label: 'สถานที่' }, { key: 'startDate', label: 'เริ่มต้น' }, { key: 'endDate', label: 'สิ้นสุด' }, { key: 'description', label: 'รายละเอียด', multiline: true }, { key: 'highlights', label: 'ผลงานสำคัญ (คั่นด้วย comma)', list: true }, { key: 'technologies', label: 'เทคโนโลยี (คั่นด้วย comma)', list: true }] },
  { key: 'projects', title: 'โปรเจกต์', fields: [{ key: 'name', label: 'ชื่อโปรเจกต์' }, { key: 'role', label: 'บทบาท' }, { key: 'description', label: 'รายละเอียด', multiline: true }, { key: 'url', label: 'ลิงก์' }, { key: 'technologies', label: 'เทคโนโลยี (คั่นด้วย comma)', list: true }] },
  { key: 'certifications', title: 'ใบรับรองและกิจกรรม', fields: [{ key: 'name', label: 'ชื่อ' }, { key: 'issuer', label: 'ผู้ออก/ผู้จัด' }, { key: 'kind', label: 'ประเภท' }, { key: 'date', label: 'วันที่' }, { key: 'detail', label: 'รายละเอียด' }] },
  { key: 'tools', title: 'เครื่องมือ', fields: [{ key: 'name', label: 'ชื่อเครื่องมือ' }] },
  { key: 'languages', title: 'ภาษา', fields: [{ key: 'name', label: 'ภาษา' }, { key: 'proficiency', label: 'ระดับภาษา' }] },
]

const stages = ['reading', 'skills', 'education', 'experience', 'building']
const stageNames: Record<string, string> = { reading: 'กำลังอ่าน CV', skills: 'กำลังระบุทักษะ', education: 'กำลังอ่านประวัติการศึกษา', experience: 'กำลังอ่านงานและโปรเจกต์', building: 'กำลังจัดทำโปรไฟล์' }

function isWebUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function newItem(section: string): CvItem {
  const base = { id: crypto.randomUUID(), confidence: 'high', needsReview: false, source: 'user' as const }
  switch (section) {
    case 'education': return { ...base, degree: '', fieldOfStudy: '', institution: '', startDate: null, endDate: null, isCurrent: false, gpa: null, description: null }
    case 'technicalSkills': return { ...base, name: '', category: 'other', proficiency: 'unknown', proficiencyBasis: 'unknown', evidence: [], catalogMatch: null }
    case 'experience': return { ...base, title: '', organization: '', employmentType: null, location: null, startDate: null, endDate: null, isCurrent: false, description: null, highlights: [], technologies: [] }
    case 'projects': return { ...base, name: '', description: null, role: null, url: null, startDate: null, endDate: null, technologies: [] }
    case 'certifications': return { ...base, kind: 'activity', name: '', issuer: null, date: null, detail: null }
    case 'languages': return { ...base, name: '', proficiency: null }
    default: return { ...base, name: '' }
  }
}

export function CvOnboardingPage() {
  const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'done'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [profile, setProfile] = useState<CvProfile | null>(null)
  const [meta, setMeta] = useState<ExtractionResult['meta'] | null>(null)
  const [stage, setStage] = useState('reading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState('')
  const [careerProfiles, setCareerProfiles] = useState<CareerProfileOption[]>([])
  const [careerProfilesLoaded, setCareerProfilesLoaded] = useState(false)
  const [careerProfileId, setCareerProfileId] = useState('')
  const [match, setMatch] = useState<CareerMatchResult | null>(null)
  const [matchBusy, setMatchBusy] = useState(false)
  const [matchError, setMatchError] = useState('')
  const extractionController = useRef<AbortController | null>(null)

  useEffect(() => {
    void loadSavedProfile().then((saved) => {
      if (saved) {
        setProfile(saved.profile)
        setSavedId(saved.profileId)
        setStep('review')
      }
    })
  }, [])

  useEffect(() => {
    if (step !== 'done') return
    let active = true
    void loadCareerProfiles().then((profiles) => {
      if (active) { setCareerProfiles(profiles); setCareerProfilesLoaded(true) }
    }).catch((caught) => {
      if (active) { setCareerProfilesLoaded(true); setMatchError(caught instanceof Error ? caught.message : 'โหลดรายการอาชีพไม่สำเร็จ') }
    })
    return () => { active = false }
  }, [step])

  function updateItem(section: keyof CvProfile, index: number, field: string, value: string) {
    setProfile((current) => {
      if (!current) return current
      const list = current[section]
      if (!Array.isArray(list)) return current
      const updated = [...list] as CvItem[]
      const previous = updated[index]
      if (!previous) return current
      updated[index] = { ...previous, [field]: field === 'technologies' || field === 'highlights' ? value.split(',').map((part) => part.trim()).filter(Boolean) : value, source: 'user' }
      return { ...current, [section]: updated }
    })
  }

  function updatePersonal(field: string, value: string) {
    setProfile((current) => current ? { ...current, personal: { ...current.personal, [field]: value, source: 'user' } } : current)
  }

  function removeItem(section: keyof CvProfile, index: number) {
    setProfile((current) => {
      if (!current || !Array.isArray(current[section])) return current
      return { ...current, [section]: current[section].filter((_, itemIndex) => itemIndex !== index) }
    })
  }

  function addItem(section: keyof CvProfile) {
    setProfile((current) => {
      if (!current || !Array.isArray(current[section])) return current
      return { ...current, [section]: [...current[section], newItem(section)] }
    })
  }

  async function startExtraction() {
    if (!file) return
    const controller = new AbortController()
    extractionController.current = controller
    setBusy(true); setError(''); setStage('reading'); setStep('processing')
    try {
      const result = await extractCv(file, setStage, controller.signal)
      setProfile(result.profile); setMeta(result.meta); setStep('review')
    } catch (caught) {
      if (controller.signal.aborted) return
      setError(caught instanceof Error ? caught.message : 'สกัดข้อมูลไม่สำเร็จ')
      setStep('upload')
    } finally {
      if (extractionController.current === controller) extractionController.current = null
      setBusy(false)
    }
  }

  function cancelExtraction() {
    extractionController.current?.abort()
    extractionController.current = null
    setBusy(false)
    setError('')
    setFile(null)
    setStep('upload')
  }

  async function confirmAndSave() {
    if (!profile) return
    setBusy(true); setError('')
    try {
      const saved = await saveProfile(profile)
      setSavedId(saved.profileId); setStep('done')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกโปรไฟล์ไม่สำเร็จ')
    } finally { setBusy(false) }
  }

  async function calculateMatch() {
    if (!savedId || !careerProfileId) return
    setMatchBusy(true); setMatchError(''); setMatch(null)
    try {
      setMatch(await loadCareerMatch(savedId, Number(careerProfileId)))
    } catch (caught) {
      setMatchError(caught instanceof Error ? caught.message : 'คำนวณผล match ไม่สำเร็จ')
    } finally { setMatchBusy(false) }
  }

  function percentage(value: number | null | undefined): string {
    return value == null ? 'ยังประเมินไม่ได้' : `${value.toFixed(1)}%`
  }

  function matchStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      covered: 'มีทักษะนี้',
      proficiency_gap: 'ควรเพิ่มระดับ',
      missing_from_profile: 'ยังไม่พบในโปรไฟล์',
      not_assessed: 'ยังไม่มีข้อมูลระดับ',
      market_data_insufficient: 'ข้อมูลตลาดไม่พอ',
    }
    return labels[status] ?? status
  }

  const displayedMatchSkills = match ? [...match.skills].sort((a, b) => {
    if (a.isCoreSkill !== b.isCoreSkill) return a.isCoreSkill ? -1 : 1
    if (a.isCoreSkill && b.isCoreSkill) {
      const aPriority = a.priorityRank ?? Number.MAX_SAFE_INTEGER
      const bPriority = b.priorityRank ?? Number.MAX_SAFE_INTEGER
      if (aPriority !== bPriority) return aPriority - bPriority
      return (a.coreRank ?? Number.MAX_SAFE_INTEGER) - (b.coreRank ?? Number.MAX_SAFE_INTEGER)
    }
    return a.skillName.localeCompare(b.skillName)
  }) : []

  const activeStep = step === 'upload' || step === 'processing' ? 1 : step === 'review' ? 2 : 5
  return (
    <main className="min-h-screen bg-sky-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-10">
        <nav aria-label="ขั้นตอน" className="mb-10 flex items-center justify-between gap-2 text-center text-sm text-slate-500">
          {['อัปโหลด CV', 'ตรวจโปรไฟล์', 'เป้าหมายอาชีพ', 'ความชอบ', 'ยืนยัน'].map((name, index) => <div key={name} className={`flex-1 ${index + 1 <= activeStep ? 'font-semibold text-blue-600' : ''}`}><span className="mx-auto mb-2 flex size-8 items-center justify-center rounded-full bg-blue-50">{index + 1 < activeStep ? <Check size={16} /> : index + 1}</span>{name}</div>)}
        </nav>

        {step === 'upload' && <section>
          <h1 className="text-3xl font-bold text-slate-900">เริ่มต้นด้วย CV ของคุณ</h1>
          <p className="mt-2 text-slate-500">Gemini จะช่วยจัดข้อมูลทักษะ การศึกษา ประสบการณ์ และโปรเจกต์ให้เป็นโปรไฟล์</p>
          <label className="mt-8 flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-8 text-center hover:bg-blue-50">
            <UploadCloud className="mb-4 text-blue-600" size={42} />
            <span className="font-semibold text-slate-900">{file ? file.name : 'เลือกไฟล์ CV ของคุณ'}</span>
            <span className="mt-2 text-sm text-slate-500">รองรับ PDF, JPG, PNG หรือ WEBP ขนาดไม่เกิน 10 MB</span>
            <input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={!file || busy} onClick={() => void startExtraction()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">วิเคราะห์ CV <ArrowRight size={18} /></button>
          <p className="mt-4 text-center text-xs text-slate-500">CV จะถูกใช้เพื่อสร้างโปรไฟล์ และคุณตรวจสอบข้อมูลก่อนบันทึกได้</p>
        </section>}

        {step === 'processing' && <section aria-live="polite">
          <h1 className="text-3xl font-bold text-slate-900">กำลังวิเคราะห์ CV</h1>
          <p className="mt-2 text-slate-500">กำลังสกัดและจัดระเบียบข้อมูล กรุณาเปิดหน้านี้ไว้จนกว่าจะเสร็จ</p>
          <div className="mt-8 space-y-4 rounded-2xl bg-blue-50 p-6">
            {stages.map((item) => { const complete = stages.indexOf(stage) > stages.indexOf(item); const current = stage === item; return <div key={item} className="flex items-center gap-4"><span className={`flex size-9 items-center justify-center rounded-full ${complete ? 'bg-emerald-500 text-white' : current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{complete ? <Check size={18} /> : current ? <LoaderCircle size={18} className="animate-spin" /> : <FileText size={18} />}</span><span className={current ? 'font-semibold text-slate-900' : 'text-slate-600'}>{stageNames[item]}</span></div> })}
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-blue-700"><Clock3 size={16} /> ปกติใช้เวลาไม่เกินหนึ่งนาที</p>
          <button onClick={cancelExtraction} className="mx-auto mt-5 block rounded-xl border border-blue-200 px-5 py-2.5 text-sm font-semibold text-blue-700">ยกเลิกการรอ แล้วเลือก CV ใหม่</button>
          <p className="mt-2 text-center text-xs text-slate-500">การยกเลิกจะหยุดรอผลบนหน้านี้ งานที่เริ่มบน Backend อาจทำต่อจนเสร็จ แต่จะไม่มีการบันทึกโปรไฟล์จนกว่าคุณจะยืนยัน</p>
        </section>}

        {step === 'review' && profile && <section>
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold text-slate-900">ตรวจข้อมูลที่สกัดได้</h1><p className="mt-2 text-slate-500">แก้ไขข้อมูลให้ถูกต้องก่อนกดยืนยัน ระบบจะบันทึกลงฐานข้อมูลหลังจากคุณกดยืนยัน</p></div>{meta && <span className="rounded-full bg-violet-100 px-3 py-1 text-sm text-violet-700"><Sparkles className="mr-1 inline" size={14} /> ตรวจ {meta.reviewCount} จุด</span>}</div>
          {meta?.warnings?.length ? <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{meta.warnings.join(' ')}</div> : null}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 md:col-span-2"><h2 className="mb-4 font-bold">ข้อมูลส่วนตัว</h2><div className="grid gap-3 sm:grid-cols-2">{[['fullName','ชื่อ-นามสกุล'],['headline','ตำแหน่ง/คำแนะนำตัว'],['email','อีเมลจาก CV'],['phone','เบอร์โทร'],['location','ที่อยู่']].map(([key,label])=><label key={key} className="text-sm text-slate-600">{label}<input value={String(profile.personal[key] ?? '')} onChange={(e)=>updatePersonal(key,e.target.value)} className="mt-1 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-slate-900" /></label>)}</div><label className="mt-3 block text-sm text-slate-600">สรุปโปรไฟล์<textarea value={profile.summary ?? ''} onChange={(e)=>setProfile({...profile,summary:e.target.value,personal:{...profile.personal,source:'user'}})} rows={3} className="mt-1 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-slate-900" /></label></section>
            {sections.map((section) => <section key={section.key} className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="font-bold">{section.title} <span className="font-normal text-slate-500">({profile[section.key].length})</span></h2><button onClick={()=>addItem(section.key)} className="text-xs font-semibold text-blue-700">+ เพิ่มรายการ</button></div><div className="space-y-4">{profile[section.key].length === 0 ? <p className="text-sm text-slate-500">ไม่พบข้อมูล</p> : profile[section.key].map((item,index)=><div key={item.id} className="rounded-xl border border-blue-100 bg-white p-3"><div className="mb-2 flex items-center justify-between text-xs font-medium text-blue-600"><span>รายการ {index+1}</span><button onClick={()=>removeItem(section.key,index)} className="text-red-600">ลบ</button></div><div className="grid gap-2">{section.fields.map((field)=>{const raw=item[field.key];const value=field.list&&Array.isArray(raw)?raw.join(', '):typeof raw==='string'?raw:'';return <label key={field.key} className="text-xs text-slate-500">{field.label}{field.multiline?<textarea value={value} onChange={(e)=>updateItem(section.key,index,field.key,e.target.value)} rows={2} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-900"/>:<input value={value} onChange={(e)=>updateItem(section.key,index,field.key,e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-900"/>}{field.key==='url'&&isWebUrl(value)&&<a href={value} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium text-blue-700 underline">เปิดลิงก์โปรเจกต์</a>}</label>})}</div></div>)}</div></section>)}
          </div>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-6 flex flex-wrap justify-between gap-3"><button onClick={()=>{setStep('upload');setProfile(null);setMeta(null)}} className="flex items-center gap-2 rounded-xl border border-blue-200 px-5 py-3 font-semibold text-blue-700"><ArrowLeft size={18}/> กลับไปเลือกไฟล์</button><button disabled={busy} onClick={()=>void confirmAndSave()} className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white disabled:opacity-50">{busy?<LoaderCircle className="animate-spin" size={18}/>:null}ยืนยันและบันทึก <ArrowRight size={18}/></button></div>
          {savedId && <p className="mt-3 text-right text-xs text-slate-500">โปรไฟล์ที่บันทึกไว้: {savedId}</p>}
        </section>}

        {step === 'done' && <section>
          <div className="text-center"><span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check size={34}/></span><h1 className="mt-5 text-3xl font-bold text-slate-900">บันทึกโปรไฟล์แล้ว</h1><p className="mt-2 text-slate-500">ข้อมูลที่คุณยืนยันถูกบันทึกลงฐานข้อมูลแล้ว</p><p className="mt-3 text-xs text-slate-400">Profile ID: {savedId}</p><button onClick={()=>setStep('review')} className="mt-4 rounded-xl border border-blue-200 px-5 py-2.5 font-semibold text-blue-700">กลับไปแก้ไขโปรไฟล์</button></div>

          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 sm:p-6">
            <h2 className="text-xl font-bold text-slate-900">ผลการ Match กับอาชีพ</h2>
            <p className="mt-1 text-sm text-slate-600">เลือกอาชีพเพื่อเทียบโปรไฟล์ที่ยืนยันแล้วกับทักษะที่ตลาดต้องการ</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <select aria-label="อาชีพที่ต้องการเทียบ" value={careerProfileId} onChange={(event) => { setCareerProfileId(event.target.value); setMatch(null) }} className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 py-3 text-slate-900" disabled={careerProfiles.length === 0}>
                <option value="">{careerProfiles.length ? 'เลือกอาชีพและระดับ' : careerProfilesLoaded ? 'ไม่มีอาชีพที่เลือกได้' : 'กำลังโหลดรายการอาชีพ…'}</option>
                {careerProfiles.map((career) => <option key={career.careerProfileId} value={career.careerProfileId}>{career.careerName} · {career.profileName} ({career.seniorityLevel})</option>)}
              </select>
              <button onClick={() => void calculateMatch()} disabled={!careerProfileId || matchBusy} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{matchBusy && <LoaderCircle className="animate-spin" size={18}/>}คำนวณผล Match</button>
            </div>
            {matchError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{matchError}</p>}
            {careerProfiles.length === 0 && !matchError && <p className="mt-3 text-sm text-slate-500">ยังไม่มีอาชีพที่มีข้อมูลตลาดให้เปรียบเทียบ</p>}
            {match && <div className="mt-6 space-y-5">
              <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">คะแนนหลักคำนวณจาก Top {match.coreSkillPolicy.nominalLimit} ทักษะตามน้ำหนักความต้องการของตลาด รวมทักษะที่น้ำหนักเสมอกับอันดับสุดท้ายด้วย คะแนนนี้แสดงการครอบคลุมทักษะในโปรไฟล์ ไม่ใช่คะแนนความพร้อมทำงาน</p>
              <p className="text-xs text-slate-500">Gap score แสดงขนาดช่องว่างโดยประมาณ ส่วน Priority score คูณ Gap score กับน้ำหนักตลาดของทักษะนั้น รายการ “ยังไม่พบในโปรไฟล์” เป็นเพียงข้อเสนอให้ตรวจยืนยัน</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[[`Core ${match.coreSkillPolicy.nominalLimit} ครอบคลุม`, match.scores.coreSkillMatchPct], ["ความครอบคลุมทักษะตลาดทั้งหมด", match.scores.marketSkillCoveragePct], ["ความสอดคล้องของระดับ", match.scores.proficiencyAlignmentPct], ["ทักษะที่ประเมินระดับได้", match.scores.assessmentCoveragePct]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-blue-100 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-blue-700">{percentage(value as number | null)}</p></div>)}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600"><span>Core skills ที่พบในโปรไฟล์: <strong className="text-slate-900">{match.skillSummary.coreCovered}/{match.coreSkillPolicy.includedCount}</strong></span><span>สถานะข้อมูล: <strong className="text-slate-900">{match.status === 'ready' ? 'เพียงพอ' : match.status === 'estimated' ? 'ประเมินเบื้องต้น' : 'ไม่เพียงพอ'}</strong></span><span>ตลาดอ้างอิง {match.marketSample.totalJobs} ประกาศงาน</span>{match.marketWindow && <span>ช่วงข้อมูล {match.marketWindow.startDate} ถึง {match.marketWindow.endDate}</span>}</div>
              {match.warnings.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{match.warnings.join(' ')}</div>}
              <div className="overflow-x-auto rounded-xl border border-blue-100 bg-white"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">ลำดับ / ทักษะ</th><th className="px-4 py-3">ระดับตลาด / CV</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">Gap score</th><th className="px-4 py-3">Priority score</th><th className="px-4 py-3">ยืนยันเพิ่ม</th></tr></thead><tbody className="divide-y divide-slate-100">{displayedMatchSkills.map((skill) => <tr key={skill.skillId}><td className="px-4 py-3 font-medium text-slate-900">{skill.isCoreSkill ? <span className="mr-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">Core #{skill.coreRank}</span> : <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">นอก Core</span>}{skill.priorityRank != null && <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">Gap #{skill.priorityRank}</span>}{skill.skillName}<span className="ml-2 block text-xs font-normal text-slate-500">ตลาดต้องการ {skill.demandPercentage.toFixed(1)}%</span></td><td className="px-4 py-3">{skill.marketTargetLevel ?? 'ไม่ระบุ'} / {skill.userProficiencyLevel ?? 'ไม่พบ/ไม่ระบุ'}</td><td className="px-4 py-3">{matchStatusLabel(skill.status)}</td><td className="px-4 py-3">{skill.gapScore == null ? '—' : `${(skill.gapScore * 100).toFixed(1)}%`}</td><td className="px-4 py-3">{skill.priorityScore == null ? '—' : skill.priorityScore.toFixed(2)}</td><td className="px-4 py-3">{skill.requiresConfirmation ? 'ควรตรวจยืนยัน' : 'ไม่ต้องยืนยันเพิ่ม'}</td></tr>)}</tbody></table></div>
              {match.unmatchedUserSkills.length > 0 && <p className="text-xs text-slate-500">ทักษะจาก CV ที่ยังจับคู่กับ catalog ไม่ได้: {match.unmatchedUserSkills.map((skill) => skill.rawSkillName).join(', ')}</p>}
            </div>}
          </div>
        </section>}
      </div>
    </main>
  )
}
