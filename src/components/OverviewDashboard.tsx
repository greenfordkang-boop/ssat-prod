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
import { formatNumber, formatPercent, parseNumber, CHART_COLORS, EXCLUDED_PROCESSES } from '@/lib/utils'

export default function OverviewDashboard() {
  const { data, selectedMonth, setSelectedMonth, getFilteredData } = useData()
  const filteredData = getFilteredData()
  const [showDetailTable, setShowDetailTable] = useState(true)
  const [processFilter, setProcessFilter] = useState('all')

  // OEE 계산 (공정별 종합효율) - hooks는 항상 맨 위에!
  const oeeStats = useMemo(() => {
    // 가동율 데이터에서 시간가동율, 성능가동율 계산
    const monthAvailability = data.availabilityData.filter(d => {
      const dateStr = String(d.date || d.일자 || '')
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

    let totalOperatingTime = 0
    let totalPlannedTime = 0
    let totalDowntime = 0

    monthAvailability.forEach(row => {
      const operating = parseNumber(row.가동시간 || row.operating_minutes || 0)
      const downtime = parseNumber(row.비가동시간 || row.downtime_minutes || 0)
      totalOperatingTime += operating
      totalDowntime += downtime
      totalPlannedTime += operating + downtime
    })

    // 시간가동율 = 가동시간 / 계획시간
    const timeAvailability = totalPlannedTime > 0 ? (totalOperatingTime / totalPlannedTime) * 100 : 0

    // 생산실적에서 양품율 계산
    let totalProduction = 0
    let totalGood = 0

    filteredData.forEach(row => {
      const process = row.공정 || ''
      if (EXCLUDED_PROCESSES.includes(process)) return
      totalProduction += parseNumber(row.생산수량)
      totalGood += parseNumber(row.양품수량)
    })

    // 양품율
    const qualityRate = totalProduction > 0 ? (totalGood / totalProduction) * 100 : 0

    // 성능가동율 (CT 데이터 기반 - 실제CT/표준CT)
    const monthCT = data.ctData.filter(d => {
      const dateStr = String(d.date || d.일자 || '')
      if (!dateStr) return true
      let rowMonth = null
      if (dateStr.includes('-')) {
        rowMonth = parseInt(dateStr.split('-')[1]) || null
      }
      return !rowMonth || rowMonth === selectedMonth
    })

    let totalStdCT = 0
    let totalActCT = 0
    monthCT.forEach(row => {
      totalStdCT += parseNumber(row['표준C/T'] || row.standardCT || 0)
      totalActCT += parseNumber(row['실제C/T'] || row.actualCT || 0)
    })

    const performanceRate = totalActCT > 0 ? Math.min((totalStdCT / totalActCT) * 100, 100) : 92 // 기본값

    // OEE = 시간가동율 × 성능가동율 × 양품율 / 10000
    const oee = (timeAvailability * performanceRate * qualityRate) / 10000

    return {
      oee: oee || 0,
      timeAvailability: timeAvailability || 0,
      performanceRate: performanceRate || 92,
      qualityRate: qualityRate || 0,
      availabilityCount: monthAvailability.length,
      ctCount: monthCT.length
    }
  }, [data.availabilityData, data.ctData, filteredData, selectedMonth])

  // 월별 OEE 추이 (1~12월)
  const monthlyOEE = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const monthData = data.rawData.filter(row => {
        const dateStr = row.생산일자 || ''
        const match = dateStr.match(/\d{4}-(\d{2})-\d{2}/)
        return match && parseInt(match[1]) === month
      })

      if (monthData.length === 0) {
        return { month: `${month}월`, OEE: 0, 시간가동율: 0, 성능가동율: 0, 양품율: 0 }
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

      // 가동율 데이터에서 해당 월 필터
      const monthAvail = data.availabilityData.filter(d => {
        const dateStr = String(d.date || d.일자 || '')
        if (!dateStr) return false
        let rowMonth = null
        if (dateStr.includes('-')) rowMonth = parseInt(dateStr.split('-')[1])
        return rowMonth === month
      })

      let opTime = 0, planTime = 0
      monthAvail.forEach(row => {
        const op = parseNumber(row.가동시간 || row.operating_minutes || 0)
        const dt = parseNumber(row.비가동시간 || row.downtime_minutes || 0)
        opTime += op
        planTime += op + dt
      })

      const timeAvail = planTime > 0 ? (opTime / planTime) * 100 : 0
      const perfRate = 92 // 기본값
      const oee = (timeAvail * perfRate * qualityRate) / 10000

      return {
        month: `${month}월`,
        'OEE (%)': Math.round(oee * 10) / 10,
        시간가동율: Math.round(timeAvail * 10) / 10,
        성능가동율: perfRate,
        양품율: Math.round(qualityRate * 10) / 10
      }
    })
  }, [data.rawData, data.availabilityData])

  // 공정별 종합효율 상세
  const processOEE = useMemo(() => {
    const stats: Record<string, { production: number; good: number; defect: number; opTime: number; planTime: number }> = {}

    filteredData.forEach(row => {
      const process = row.공정 || '기타'
      if (EXCLUDED_PROCESSES.includes(process)) return

      if (!stats[process]) {
        stats[process] = { production: 0, good: 0, defect: 0, opTime: 0, planTime: 0 }
      }

      stats[process].production += parseNumber(row.생산수량)
      stats[process].good += parseNumber(row.양품수량)
      stats[process].defect += parseNumber(row.불량수량)
    })

    // 가동율 데이터 병합
    const monthAvail = data.availabilityData.filter(d => {
      const dateStr = String(d.date || d.일자 || '')
      if (!dateStr) return true
      let rowMonth = null
      if (dateStr.includes('-')) rowMonth = parseInt(dateStr.split('-')[1])
      return !rowMonth || rowMonth === selectedMonth
    })

    monthAvail.forEach(row => {
      const process = String(row.공정 || row.process || '기타')
      if (!stats[process]) {
        stats[process] = { production: 0, good: 0, defect: 0, opTime: 0, planTime: 0 }
      }
      const op = parseNumber(row.가동시간 || row.operating_minutes || 0)
      const dt = parseNumber(row.비가동시간 || row.downtime_minutes || 0)
      stats[process].opTime += op
      stats[process].planTime += op + dt
    })

    return Object.entries(stats)
      .filter(([, v]) => v.production > 0)
      .map(([name, values]) => {
        const timeAvail = values.planTime > 0 ? (values.opTime / values.planTime) * 100 : 100
        const perfRate = 100 // 기본값
        const qualityRate = values.production > 0 ? (values.good / values.production) * 100 : 0
        const oee = (timeAvail * perfRate * qualityRate) / 10000

        return {
          공정: name,
          생산수량: values.production,
          양품수량: values.good,
          시간가동율: Math.round(timeAvail * 10) / 10,
          성능가동율: perfRate,
          양품율: Math.round(qualityRate * 10) / 10,
          '종합효율(OEE)': Math.round(oee * 10) / 10
        }
      })
      .sort((a, b) => b['종합효율(OEE)'] - a['종합효율(OEE)'])
  }, [filteredData, data.availabilityData, selectedMonth])

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

  // 데이터 없음 표시 - hooks 다음에 배치!
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
              <option value="all">All</option>
              {processes.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 데이터 현황 */}
        <div className="flex items-center gap-4 mt-4 text-sm">
          <span className="text-green-600 flex items-center gap-1">
            ✓ 가동율 {formatNumber(oeeStats.availabilityCount)}건
          </span>
          <span className="text-amber-600 flex items-center gap-1">
            ✓ CT현황 {formatNumber(oeeStats.ctCount)}건
          </span>
        </div>
      </div>

      {/* OEE 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{selectedMonth}월 종합효율 (OEE)</div>
          <div className="text-4xl font-bold text-slate-800">{formatPercent(oeeStats.oee)}</div>
          <div className="text-xs text-slate-400 mt-2">시간가동율 × 성능가동율 × 양품율</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="text-sm text-slate-500 mb-1">평균 시간가동율</div>
          <div className="text-4xl font-bold text-blue-600">{formatPercent(oeeStats.timeAvailability)}</div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">평균 성능가동율</div>
          <div className="text-4xl font-bold text-slate-700">{formatPercent(oeeStats.performanceRate)}</div>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-6 border border-cyan-200">
          <div className="text-sm text-slate-500 mb-1">평균 양품율</div>
          <div className="text-4xl font-bold text-cyan-600">{formatPercent(oeeStats.qualityRate)}</div>
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
            <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(value) => [`${value}%`, '']} />
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
            <span className="text-sm font-normal text-slate-400">(년간 누적)</span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDetailTable(!showDetailTable)}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1 bg-slate-100 rounded-lg"
            >
              {showDetailTable ? '접기' : '펼치기'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition">
              📥 엑셀 다운로드
            </button>
          </div>
        </div>

        {showDetailTable && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">공정</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">생산수량</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">양품수량</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">시간가동율</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">성능가동율</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">양품율</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">종합효율(OEE)</th>
                </tr>
              </thead>
              <tbody>
                {processOEE.map((row, idx) => (
                  <tr key={row.공정} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-3 font-medium text-slate-700">{row.공정}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.생산수량)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.양품수량)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.시간가동율)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.성능가동율)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.양품율)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-600">
                      {formatPercent(row['종합효율(OEE)'])}
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
