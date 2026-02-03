'use client'

import { useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { formatNumber, parseNumber, CHART_COLORS, EXCLUDED_PROCESSES } from '@/lib/utils'

export default function OverviewDashboard() {
  const { data, selectedMonth, getFilteredData } = useData()
  const filteredData = getFilteredData()

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

  // 공정별 집계
  const processStats = useMemo(() => {
    const stats: Record<string, { production: number; defect: number; count: number }> = {}

    filteredData.forEach(row => {
      const process = row.공정 || '기타'
      if (EXCLUDED_PROCESSES.includes(process)) return

      if (!stats[process]) {
        stats[process] = { production: 0, defect: 0, count: 0 }
      }

      stats[process].production += parseNumber(row.생산수량)
      stats[process].defect += parseNumber(row.불량수량)
      stats[process].count++
    })

    return Object.entries(stats).map(([name, values]) => ({
      name,
      production: values.production,
      defect: values.defect,
      defectRate: values.production > 0 ? (values.defect / values.production * 100) : 0,
      count: values.count
    }))
  }, [filteredData])

  // 전체 통계
  const totalStats = useMemo(() => {
    let totalProduction = 0
    let totalDefect = 0
    let totalGood = 0

    filteredData.forEach(row => {
      const process = row.공정 || ''
      if (EXCLUDED_PROCESSES.includes(process)) return

      totalProduction += parseNumber(row.생산수량)
      totalDefect += parseNumber(row.불량수량)
      totalGood += parseNumber(row.양품수량)
    })

    return {
      production: totalProduction,
      defect: totalDefect,
      good: totalGood,
      defectRate: totalProduction > 0 ? (totalDefect / totalProduction * 100) : 0
    }
  }, [filteredData])

  // 일별 생산 추이
  const dailyTrend = useMemo(() => {
    const daily: Record<string, number> = {}

    filteredData.forEach(row => {
      const date = row.생산일자 || ''
      const day = date.split('-')[2] || ''
      if (!day) return

      const process = row.공정 || ''
      if (EXCLUDED_PROCESSES.includes(process)) return

      if (!daily[day]) daily[day] = 0
      daily[day] += parseNumber(row.생산수량)
    })

    return Object.entries(daily)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([day, value]) => ({ day: `${parseInt(day)}일`, production: value }))
  }, [filteredData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-blue-500 rounded" />
          <h2 className="text-xl font-bold text-gray-900">{selectedMonth}월 종합현황</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="bg-slate-100 px-3 py-1 rounded-lg">생산실적 {data.rawData.length.toLocaleString()}건</span>
          <span className="bg-slate-100 px-3 py-1 rounded-lg">가동율 {data.availabilityData.length.toLocaleString()}건</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">총 생산수량</div>
          <div className="text-3xl font-bold text-gray-900">{formatNumber(totalStats.production)}</div>
          <div className="text-sm text-gray-500 mt-1">{filteredData.length}건 데이터</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">양품수량</div>
          <div className="text-3xl font-bold text-gray-900">{formatNumber(totalStats.good)}</div>
          <div className="text-sm text-gray-500 mt-1">
            양품율 {totalStats.production > 0 ? ((totalStats.good / totalStats.production) * 100).toFixed(1) : 0}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">불량수량</div>
          <div className="text-3xl font-bold text-gray-900">{formatNumber(totalStats.defect)}</div>
          <div className="text-sm text-gray-500 mt-1">불량율 {totalStats.defectRate.toFixed(2)}%</div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">공정수</div>
          <div className="text-3xl font-bold text-gray-900">{processStats.length}</div>
          <div className="text-sm text-gray-500 mt-1">활성 공정</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* 공정별 생산현황 */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <div className="w-0.5 h-4 bg-blue-500 rounded" />
            공정별 생산현황
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatNumber(value)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatNumber(value as number)} />
              <Bar dataKey="production" name="생산수량" fill={CHART_COLORS.pastel[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 공정별 비율 */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <div className="w-0.5 h-4 bg-blue-500 rounded" />
            공정별 생산비율
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={processStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="production"
              >
                {processStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS.pastel[index % CHART_COLORS.pastel.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatNumber(value as number)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Trend */}
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <div className="w-0.5 h-4 bg-blue-500 rounded" />
          일별 생산추이
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dailyTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(value) => formatNumber(value)} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => formatNumber(value as number)} />
            <Bar dataKey="production" name="생산수량" fill={CHART_COLORS.pastel[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Process Detail Table */}
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <div className="w-0.5 h-4 bg-blue-500 rounded" />
          공정별 상세현황
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">공정</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">생산수량</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">불량수량</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">불량율</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">작업건수</th>
              </tr>
            </thead>
            <tbody>
              {processStats.map((row, idx) => (
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
                      {row.defectRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
