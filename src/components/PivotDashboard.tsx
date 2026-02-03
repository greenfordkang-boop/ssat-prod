'use client'

import { useMemo, useState, useCallback } from 'react'
import { useData } from '@/contexts/DataContext'
import { formatNumber, parseNumber, EXCLUDED_PROCESSES } from '@/lib/utils'

type AggFunc = 'sum' | 'count' | 'avg'

export default function PivotDashboard() {
  const { data, selectedMonth, getFilteredData, pivot, setPivot } = useData()
  const filteredData = getFilteredData()

  const [showTable, setShowTable] = useState(true)

  // 가능한 필드 목록
  const fields = useMemo(() => {
    if (filteredData.length === 0) return []
    const sample = filteredData[0]
    return Object.keys(sample).filter(key =>
      !['id', 'month', 'created_at', 'updated_at'].includes(key)
    )
  }, [filteredData])

  // 숫자 필드 (값 집계용)
  const numericFields = useMemo(() => {
    return ['생산수량', '양품수량', '불량수량', '폐기수량', '작업시간(분)', '작업인원', 'UPH', 'UPPH']
  }, [])

  // 피봇 테이블 생성
  const pivotTable = useMemo(() => {
    if (filteredData.length === 0) return { rows: [], cols: [], data: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 }

    const rowField = pivot.rows
    const colField = pivot.cols
    const valueField = pivot.values
    const aggFunc = pivot.aggFunc

    // 유니크 행/열 값
    const rowSet = new Set<string>()
    const colSet = new Set<string>()

    // 데이터 수집
    const dataMap: Record<string, Record<string, { sum: number; count: number }>> = {}

    filteredData.forEach(row => {
      const process = row.공정 || ''
      if (EXCLUDED_PROCESSES.includes(process)) return

      const rowVal = String(row[rowField as keyof typeof row] || '기타')
      const colVal = String(row[colField as keyof typeof row] || '기타')
      const value = parseNumber(row[valueField as keyof typeof row] as string | number)

      rowSet.add(rowVal)
      colSet.add(colVal)

      if (!dataMap[rowVal]) dataMap[rowVal] = {}
      if (!dataMap[rowVal][colVal]) dataMap[rowVal][colVal] = { sum: 0, count: 0 }

      dataMap[rowVal][colVal].sum += value
      dataMap[rowVal][colVal].count++
    })

    // 정렬된 배열
    const rows = Array.from(rowSet).sort()
    const cols = Array.from(colSet).sort()

    // 집계 함수 적용
    const getValue = (sum: number, count: number): number => {
      switch (aggFunc) {
        case 'sum': return sum
        case 'count': return count
        case 'avg': return count > 0 ? sum / count : 0
        default: return sum
      }
    }

    // 데이터 매트릭스 생성
    const result: Record<string, Record<string, number>> = {}
    const rowTotals: Record<string, number> = {}
    const colTotals: Record<string, number> = {}
    let grandTotal = 0

    rows.forEach(rowVal => {
      result[rowVal] = {}
      rowTotals[rowVal] = 0

      cols.forEach(colVal => {
        const cell = dataMap[rowVal]?.[colVal] || { sum: 0, count: 0 }
        const value = getValue(cell.sum, cell.count)
        result[rowVal][colVal] = value
        rowTotals[rowVal] += value
        colTotals[colVal] = (colTotals[colVal] || 0) + value
        grandTotal += value
      })
    })

    return { rows, cols, data: result, rowTotals, colTotals, grandTotal }
  }, [filteredData, pivot])

  // 엑셀 다운로드
  const handleExport = useCallback(() => {
    if (pivotTable.rows.length === 0) return

    const { rows, cols, data, rowTotals, colTotals, grandTotal } = pivotTable

    // CSV 생성
    let csv = `${pivot.rows} \\ ${pivot.cols}`
    cols.forEach(col => { csv += `,${col}` })
    csv += ',합계\n'

    rows.forEach(row => {
      csv += row
      cols.forEach(col => {
        csv += `,${Math.round(data[row][col] || 0)}`
      })
      csv += `,${Math.round(rowTotals[row])}\n`
    })

    // 합계 행
    csv += '합계'
    cols.forEach(col => {
      csv += `,${Math.round(colTotals[col] || 0)}`
    })
    csv += `,${Math.round(grandTotal)}\n`

    // 다운로드
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `피봇테이블_${selectedMonth}월.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [pivotTable, pivot, selectedMonth])

  // 초기화
  const handleReset = () => {
    setPivot({ rows: '공정', cols: '품종', values: '생산수량', aggFunc: 'sum' })
  }

  // 데이터 없음
  if (data.rawData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-16 text-center border border-slate-200">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-slate-700 mb-2">생산실적 데이터가 없습니다</h3>
        <p className="text-slate-500 mb-6">데이터 조회를 위해 생산실적 CSV 파일을 업로드하세요</p>
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
            <h2 className="text-xl font-bold text-slate-800">상세 데이터 조회 (피봇)</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{selectedMonth}월</span>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
            >
              📥 엑셀 다운로드
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {/* 피봇 설정 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex flex-wrap items-center gap-6">
          {/* 행 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">행:</label>
            <select
              value={pivot.rows}
              onChange={(e) => setPivot({ ...pivot, rows: e.target.value })}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[120px]"
            >
              {fields.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* 열 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">열:</label>
            <select
              value={pivot.cols}
              onChange={(e) => setPivot({ ...pivot, cols: e.target.value })}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[120px]"
            >
              {fields.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* 값 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">값:</label>
            <select
              value={pivot.values}
              onChange={(e) => setPivot({ ...pivot, values: e.target.value })}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[120px]"
            >
              {numericFields.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* 집계 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">집계:</label>
            <select
              value={pivot.aggFunc}
              onChange={(e) => setPivot({ ...pivot, aggFunc: e.target.value as AggFunc })}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[100px]"
            >
              <option value="sum">합계</option>
              <option value="count">건수</option>
              <option value="avg">평균</option>
            </select>
          </div>

          {/* 데이터 건수 */}
          <div className="ml-auto text-sm text-slate-500">
            총 {formatNumber(filteredData.length)}건
          </div>
        </div>
      </div>

      {/* 피봇 테이블 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700">피봇 테이블 결과</h3>
          <button
            onClick={() => setShowTable(!showTable)}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1 bg-slate-100 rounded-lg"
          >
            {showTable ? '접기' : '펼치기'}
          </button>
        </div>

        {showTable && pivotTable.rows.length > 0 ? (
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border border-slate-200 min-w-[100px]">
                    {pivot.rows} \ {pivot.cols}
                  </th>
                  {pivotTable.cols.map(col => (
                    <th key={col} className="text-right px-3 py-2 font-semibold text-slate-600 border border-slate-200 min-w-[80px] whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-bold text-slate-700 border border-slate-200 bg-slate-200 min-w-[80px]">
                    합계
                  </th>
                </tr>
              </thead>
              <tbody>
                {pivotTable.rows.map((row, rowIdx) => (
                  <tr key={row} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 font-medium text-slate-700 border border-slate-200 whitespace-nowrap">
                      {row}
                    </td>
                    {pivotTable.cols.map(col => (
                      <td key={col} className="px-3 py-2 text-right tabular-nums text-slate-600 border border-slate-200">
                        {formatNumber(Math.round(pivotTable.data[row]?.[col] || 0))}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700 border border-slate-200 bg-slate-100">
                      {formatNumber(Math.round(pivotTable.rowTotals[row] || 0))}
                    </td>
                  </tr>
                ))}
                {/* 합계 행 */}
                <tr className="bg-slate-200 font-semibold">
                  <td className="px-3 py-2 text-slate-700 border border-slate-300">합계</td>
                  {pivotTable.cols.map(col => (
                    <td key={col} className="px-3 py-2 text-right tabular-nums text-slate-700 border border-slate-300">
                      {formatNumber(Math.round(pivotTable.colTotals[col] || 0))}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 border border-slate-300 bg-slate-300">
                    {formatNumber(Math.round(pivotTable.grandTotal))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            {pivotTable.rows.length === 0 ? '데이터가 없습니다' : '테이블이 접혀 있습니다'}
          </div>
        )}
      </div>
    </div>
  )
}
