'use client'

import { useMemo, useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { formatNumber, parseNumber, PROCESS_MAPPING, CHART_COLORS } from '@/lib/utils'

interface ProcessDashboardProps {
  process: string
  subMenu: string
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

export default function ProcessDashboard({ process, subMenu }: ProcessDashboardProps) {
  const { data, selectedMonth, getFilteredData } = useData()

  // 테이블 상태
  const [showEquipTable, setShowEquipTable] = useState(true)
  const [showUphTable, setShowUphTable] = useState(true)
  const [showCtTable, setShowCtTable] = useState(true)
  const [showPackagingTable, setShowPackagingTable] = useState(true)
  const [showRepairTable, setShowRepairTable] = useState(true)
  const [showMaterialTable, setShowMaterialTable] = useState(true)

  // 정렬 상태
  const [equipSort, setEquipSort] = useState<SortConfig>(null)
  const [uphSort, setUphSort] = useState<SortConfig>(null)
  const [ctSort, setCtSort] = useState<SortConfig>(null)

  // 필터 상태
  const [equipFilter, setEquipFilter] = useState('')

  // 공정명 변환
  const processName = PROCESS_MAPPING[process as keyof typeof PROCESS_MAPPING] || process

  // 해당 공정 데이터 필터링
  const processData = useMemo(() => {
    return getFilteredData().filter(row => row.공정 === processName)
  }, [getFilteredData, processName])

  // 통계 계산
  const stats = useMemo(() => {
    let production = 0
    let good = 0
    let defect = 0
    let workTime = 0

    processData.forEach(row => {
      const prod = parseNumber(row.생산수량)
      const goodQty = parseNumber(row.양품수량)
      // 불량수량: 명시적 필드가 있으면 사용, 없으면 생산-양품으로 계산
      const defectQty = parseNumber(row.불량수량) || (prod - goodQty)

      production += prod
      good += goodQty
      defect += defectQty > 0 ? defectQty : 0
      workTime += parseNumber(row['작업시간(분)'])
    })

    return {
      production,
      good,
      defect,
      defectRate: production > 0 ? (defect / production * 100) : 0,
      workTime,
      avgUph: workTime > 0 ? Math.round(production / (workTime / 60)) : 0
    }
  }, [processData])

  // 일별 추이
  const dailyTrend = useMemo(() => {
    const daily: Record<string, { production: number; defect: number }> = {}

    processData.forEach(row => {
      const day = (row.생산일자 || '').split('-')[2] || ''
      if (!day) return

      const prod = parseNumber(row.생산수량)
      const goodQty = parseNumber(row.양품수량)
      const defectQty = parseNumber(row.불량수량) || (prod - goodQty)

      if (!daily[day]) daily[day] = { production: 0, defect: 0 }
      daily[day].production += prod
      daily[day].defect += defectQty > 0 ? defectQty : 0
    })

    return Object.entries(daily)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([day, values]) => ({
        day: `${parseInt(day)}일`,
        production: values.production,
        defect: values.defect,
        defectRate: values.production > 0 ? (values.defect / values.production * 100) : 0
      }))
  }, [processData])

  // 설비별 현황
  const equipmentStats = useMemo(() => {
    const equip: Record<string, { production: number; defect: number; time: number }> = {}

    processData.forEach(row => {
      const name = row['설비(라인)명'] || '기타'
      const prod = parseNumber(row.생산수량)
      const goodQty = parseNumber(row.양품수량)
      const defectQty = parseNumber(row.불량수량) || (prod - goodQty)

      if (!equip[name]) equip[name] = { production: 0, defect: 0, time: 0 }
      equip[name].production += prod
      equip[name].defect += defectQty > 0 ? defectQty : 0
      equip[name].time += parseNumber(row['작업시간(분)'])
    })

    let result = Object.entries(equip)
      .map(([name, values]) => ({
        name,
        production: values.production,
        defect: values.defect,
        defectRate: values.production > 0 ? (values.defect / values.production * 100) : 0,
        uph: values.time > 0 ? Math.round(values.production / (values.time / 60)) : 0
      }))

    // 필터
    if (equipFilter) {
      result = result.filter(r => r.name.toLowerCase().includes(equipFilter.toLowerCase()))
    }

    // 정렬
    if (equipSort) {
      result.sort((a, b) => {
        const aVal = a[equipSort.key as keyof typeof a]
        const bVal = b[equipSort.key as keyof typeof b]
        const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal))
        return equipSort.direction === 'asc' ? cmp : -cmp
      })
    } else {
      result.sort((a, b) => b.production - a.production)
    }

    return result
  }, [processData, equipFilter, equipSort])

  // UPH 분석
  const uphAnalysis = useMemo(() => {
    let result = processData.map(row => ({
      equipment: row['설비(라인)명'] || '기타',
      product: row.품목명 || '',
      uph: parseNumber(row.UPH),
      standardCT: parseNumber(row['표준C/T']),
      actualCT: parseNumber(row['실제C/T']),
      ctEfficiency: parseNumber(row['표준C/T']) > 0
        ? (parseNumber(row['표준C/T']) / parseNumber(row['실제C/T']) * 100)
        : 0
    }))

    // 정렬
    if (uphSort) {
      result.sort((a, b) => {
        const aVal = a[uphSort.key as keyof typeof a]
        const bVal = b[uphSort.key as keyof typeof b]
        const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal))
        return uphSort.direction === 'asc' ? cmp : -cmp
      })
    }

    return result.slice(0, 50)
  }, [processData, uphSort])

  // CT 데이터 분석
  const ctAnalysis = useMemo(() => {
    const processCT = data.ctData.filter(row =>
      row.공정 === processName || row.process === processName
    )

    let result = processCT.map(row => ({
      equipment: row['설비(라인)명'] || row.equipment || row.설비명 || '기타',
      product: row.품목명 || row.product || '',
      standardCT: parseNumber(row['표준C/T'] || row.standardCT || row['표준CT'] || 0),
      actualCT: parseNumber(row['실제C/T'] || row.actualCT || row['실제CT'] || 0),
      efficiency: parseNumber(row['표준C/T'] || row.standardCT || 0) > 0
        ? (parseNumber(row['표준C/T'] || row.standardCT || 0) / parseNumber(row['실제C/T'] || row.actualCT || 1) * 100)
        : 0
    }))

    // 정렬
    if (ctSort) {
      result.sort((a, b) => {
        const aVal = a[ctSort.key as keyof typeof a]
        const bVal = b[ctSort.key as keyof typeof b]
        const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal))
        return ctSort.direction === 'asc' ? cmp : -cmp
      })
    }

    return result.slice(0, 50)
  }, [data.ctData, processName, ctSort])

  // 검포장 데이터
  const packagingData = useMemo(() => {
    return data.packagingStatusData.filter(row =>
      row.공정 === processName || !row.공정
    ).slice(0, 50)
  }, [data.packagingStatusData, processName])

  // 불량수리 데이터
  const repairData = useMemo(() => {
    return data.repairStatusData.filter(row =>
      row.공정 === processName || !row.공정
    ).slice(0, 50)
  }, [data.repairStatusData, processName])

  // 자재불량 데이터
  const materialDefectData = useMemo(() => {
    return data.materialDefectData.filter(row =>
      row.공정 === processName || !row.공정
    ).slice(0, 50)
  }, [data.materialDefectData, processName])

  // 정렬 핸들러
  const handleSort = (setter: React.Dispatch<React.SetStateAction<SortConfig>>, key: string, current: SortConfig) => {
    if (current?.key === key) {
      setter(current.direction === 'asc' ? { key, direction: 'desc' } : null)
    } else {
      setter({ key, direction: 'asc' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-blue-500 rounded" />
          <h2 className="text-xl font-bold text-gray-900">{selectedMonth}월 {processName}공정 현황</h2>
          <span className="text-sm text-gray-500">({processData.length}건)</span>
        </div>
      </div>

      {/* Render based on subMenu */}
      {subMenu === 'production' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
              <div className="text-xs font-semibold text-blue-600 uppercase mb-2">생산수량</div>
              <div className="text-2xl font-bold">{formatNumber(stats.production)}</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
              <div className="text-xs font-semibold text-green-600 uppercase mb-2">양품수량</div>
              <div className="text-2xl font-bold">{formatNumber(stats.good)}</div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200">
              <div className="text-xs font-semibold text-red-600 uppercase mb-2">불량수량</div>
              <div className="text-2xl font-bold">{formatNumber(stats.defect)}</div>
              <div className="text-sm text-red-500">{stats.defectRate.toFixed(1)}%</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
              <div className="text-xs font-semibold text-purple-600 uppercase mb-2">평균 UPH</div>
              <div className="text-2xl font-bold">{formatNumber(stats.avgUph)}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-base font-semibold mb-4">일별 생산추이</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={formatNumber} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatNumber(v as number)} />
                  <Bar dataKey="production" name="생산" fill={CHART_COLORS.pastel[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-base font-semibold mb-4">일별 불량율 추이</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} tickFormatter={(v) => v.toFixed(1)} />
                  <Tooltip formatter={(v) => `${(v as number).toFixed(1)}%`} />
                  <Line type="monotone" dataKey="defectRate" name="불량율" stroke={CHART_COLORS.pastel[3]} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Equipment Table */}
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                설비별 현황
                <span className="text-sm font-normal text-slate-400">({equipmentStats.length}건)</span>
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
                  onClick={() => downloadExcel(equipmentStats.map(r => ({
                    설비: r.name,
                    생산수량: r.production,
                    불량수량: r.defect,
                    '불량율(%)': r.defectRate.toFixed(1),
                    UPH: r.uph
                  })), `${processName}_설비별현황`)}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  📥 엑셀
                </button>
                <button
                  onClick={() => setShowEquipTable(!showEquipTable)}
                  className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
                >
                  {showEquipTable ? '접기' : '펼치기'}
                </button>
              </div>
            </div>
            {showEquipTable && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <SortableHeader label="설비" sortKey="name" sortConfig={equipSort} onSort={(k) => handleSort(setEquipSort, k, equipSort)} />
                      <SortableHeader label="생산수량" sortKey="production" sortConfig={equipSort} onSort={(k) => handleSort(setEquipSort, k, equipSort)} align="right" />
                      <SortableHeader label="불량수량" sortKey="defect" sortConfig={equipSort} onSort={(k) => handleSort(setEquipSort, k, equipSort)} align="right" />
                      <SortableHeader label="불량율" sortKey="defectRate" sortConfig={equipSort} onSort={(k) => handleSort(setEquipSort, k, equipSort)} align="right" />
                      <SortableHeader label="UPH" sortKey="uph" sortConfig={equipSort} onSort={(k) => handleSort(setEquipSort, k, equipSort)} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentStats.map((row, idx) => (
                      <tr key={row.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.production)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatNumber(row.defect)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            row.defectRate > 5 ? 'bg-red-100 text-red-700' :
                            row.defectRate > 2 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {row.defectRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.uph)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {subMenu === 'uph' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              UPH 현황
              <span className="text-sm font-normal text-slate-400">({uphAnalysis.length}건)</span>
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => downloadExcel(uphAnalysis.map(r => ({
                  설비: r.equipment,
                  품목: r.product,
                  UPH: r.uph,
                  표준CT: r.standardCT.toFixed(1),
                  실제CT: r.actualCT.toFixed(1),
                  'CT효율(%)': r.ctEfficiency.toFixed(1)
                })), `${processName}_UPH현황`)}
                className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                📥 엑셀
              </button>
              <button
                onClick={() => setShowUphTable(!showUphTable)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                {showUphTable ? '접기' : '펼치기'}
              </button>
            </div>
          </div>
          {uphAnalysis.length === 0 ? (
            <p className="text-gray-500">해당 공정의 UPH 데이터가 없습니다.</p>
          ) : showUphTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <SortableHeader label="설비" sortKey="equipment" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} />
                    <SortableHeader label="품목" sortKey="product" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} />
                    <SortableHeader label="UPH" sortKey="uph" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} align="right" />
                    <SortableHeader label="표준CT" sortKey="standardCT" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} align="right" />
                    <SortableHeader label="실제CT" sortKey="actualCT" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} align="right" />
                    <SortableHeader label="CT효율" sortKey="ctEfficiency" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {uphAnalysis.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-4 py-3">{row.equipment}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{row.product}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatNumber(row.uph)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.standardCT.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.actualCT.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.ctEfficiency >= 100 ? 'bg-green-100 text-green-700' :
                          row.ctEfficiency >= 80 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {row.ctEfficiency.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subMenu === 'cycletime' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              Cycle Time 분석
              <span className="text-sm font-normal text-slate-400">({ctAnalysis.length}건)</span>
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => downloadExcel(ctAnalysis.map(r => ({
                  설비: r.equipment,
                  품목: r.product,
                  표준CT: r.standardCT.toFixed(1),
                  실제CT: r.actualCT.toFixed(1),
                  'CT효율(%)': r.efficiency.toFixed(1)
                })), `${processName}_CT분석`)}
                className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                📥 엑셀
              </button>
              <button
                onClick={() => setShowCtTable(!showCtTable)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                {showCtTable ? '접기' : '펼치기'}
              </button>
            </div>
          </div>
          {ctAnalysis.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">해당 공정의 CT 데이터가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-2">전체 CT 데이터: {data.ctData.length}건</p>
            </div>
          ) : showCtTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <SortableHeader label="설비" sortKey="equipment" sortConfig={ctSort} onSort={(k) => handleSort(setCtSort, k, ctSort)} />
                    <SortableHeader label="품목" sortKey="product" sortConfig={ctSort} onSort={(k) => handleSort(setCtSort, k, ctSort)} />
                    <SortableHeader label="표준CT" sortKey="standardCT" sortConfig={ctSort} onSort={(k) => handleSort(setCtSort, k, ctSort)} align="right" />
                    <SortableHeader label="실제CT" sortKey="actualCT" sortConfig={ctSort} onSort={(k) => handleSort(setCtSort, k, ctSort)} align="right" />
                    <SortableHeader label="CT효율" sortKey="efficiency" sortConfig={ctSort} onSort={(k) => handleSort(setCtSort, k, ctSort)} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {ctAnalysis.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-4 py-3">{row.equipment}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{row.product}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.standardCT.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.actualCT.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.efficiency >= 100 ? 'bg-green-100 text-green-700' :
                          row.efficiency >= 80 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {row.efficiency.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subMenu === 'packaging' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              검포장 현황
              <span className="text-sm font-normal text-slate-400">({packagingData.length}건)</span>
            </h3>
            <div className="flex items-center gap-3">
              {packagingData.length > 0 && (
                <button
                  onClick={() => downloadExcel(packagingData as Record<string, unknown>[], `${processName}_검포장현황`)}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  📥 엑셀
                </button>
              )}
              <button
                onClick={() => setShowPackagingTable(!showPackagingTable)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                {showPackagingTable ? '접기' : '펼치기'}
              </button>
            </div>
          </div>
          {packagingData.length === 0 ? (
            <p className="text-gray-500">검포장 데이터가 없습니다. 파일업로드 메뉴에서 업로드해주세요.</p>
          ) : showPackagingTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {Object.keys(packagingData[0] || {}).slice(0, 8).map(key => (
                      <th key={key} className="px-4 py-3 text-left font-semibold text-slate-600">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {packagingData.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {Object.values(row).slice(0, 8).map((val, i) => (
                        <td key={i} className="px-4 py-3">{String(val || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subMenu === 'defect-repair' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              불량수리 현황
              <span className="text-sm font-normal text-slate-400">({repairData.length}건)</span>
            </h3>
            <div className="flex items-center gap-3">
              {repairData.length > 0 && (
                <button
                  onClick={() => downloadExcel(repairData as Record<string, unknown>[], `${processName}_불량수리현황`)}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  📥 엑셀
                </button>
              )}
              <button
                onClick={() => setShowRepairTable(!showRepairTable)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                {showRepairTable ? '접기' : '펼치기'}
              </button>
            </div>
          </div>
          {repairData.length === 0 ? (
            <p className="text-gray-500">불량수리 데이터가 없습니다. 파일업로드 메뉴에서 업로드해주세요.</p>
          ) : showRepairTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {Object.keys(repairData[0] || {}).slice(0, 8).map(key => (
                      <th key={key} className="px-4 py-3 text-left font-semibold text-slate-600">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repairData.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {Object.values(row).slice(0, 8).map((val, i) => (
                        <td key={i} className="px-4 py-3">{String(val || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subMenu === 'material-defect' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              자재불량 현황
              <span className="text-sm font-normal text-slate-400">({materialDefectData.length}건)</span>
            </h3>
            <div className="flex items-center gap-3">
              {materialDefectData.length > 0 && (
                <button
                  onClick={() => downloadExcel(materialDefectData as Record<string, unknown>[], `${processName}_자재불량현황`)}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  📥 엑셀
                </button>
              )}
              <button
                onClick={() => setShowMaterialTable(!showMaterialTable)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                {showMaterialTable ? '접기' : '펼치기'}
              </button>
            </div>
          </div>
          {materialDefectData.length === 0 ? (
            <p className="text-gray-500">자재불량 데이터가 없습니다. 파일업로드 메뉴에서 업로드해주세요.</p>
          ) : showMaterialTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {Object.keys(materialDefectData[0] || {}).slice(0, 8).map(key => (
                      <th key={key} className="px-4 py-3 text-left font-semibold text-slate-600">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materialDefectData.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {Object.values(row).slice(0, 8).map((val, i) => (
                        <td key={i} className="px-4 py-3">{String(val || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
