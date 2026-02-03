'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'

interface NavigationProps {
  activeTab: string
  activeProcess: string | null
  activeSubMenu: string
  onTabChange: (tab: string) => void
  onProcessChange: (process: string | null) => void
  onSubMenuChange: (menu: string) => void
}

const mainTabs = [
  { id: 'overview', name: '종합현황' },
  { id: 'process', name: '공정현황' },
  { id: 'downtime', name: '비가동현황' },
  { id: 'wip', name: '재공재고' },
  { id: 'quality', name: '품질분석' },
  { id: 'pivot', name: '데이터조회' },
  { id: 'upload', name: '파일업로드' }
]

const processTabs = [
  { id: 'injection', name: '사출' },
  { id: 'painting', name: '도장' },
  { id: 'printing', name: '인쇄' },
  { id: 'assembly', name: '조립' }
]

const commonSubMenus = [
  { id: 'production', name: '생산현황' },
  { id: 'uph', name: 'UPH현황' },
  { id: 'cycletime', name: 'Cycle Time' },
  { id: 'packaging', name: '검포장현황' }
]

const assemblyExtraMenus = [
  { id: 'defect-repair', name: '불량수리현황' },
  { id: 'material-defect', name: '자재불량현황' }
]

export default function Navigation({
  activeTab,
  activeProcess,
  activeSubMenu,
  onTabChange,
  onProcessChange,
  onSubMenuChange
}: NavigationProps) {
  const { user, profile, signOut, isAdmin } = useAuth()
  const { syncing, loading, selectedMonth, setSelectedMonth, refreshData } = useData()

  return (
    <div className="sticky top-0 z-50">
      {/* Main Navigation - Apple Style */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            {/* Logo */}
            <div className="flex items-center">
              <span className="font-semibold text-[15px] tracking-tight text-gray-900">신성오토텍</span>
            </div>

            {/* Main Tabs */}
            <div className="flex items-center">
              {mainTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    onTabChange(tab.id)
                    if (tab.id !== 'process') onProcessChange(null)
                  }}
                  className={`px-4 py-1.5 mx-0.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            {/* User Info & Controls */}
            <div className="flex items-center gap-3">
              {/* Month Selector */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md border-0 text-[13px] font-medium focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}월</option>
                ))}
              </select>

              {/* Refresh Button */}
              <button
                onClick={refreshData}
                disabled={syncing || loading}
                className={`p-1.5 rounded-md transition-colors ${
                  syncing || loading
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="데이터 새로고침"
              >
                <svg
                  className={`w-4 h-4 ${syncing || loading ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Sync Status */}
              {(syncing || loading) && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-[12px] text-gray-500">{loading ? '로딩' : '동기화'}</span>
                </div>
              )}

              {/* Divider */}
              <div className="w-px h-4 bg-gray-200" />

              {/* User */}
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-gray-600">
                  {profile?.display_name || user?.email?.split('@')[0]}
                  {isAdmin && <span className="ml-1 text-amber-600 font-medium">관리자</span>}
                </span>
                <button
                  onClick={signOut}
                  className="px-3 py-1.5 text-[13px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Process Sub Navigation */}
      {activeTab === 'process' && (
        <div className="bg-gray-50/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center h-11 gap-1">
              {processTabs.map(process => (
                <button
                  key={process.id}
                  onClick={() => onProcessChange(process.id)}
                  className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                    activeProcess === process.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  {process.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub Menu (3rd level) */}
      {activeTab === 'process' && activeProcess && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center h-10 gap-0.5">
              {commonSubMenus.map(menu => (
                <button
                  key={menu.id}
                  onClick={() => onSubMenuChange(menu.id)}
                  className={`px-3 py-1 rounded text-[12px] font-medium transition-all duration-200 ${
                    activeSubMenu === menu.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {menu.name}
                </button>
              ))}
              {activeProcess === 'assembly' && assemblyExtraMenus.map(menu => (
                <button
                  key={menu.id}
                  onClick={() => onSubMenuChange(menu.id)}
                  className={`px-3 py-1 rounded text-[12px] font-medium transition-all duration-200 ${
                    activeSubMenu === menu.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {menu.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WIP Sub Navigation */}
      {activeTab === 'wip' && (
        <div className="bg-gray-50/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center h-11 gap-1">
              <button
                onClick={() => onSubMenuChange('status')}
                className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                  activeSubMenu === 'status'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                재고현황
              </button>
              <button
                onClick={() => onSubMenuChange('price')}
                className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                  activeSubMenu === 'price'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                부품단가표
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
