'use client'

import { useCallback } from 'react'
import { useData } from '@/contexts/DataContext'
import { parseCSV } from '@/lib/utils'

// 아이콘 컴포넌트
const UploadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

// 업로드 카드 타입
interface UploadCardConfig {
  id: string
  name: string
  description: string
  icon: string
  color: string
  borderColor: string
  bgColor: string
  textColor: string
  dataKey: 'rawData' | 'availabilityData' | 'detailData' | 'ctData' | 'materialDefectData' | 'wipInventoryData' | 'repairStatusData' | 'packagingStatusData' | 'priceData'
  process?: string // CT 데이터용
}

export default function FileUploadPage() {
  const { data, selectedMonth, setSelectedMonth, uploadData, clearData, syncing } = useData()

  // 파일 업로드 핸들러
  const handleFileUpload = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    dataKey: UploadCardConfig['dataKey'],
    process?: string
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsedData = parseCSV(text)

      if (parsedData.length === 0) {
        alert('CSV 파일에 데이터가 없습니다.')
        return
      }

      // CT 데이터의 경우 공정 정보 추가
      let dataToUpload: unknown[] = parsedData
      if (process) {
        const newData = parsedData.map(row => ({ ...row, 공정: process }))
        // 기존 CT 데이터에서 해당 공정 데이터만 제거하고 새로 추가
        const existingOther = data.ctData.filter(item => item.공정 !== process)
        dataToUpload = [...existingOther, ...newData]
      }

      // 생산실적의 경우 월 정보 추출
      let months: number[] = []
      if (dataKey === 'rawData') {
        const monthSet = new Set<number>()
        parsedData.forEach((row) => {
          const dateStr = row.생산일자 as string
          if (dateStr) {
            const match = dateStr.match(/\d{4}-(\d{2})-\d{2}/)
            if (match) monthSet.add(parseInt(match[1], 10))
          }
        })
        months = Array.from(monthSet)
      }

      const success = await uploadData(dataKey, dataToUpload, months.length > 0 ? months : undefined)

      if (success) {
        alert(`${parsedData.length}건 업로드 완료!`)
      } else {
        alert('업로드 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('파일 업로드 오류:', error)
      alert('파일 처리 중 오류가 발생했습니다.')
    }

    // 입력 초기화
    e.target.value = ''
  }, [uploadData, data.ctData])

  // CT 데이터 건수 (공정별)
  const getCTCountByProcess = (process: string): number => {
    return data.ctData.filter(item => item.공정 === process).length
  }

  // 개별 데이터 삭제
  const handleDelete = async (dataKey: UploadCardConfig['dataKey'], name: string) => {
    if (confirm(`${name} 데이터를 삭제하시겠습니까?`)) {
      await clearData(dataKey)
    }
  }

  // 전체 초기화
  const handleClearAll = async () => {
    if (confirm('모든 데이터를 삭제하시겠습니까?')) {
      await clearData()
    }
  }

  // CT 공정별 삭제
  const handleDeleteCTByProcess = async (process: string) => {
    if (confirm(`CT - ${process} 데이터를 삭제하시겠습니까?`)) {
      const remaining = data.ctData.filter(item => item.공정 !== process)
      await uploadData('ctData', remaining)
    }
  }

  // 메인 업로드 카드 설정
  const mainCards: UploadCardConfig[] = [
    {
      id: 'production',
      name: '생산실적',
      description: '생산수량, 양품, 불량',
      icon: '📊',
      color: 'emerald',
      borderColor: 'hover:border-emerald-300',
      bgColor: 'bg-emerald-500 hover:bg-emerald-600',
      textColor: 'text-emerald-600',
      dataKey: 'rawData'
    },
    {
      id: 'availability',
      name: '가동율',
      description: '가동시간, 시간가동율',
      icon: '⚙️',
      color: 'blue',
      borderColor: 'hover:border-blue-300',
      bgColor: 'bg-blue-500 hover:bg-blue-600',
      textColor: 'text-blue-600',
      dataKey: 'availabilityData'
    },
    {
      id: 'detail',
      name: '업종별 데이터',
      description: '피봇 분석용',
      icon: '📋',
      color: 'slate',
      borderColor: 'hover:border-slate-400',
      bgColor: 'bg-slate-600 hover:bg-slate-700',
      textColor: 'text-slate-600',
      dataKey: 'detailData'
    },
    {
      id: 'price',
      name: '부품단가표',
      description: '생산금액 산출용',
      icon: '💰',
      color: 'amber',
      borderColor: 'hover:border-amber-300',
      bgColor: 'bg-amber-500 hover:bg-amber-600',
      textColor: 'text-amber-600',
      dataKey: 'priceData'
    }
  ]

  // CT 카드 설정
  const ctCards: UploadCardConfig[] = [
    {
      id: 'ct-injection',
      name: 'CT - 사출',
      description: 'Injection Molding',
      icon: '💉',
      color: 'orange',
      borderColor: 'hover:border-orange-300',
      bgColor: 'bg-orange-500 hover:bg-orange-600',
      textColor: 'text-orange-600',
      dataKey: 'ctData',
      process: '사출'
    },
    {
      id: 'ct-painting',
      name: 'CT - 도장',
      description: 'Painting Process',
      icon: '🎨',
      color: 'sky',
      borderColor: 'hover:border-sky-300',
      bgColor: 'bg-sky-500 hover:bg-sky-600',
      textColor: 'text-sky-600',
      dataKey: 'ctData',
      process: '도장'
    },
    {
      id: 'ct-assembly',
      name: 'CT - 조립',
      description: 'Assembly Line',
      icon: '🔧',
      color: 'violet',
      borderColor: 'hover:border-violet-300',
      bgColor: 'bg-violet-500 hover:bg-violet-600',
      textColor: 'text-violet-600',
      dataKey: 'ctData',
      process: '조립'
    }
  ]

  // 조립공정 카드 설정
  const assemblyCards: UploadCardConfig[] = [
    {
      id: 'material-defect',
      name: '조립자재불량',
      description: 'Material Defects',
      icon: '⚠️',
      color: 'rose',
      borderColor: 'hover:border-rose-300',
      bgColor: 'bg-rose-500 hover:bg-rose-600',
      textColor: 'text-rose-600',
      dataKey: 'materialDefectData'
    },
    {
      id: 'wip-inventory',
      name: '재공재고금액',
      description: 'WIP Inventory',
      icon: '💰',
      color: 'teal',
      borderColor: 'hover:border-teal-300',
      bgColor: 'bg-teal-500 hover:bg-teal-600',
      textColor: 'text-teal-600',
      dataKey: 'wipInventoryData'
    },
    {
      id: 'repair-status',
      name: '불량수리현황',
      description: 'Repair Status',
      icon: '🔨',
      color: 'indigo',
      borderColor: 'hover:border-indigo-300',
      bgColor: 'bg-indigo-500 hover:bg-indigo-600',
      textColor: 'text-indigo-600',
      dataKey: 'repairStatusData'
    },
    {
      id: 'packaging-status',
      name: '검포장현황',
      description: 'Packaging Status',
      icon: '📦',
      color: 'purple',
      borderColor: 'hover:border-purple-300',
      bgColor: 'bg-purple-500 hover:bg-purple-600',
      textColor: 'text-purple-600',
      dataKey: 'packagingStatusData'
    }
  ]

  // 업로드 현황 테이블 데이터
  const statusData = [
    { name: '생산실적', icon: '📊', count: data.rawData.length, color: 'emerald', dataKey: 'rawData' as const },
    { name: '가동율', icon: '⚙️', count: data.availabilityData.length, color: 'blue', dataKey: 'availabilityData' as const },
    { name: '업종별 데이터', icon: '📋', count: data.detailData.length, color: 'slate', dataKey: 'detailData' as const },
    { name: 'CT - 사출', icon: '💉', count: getCTCountByProcess('사출'), color: 'orange', dataKey: 'ctData' as const, process: '사출' },
    { name: 'CT - 도장', icon: '🎨', count: getCTCountByProcess('도장'), color: 'sky', dataKey: 'ctData' as const, process: '도장' },
    { name: 'CT - 조립', icon: '🔧', count: getCTCountByProcess('조립'), color: 'violet', dataKey: 'ctData' as const, process: '조립' },
    { name: '조립자재불량', icon: '⚠️', count: data.materialDefectData.length, color: 'rose', dataKey: 'materialDefectData' as const },
    { name: '재공재고금액', icon: '💰', count: data.wipInventoryData.length, color: 'teal', dataKey: 'wipInventoryData' as const },
    { name: '불량수리현황', icon: '🔨', count: data.repairStatusData.length, color: 'indigo', dataKey: 'repairStatusData' as const },
    { name: '검포장현황', icon: '📦', count: data.packagingStatusData.length, color: 'purple', dataKey: 'packagingStatusData' as const },
    { name: '부품단가표', icon: '💰', count: data.priceData.length, color: 'amber', dataKey: 'priceData' as const }
  ]

  // 업로드 카드 렌더링
  const renderUploadCard = (card: UploadCardConfig, count: number) => {
    return (
      <div
        key={card.id}
        className={`group relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg ${card.borderColor} transition-all duration-300 overflow-hidden`}
      >
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-500" style={{
          background: `linear-gradient(to right, var(--tw-gradient-from), var(--tw-gradient-to))`
        }} />

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            {card.icon}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 mb-1">{card.name}</h3>
            <p className="text-xs text-slate-400 mb-4">{card.description}</p>
            <label className={`flex items-center justify-center gap-2 w-full py-2.5 ${card.bgColor} text-white text-sm font-semibold rounded-lg cursor-pointer transition-all shadow-sm hover:shadow`}>
              <UploadIcon />
              업로드
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e, card.dataKey, card.process)}
                className="hidden"
                disabled={syncing}
              />
            </label>
          </div>
        </div>

        {/* Status indicator */}
        <div className={`mt-4 pt-3 border-t border-slate-100 text-xs font-medium ${count > 0 ? card.textColor : 'text-slate-400'}`}>
          {count > 0 ? (
            <span className="inline-flex items-center gap-1">
              <CheckIcon />
              {count.toLocaleString()}건
            </span>
          ) : (
            '데이터 없음'
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 메인 카드 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">데이터 업로드</h2>
            <p className="text-slate-500 text-sm">MES에서 추출한 CSV 파일을 업로드하세요</p>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl shadow-sm border border-slate-200">
            <span className="text-slate-500 text-sm font-medium">대상월</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-slate-50 border-0 rounded-lg px-4 py-2 text-slate-700 font-semibold text-base focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}월</option>
              ))}
            </select>
          </div>
        </div>

        {/* 메인 업로드 영역 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {mainCards.map(card => renderUploadCard(card,
            card.dataKey === 'rawData' ? data.rawData.length :
            card.dataKey === 'availabilityData' ? data.availabilityData.length :
            card.dataKey === 'detailData' ? data.detailData.length :
            data.priceData.length
          ))}
        </div>

        {/* CT현황 섹션 */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-lg">⏱️</div>
            <h3 className="font-bold text-slate-700">Cycle Time 데이터</h3>
            <span className="text-xs text-slate-400 ml-2">공정별 분리 업로드</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {ctCards.map(card => renderUploadCard(card, getCTCountByProcess(card.process || '')))}
        </div>

        {/* 조립공정 관련 데이터 섹션 */}
        <div className="mb-5 mt-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-lg">🔧</div>
            <h3 className="font-bold text-slate-700">조립공정 데이터</h3>
            <span className="text-xs text-slate-400 ml-2">자재불량, 재고, 수리, 검포장</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {assemblyCards.map(card => renderUploadCard(card,
            card.dataKey === 'materialDefectData' ? data.materialDefectData.length :
            card.dataKey === 'wipInventoryData' ? data.wipInventoryData.length :
            card.dataKey === 'repairStatusData' ? data.repairStatusData.length :
            data.packagingStatusData.length
          ))}
        </div>
      </div>

      {/* 업로드 현황 테이블 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-lg">📋</div>
            <h3 className="font-bold text-slate-700">업로드 현황</h3>
          </div>
          <button
            onClick={handleClearAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors border border-red-200"
            disabled={syncing}
          >
            <TrashIcon />
            전체 초기화
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-b from-slate-50 to-slate-100">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 border-b-2 border-slate-200">데이터 유형</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 border-b-2 border-slate-200">건수</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 border-b-2 border-slate-200">상태</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 border-b-2 border-slate-200 w-20">관리</th>
              </tr>
            </thead>
            <tbody>
              {statusData.map((item, idx) => (
                <tr key={item.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded bg-${item.color}-100 flex items-center justify-center text-sm`}>
                        {item.icon}
                      </span>
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {item.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.count > 0
                        ? `bg-${item.color}-100 text-${item.color}-700`
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.count > 0 ? '활성' : '없음'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        if (item.process) {
                          handleDeleteCTByProcess(item.process)
                        } else {
                          handleDelete(item.dataKey, item.name)
                        }
                      }}
                      disabled={item.count === 0 || syncing}
                      className={`p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors ${
                        item.count === 0 ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
