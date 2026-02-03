'use client'

import { useMemo, useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { formatNumber, formatPercent, parseNumber, CHART_COLORS, EXCLUDED_PROCESSES, PROCESS_MAPPING } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Legend
} from 'recharts'

export default function QualityDashboard() {
  const { data, selectedMonth, getFilteredData } = useData()
  const filteredData = getFilteredData()
  const [showTable, setShowTable] = useState(true)
  const [processFilter, setProcessFilter] = useState('all')

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
      const defect = parseNumber(row.불량수량)
      const scrap = parseNumber(row.폐기수량)

      totalProduction += production
      totalGood += good
      totalDefect += defect
      totalScrap += scrap

      // 불량금액 계산 (단가 데이터가 있으면 사용)
      const price = data.priceData.find(p =>
        p.품목코드 === row.품목코드 || p.품목명 === row.품목명
      )
      if (price) {
        totalDefectAmount += defect * parseNumber(price.단가 || price.price || 0)
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

      if (!stats[process]) {
        stats[process] = { production: 0, good: 0, defect: 0, scrap: 0 }
      }

      stats[process].production += parseNumber(row.생산수량)
      stats[process].good += parseNumber(row.양품수량)
      stats[process].defect += parseNumber(row.불량수량)
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

      stats[key].production += parseNumber(row.생산수량)
      stats[key].good += parseNumber(row.양품수량)
      stats[key].defect += parseNumber(row.불량수량)

      // 불량금액
      const price = data.priceData.find(p =>
        p.품목코드 === row.품목코드 || p.품목명 === row.품목명
      )
      if (price) {
        stats[key].defectAmount += parseNumber(row.불량수량) * parseNumber(price.단가 || price.price || 0)
      }
    })

    return Object.values(stats)
      .filter(item => processFilter === 'all' || item.process === processFilter)
      .map(item => ({
        ...item,
        defectRate: item.production > 0 ? (item.defect / item.production) * 100 : 0,
        yieldRate: item.production > 0 ? (item.good / item.production) * 100 : 0
      }))
      .sort((a, b) => b.defectRate - a.defectRate)
      .slice(0, 50)
  }, [filteredData, data.priceData, processFilter])

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
          <div className="text-3xl font-bold text-blue-600">{formatPercent(qualityStats.yieldRate)}</div>
          <div className="text-xs text-slate-500 mt-2">양품: {formatNumber(qualityStats.totalGood)} EA</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
          <div className="text-sm text-slate-500 mb-1">불량 금액</div>
          <div className="text-3xl font-bold text-amber-600">{formatNumber(Math.round(qualityStats.defectAmount))}</div>
          <div className="text-xs text-slate-500 mt-2">원 (불량 {formatNumber(qualityStats.totalDefect)} EA)</div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="text-sm text-slate-500 mb-1">평균 불량율</div>
          <div className="text-3xl font-bold text-red-600">{formatPercent(qualityStats.defectRate)}</div>
          <div className="text-xs text-slate-500 mt-2">불량: {formatNumber(qualityStats.totalDefect)} EA</div>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-6 border border-pink-200">
          <div className="text-sm text-slate-500 mb-1">평균 폐기율</div>
          <div className="text-3xl font-bold text-pink-600">{formatPercent(qualityStats.scrapRate)}</div>
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
                  if (name === '수율(%)') return [`${value}%`, name]
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
            <span className="text-sm font-normal text-slate-400">(불량율 높은 순)</span>
          </h3>
          <button
            onClick={() => setShowTable(!showTable)}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1 bg-slate-100 rounded-lg"
          >
            {showTable ? '접기' : '펼치기'}
          </button>
        </div>

        {showTable && (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">순위</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">품목명</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">공정</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">생산수량</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">양품수량</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">불량수량</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">불량금액</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">불량율</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">수율</th>
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
                    <td className="px-4 py-3 text-right tabular-nums">{formatPercent(item.defectRate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPercent(item.yieldRate)}</td>
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
