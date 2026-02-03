'use client'

import { useMemo, useState } from 'react'
import { useData } from '@/contexts/DataContext'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Legend
} from 'recharts'
import { formatNumber, parseNumber, CHART_COLORS, EXCLUDED_PROCESSES } from '@/lib/utils'

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

// 엑셀 다운로드 함수
const downloadExcel = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h]
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
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

export default function OverviewDashboard() {
  const { data, selectedMonth, setSelectedMonth, getFilteredData } = useData()
  const filteredData = getFilteredData()
  const [showDetailTable, setShowDetailTable] = useState(true)
  const [processFilter, setProcessFilter] = useState('all')
  const [sortField, setSortField] = useState<string>('종합효율(OEE)')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // 공정별 종합효율 계산 (테이블 데이터)
  const processOEE = useMemo(() => {
    const stats: Record<string, { production: number; good: number; defect: number; defectAmount: number }> = {}

    filteredData.forEach(row => {
      const process = row.공정 || '기타'
      if (EXCLUDED_PROCESSES.includes(process)) return

      const prod = parseNumber(row.생산수량)
      const goodQty = parseNumber(row.양품수량)
      const defectQty = parseNumber(row.불량수량) || (prod - goodQty)
      const actualDefect = defectQty > 0 ? defectQty : 0

      if (!stats[process]) {
        stats[process] = { production: 0, good: 0, defect: 0, defectAmount: 0 }
      }

      stats[process].production += prod
      stats[process].good += goodQty
      stats[process].defect += actualDefect

      // 불량금액 계산
      const price = findPriceData(data.priceData, row.품목코드, row.품목명)
      if (price) {
        stats[process].defectAmount += actualDefect * getPriceValue(price)
      }
    })

    return Object.entries(stats)
      .filter(([, v]) => v.production > 0)
      .map(([name, values]) => {
        const qualityRate = values.production > 0 ? (values.good / values.production) * 100 : 0
        // 시간가동율, 성능가동율은 100%로 가정 (별도 데이터 없으면)
        const timeAvail = 100
        const perfRate = 100
        const oee = (timeAvail * perfRate * qualityRate) / 10000

        return {
          공정: name,
          생산수량: values.production,
          양품수량: values.good,
          불량수량: values.defect,
          불량금액: Math.round(values.defectAmount),
          시간가동율: timeAvail,
          성능가동율: perfRate,
          양품율: Math.round(qualityRate * 10) / 10,
          '종합효율(OEE)': Math.round(oee * 10) / 10
        }
      })
  }, [filteredData, data.priceData])

  // 정렬된 데이터
  const sortedProcessOEE = useMemo(() => {
    return [...processOEE].sort((a, b) => {
      const aVal = a[sortField as keyof typeof a] as number
      const bVal = b[sortField as keyof typeof b] as number
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [processOEE, sortField, sortDirection])

  // 필터링된 데이터
  const filteredProcessOEE = useMemo(() => {
    if (processFilter === 'all') return sortedProcessOEE
    return sortedProcessOEE.filter(row => row.공정 === processFilter)
  }, [sortedProcessOEE, processFilter])

  // OEE 요약 통계 (테이블 데이터 기반)
  const oeeStats = useMemo(() => {
    if (processOEE.length === 0) {
      return { oee: 0, timeAvailability: 0, performanceRate: 0, qualityRate: 0, totalDefect: 0, totalDefectAmount: 0 }
    }

    // 전체 생산량 기준 가중평균
    let totalProduction = 0
    let totalGood = 0
    let totalDefect = 0
    let totalDefectAmount = 0

    processOEE.forEach(row => {
      totalProduction += row.생산수량
      totalGood += row.양품수량
      totalDefect += row.불량수량
      totalDefectAmount += row.불량금액
    })

    const avgQuality = totalProduction > 0 ? (totalGood / totalProduction) * 100 : 0
    const avgTimeAvail = 100 // 시간가동율 데이터 없으면 100%
    const avgPerfRate = 100 // 성능가동율 데이터 없으면 100%
    const avgOEE = (avgTimeAvail * avgPerfRate * avgQuality) / 10000

    return {
      oee: Math.round(avgOEE * 10) / 10,
      timeAvailability: avgTimeAvail,
      performanceRate: avgPerfRate,
      qualityRate: Math.round(avgQuality * 10) / 10,
      totalDefect,
      totalDefectAmount
    }
  }, [processOEE])

  // 월별 OEE 추이
  const monthlyOEE = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const monthData = data.rawData.filter(row => {
        const dateStr = row.생산일자 || ''
        const match = dateStr.match(/\d{4}-(\d{2})-\d{2}/)
        return match && parseInt(match[1]) === month
      })

      if (monthData.length === 0) {
        return { month: `${month}월`, 'OEE (%)': 0, 시간가동율: 0, 성능가동율: 0, 양품율: 0 }
      }

      let production = 0
      let good = 0
      monthData.forEach(row => {
        const process = row.공정 || ''
        if (EXCLUDED_PROCESSES.includes(process)) return
        production += parseNumber(row.생산수량)
        good += parseNumber(row.양품수량)
      })

      const qualityRate = production > 0 ? (good / production) * 100 : 0
      const timeAvail = 100
      const perfRate = 100
      const oee = (timeAvail * perfRate * qualityRate) / 10000

      return {
        month: `${month}월`,
        'OEE (%)': Math.round(oee * 10) / 10,
        시간가동율: timeAvail,
        성능가동율: perfRate,
        양품율: Math.round(qualityRate * 10) / 10
      }
    })
  }, [data.rawData])

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
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // 데이터 없음 표시
  if (data.rawData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-16 text-center border border-slate-200">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-bold text-slate-700 mb-2">생산실적 데이터가 없습니다</h3>
        <p className="text-slate-500 mb-6">종합현황 분석을 위해 생산실적 CSV 파일을 업로드하세요</p>
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
            <h2 className="text-xl font-bold text-slate-800">공정별 종합효율 (OEE)</h2>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}월</option>
              ))}
            </select>
            <select
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm"
            >
              <option value="all">전체 공정</option>
              {processes.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 데이터 현황 */}
        <div className="flex items-center gap-4 mt-4 text-sm">
          <span className="text-green-600 flex items-center gap-1">
            ✓ 가동율 {formatNumber(data.availabilityData.length)}건
          </span>
          <span className="text-amber-600 flex items-center gap-1">
            ✓ CT현황 {formatNumber(data.ctData.length)}건
          </span>
        </div>
      </div>

      {/* OEE 요약 카드 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{selectedMonth}월 종합효율 (OEE)</div>
          <div className="text-4xl font-bold text-slate-800">{oeeStats.oee.toFixed(1)}%</div>
          <div className="text-xs text-slate-400 mt-2">시간가동율 × 성능가동율 × 양품율</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="text-sm text-slate-500 mb-1">평균 시간가동율</div>
          <div className="text-4xl font-bold text-blue-600">{oeeStats.timeAvailability.toFixed(1)}%</div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">평균 성능가동율</div>
          <div className="text-4xl font-bold text-slate-700">{oeeStats.performanceRate.toFixed(1)}%</div>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-6 border border-cyan-200">
          <div className="text-sm text-slate-500 mb-1">평균 양품율</div>
          <div className="text-4xl font-bold text-cyan-600">{oeeStats.qualityRate.toFixed(1)}%</div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="text-sm text-slate-500 mb-1">불량금액</div>
          <div className="text-3xl font-bold text-red-600">{formatNumber(oeeStats.totalDefectAmount)}</div>
          <div className="text-xs text-slate-400 mt-2">불량 {formatNumber(oeeStats.totalDefect)} EA</div>
        </div>
      </div>

      {/* 월별 OEE 추이 차트 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full" />
          월별 종합효율 (OEE) 추이
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={monthlyOEE}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(v) => `${v.toFixed(1)}%`} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v.toFixed(1)}%`} />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, '']} />
            <Legend />
            <Bar yAxisId="left" dataKey="시간가동율" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="성능가동율" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="양품율" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="OEE (%)" stroke="#f87171" strokeWidth={2} dot={{ r: 4, fill: '#f87171' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 공정별 종합효율 상세 테이블 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-full" />
            공정별 종합효율 상세
            <span className="text-sm font-normal text-slate-400">({filteredProcessOEE.length}건)</span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDetailTable(!showDetailTable)}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg transition"
            >
              {showDetailTable ? '📁 접기' : '📂 펼치기'}
            </button>
            <button
              onClick={() => downloadExcel(filteredProcessOEE, `OEE_${selectedMonth}월`)}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
            >
              📥 엑셀 다운로드
            </button>
          </div>
        </div>

        {showDetailTable && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['공정', '생산수량', '양품수량', '불량수량', '불량금액', '시간가동율', '성능가동율', '양품율', '종합효율(OEE)'].map(field => (
                    <th
                      key={field}
                      onClick={() => handleSort(field)}
                      className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition"
                    >
                      <div className="flex items-center gap-1">
                        {field}
                        {sortField === field && (
                          <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProcessOEE.map((row, idx) => (
                  <tr key={row.공정} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-3 font-medium text-slate-700">{row.공정}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.생산수량)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.양품수량)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatNumber(row.불량수량)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatNumber(row.불량금액)}원</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.시간가동율.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.성능가동율.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.양품율.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-600">
                      {row['종합효율(OEE)'].toFixed(1)}%
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
