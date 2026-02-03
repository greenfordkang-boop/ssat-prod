'use client'

import { useMemo, useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { formatNumber, formatPercent } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  LabelList
} from 'recharts'

const COLORS = [
  '#93c5fd', // 파스텔 블루
  '#6ee7b7', // 파스텔 그린
  '#fdba74', // 파스텔 오렌지
  '#fca5a5', // 파스텔 레드
  '#c4b5fd', // 파스텔 퍼플
  '#fde047', // 파스텔 옐로우
  '#a5f3fc', // 파스텔 시안
  '#fbcfe8'  // 파스텔 핑크
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
  align?: 'left' | 'right'
}) {
  const isActive = sortConfig?.key === sortKey
  return (
    <th
      className={`px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
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

export default function DowntimeDashboard() {
  const { data, selectedMonth } = useData()
  const [showTable, setShowTable] = useState(true)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'value', direction: 'desc' })
  const [reasonFilter, setReasonFilter] = useState('')

  // 가동율 데이터 필터링
  const filteredData = useMemo(() => {
    // 디버깅: 데이터 구조 확인
    if (data.availabilityData.length > 0) {
      console.log('⏱️ 가동율 데이터 샘플:', data.availabilityData[0])
      console.log('⏱️ 가동율 데이터 키:', Object.keys(data.availabilityData[0]))
    } else {
      console.log('⏱️ 가동율 데이터 없음')
    }

    return data.availabilityData.filter(d => {
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
  }, [data.availabilityData, selectedMonth])

  // 비가동 사유별 분석 (컬럼별 비가동 사유 구조 지원)
  const downtimeByReason = useMemo(() => {
    const reasonMap = new Map<string, number>()

    // 비가동 사유로 인식할 컬럼명 패턴
    const excludeKeys = ['생산일자', '공정', '설비', 'LINE', '주/야간', '무인', '조업시간', '가동시간', '비가동합계', '시간가동율', '계획정지합계', '설비가동율', 'id', 'data']

    filteredData.forEach(item => {
      const keys = Object.keys(item)

      // 각 컬럼을 순회하며 비가동 사유 컬럼 찾기
      keys.forEach(key => {
        // 제외할 키 체크
        const isExcluded = excludeKeys.some(ex => key.includes(ex))
        if (isExcluded) return

        const value = parseFloat(String(item[key as keyof typeof item] || 0)) || 0
        if (value > 0) {
          // 컬럼명을 비가동 사유로 사용
          const reason = key
          reasonMap.set(reason, (reasonMap.get(reason) || 0) + value)
        }
      })
    })

    let result = Array.from(reasonMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))

    // 필터
    if (reasonFilter) {
      result = result.filter(r => r.name.toLowerCase().includes(reasonFilter.toLowerCase()))
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

    return result.slice(0, 20)
  }, [filteredData, reasonFilter, sortConfig])

  // 설비별 비가동 분석
  const downtimeByEquipment = useMemo(() => {
    const equipMap = new Map<string, { total: number; downtime: number }>()

    // 비가동 사유로 인식할 컬럼명 패턴 (제외 목록)
    const excludeKeys = ['생산일자', '공정', '설비', 'LINE', '주/야간', '무인', '조업시간', '가동시간', '비가동합계', '시간가동율', '계획정지합계', '설비가동율', 'id', 'data']

    filteredData.forEach(item => {
      // 설비명 찾기
      const equip = String(
        item['설비/LINE'] || item['설비(라인)명'] || item.equipment_name ||
        item.설비명 || item.설비 || item.라인명 || '기타'
      )

      // 가동시간
      const operatingTime = parseFloat(String(
        item['가동시간(분)'] || item.가동시간 || item.operating_minutes || 0
      )) || 0

      // 비가동합계가 있으면 사용, 없으면 각 비가동 사유 컬럼 합산
      let downtimeTotal = parseFloat(String(item.비가동합계 || 0)) || 0

      if (downtimeTotal === 0) {
        // 각 비가동 사유 컬럼 합산
        const keys = Object.keys(item)
        keys.forEach(key => {
          const isExcluded = excludeKeys.some(ex => key.includes(ex))
          if (isExcluded) return
          downtimeTotal += parseFloat(String(item[key as keyof typeof item] || 0)) || 0
        })
      }

      if (!equipMap.has(equip)) {
        equipMap.set(equip, { total: 0, downtime: 0 })
      }
      const current = equipMap.get(equip)!
      current.total += operatingTime + downtimeTotal
      current.downtime += downtimeTotal
    })

    return Array.from(equipMap.entries())
      .map(([name, data]) => ({
        name: name.length > 15 ? name.slice(0, 15) + '...' : name,
        fullName: name,
        가동시간: Math.round(data.total - data.downtime),
        비가동시간: Math.round(data.downtime),
        비가동율: data.total > 0 ? Math.round((data.downtime / data.total) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.비가동시간 - a.비가동시간) // 비가동시간 큰 순으로 정렬
      .slice(0, 12)
  }, [filteredData])

  // 총 비가동시간 계산
  const totalDowntime = useMemo(() => {
    // 비가동합계 컬럼이 있으면 사용
    const hasTotal = filteredData.some(item => item.비가동합계 !== undefined)
    if (hasTotal) {
      return filteredData.reduce((sum, item) => {
        return sum + (parseFloat(String(item.비가동합계 || 0)) || 0)
      }, 0)
    }
    // downtimeByReason에서 계산된 합계 사용
    return downtimeByReason.reduce((sum, item) => sum + item.value, 0)
  }, [filteredData, downtimeByReason])

  // 정렬 핸들러
  const handleSort = (key: string) => {
    if (sortConfig?.key === key) {
      setSortConfig(sortConfig.direction === 'asc' ? { key, direction: 'desc' } : null)
    } else {
      setSortConfig({ key, direction: 'asc' })
    }
  }

  // 데이터 없음 처리
  if (data.availabilityData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-16 text-center border border-slate-200">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold text-slate-700 mb-2">가동율 데이터가 없습니다</h3>
        <p className="text-slate-500 mb-6">비가동현황 분석을 위해 가동율 CSV 파일을 업로드하세요</p>
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 font-medium rounded-xl">
          📤 파일업로드 메뉴에서 가동율 데이터를 업로드해 주세요
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
          <div className="text-sm font-medium text-amber-600 mb-2">주요 비가동 사유</div>
          <div className="text-xl font-bold text-amber-700 truncate">
            {downtimeByReason[0]?.name || '-'}
          </div>
          <div className="text-xs text-amber-500 mt-1">
            {downtimeByReason[0] ? `${formatNumber(downtimeByReason[0].value)}분` : '-'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="text-sm font-medium text-blue-600 mb-2">비가동 사유 수</div>
          <div className="text-3xl font-bold text-blue-700">{downtimeByReason.length}</div>
          <div className="text-xs text-blue-500 mt-1">개 유형</div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 비가동 사유별 파이 차트 */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-full" />
            비가동 사유별 분포
          </h3>
          {downtimeByReason.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={downtimeByReason.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                  labelLine={true}
                >
                  {downtimeByReason.slice(0, 8).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(value as number) + '분'} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              데이터가 부족합니다
            </div>
          )}
        </div>

        {/* 비가동 사유별 바 차트 */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-red-500 rounded-full" />
            비가동 사유별 시간
          </h3>
          {downtimeByReason.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={downtimeByReason.slice(0, 8)} layout="vertical" margin={{ right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatNumber(value as number) + '분'} />
                <Bar dataKey="value" fill="#fca5a5" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill="#b91c1c"
                    fontSize={10}
                    fontWeight="bold"
                    formatter={(v) => `${formatNumber(Number(v))}분`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              데이터가 부족합니다
            </div>
          )}
        </div>
      </div>

      {/* 설비별 비가동 현황 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full" />
          설비별 가동/비가동 현황
          <span className="text-xs font-normal text-slate-400 ml-2">(비가동시간 순 정렬)</span>
        </h3>
        {downtimeByEquipment.length > 0 ? (
          <ResponsiveContainer width="100%" height={450}>
            <ComposedChart data={downtimeByEquipment} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => formatNumber(v)}
                label={{ value: '시간(분)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                label={{ value: '비가동율(%)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (name === '비가동율') return [`${(value as number).toFixed(1)}%`, name]
                  return [formatNumber(value as number) + '분', name]
                }}
                labelFormatter={(label) => {
                  const item = downtimeByEquipment.find(d => d.name === label)
                  return item?.fullName || label
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar yAxisId="left" dataKey="가동시간" stackId="a" fill="#6ee7b7" name="가동시간">
                <LabelList
                  dataKey="가동시간"
                  position="inside"
                  fill="#047857"
                  fontSize={9}
                  formatter={(v) => Number(v) > 0 ? formatNumber(Number(v)) : ''}
                />
              </Bar>
              <Bar yAxisId="left" dataKey="비가동시간" stackId="a" fill="#fca5a5" name="비가동시간">
                <LabelList
                  dataKey="비가동시간"
                  position="inside"
                  fill="#b91c1c"
                  fontSize={9}
                  formatter={(v) => Number(v) > 0 ? formatNumber(Number(v)) : ''}
                />
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="비가동율"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
                name="비가동율"
              >
                <LabelList
                  dataKey="비가동율"
                  position="top"
                  fill="#d97706"
                  fontSize={10}
                  fontWeight="bold"
                  formatter={(v) => `${Number(v).toFixed(1)}%`}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            설비별 데이터가 부족합니다
          </div>
        )}
      </div>

      {/* 상세 테이블 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <span className="w-1 h-5 bg-slate-500 rounded-full" />
            비가동 상세 현황
            <span className="text-sm font-normal text-slate-400">({downtimeByReason.length}건)</span>
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="사유 검색..."
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-40"
            />
            <button
              onClick={() => downloadExcel(downtimeByReason.map((item, idx) => ({
                비가동사유: item.name,
                '시간(분)': item.value,
                '비율(%)': totalDowntime > 0 ? ((item.value / totalDowntime) * 100).toFixed(1) : '0'
              })), `비가동현황_${selectedMonth}월`)}
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
                  <SortableHeader label="비가동 사유" sortKey="name" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="시간(분)" sortKey="value" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">비율</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">그래프</th>
                </tr>
              </thead>
              <tbody>
                {downtimeByReason.map((item, idx) => {
                  const percent = totalDowntime > 0 ? (item.value / totalDowntime) * 100 : 0
                  return (
                    <tr key={item.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-3 font-medium text-slate-700">{item.name}</td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{formatNumber(item.value)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{percent.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                          <div
                            className="h-2.5 rounded-full"
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
        )}
      </div>
    </div>
  )
}
