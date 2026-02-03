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
  { id: 'overview', name: '종합현황', icon: '📊' },
  { id: 'process', name: '공정별현황', icon: '🔧' },
  { id: 'wip', name: '재공재고', icon: '📦' }
]

const processTabs = [
  { id: 'injection', name: '사출공정', icon: '💉', color: '#3B82F6' },
  { id: 'painting', name: '도장공정', icon: '🎨', color: '#10B981' },
  { id: 'printing', name: '인쇄공정', icon: '🖨️', color: '#F59E0B' },
  { id: 'assembly', name: '조립공정', icon: '🔧', color: '#EF4444' }
]

const commonSubMenus = [
  { id: 'production', name: '생산현황', icon: '📊' },
  { id: 'uph', name: 'UPH현황', icon: '⚡' },
  { id: 'cycletime', name: 'Cycle Time', icon: '⏱️' },
  { id: 'packaging', name: '검포장현황', icon: '📦' }
]

const assemblyExtraMenus = [
  { id: 'defect-repair', name: '불량수리현황', icon: '🔧' },
  { id: 'material-defect', name: '자재불량현황', icon: '⚠️' }
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
  const { syncing, selectedMonth, setSelectedMonth } = useData()

  return (
    <div className="sticky top-0 z-50">
      {/* Main Navigation */}
      <nav className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">S</span>
                <span className="font-bold text-lg">신성오토텍</span>
              </div>
            </div>

            {/* Main Tabs */}
            <div className="flex items-center gap-2">
              {mainTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    onTabChange(tab.id)
                    if (tab.id !== 'process') onProcessChange(null)
                  }}
                  className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
                    activeTab === tab.id
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="mr-1.5">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </div>

            {/* User Info & Controls */}
            <div className="flex items-center gap-4">
              {/* Month Selector */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}월</option>
                ))}
              </select>

              {/* Sync Status */}
              {syncing && (
                <span className="text-sm text-blue-400 animate-pulse">동기화 중...</span>
              )}

              {/* User */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">
                  {profile?.display_name || user?.email}
                  {isAdmin && <span className="ml-1 text-yellow-400">(관리자)</span>}
                </span>
                <button
                  onClick={signOut}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition"
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
        <div className="bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-0">
              {processTabs.map(process => (
                <button
                  key={process.id}
                  onClick={() => onProcessChange(process.id)}
                  className={`px-7 py-4 text-sm font-medium transition border-b-2 ${
                    activeProcess === process.id
                      ? 'text-blue-600 border-blue-600 font-semibold'
                      : 'text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-2">{process.icon}</span>
                  {process.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub Menu (3rd level) */}
      {activeTab === 'process' && activeProcess && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1">
              {commonSubMenus.map(menu => (
                <button
                  key={menu.id}
                  onClick={() => onSubMenuChange(menu.id)}
                  className={`px-5 py-3 text-sm font-medium transition border-b-2 ${
                    activeSubMenu === menu.id
                      ? 'text-blue-500 border-blue-500 font-semibold'
                      : 'text-gray-400 border-transparent hover:text-gray-600'
                  }`}
                >
                  {menu.name}
                </button>
              ))}
              {activeProcess === 'assembly' && assemblyExtraMenus.map(menu => (
                <button
                  key={menu.id}
                  onClick={() => onSubMenuChange(menu.id)}
                  className={`px-5 py-3 text-sm font-medium transition border-b-2 ${
                    activeSubMenu === menu.id
                      ? 'text-blue-500 border-blue-500 font-semibold'
                      : 'text-gray-400 border-transparent hover:text-gray-600'
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
        <div className="bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-0">
              <button
                onClick={() => onSubMenuChange('status')}
                className={`px-7 py-4 text-sm font-medium transition border-b-2 ${
                  activeSubMenu === 'status'
                    ? 'text-blue-600 border-blue-600 font-semibold'
                    : 'text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                📊 재공현황
              </button>
              <button
                onClick={() => onSubMenuChange('price')}
                className={`px-7 py-4 text-sm font-medium transition border-b-2 ${
                  activeSubMenu === 'price'
                    ? 'text-blue-600 border-blue-600 font-semibold'
                    : 'text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                💰 부품단가표
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
