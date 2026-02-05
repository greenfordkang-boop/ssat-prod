'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import Navigation from './Navigation'
import OverviewDashboard from './OverviewDashboard'
import FileUploadPage from './FileUploadPage'
import ProcessDashboard from './ProcessDashboard'
import KeyIssuesBoard from './KeyIssuesBoard'
import DowntimeDashboard from './DowntimeDashboard'
import WipDashboard from './WipDashboard'
import MoldDashboard from './MoldDashboard'
import QualityDashboard from './QualityDashboard'
import PivotDashboard from './PivotDashboard'
import LoginForm from './LoginForm'

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const { loading: dataLoading } = useData()

  const [activeTab, setActiveTab] = useState('overview')
  const [activeProcess, setActiveProcess] = useState<string | null>(null)
  const [activeSubMenu, setActiveSubMenu] = useState('production')

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return <LoginForm />
  }

  // Handle tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === 'process') {
      setActiveProcess('injection')
      setActiveSubMenu('production')
    } else if (tab === 'wip') {
      setActiveSubMenu('status')
    } else if (tab === 'mold') {
      setActiveSubMenu('status')
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navigation
        activeTab={activeTab}
        activeProcess={activeProcess}
        activeSubMenu={activeSubMenu}
        onTabChange={handleTabChange}
        onProcessChange={setActiveProcess}
        onSubMenuChange={setActiveSubMenu}
      />

      {/* Loading Overlay */}
      {dataLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 shadow-xl">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-slate-600">데이터 로딩 중...</p>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && <OverviewDashboard />}
        {activeTab === 'process' && activeProcess === 'key-issues' && (
          <KeyIssuesBoard />
        )}
        {activeTab === 'process' && activeProcess && activeProcess !== 'key-issues' && (
          <ProcessDashboard process={activeProcess} subMenu={activeSubMenu} />
        )}
        {activeTab === 'downtime' && <DowntimeDashboard />}
        {activeTab === 'wip' && <WipDashboard subTab={activeSubMenu} />}
        {activeTab === 'mold' && <MoldDashboard subTab={activeSubMenu} />}
        {activeTab === 'quality' && <QualityDashboard />}
        {activeTab === 'pivot' && <PivotDashboard />}
        {activeTab === 'upload' && <FileUploadPage />}
      </main>
    </div>
  )
}
