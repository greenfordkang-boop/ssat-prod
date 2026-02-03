'use client'

import { useMemo, useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { formatNumber, formatPercent, parseNumber, EXCLUDED_PROCESSES } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
  Line
} from 'recharts'

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

// 정렬 가능한 테이블 헤더
function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  align = 'left'
}: {
  label: string
  sortKey: string
  sortConfig: SortConfig
  onSort: (key: string) => void
  align?: 'left' | 'right' | 'center'
}) {
  const isActive = sortConfig?.key === sortKey
  return (
    <th
      className={`px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-xs">
          {isActive ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  )
}

// 필드 값 가져오기 (다양한 필드명 지원)
const getFieldFromPrice = (p: { [key: string]: string | number | undefined }, ...keys: string[]) => {
  for (const key of keys) {
    if (p[key] !== undefined && p[key] !== null && p[key] !== '') {
      return String(p[key]).trim()
    }
  }
  return ''
}

// 단가 데이터에서 매칭하는 헬퍼 함수
const findPriceData = (
  priceData: { [key: string]: string | number | undefined }[],
  itemCode?: string,
  itemName?: string
) => {
  if (!priceData || priceData.length === 0) return undefined

  const searchCode = itemCode ? String(itemCode).trim() : ''
  const searchName = itemName ? String(itemName).trim() : ''

  return priceData.find(p => {
    // 품목코드 매칭 (다양한 필드명 지원)
    const priceItemCode = getFieldFromPrice(p, '품목코드', '품번', '품목번호', 'itemCode', 'item_code', 'code', 'ITEM_CODE', 'PART_NO', 'partNo', 'part_no')
    if (searchCode && priceItemCode && priceItemCode === searchCode) {
      return true
    }
    // 품목명 매칭 (다양한 필드명 지원)
    const priceItemName = getFieldFromPrice(p, '품목명', '품명', 'productName', 'product_name', 'name', 'ITEM_NAME', 'PRODUCT', 'itemName', 'item_name')
    if (searchName && priceItemName && priceItemName === searchName) {
      return true
    }
    return false
  })
}

// 단가 값 추출 헬퍼 함수
const getPriceValue = (priceItem: { [key: string]: string | number | undefined }) => {
  // 합계단가 우선 적용!
  const priceVal = priceItem.합계단가 || priceItem['합계단가'] ||
                   priceItem.단가 || priceItem.가격 || priceItem.price || priceItem.unitPrice ||
                   priceItem.unit_price || priceItem.PRICE || priceItem.UNIT_PRICE ||
                   priceItem['단 가'] || priceItem['판매단가'] || priceItem['구매단가'] ||
                   priceItem.cost || priceItem.COST || 0
  return parseNumber(priceVal)
}

export default function QualityDashboard() {
  const { data, selectedMonth, getFilteredData } = useData()
  const filteredData = getFilteredData()
  const [showTable, setShowTable] = useState(true)
  const [processFilter, setProcessFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'defectRate', direction: 'desc' })

  // 전체 품질 통계
  const qualityStats = useMemo(() => {
    let totalProduction = 0
    let totalGood = 0
    let totalDefect = 0
    let totalScrap = 0
    let totalDefectAmount = 0

    filteredData.forEach(row => {
      const process = row.공정 || ''
      if (EXCLUDED_PROCESSES.includes(process)) return

      const production = parseNumber(row.생산수량)
      const good = parseNumber(row.양품수량)
      // 불량수량: 명시적 필드가 있으면 사용, 없으면 생산-양품으로 계산
      const defect = parseNumber(row.불량수량) || (production - good)
      const scrap = parseNumber(row.폐기수량)

      totalProduction += production
      totalGood += good
      totalDefect += defect > 0 ? defect : 0
      totalScrap += scrap

      // 불량금액 계산 (단가 데이터가 있으면 사용)
      const price = findPriceData(data.priceData, row.품목코드, row.품목명)
      if (price) {
        totalDefectAmount += (defect > 0 ? defect : 0) * getPriceValue(price)
      }
    })

    return {
      yieldRate: totalProduction > 0 ? (totalGood / totalProduction) * 100 : 0,
      defectAmount: totalDefectAmount,
      defectRate: totalProduction > 0 ? (totalDefect / totalProduction) * 100 : 0,
      scrapRate: totalProduction > 0 ? (totalScrap / totalProduction) * 100 : 0,
      totalGood,
      totalDefect,
      totalScrap
    }
  }, [filteredData, data.priceData])

  // 공정별 품질 지표
  const processQuality = useMemo(() => {
    const stats: Record<string, { production: number; good: number; defect: number; scrap: number }> = {}

    filteredData.forEach(row => {
      const process = row.공정 || '기타'
      if (EXCLUDED_PROCESSES.includes(process)) return

      const prod = parseNumber(row.생산수량)
      const goodQty = parseNumber(row.양품수량)
      const defectQty = parseNumber(row.불량수량) || (prod - goodQty)

      if (!stats[process]) {
        stats[process] = { production: 0, good: 0, defect: 0, scrap: 0 }
      }

      stats[process].production += prod
      stats[process].good += goodQty
      stats[process].defect += defectQty > 0 ? defectQty : 0
      stats[process].scrap += parseNumber(row.폐기수량)
    })

    return Object.entries(stats).map(([name, values]) => ({
      name,
      불량: values.defect,
      폐기: values.scrap,
      '수율(%)': values.production > 0 ? Math.round((values.good / values.production) * 1000) / 10 : 0
    }))
  }, [filteredData])

  // 품목별 불량율 현황
  const productDefects = useMemo(() => {
    const stats: Record<string, {
      product: string
      process: string
      production: number
      good: number
      defect: number
      defectAmount: number
    }> = {}

    filteredData.forEach(row => {
      const key = row.품목명 || row.품목코드 || '기타'
      const process = row.공정 || ''
      if (EXCLUDED_PROCESSES.includes(process)) return

      const prod = parseNumber(row.생산수량)
      const goodQty = parseNumber(row.양품수량)
      const defectQty = parseNumber(row.불량수량) || (prod - goodQty)

      if (!stats[key]) {
        stats[key] = {
          product: key,
          process,
          production: 0,
          good: 0,
          defect: 0,
          defectAmount: 0
        }
      }

      stats[key].production += prod
      stats[key].good += goodQty
      stats[key].defect += defectQty > 0 ? defectQty : 0

      // 불량금액
      const price = findPriceData(data.priceData, row.품목코드, row.품목명)
      if (price) {
        stats[key].defectAmount += (defectQty > 0 ? defectQty : 0) * getPriceValue(price)
      }
    })

    let result = Object.values(stats)
      .filter(item => processFilter === 'all' || item.process === processFilter)
      .map(item => ({
        ...item,
        defectRate: item.production > 0 ? (item.defect / item.production) * 100 : 0,
        yieldRate: item.production > 0 ? (item.good / item.production) * 100 : 0
      }))

    // 정렬
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof typeof a]
        const bVal = b[sortConfig.key as keyof typeof b]
        const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal))
        return sortConfig.direction === 'asc' ? cmp : -cmp
      })
    }

    return result.slice(0, 50)
  }, [filteredData, data.priceData, processFilter, sortConfig])

  // 공정 목록
  const processes = useMemo(() => {
    const set = new Set<string>()
    filteredData.forEach(row => {
      const process = row.공정
      if (process && !EXCLUDED_PROCESSES.includes(process)) {
        set.add(process)
      }
    })
    return Array.from(set)
  }, [filteredData])

  // 정렬 핸들러
  const handleSort = (key: string) => {
    if (sortConfig?.key === key) {
      setSortConfig(sortConfig.direction === 'asc' ? { key, direction: 'desc' } : null)
    } else {
      setSortConfig({ key, direction: 'asc' })
    }
  }

  // 데이터 없음
  if (data.rawData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-16 text-center border border-slate-200">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-slate-700 mb-2">생산실적 데이터가 없습니다</h3>
        <p className="text-slate-500 mb-6">품질분석을 위해 생산실적 CSV 파일을 업로드하세요</p>
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 font-medium rounded-xl">
          📤 파일업로드 메뉴에서 생산실적 데이터를 업로드해 주세요
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-blue-500 rounded" />
            <h2 className="text-xl font-bold text-slate-800">품질 분석 리포트</h2>
          </div>
          <select
            value={processFilter}
            onChange={(e) => setProcessFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm"
          >
            <option value="all">All</option>
            {processes.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="text-sm text-slate-500 mb-1">평균 수율</div>
          <div className="text-3xl font-bold text-blue-600">{qualityStats.yieldRate.toFixed(1)}%</div>
          <div className="text-xs text-slate-500 mt-2">양품: {formatNumber(qualityStats.totalGood)} EA</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
          <div className="text-sm text-slate-500 mb-1">불량 금액</div>
          <div className="text-3xl font-bold text-amber-600">{formatNumber(Math.round(qualityStats.defectAmount))}</div>
          <div className="text-xs text-slate-500 mt-2">원 (불량 {formatNumber(qualityStats.totalDefect)} EA)</div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="text-sm text-slate-500 mb-1">평균 불량율</div>
          <div className="text-3xl font-bold text-red-600">{qualityStats.defectRate.toFixed(1)}%</div>
          <div className="text-xs text-slate-500 mt-2">불량: {formatNumber(qualityStats.totalDefect)} EA</div>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-6 border border-pink-200">
          <div className="text-sm text-slate-500 mb-1">평균 폐기율</div>
          <div className="text-3xl font-bold text-pink-600">{qualityStats.scrapRate.toFixed(1)}%</div>
          <div className="text-xs text-slate-500 mt-2">폐기: {formatNumber(qualityStats.totalScrap)} EA</div>
        </div>
      </div>

      {/* 공정별 품질 지표 차트 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full" />
          공정별 품질 지표
        </h3>
        {processQuality.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={processQuality}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tickFormatter={(v) => formatNumber(v)} />
              <YAxis yAxisId="right" orientation="right" domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === '수율(%)') return [`${Number(value).toFixed(1)}%`, name]
                  return [formatNumber(value as number), name]
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="불량" fill="#fca5a5" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="폐기" fill="#fbcfe8" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="수율(%)" stroke="#93c5fd" strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            데이터가 부족합니다
          </div>
        )}
      </div>

      {/* 품목별 불량율 현황 테이블 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <span className="text-xl">📋</span>
            품목별 불량율 현황
            <span className="text-sm font-normal text-slate-400">({productDefects.length}건)</span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => downloadExcel(productDefects.map(item => ({
                순위: productDefects.indexOf(item) + 1,
                품목명: item.product,
                공정: item.process,
                생산수량: item.production,
                양품수량: item.good,
                불량수량: item.defect,
                불량금액: Math.round(item.defectAmount),
                '불량율(%)': item.defectRate.toFixed(1),
                '수율(%)': item.yieldRate.toFixed(1)
              })), `품목별_불량율현황_${selectedMonth}월`)}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              📥 엑셀
            </button>
            <button
              onClick={() => setShowTable(!showTable)}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1 bg-slate-100 rounded-lg"
            >
              {showTable ? '접기' : '펼치기'}
            </button>
          </div>
        </div>

        {showTable && (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">순위</th>
                  <SortableHeader label="품목명" sortKey="product" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="공정" sortKey="process" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="생산수량" sortKey="production" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <SortableHeader label="양품수량" sortKey="good" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <SortableHeader label="불량수량" sortKey="defect" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <SortableHeader label="불량금액" sortKey="defectAmount" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <SortableHeader label="불량율" sortKey="defectRate" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <SortableHeader label="수율" sortKey="yieldRate" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">상태</th>
                </tr>
              </thead>
              <tbody>
                {productDefects.map((item, idx) => (
                  <tr key={item.product} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 max-w-[200px] truncate" title={item.product}>
                      {item.product}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.process}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.production)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.good)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatNumber(item.defect)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(Math.round(item.defectAmount))}원</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.defectRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.yieldRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        item.defectRate > 5 ? 'bg-red-100 text-red-700' :
                        item.defectRate > 1 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.defectRate > 5 ? '관리' : item.defectRate > 1 ? '주의' : '양호'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
