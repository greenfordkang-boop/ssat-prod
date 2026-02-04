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

// 설비/Line 필드명 추출 헬퍼 함수
const getEquipmentName = (row: Record<string, unknown>): string => {
  // 다양한 필드명 지원 - 순서 중요 (정확한 매칭 우선)
  const name = row['설비/LINE'] || row['설비/Line'] || row['설비/라인'] ||
               row['설비(라인)명'] || row['설비명'] || row.LINE || row.Line ||
               row['라인명'] || row['설비(라인)코드'] || row['설비코드'] ||
               row['EQUIPMENT'] || row['Equipment'] || row.equipment || ''
  return String(name).trim() || '기타'
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

  // 불량 상세 팝업 상태
  const [defectModalOpen, setDefectModalOpen] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)

  // CT 상세 팝업 상태
  const [ctModalOpen, setCtModalOpen] = useState(false)
  const [selectedCtEquipment, setSelectedCtEquipment] = useState<string | null>(null)

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

  // 설비/Line별 현황
  const equipmentStats = useMemo(() => {
    const equip: Record<string, { production: number; defect: number; time: number }> = {}

    // 디버깅: 첫 번째 데이터의 키 확인
    if (processData.length > 0) {
      const firstRow = processData[0]
      const keys = Object.keys(firstRow)
      const equipKeys = keys.filter(k =>
        k.includes('설비') || k.includes('LINE') || k.includes('Line') || k.includes('라인')
      )
      console.log('🏭 설비/Line 필드 확인:', equipKeys, '| 샘플값:', equipKeys.map(k => firstRow[k as keyof typeof firstRow]))
    }

    processData.forEach(row => {
      const name = getEquipmentName(row as Record<string, unknown>)
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

  // 선택된 설비의 불량 상세 데이터
  const defectDetails = useMemo(() => {
    if (!selectedEquipment) return []

    return processData
      .filter(row => {
        const equipName = getEquipmentName(row as Record<string, unknown>)
        const prod = parseNumber(row.생산수량)
        const goodQty = parseNumber(row.양품수량)
        const defectQty = parseNumber(row.불량수량) || (prod - goodQty)
        return equipName === selectedEquipment && defectQty > 0
      })
      .map(row => {
        const prod = parseNumber(row.생산수량)
        const goodQty = parseNumber(row.양품수량)
        const defectQty = parseNumber(row.불량수량) || (prod - goodQty)
        return {
          생산일자: row.생산일자 || '',
          품목명: row.품목명 || row['품목코드'] || '',
          생산수량: prod,
          양품수량: goodQty,
          불량수량: defectQty,
          불량율: prod > 0 ? (defectQty / prod * 100).toFixed(1) + '%' : '0%',
          불량유형: row.불량유형 || row['불량사유'] || '-',
          작업자: row.작업자 || '-'
        }
      })
      .sort((a, b) => a.생산일자.localeCompare(b.생산일자))
  }, [processData, selectedEquipment])

  // 불량 상세 팝업 열기
  const openDefectModal = (equipmentName: string) => {
    setSelectedEquipment(equipmentName)
    setDefectModalOpen(true)
  }

  // 업종별 데이터에서 품목별 UPH/UPPH 매핑 생성
  const productUphMap = useMemo(() => {
    const map = new Map<string, { uph: number; upph: number }>()
    data.detailData.forEach(row => {
      // 품목명 또는 품목코드로 매핑
      const product = String(row.품목명 || row.품목코드 || row['품목'] || '')
      if (!product) return

      const uph = parseNumber(row.UPH as string | number)
      const upph = parseNumber(row.UPPH as string | number)

      // 값이 있는 경우에만 저장 (더 큰 값으로 업데이트)
      const existing = map.get(product)
      if (!existing || uph > existing.uph || upph > existing.upph) {
        map.set(product, {
          uph: Math.max(uph, existing?.uph || 0),
          upph: Math.max(upph, existing?.upph || 0)
        })
      }
    })
    return map
  }, [data.detailData])

  // UPH 분석 (업종별 데이터 기준)
  const uphAnalysis = useMemo(() => {
    let result = processData.map(row => {
      const product = row.품목명 || ''
      const detailUph = productUphMap.get(product)

      return {
        equipment: getEquipmentName(row as Record<string, unknown>),
        product,
        // 업종별 데이터 우선, 없으면 생산실적 데이터 사용
        uph: detailUph?.uph || parseNumber(row.UPH),
        upph: detailUph?.upph || parseNumber(row.UPPH),
        standardCT: parseNumber(row['표준C/T']),
        actualCT: parseNumber(row['실제C/T']),
        ctEfficiency: parseNumber(row['표준C/T']) > 0
          ? (parseNumber(row['표준C/T']) / parseNumber(row['실제C/T']) * 100)
          : 0
      }
    })

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
  }, [processData, uphSort, productUphMap])

  // CT 데이터에서 유연하게 값 찾기 (표준/실제 구분 명확히)
  const findCTValue = (row: Record<string, unknown>, type: 'standard' | 'actual'): number => {
    const keys = Object.keys(row)

    // 타입별 키워드 정의
    const standardKeywords = ['표준', 'standard', 'std', '기준']
    const actualKeywords = ['실제', 'actual', '측정', '현재']
    const ctKeywords = ['c/t', 'ct', '사이클', 'cycle', 'time']

    const targetKeywords = type === 'standard' ? standardKeywords : actualKeywords
    const excludeKeywords = type === 'standard' ? actualKeywords : standardKeywords

    // 1단계: 타입 키워드 + CT 키워드 모두 포함하는 컬럼 찾기
    for (const key of keys) {
      const lowerKey = key.toLowerCase()
      const hasTarget = targetKeywords.some(kw => lowerKey.includes(kw))
      const hasCT = ctKeywords.some(kw => lowerKey.includes(kw))
      const hasExclude = excludeKeywords.some(kw => lowerKey.includes(kw))

      if (hasTarget && hasCT && !hasExclude) {
        const val = parseNumber(row[key] as string | number)
        if (val > 0) return val
      }
    }

    // 2단계: 타입 키워드만 포함하는 컬럼 (CT 없어도)
    for (const key of keys) {
      const lowerKey = key.toLowerCase()
      const hasTarget = targetKeywords.some(kw => lowerKey.includes(kw))
      const hasExclude = excludeKeywords.some(kw => lowerKey.includes(kw))

      if (hasTarget && !hasExclude) {
        const val = parseNumber(row[key] as string | number)
        if (val > 0) return val
      }
    }

    return 0
  }

  // CT 데이터 분석
  const ctAnalysis = useMemo(() => {
    // 디버깅: CT 데이터 컬럼 확인
    if (data.ctData.length > 0) {
      console.log('🔧 CT 데이터 샘플 키:', Object.keys(data.ctData[0]))
      console.log('🔧 CT 데이터 샘플 값:', data.ctData[0])
      // 품목 관련 필드 찾기
      const productKeys = Object.keys(data.ctData[0]).filter(k =>
        k.includes('품목') || k.includes('품명') || k.includes('제품') ||
        k.includes('ITEM') || k.includes('Item') || k.includes('모델') || k.includes('Model')
      )
      console.log('🔧 CT 품목 관련 필드:', productKeys)
    }

    const processCT = data.ctData.filter(row =>
      row.공정 === processName || row.process === processName
    )

    let result = processCT.map(row => {
      const standardCT = findCTValue(row, 'standard')
      const actualCT = findCTValue(row, 'actual')

      // 설비명 찾기 (유연하게)
      const equipment = String(
        row['설비(라인)명'] || row['설비/LINE'] || row['설비/Line'] ||
        row.LINE || row.Line || row.설비명 || row.equipment ||
        row['라인명'] || row['설비'] || '기타'
      )

      // 품목명 찾기 (다양한 필드명 지원) - 부품명 우선
      const product = String(
        row.부품명 || row.품목명 || row.품목코드 || row.product || row['품목'] ||
        row.품명 || row.제품명 || row['제품코드'] || row['제품'] ||
        row.ITEM || row.Item || row.item || row['ITEM_NAME'] || row['ITEM_CODE'] ||
        row.모델 || row.Model || row.model || row['모델명'] ||
        row['PRODUCT'] || row['Product'] || ''
      )

      return {
        equipment,
        product,
        standardCT,
        actualCT,
        efficiency: standardCT > 0 && actualCT > 0
          ? (standardCT / actualCT * 100)
          : 0
      }
    })

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

  // 선택된 설비의 CT 상세 데이터
  const ctDetails = useMemo(() => {
    if (!selectedCtEquipment) return []

    const processCT = data.ctData.filter(row =>
      row.공정 === processName || row.process === processName
    )

    return processCT
      .filter(row => {
        const equipment = String(
          row['설비(라인)명'] || row['설비/LINE'] || row['설비/Line'] ||
          row.LINE || row.Line || row.설비명 || row.equipment ||
          row['라인명'] || row['설비'] || '기타'
        )
        return equipment === selectedCtEquipment
      })
      .map(row => {
        const standardCT = findCTValue(row, 'standard')
        const actualCT = findCTValue(row, 'actual')
        // 품목명 찾기 (다양한 필드명 지원) - 부품명 우선
        const product = String(
          row.부품명 || row.품목명 || row.품목코드 || row.product || row['품목'] ||
          row.품명 || row.제품명 || row['제품코드'] || row['제품'] ||
          row.ITEM || row.Item || row.item || row['ITEM_NAME'] || row['ITEM_CODE'] ||
          row.모델 || row.Model || row.model || row['모델명'] ||
          row['PRODUCT'] || row['Product'] || '-'
        )
        const date = String(row.생산일자 || row.date || row['일자'] || '-')

        return {
          생산일자: date,
          품목명: product,
          표준CT: standardCT,
          실제CT: actualCT,
          CT효율: standardCT > 0 && actualCT > 0 ? (standardCT / actualCT * 100) : 0,
          차이: actualCT - standardCT
        }
      })
  }, [data.ctData, processName, selectedCtEquipment])

  // CT 상세 팝업 열기
  const openCtModal = (equipmentName: string) => {
    setSelectedCtEquipment(equipmentName)
    setCtModalOpen(true)
  }

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
                설비/Line별 현황
                <span className="text-sm font-normal text-slate-400">({equipmentStats.length}건)</span>
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="설비/Line 검색..."
                  value={equipFilter}
                  onChange={(e) => setEquipFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-40"
                />
                <button
                  onClick={() => downloadExcel(equipmentStats.map(r => ({
                    '설비/Line': r.name,
                    생산수량: r.production,
                    불량수량: r.defect,
                    '불량율(%)': r.defectRate.toFixed(1),
                    UPH: r.uph
                  })), `${processName}_설비Line별현황`)}
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
                      <SortableHeader label="설비/Line" sortKey="name" sortConfig={equipSort} onSort={(k) => handleSort(setEquipSort, k, equipSort)} />
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
                        <td
                          className="px-4 py-3 text-right tabular-nums text-red-600 cursor-pointer hover:bg-red-50 hover:underline"
                          onClick={() => row.defect > 0 && openDefectModal(row.name)}
                          title={row.defect > 0 ? '클릭하여 불량 상세 보기' : ''}
                        >
                          {formatNumber(row.defect)}
                        </td>
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
                  '설비/Line': r.equipment,
                  품목: r.product,
                  UPH: r.uph,
                  UPPH: r.upph,
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
                    <SortableHeader label="설비/Line" sortKey="equipment" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} />
                    <SortableHeader label="품목" sortKey="product" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} />
                    <SortableHeader label="UPH" sortKey="uph" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} align="right" />
                    <SortableHeader label="UPPH" sortKey="upph" sortConfig={uphSort} onSort={(k) => handleSort(setUphSort, k, uphSort)} align="right" />
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
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatNumber(row.upph)}</td>
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
                  '설비/Line': r.equipment,
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
                    <SortableHeader label="설비/Line" sortKey="equipment" sortConfig={ctSort} onSort={(k) => handleSort(setCtSort, k, ctSort)} />
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
                      <td
                        className="px-4 py-3 text-right cursor-pointer hover:bg-blue-50"
                        onClick={() => openCtModal(row.equipment)}
                        title="클릭하여 상세 내역 보기"
                      >
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

      {/* 불량 상세 팝업 모달 */}
      {defectModalOpen && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDefectModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-red-50 to-red-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="text-red-500">🔴</span>
                {selectedEquipment} 불량 상세
                <span className="text-sm font-normal text-slate-500">({defectDetails.length}건)</span>
              </h3>
              <button
                onClick={() => setDefectModalOpen(false)}
                className="p-2 hover:bg-red-200 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="overflow-auto max-h-[calc(80vh-130px)]">
              {defectDetails.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  해당 설비의 불량 상세 데이터가 없습니다.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">생산일자</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">품목명</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">생산수량</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">양품수량</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">불량수량</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">불량율</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">불량유형</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">작업자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defectDetails.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-3">{row.생산일자}</td>
                        <td className="px-4 py-3 font-medium">{row.품목명}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.생산수량)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.양품수량)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-600 font-semibold">{formatNumber(row.불량수량)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-600">{row.불량율}</td>
                        <td className="px-4 py-3">{row.불량유형}</td>
                        <td className="px-4 py-3">{row.작업자}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <div className="text-sm text-slate-500">
                총 불량수량: <span className="font-bold text-red-600">{formatNumber(defectDetails.reduce((sum, r) => sum + r.불량수량, 0))}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    downloadExcel(defectDetails.map(r => ({
                      생산일자: r.생산일자,
                      품목명: r.품목명,
                      생산수량: r.생산수량,
                      양품수량: r.양품수량,
                      불량수량: r.불량수량,
                      '불량율(%)': r.불량율,
                      불량유형: r.불량유형,
                      작업자: r.작업자
                    })), `${processName}_${selectedEquipment}_불량상세`)
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium flex items-center gap-2"
                >
                  📥 엑셀 다운로드
                </button>
                <button
                  onClick={() => setDefectModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CT 상세 팝업 */}
      {ctModalOpen && selectedCtEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCtModalOpen(false)}>
          <div
            className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                📊 CT 상세 내역 - {selectedCtEquipment}
                <span className="text-sm font-normal text-slate-500">({ctDetails.length}건)</span>
              </h3>
              <button
                onClick={() => setCtModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="overflow-auto flex-1">
              {ctDetails.length === 0 ? (
                <p className="text-slate-500 text-center py-8">CT 데이터가 없습니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">품목</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">표준CT</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">실제CT</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">CT효율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctDetails.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-2">{row.품목명}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.표준CT.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.실제CT.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            row.CT효율 >= 100 ? 'bg-green-100 text-green-700' :
                            row.CT효율 >= 80 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {row.CT효율.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                평균 CT효율: <span className="font-bold text-blue-600">
                  {ctDetails.length > 0
                    ? (ctDetails.reduce((sum, r) => sum + r.CT효율, 0) / ctDetails.length).toFixed(1)
                    : 0}%
                </span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    downloadExcel(ctDetails.map(r => ({
                      설비: selectedCtEquipment,
                      생산일자: r.생산일자,
                      품목명: r.품목명,
                      표준CT: r.표준CT,
                      실제CT: r.실제CT,
                      'CT효율(%)': r.CT효율
                    })), `${processName}_${selectedCtEquipment}_CT상세`)
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium flex items-center gap-2"
                >
                  📥 엑셀 다운로드
                </button>
                <button
                  onClick={() => setCtModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
