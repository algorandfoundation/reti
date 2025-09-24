import type { Proposal, ProposalUserCategory } from '../types/proposal'

export type ProposalCategoryTabsType = Record<
  ProposalUserCategory,
  { label: string; data: Proposal[]; displayNum?: number }
>

export type ProposalCategoryTabsProps = {
  tabs: ProposalCategoryTabsType
  activeTab: ProposalUserCategory
  setActiveTab: (value: React.SetStateAction<ProposalUserCategory>) => void
}

export function ProposalCategoryTabs({ tabs, activeTab, setActiveTab }: ProposalCategoryTabsProps) {
  return (
    <div className="inline-flex rounded-lg bg-white/10 dark:bg-black/10 p-0.5">
      {(Object.keys(tabs) as ProposalUserCategory[]).map((k) => (
        <button
          key={k}
          onClick={() => setActiveTab(k)}
          className={`px-2 h-8 text-sm rounded-md transition ${
            activeTab === k
              ? 'bg-white text-algo-blue dark:bg-algo-black dark:text-white'
              : 'opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex flex-row">
            <span>{tabs[k].label}</span>
            <span className="hidden @xl:flex @xl:ml-1">
              {tabs[k].displayNum !== undefined && `(${tabs[k].displayNum})`}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
