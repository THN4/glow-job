import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrainCircuit, ChartNoAxesCombined, Cloud, Code2, Container, Database, Layers3, Network, ShieldCheck, TestTubeDiagonal, Workflow, Wrench } from 'lucide-react'
import catalog from '../src/lib/skillIconCatalog.json' with { type: 'json' }
import { resolveSkillIcon } from '../src/lib/skillIcons.ts'

const symbols = { brain: BrainCircuit, chart: ChartNoAxesCombined, cloud: Cloud, code: Code2, container: Container, database: Database, layers: Layers3, network: Network, shield: ShieldCheck, test: TestTubeDiagonal, workflow: Workflow, wrench: Wrench }
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const counts = { logo: 0, symbol: 0, initials: 0 }
const cards = catalog.map(skill => {
  const icon = resolveSkillIcon(skill.skill_name, skill.skill_id)
  counts[icon.kind]++
  let visual = escape(icon.name)
  if (icon.kind === 'logo') {
    const svg = readFileSync(new URL(`../src/assets/technology/${icon.name}.svg`, import.meta.url))
    visual = `<img alt="" width="32" height="32" src="data:image/svg+xml;base64,${svg.toString('base64')}">`
  } else if (icon.kind === 'symbol') visual = renderToStaticMarkup(createElement(symbols[icon.name], { size: 32 }))
  return `<article data-kind="${icon.kind}"><span class="icon">${visual}</span><div><strong>${escape(skill.skill_name)}</strong><small>#${skill.skill_id} · ${escape(skill.skill_category)} · ${icon.kind}</small><small>${skill.aliases.map(escape).join(', ')}</small></div></article>`
}).join('\n')
const dir = new URL('../../docs/skills/', import.meta.url)
mkdirSync(dir, { recursive: true })
writeFileSync(new URL('skill-icon-audit.html', dir), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GlowJob skill icon inventory</title><style>body{font:15px system-ui;background:#f8fafc;color:#0f172a;margin:32px}input,select{padding:10px;border:1px solid #cbd5e1;border-radius:8px;margin:0 8px 24px 0}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px}article{display:flex;gap:14px;align-items:center;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px}.icon{display:grid;place-items:center;flex-shrink:0;width:42px;height:42px;background:#f1f5f9;border-radius:8px;font-weight:bold}img{object-fit:contain}small{display:block;color:#64748b;margin-top:4px}article[hidden]{display:none}</style><h1>Skill icon inventory</h1><p>${catalog.length} database skills · ${counts.logo} branded logos · ${counts.symbol} topic symbols · ${counts.initials} initials. Initials preserve ambiguous names without inventing a brand.</p><input id="search" type="search" aria-label="Search skills" placeholder="Search names or aliases"><select id="kind" aria-label="Icon type"><option value="">All icons</option><option>logo</option><option>symbol</option><option>initials</option></select><main>${cards}</main><script>const search=document.getElementById('search'),kind=document.getElementById('kind');function filter(){document.querySelectorAll('article').forEach(card=>card.hidden=!card.textContent.toLowerCase().includes(search.value.toLowerCase())||!!kind.value&&card.dataset.kind!==kind.value)}search.addEventListener('input',filter);kind.addEventListener('change',filter)</script></html>`)
console.log(JSON.stringify({ skills: catalog.length, ...counts }))
