'use client'

import { useMemo, useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { formatNumber } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  LabelList
} from 'recharts'

const COLORS = [
  '#93c5fd', '#6ee7b7', '#fdba74', '#fca5a5',
  '#c4b5fd', '#fde047', '#a5f3fc', '#fbcfe8'
]

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

// A~L열 메타 컬럼 (비가동사유가 아닌 컬럼)
const META_COLUMNS = new Set([
  ' ', '', 'col_0', // 첫 번째 빈 컬럼
  '생산일자', '공정', '설비/LINE', '설비/line', '설비(라인)명',
  '주/야간', '주야간', '무인',
  '조업시간', '조업시간(분)',
  '가동시간', '가동시간(분)',
  '비가동합계', '비가동시간합계',
  '시간가동율', '시간가동율(%)', '시간가동률', '시간가동률(%)',
  '계획정지합계',
  '설비가동율', '설비가동율(%)', '설비가동률', '설비가동률(%)',
  'id', 'created_at', 'user_id'
])

export default function DowntimeDashboard() {
  const { data, selectedMonth } = useData()
  const [showTable, setShowTable] = useState(true)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'downtime', direction: 'desc' })
  const [equipFilter, setEquipFilter] = useState('')
  const [processFilter, setProcessFilter] = useState('all')

  // 상세 팝업 상태
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedEquip, setSelectedEquip] = useState<string | null>(null)

  // 공정 목록 추출
  const processList = useMemo(() => {
    const set = new Set<string>()
    data.availabilityData.forEach(row => {
      const process = String(row.공정 || row.process || '')
      if (process && process !== '합계') set.add(process)
    })
    return Array.from(set).sort()
  }, [data.availabilityData])

  // 가동율 데이터 필터링 (공정 + 월)
  const filteredData = useMemo(() => {
    return data.availabilityData.filter(d => {
      // 공정 필터
      if (processFilter !== 'all') {
        const process = String(d.공정 || d.process || '')
        if (process !== processFilter) return false
      }
      // 월 필터
      const dateStr = String(d.date || d.일자 || d.생산일자 || '')
      if (!dateStr) return true
      let rowMonth = null
      if (dateStr.includes('-')) {
        rowMonth = parseInt(dateStr.split('-')[1]) || null
      } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/')
        rowMonth = parts[0].length === 4 ? parseInt(parts[1]) : parseInt(parts[0])
      }
      return !rowMonth || rowMonth === selectedMonth
    })
  }, [data.availabilityData, selectedMonth, processFilter])

  // ⭐ 설비별 비가동 현황 (비가동합계 컬럼 직접 사용)
  const equipmentSummary = useMemo(() => {
    const equipMap = new Map<string, {
      operating: number
      downtime: number
      rows: Record<string, unknown>[]
    }>()

    filteredData.forEach(item => {
      const equip = String(
        item['설비/LINE'] || item['설비(라인)명'] || item.LINE ||
        item.설비명 || item.설비 || item.라인명 || '기타'
      ).trim()

      // 가동시간 & 비가동합계 직접 사용
      const operating = parseFloat(String(item['가동시간(분)'] || item.가동시간 || 0)) || 0
      const downtime = parseFloat(String(item.비가동합계 || item['비가동합계'] || 0)) || 0

      if (!equipMap.has(equip)) {
        equipMap.set(equip, { operating: 0, downtime: 0, rows: [] })
      }
      const current = equipMap.get(equip)!
      current.operating += operating
      current.downtime += downtime
      current.rows.push(item)
    })

    let result = Array.from(equipMap.entries())
      .filter(([name]) => {
        const lowerName = name.toLowerCase()
        return !lowerName.includes('total') && !name.includes('합계') && !name.includes('총계')
      })
      .map(([name, d]) => ({
        name: name.length > 15 ? name.slice(0, 15) + '...' : name,
        fullName: name,
        가동시간: Math.round(d.operating),
        비가동시간: Math.round(d.downtime),
        비가동율: (d.operating + d.downtime) > 0
          ? Math.round((d.downtime / (d.operating + d.downtime)) * 1000) / 10
          : 0,
        rowCount: d.rows.length
      }))

    // 필터
    if (equipFilter) {
      result = result.filter(r => r.fullName.toLowerCase().includes(equipFilter.toLowerCase()))
    }

    // 정렬
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof typeof a]
        const bVal = b[sortConfig.key as keyof typeof b]
        const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal))
        return sortConfig.direction === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [filteredData, equipFilter, sortConfig])

  // 차트용 데이터 (상위 15개)
  const chartData = useMemo(() => {
    return [...equipmentSummary]
      .sort((a, b) => b.비가동시간 - a.비가동시간)
      .slice(0, 15)
  }, [equipmentSummary])

  // 총 비가동시간
  const totalDowntime = useMemo(() => {
    return filteredData.reduce((sum, item) => {
      return sum + (parseFloat(String(item.비가동합계 || 0)) || 0)
    }, 0)
  }, [filteredData])

  // ⭐ 선택된 설비의 상세 비가동사유 (M열 이후 컬럼)
  const selectedEquipDetail = useMemo(() => {
    if (!selectedEquip) return { rows: [], reasons: [] }

    // 해당 설비의 원본 데이터 행들
    const equipRows = filteredData.filter(item => {
      const equip = String(
        item['설비/LINE'] || item['설비(라인)명'] || item.LINE ||
        item.설비명 || item.설비 || item.라인명 || '기타'
      ).trim()
      return equip === selectedEquip
    })

    // M열 이후 비가동사유별 합계 계산
    const reasonMap = new Map<string, number>()

    equipRows.forEach(row => {
      const keys = Object.keys(row)
      keys.forEach(key => {
        const cleanKey = key.replace(/_\d+$/, '')
        if (META_COLUMNS.has(cleanKey) || META_COLUMNS.has(key)) return

        const value = parseFloat(String(row[key as keyof typeof row] || 0)) || 0
        if (value > 0) {
          reasonMap.set(cleanKey, (reasonMap.get(cleanKey) || 0) + value)
        }
      })
    })

    const reasons = Array.from(reasonMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)

    return { rows: equipRows, reasons }
  }, [selectedEquip, filteredData])

  // 정렬 핸들러
  const handleSort = (key: string) => {
    if (sortConfig?.key === key) {
      setSortConfig(sortConfig.direction === 'asc' ? { key, direction: 'desc' } : null)
    } else {
      setSortConfig({ key, direction: 'asc' })
    }
  }

  // 상세 팝업 열기
  const openDetail = (equipName: string) => {
    setSelectedEquip(equipName)
    setDetailModalOpen(true)
  }

  // 데이터 없음 처리
  if (data.availabilityData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-16 text-center border border-slate-200">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold text-slate-700 mb-2">가동율 데이터가 없습니다</h3>
        <p className="text-slate-500 mb-6">비가동현황 분석을 위해 가동율 CSV 파일을 업로드하세요</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 + 공정 필터 */}
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-red-500 rounded" />
            <h2 className="text-xl font-bold text-slate-800">비가동 현황</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">공정 선택:</span>
            <select
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-red-500 min-w-[140px]"
            >
              <option value="all">전체 공정</option>
              {processList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="text-sm font-medium text-slate-500 mb-2">데이터 건수</div>
          <div className="text-3xl font-bold text-slate-800">{formatNumber(filteredData.length)}</div>
          <div className="text-xs text-slate-400 mt-1">{selectedMonth}월 기준</div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="text-sm font-medium text-red-600 mb-2">총 비가동시간</div>
          <div className="text-3xl font-bold text-red-700">{formatNumber(Math.round(totalDowntime))}</div>
          <div className="text-xs text-red-500 mt-1">분 (minutes)</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
          <div className="text-sm font-medium text-amber-600 mb-2">최다 비가동 설비</div>
          <div className="text-xl font-bold text-amber-700 truncate">
            {chartData[0]?.fullName || '-'}
          </div>
          <div className="text-xs text-amber-500 mt-1">
            {chartData[0] ? `${formatNumber(chartData[0].비가동시간)}분` : '-'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="text-sm font-medium text-blue-600 mb-2">설비/LINE 수</div>
          <div className="text-3xl font-bold text-blue-700">{equipmentSummary.length}</div>
          <div className="text-xs text-blue-500 mt-1">개</div>
        </div>
      </div>

      {/* 설비별 가동/비가동 차트 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full" />
          설비별 가동/비가동 현황
          <span className="text-xs font-normal text-slate-400 ml-2">(비가동시간 순)</span>
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: chartData.length > 8 ? 9 : 10 }}
                angle={chartData.length > 6 ? -45 : 0}
                textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                height={chartData.length > 6 ? 80 : 60}
                interval={0}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => formatNumber(v)}
                label={{ value: '시간(분)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                label={{ value: '비가동율(%)', angle: 90, position: 'insideRight', style: { fontSize: 11 } }}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (name === '비가동율') return [`${(value as number).toFixed(1)}%`, name]
                  return [formatNumber(value as number) + '분', name]
                }}
                labelFormatter={(label) => {
                  const item = chartData.find(d => d.name === label)
                  return item?.fullName || label
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar yAxisId="left" dataKey="가동시간" stackId="a" fill="#6ee7b7" name="가동시간">
                <LabelList dataKey="가동시간" position="inside" fill="#047857" fontSize={9}
                  formatter={(v) => Number(v) > 0 ? formatNumber(Number(v)) : ''} />
              </Bar>
              <Bar yAxisId="left" dataKey="비가동시간" stackId="a" fill="#fca5a5" name="비가동시간">
                <LabelList dataKey="비가동시간" position="inside" fill="#b91c1c" fontSize={9}
                  formatter={(v) => Number(v) > 0 ? formatNumber(Number(v)) : ''} />
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="비가동율"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
                name="비가동율"
              >
                <LabelList dataKey="비가동율" position="top" fill="#d97706" fontSize={10} fontWeight="bold"
                  formatter={(v) => `${Number(v).toFixed(1)}%`} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            설비별 데이터가 부족합니다
          </div>
        )}
      </div>

      {/* 설비별 비가동 현황 테이블 (클릭 시 상세 팝업) */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <span className="w-1 h-5 bg-slate-500 rounded-full" />
            설비/LINE별 비가동 현황
            <span className="text-sm font-normal text-slate-400">({equipmentSummary.length}건)</span>
            <span className="text-xs text-blue-500 ml-2">💡 비가동시간 클릭 → 상세보기</span>
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="설비 검색..."
              value={equipFilter}
              onChange={(e) => setEquipFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-40"
            />
            <button
              onClick={() => downloadExcel(equipmentSummary.map(item => ({
                '설비/LINE': item.fullName,
                '가동시간(분)': item.가동시간,
                '비가동시간(분)': item.비가동시간,
                '비가동율(%)': item.비가동율
              })), `설비별비가동_${selectedMonth}월`)}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              📥 엑셀
            </button>
            <button
              onClick={() => setShowTable(!showTable)}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
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
                  <th
                    className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('fullName')}
                  >
                    설비/LINE {sortConfig?.key === 'fullName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th
                    className="px-4 py-3 text-right font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('가동시간')}
                  >
                    가동시간 {sortConfig?.key === '가동시간' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th
                    className="px-4 py-3 text-right font-semibold text-red-600 cursor-pointer hover:bg-slate-100 bg-red-50"
                    onClick={() => handleSort('비가동시간')}
                  >
                    비가동시간 {sortConfig?.key === '비가동시간' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th
                    className="px-4 py-3 text-right font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('비가동율')}
                  >
                    비가동율 {sortConfig?.key === '비가동율' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {equipmentSummary.map((item, idx) => (
                  <tr key={item.fullName} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-3 font-medium text-slate-700">{item.fullName}</td>
                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                      {formatNumber(item.가동시간)}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-bold text-red-600 tabular-nums bg-red-50/50 cursor-pointer hover:bg-red-100 underline decoration-dotted"
                      onClick={() => openDetail(item.fullName)}
                      title="클릭하여 상세보기"
                    >
                      {formatNumber(item.비가동시간)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        item.비가동율 >= 20 ? 'bg-red-100 text-red-700' :
                        item.비가동율 >= 10 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.비가동율.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 비가동 상세 팝업 */}
      {detailModalOpen && selectedEquip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            {/* 팝업 헤더 */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{selectedEquip}</h3>
                  <p className="text-red-100 text-sm">비가동 사유별 상세 내역</p>
                </div>
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="text-white/80 hover:text-white text-2xl font-light"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 팝업 내용 */}
            <div className="p-6 overflow-auto max-h-[60vh]">
              {/* 요약 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-slate-500">데이터 행 수</div>
                  <div className="text-2xl font-bold text-slate-700">{selectedEquipDetail.rows.length}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-red-500">총 비가동시간</div>
                  <div className="text-2xl font-bold text-red-700">
                    {formatNumber(selectedEquipDetail.reasons.reduce((s, r) => s + r.value, 0))}분
                  </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-amber-500">비가동 사유 수</div>
                  <div className="text-2xl font-bold text-amber-700">{selectedEquipDetail.reasons.length}</div>
                </div>
              </div>

              {/* 비가동사유 상세 테이블 */}
              {selectedEquipDetail.reasons.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">비가동 사유</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">시간(분)</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">비율</th>
                        <th className="px-4 py-3 font-semibold text-slate-600">그래프</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEquipDetail.reasons.map((reason, idx) => {
                        const total = selectedEquipDetail.reasons.reduce((s, r) => s + r.value, 0)
                        const percent = total > 0 ? (reason.value / total) * 100 : 0
                        return (
                          <tr key={reason.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-3 font-medium text-slate-700">{reason.name}</td>
                            <td className="px-4 py-3 text-right text-slate-600 tabular-nums font-semibold">
                              {formatNumber(reason.value)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                              {percent.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3">
                              <div className="w-full bg-slate-200 rounded-full h-3">
                                <div
                                  className="h-3 rounded-full transition-all"
                                  style={{
                                    width: `${percent}%`,
                                    backgroundColor: COLORS[idx % COLORS.length]
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  비가동 사유 데이터가 없습니다
                </div>
              )}
            </div>

            {/* 팝업 푸터 */}
            <div className="border-t px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  if (selectedEquipDetail.reasons.length > 0) {
                    downloadExcel(selectedEquipDetail.reasons.map(r => ({
                      '설비/LINE': selectedEquip,
                      '비가동사유': r.name,
                      '시간(분)': r.value
                    })), `${selectedEquip}_비가동상세`)
                  }
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
              >
                📥 엑셀 다운로드
              </button>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
