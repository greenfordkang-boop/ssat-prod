'use client'

import { useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { formatNumber, parseNumber, PROCESS_MAPPING, CHART_COLORS } from '@/lib/utils'

interface ProcessDashboardProps {
  process: string
  subMenu: string
}

export default function ProcessDashboard({ process, subMenu }: ProcessDashboardProps) {
  const { data, selectedMonth, getFilteredData } = useData()

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

    // 디버깅: 생산 데이터 구조 확인
    if (processData.length > 0) {
      console.log('📊 생산 데이터 샘플:', processData[0])
      console.log('📊 생산 데이터 키:', Object.keys(processData[0]))
      console.log('📊 불량수량 값:', processData[0]['불량수량'])
    }

    processData.forEach(row => {
      production += parseNumber(row.생산수량)
      good += parseNumber(row.양품수량)
      defect += parseNumber(row.불량수량)
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

      if (!daily[day]) daily[day] = { production: 0, defect: 0 }
      daily[day].production += parseNumber(row.생산수량)
      daily[day].defect += parseNumber(row.불량수량)
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
      if (!equip[name]) equip[name] = { production: 0, defect: 0, time: 0 }
      equip[name].production += parseNumber(row.생산수량)
      equip[name].defect += parseNumber(row.불량수량)
      equip[name].time += parseNumber(row['작업시간(분)'])
    })

    return Object.entries(equip)
      .map(([name, values]) => ({
        name,
        production: values.production,
        defect: values.defect,
        defectRate: values.production > 0 ? (values.defect / values.production * 100) : 0,
        uph: values.time > 0 ? Math.round(values.production / (values.time / 60)) : 0
      }))
      .sort((a, b) => b.production - a.production)
  }, [processData])

  // UPH 분석
  const uphAnalysis = useMemo(() => {
    return processData.map(row => ({
      equipment: row['설비(라인)명'] || '기타',
      product: row.품목명 || '',
      uph: parseNumber(row.UPH),
      standardCT: parseNumber(row['표준C/T']),
      actualCT: parseNumber(row['실제C/T']),
      ctEfficiency: parseNumber(row['표준C/T']) > 0
        ? (parseNumber(row['표준C/T']) / parseNumber(row['실제C/T']) * 100)
        : 0
    })).slice(0, 20)
  }, [processData])

  // CT 데이터 분석 (해당 공정)
  const ctAnalysis = useMemo(() => {
    // 디버깅: CT 데이터 구조 확인
    if (data.ctData.length > 0) {
      console.log('🔧 CT 데이터 샘플:', data.ctData[0])
      console.log('🔧 CT 데이터 키:', Object.keys(data.ctData[0]))
      console.log('🔧 찾는 공정명:', processName)
    }

    const processCT = data.ctData.filter(row =>
      row.공정 === processName || row.process === processName
    )
    console.log('🔧 필터링된 CT 데이터:', processCT.length, '건')

    return processCT.map(row => ({
      equipment: row['설비(라인)명'] || row.equipment || row.설비명 || '기타',
      product: row.품목명 || row.product || '',
      standardCT: parseNumber(row['표준C/T'] || row.standardCT || row['표준CT'] || 0),
      actualCT: parseNumber(row['실제C/T'] || row.actualCT || row['실제CT'] || 0),
      efficiency: parseNumber(row['표준C/T'] || row.standardCT || 0) > 0
        ? (parseNumber(row['표준C/T'] || row.standardCT || 0) / parseNumber(row['실제C/T'] || row.actualCT || 1) * 100)
        : 0
    })).slice(0, 50)
  }, [data.ctData, processName])

  // 검포장 데이터
  const packagingData = useMemo(() => {
    // 디버깅: 검포장 데이터 확인
    if (data.packagingStatusData.length > 0) {
      console.log('📦 검포장 데이터 샘플:', data.packagingStatusData[0])
      console.log('📦 검포장 데이터 키:', Object.keys(data.packagingStatusData[0]))
    }
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

  return (
    <div className="p-6 space-y-6">
      {/* Header - 업로드 버튼 제거 */}
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
              <div className="text-sm text-red-500">{stats.defectRate.toFixed(2)}%</div>
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
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${(v as number).toFixed(2)}%`} />
                  <Line type="monotone" dataKey="defectRate" name="불량율" stroke={CHART_COLORS.pastel[3]} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Equipment Table */}
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h3 className="text-base font-semibold mb-4">설비별 현황</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">설비</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">생산수량</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">불량수량</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">불량율</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">UPH</th>
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
                          {row.defectRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.uph)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {subMenu === 'uph' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="text-base font-semibold mb-4">UPH 현황</h3>
          {uphAnalysis.length === 0 ? (
            <p className="text-gray-500">해당 공정의 UPH 데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">설비</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">품목</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">UPH</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">표준CT</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">실제CT</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">CT효율</th>
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
          <h3 className="text-base font-semibold mb-4">Cycle Time 분석</h3>
          {ctAnalysis.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">해당 공정의 CT 데이터가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-2">전체 CT 데이터: {data.ctData.length}건</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">설비</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">품목</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">표준CT</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">실제CT</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">CT효율</th>
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
          <h3 className="text-base font-semibold mb-4">검포장 현황</h3>
          {packagingData.length === 0 ? (
            <p className="text-gray-500">검포장 데이터가 없습니다. 파일업로드 메뉴에서 업로드해주세요.</p>
          ) : (
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
          <h3 className="text-base font-semibold mb-4">불량수리 현황</h3>
          {repairData.length === 0 ? (
            <p className="text-gray-500">불량수리 데이터가 없습니다. 파일업로드 메뉴에서 업로드해주세요.</p>
          ) : (
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
          <h3 className="text-base font-semibold mb-4">자재불량 현황</h3>
          {materialDefectData.length === 0 ? (
            <p className="text-gray-500">자재불량 데이터가 없습니다. 파일업로드 메뉴에서 업로드해주세요.</p>
          ) : (
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
