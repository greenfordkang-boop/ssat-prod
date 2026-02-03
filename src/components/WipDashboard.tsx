'use client'

import { useMemo, useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { formatNumber } from '@/lib/utils'

interface WipDashboardProps {
  subTab: string
}

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null

// 엑셀 다운로드 함수
const downloadExcel = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h]
      const strVal = String(val ?? '')
      return strVal.includes(',') ? `"${strVal}"` : strVal
    }).join(','))
  ].join('\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function WipDashboard({ subTab }: WipDashboardProps) {
  const { data, selectedMonth } = useData()
  const [showWipTable, setShowWipTable] = useState(true)
  const [showPriceTable, setShowPriceTable] = useState(true)
  const [wipFilter, setWipFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [wipSort, setWipSort] = useState<SortConfig>(null)
  const [priceSort, setPriceSort] = useState<SortConfig>(null)

  // 재공재고 데이터 (필터/정렬 적용)
  const wipInventoryFiltered = useMemo(() => {
    let result = [...data.wipInventoryData]

    // 필터
    if (wipFilter) {
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(wipFilter.toLowerCase())
        )
      )
    }

    // 정렬
    if (wipSort) {
      const key = wipSort.key
      result.sort((a, b) => {
        const aVal = a[key as keyof typeof a]
        const bVal = b[key as keyof typeof b]
        const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal)) || 0
        const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal)) || 0
        const cmp = !isNaN(aNum) && !isNaN(bNum) ? aNum - bNum : String(aVal).localeCompare(String(bVal))
        return wipSort.direction === 'asc' ? cmp : -cmp
      })
    }

    return result.slice(0, 100)
  }, [data.wipInventoryData, wipFilter, wipSort])

  // 단가표 데이터 (필터/정렬 적용)
  const priceDataFiltered = useMemo(() => {
    let result = [...data.priceData]

    // 필터
    if (priceFilter) {
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(priceFilter.toLowerCase())
        )
      )
    }

    // 정렬
    if (priceSort) {
      const key = priceSort.key
      result.sort((a, b) => {
        const aVal = a[key as keyof typeof a]
        const bVal = b[key as keyof typeof b]
        const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal)) || 0
        const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal)) || 0
        const cmp = !isNaN(aNum) && !isNaN(bNum) ? aNum - bNum : String(aVal).localeCompare(String(bVal))
        return priceSort.direction === 'asc' ? cmp : -cmp
      })
    }

    return result.slice(0, 100)
  }, [data.priceData, priceFilter, priceSort])

  // 재공재고 컬럼
  const wipColumns = useMemo(() => {
    if (data.wipInventoryData.length === 0) return []
    return Object.keys(data.wipInventoryData[0]).filter(key => key !== 'id').slice(0, 10)
  }, [data.wipInventoryData])

  // 단가표 컬럼
  const priceColumns = useMemo(() => {
    if (data.priceData.length === 0) return []
    return Object.keys(data.priceData[0]).filter(key => key !== 'id').slice(0, 10)
  }, [data.priceData])

  // 정렬 핸들러
  const handleWipSort = (key: string) => {
    if (wipSort?.key === key) {
      setWipSort(wipSort.direction === 'asc' ? { key, direction: 'desc' } : null)
    } else {
      setWipSort({ key, direction: 'asc' })
    }
  }

  const handlePriceSort = (key: string) => {
    if (priceSort?.key === key) {
      setPriceSort(priceSort.direction === 'asc' ? { key, direction: 'desc' } : null)
    } else {
      setPriceSort({ key, direction: 'asc' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header - 업로드 버튼 제거 */}
      <div className="flex items-center justify-between bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-blue-500 rounded" />
          <h2 className="text-xl font-bold text-gray-900">
            {selectedMonth}월 {subTab === 'status' ? '재공재고 현황' : '부품단가표'}
          </h2>
        </div>
      </div>

      {subTab === 'status' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              재공재고 현황
              <span className="text-sm font-normal text-slate-400">({wipInventoryFiltered.length}건)</span>
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="검색..."
                value={wipFilter}
                onChange={(e) => setWipFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-40"
              />
              {data.wipInventoryData.length > 0 && (
                <button
                  onClick={() => downloadExcel(data.wipInventoryData as Record<string, unknown>[], `재공재고현황_${selectedMonth}월`)}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  📥 엑셀
                </button>
              )}
              <button
                onClick={() => setShowWipTable(!showWipTable)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                {showWipTable ? '접기' : '펼치기'}
              </button>
            </div>
          </div>

          {data.wipInventoryData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>재공재고 데이터를 업로드해주세요</p>
              <p className="text-sm text-gray-400 mt-2">파일업로드 메뉴에서 업로드할 수 있습니다</p>
            </div>
          ) : showWipTable && (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-slate-50">
                    {wipColumns.map(key => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100"
                        onClick={() => handleWipSort(key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {key}
                          <span className="text-xs">
                            {wipSort?.key === key ? (wipSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wipInventoryFiltered.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {wipColumns.map((key, colIdx) => (
                        <td key={colIdx} className="px-4 py-3 whitespace-nowrap">
                          {typeof row[key as keyof typeof row] === 'number'
                            ? formatNumber(row[key as keyof typeof row] as number)
                            : String(row[key as keyof typeof row] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.wipInventoryData.length > 100 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  총 {formatNumber(data.wipInventoryData.length)}건 중 100건 표시
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {subTab === 'price' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              부품단가표
              <span className="text-sm font-normal text-slate-400">({priceDataFiltered.length}건)</span>
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="검색..."
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-40"
              />
              {data.priceData.length > 0 && (
                <button
                  onClick={() => downloadExcel(data.priceData as Record<string, unknown>[], `부품단가표_${selectedMonth}월`)}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  📥 엑셀
                </button>
              )}
              <button
                onClick={() => setShowPriceTable(!showPriceTable)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                {showPriceTable ? '접기' : '펼치기'}
              </button>
            </div>
          </div>

          {data.priceData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>부품단가표 데이터를 업로드해주세요</p>
              <p className="text-sm text-gray-400 mt-2">파일업로드 메뉴에서 업로드할 수 있습니다</p>
            </div>
          ) : showPriceTable && (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-slate-50">
                    {priceColumns.map(key => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100"
                        onClick={() => handlePriceSort(key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {key}
                          <span className="text-xs">
                            {priceSort?.key === key ? (priceSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {priceDataFiltered.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {priceColumns.map((key, colIdx) => (
                        <td key={colIdx} className="px-4 py-3 whitespace-nowrap">
                          {typeof row[key as keyof typeof row] === 'number'
                            ? formatNumber(row[key as keyof typeof row] as number)
                            : String(row[key as keyof typeof row] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.priceData.length > 100 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  총 {formatNumber(data.priceData.length)}건 중 100건 표시
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
