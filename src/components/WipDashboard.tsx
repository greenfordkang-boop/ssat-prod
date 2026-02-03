'use client'

import { useMemo, useState, useCallback } from 'react'
import { useData } from '@/contexts/DataContext'
import { formatNumber, parseNumber } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

interface WipDashboardProps {
  subTab: string
}

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null

// 피벗 집계 방식
type AggregateMethod = 'sum' | 'count' | 'avg' | 'min' | 'max'

// 피벗 설정 타입
interface PivotConfig {
  rowField: string
  colField: string
  valueField: string
  aggregateMethod: AggregateMethod
}

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

// 차트 색상
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1']

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
  itemName?: string,
  customerPN?: string
) => {
  if (!priceData || priceData.length === 0) return undefined

  const searchCode = itemCode ? String(itemCode).trim() : ''
  const searchName = itemName ? String(itemName).trim() : ''
  const searchPN = customerPN ? String(customerPN).trim() : ''

  return priceData.find(p => {
    // 품목코드 매칭 (다양한 필드명 지원)
    const priceItemCode = getFieldFromPrice(p, '품목코드', '품번', '품목번호', 'itemCode', 'item_code', 'code', 'ITEM_CODE', 'PART_NO', 'partNo', 'part_no')
    if (searchCode && priceItemCode && priceItemCode === searchCode) {
      return true
    }
    // 고객사 P/N 매칭
    const priceCustPN = getFieldFromPrice(p, '고객사 P/N', '고객P/N', '고객사P/N', 'customerPN', 'customer_pn', 'CUST_PN', 'custPN')
    if (searchPN && priceCustPN && priceCustPN === searchPN) {
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
  // 다양한 필드명에서 단가 찾기 (합계단가 우선!)
  const priceVal = priceItem.합계단가 || priceItem['합계단가'] ||
                   priceItem.단가 || priceItem.가격 || priceItem.price || priceItem.unitPrice ||
                   priceItem.unit_price || priceItem.PRICE || priceItem.UNIT_PRICE ||
                   priceItem['단 가'] || priceItem['판매단가'] || priceItem['구매단가'] ||
                   priceItem.cost || priceItem.COST || 0
  return parseNumber(priceVal)
}

// 단가 매칭 통합 함수
const findPrice = (
  priceData: { [key: string]: string | number | undefined }[],
  itemCode?: string,
  itemName?: string,
  customerPN?: string
): number => {
  const found = findPriceData(priceData, itemCode, itemName, customerPN)
  if (!found) return 0
  return getPriceValue(found)
}

// 품목 상세 팝업용 타입
interface ItemDetailPopup {
  itemCode: string
  itemName: string
  warehouses: { name: string; qty: number }[]
  totalQty: number
}

export default function WipDashboard({ subTab }: WipDashboardProps) {
  const { data, selectedMonth } = useData()
  const [showTable, setShowTable] = useState(true)
  const [showPriceTable, setShowPriceTable] = useState(true)
  const [filter, setFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [priceSort, setPriceSort] = useState<SortConfig>(null)
  const [selectedItem, setSelectedItem] = useState<ItemDetailPopup | null>(null)
  const [warehouseFilter, setWarehouseFilter] = useState('all')

  // 재고 데이터에서 필드명 추출
  const getFieldValue = (row: Record<string, unknown>, ...keys: string[]): string | number => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key] as string | number
      }
    }
    return ''
  }

  // 요약 통계 (창고 필터 적용)
  const stats = useMemo(() => {
    let inventory = data.wipInventoryData

    // 창고 필터 적용
    if (warehouseFilter !== 'all') {
      inventory = inventory.filter(row => {
        const warehouse = String(getFieldValue(row, '창고명', '창고', 'warehouse') || '')
        return warehouse === warehouseFilter
      })
    }

    if (inventory.length === 0) return { totalQty: 0, totalAmount: 0, warehouseCount: 0, itemCount: 0, matchedCount: 0, unmatchedCount: 0 }

    let totalQty = 0
    let totalAmount = 0
    let matchedCount = 0
    let unmatchedCount = 0
    const warehouses = new Set<string>()
    const items = new Set<string>()

    inventory.forEach(row => {
      // 재고수량
      const qty = parseNumber(getFieldValue(row, '재고', '재고수량', 'quantity', 'qty'))
      totalQty += qty

      // 창고
      const warehouse = String(getFieldValue(row, '창고명', '창고', 'warehouse') || '')
      if (warehouse && warehouse !== '합계') warehouses.add(warehouse)

      // 품목
      const itemCode = String(getFieldValue(row, '품목코드', 'itemCode', 'code') || '')
      if (itemCode) items.add(itemCode)

      // 재고금액 (단가표 매칭)
      const itemName = String(getFieldValue(row, '품목명', 'itemName', 'name') || '')
      const customerPN = String(getFieldValue(row, '고객사 P/N', '고객P/N', 'customerPN') || '')
      const price = findPrice(data.priceData, itemCode, itemName, customerPN)

      if (price > 0) {
        matchedCount++
        totalAmount += qty * price
      } else {
        unmatchedCount++
      }
    })

    return {
      totalQty,
      totalAmount,
      warehouseCount: warehouses.size,
      itemCount: items.size,
      matchedCount,
      unmatchedCount
    }
  }, [data.wipInventoryData, data.priceData, warehouseFilter])

  // 창고별 재고 현황 (창고 필터 적용)
  const warehouseStats = useMemo(() => {
    let inventory = data.wipInventoryData

    // 창고 필터 적용
    if (warehouseFilter !== 'all') {
      inventory = inventory.filter(row => {
        const warehouse = String(getFieldValue(row, '창고명', '창고', 'warehouse') || '')
        return warehouse === warehouseFilter
      })
    }

    const statsMap: Record<string, { qty: number; amount: number; items: number }> = {}

    inventory.forEach(row => {
      const warehouse = String(getFieldValue(row, '창고명', '창고', 'warehouse') || '기타')
      if (warehouse === '합계') return

      if (!statsMap[warehouse]) {
        statsMap[warehouse] = { qty: 0, amount: 0, items: 0 }
      }

      const qty = parseNumber(getFieldValue(row, '재고', '재고수량', 'quantity', 'qty'))
      statsMap[warehouse].qty += qty
      statsMap[warehouse].items += 1

      // 재고금액
      const itemCode = String(getFieldValue(row, '품목코드', 'itemCode', 'code') || '')
      const itemName = String(getFieldValue(row, '품목명', 'itemName', 'name') || '')
      const customerPN = String(getFieldValue(row, '고객사 P/N', '고객P/N', 'customerPN') || '')
      const price = findPrice(data.priceData, itemCode, itemName, customerPN)
      statsMap[warehouse].amount += qty * price
    })

    return Object.entries(statsMap)
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.qty - a.qty)
  }, [data.wipInventoryData, data.priceData, warehouseFilter])

  // 품목유형별 재고 현황 (창고 필터 적용)
  const typeStats = useMemo(() => {
    let inventory = data.wipInventoryData

    // 창고 필터 적용
    if (warehouseFilter !== 'all') {
      inventory = inventory.filter(row => {
        const warehouse = String(getFieldValue(row, '창고명', '창고', 'warehouse') || '')
        return warehouse === warehouseFilter
      })
    }

    const statsMap: Record<string, number> = {}

    inventory.forEach(row => {
      const type = String(getFieldValue(row, '품목유형', '유형', 'type', '품종') || '기타')
      const qty = parseNumber(getFieldValue(row, '재고', '재고수량', 'quantity', 'qty'))
      statsMap[type] = (statsMap[type] || 0) + qty
    })

    return Object.entries(statsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [data.wipInventoryData, warehouseFilter])

  // 창고 목록
  const warehouses = useMemo(() => {
    const set = new Set<string>()
    data.wipInventoryData.forEach(row => {
      const warehouse = String(getFieldValue(row, '창고명', '창고', 'warehouse') || '')
      if (warehouse && warehouse !== '합계') set.add(warehouse)
    })
    return Array.from(set).sort()
  }, [data.wipInventoryData])

  // 품목별 창고 분산 현황 (여러 창고에 흩어진 품목 확인용)
  const itemWarehouseMap = useMemo(() => {
    const map: Record<string, Set<string>> = {}

    data.wipInventoryData.forEach(row => {
      const itemCode = String(getFieldValue(row, '품목코드', 'itemCode', 'code') || '')
      const warehouse = String(getFieldValue(row, '창고명', '창고', 'warehouse') || '')

      if (itemCode && warehouse && warehouse !== '합계') {
        if (!map[itemCode]) {
          map[itemCode] = new Set()
        }
        map[itemCode].add(warehouse)
      }
    })

    return map
  }, [data.wipInventoryData])

  // 품목이 여러 창고에 있는지 확인
  const getWarehouseCount = (itemCode: string): number => {
    return itemWarehouseMap[itemCode]?.size || 0
  }

  // 분산 필터 상태
  const [showOnlyDistributed, setShowOnlyDistributed] = useState(false)

  // 피벗 설정 상태
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>({
    rowField: '창고명',
    colField: '품목유형',
    valueField: '재고',
    aggregateMethod: 'sum'
  })
  const [showPivot, setShowPivot] = useState(true)

  // 필터링된 재고 데이터
  const filteredInventory = useMemo(() => {
    let result = [...data.wipInventoryData]

    // 창고 필터
    if (warehouseFilter !== 'all') {
      result = result.filter(row => {
        const warehouse = String(getFieldValue(row, '창고명', '창고', 'warehouse') || '')
        return warehouse === warehouseFilter
      })
    }

    // 텍스트 필터
    if (filter) {
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(filter.toLowerCase())
        )
      )
    }

    // 분산 품목만 필터
    if (showOnlyDistributed) {
      result = result.filter(row => {
        const itemCode = String(getFieldValue(row, '품목코드', 'itemCode', 'code') || '')
        return getWarehouseCount(itemCode) > 1
      })
    }

    // 정렬
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof typeof a]
        const bVal = b[sortConfig.key as keyof typeof b]
        const aNum = parseNumber(aVal)
        const bNum = parseNumber(bVal)
        const cmp = aNum !== 0 || bNum !== 0 ? aNum - bNum : String(aVal).localeCompare(String(bVal))
        return sortConfig.direction === 'asc' ? cmp : -cmp
      })
    }

    return result // 전체 데이터 반환 (제한 없음)
  }, [data.wipInventoryData, warehouseFilter, filter, sortConfig, showOnlyDistributed, getWarehouseCount])

  // 단가표 필터링
  const filteredPrice = useMemo(() => {
    let result = [...data.priceData]

    if (priceFilter) {
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(priceFilter.toLowerCase())
        )
      )
    }

    if (priceSort) {
      result.sort((a, b) => {
        const aVal = a[priceSort.key as keyof typeof a]
        const bVal = b[priceSort.key as keyof typeof b]
        const aNum = parseNumber(aVal)
        const bNum = parseNumber(bVal)
        const cmp = aNum !== 0 || bNum !== 0 ? aNum - bNum : String(aVal).localeCompare(String(bVal))
        return priceSort.direction === 'asc' ? cmp : -cmp
      })
    }

    return result // 전체 표시 (제한 없음)
  }, [data.priceData, priceFilter, priceSort])

  // 컬럼 추출
  const columns = useMemo(() => {
    if (data.wipInventoryData.length === 0) return []
    return Object.keys(data.wipInventoryData[0]).filter(key => key !== 'id' && key !== 'data').slice(0, 12)
  }, [data.wipInventoryData])

  const priceColumns = useMemo(() => {
    if (data.priceData.length === 0) return []
    return Object.keys(data.priceData[0]).filter(key => key !== 'id' && key !== 'data')
  }, [data.priceData])

  // 피벗 가능한 필드 목록
  const pivotFields = useMemo(() => {
    if (data.wipInventoryData.length === 0) return { dimension: [], measure: [] }

    const allKeys = Object.keys(data.wipInventoryData[0]).filter(key => key !== 'id' && key !== 'data')

    // 숫자 필드와 문자 필드 분리
    const sampleRow = data.wipInventoryData[0]
    const dimension: string[] = [] // 행/열용 (문자)
    const measure: string[] = []   // 값용 (숫자)

    allKeys.forEach(key => {
      const value = sampleRow[key as keyof typeof sampleRow]
      const numValue = parseNumber(value)
      // 숫자로 변환 가능하고 실제로 숫자 값이면 measure로
      if (typeof value === 'number' || (numValue !== 0 && !isNaN(numValue))) {
        measure.push(key)
      }
      // 모든 필드는 dimension으로 사용 가능
      dimension.push(key)
    })

    return { dimension, measure: measure.length > 0 ? measure : dimension }
  }, [data.wipInventoryData])

  // 피벗 테이블 데이터 계산
  const pivotData = useMemo(() => {
    if (data.wipInventoryData.length === 0) return { rows: [], cols: [], matrix: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 }

    const { rowField, colField, valueField, aggregateMethod } = pivotConfig

    // 고유한 행/열 값 추출
    const rowValues = new Set<string>()
    const colValues = new Set<string>()

    // 집계용 데이터 구조
    const matrix: Record<string, Record<string, number[]>> = {}

    data.wipInventoryData.forEach(row => {
      const rowKey = String(getFieldValue(row, rowField) || '(없음)')
      const colKey = String(getFieldValue(row, colField) || '(없음)')
      const value = parseNumber(getFieldValue(row, valueField))

      rowValues.add(rowKey)
      colValues.add(colKey)

      if (!matrix[rowKey]) matrix[rowKey] = {}
      if (!matrix[rowKey][colKey]) matrix[rowKey][colKey] = []
      matrix[rowKey][colKey].push(value)
    })

    // 집계 함수
    const aggregate = (values: number[]): number => {
      if (values.length === 0) return 0
      switch (aggregateMethod) {
        case 'sum': return values.reduce((a, b) => a + b, 0)
        case 'count': return values.length
        case 'avg': return values.reduce((a, b) => a + b, 0) / values.length
        case 'min': return Math.min(...values)
        case 'max': return Math.max(...values)
        default: return values.reduce((a, b) => a + b, 0)
      }
    }

    // 집계 실행
    const aggregatedMatrix: Record<string, Record<string, number>> = {}
    const rowTotals: Record<string, number> = {}
    const colTotals: Record<string, number> = {}
    let grandTotal = 0

    const rows = Array.from(rowValues).sort()
    const cols = Array.from(colValues).sort()

    rows.forEach(rowKey => {
      aggregatedMatrix[rowKey] = {}
      let rowSum: number[] = []

      cols.forEach(colKey => {
        const values = matrix[rowKey]?.[colKey] || []
        const aggregated = aggregate(values)
        aggregatedMatrix[rowKey][colKey] = aggregated
        rowSum = [...rowSum, ...values]
      })

      rowTotals[rowKey] = aggregate(rowSum)
    })

    cols.forEach(colKey => {
      let colSum: number[] = []
      rows.forEach(rowKey => {
        const values = matrix[rowKey]?.[colKey] || []
        colSum = [...colSum, ...values]
      })
      colTotals[colKey] = aggregate(colSum)
    })

    // 전체 합계
    let allValues: number[] = []
    rows.forEach(rowKey => {
      cols.forEach(colKey => {
        const values = matrix[rowKey]?.[colKey] || []
        allValues = [...allValues, ...values]
      })
    })
    grandTotal = aggregate(allValues)

    return { rows, cols, matrix: aggregatedMatrix, rowTotals, colTotals, grandTotal }
  }, [data.wipInventoryData, pivotConfig, getFieldValue])

  // 피벗 설정 변경 핸들러
  const handlePivotConfigChange = useCallback((field: keyof PivotConfig, value: string) => {
    setPivotConfig(prev => ({ ...prev, [field]: value }))
  }, [])

  // 디버그: 단가표 필드명 확인
  const priceFieldInfo = useMemo(() => {
    if (data.priceData.length === 0) return { fields: [], sample: null }
    const fields = Object.keys(data.priceData[0]).filter(key => key !== 'id' && key !== 'data')
    return { fields, sample: data.priceData[0] }
  }, [data.priceData])

  // 콘솔에 디버그 정보 출력
  useMemo(() => {
    if (data.priceData.length > 0) {
      console.log('📋 ========== 단가표 디버그 ==========')
      console.log('📋 단가표 필드명:', priceFieldInfo.fields)
      console.log('📋 단가표 샘플 데이터:', priceFieldInfo.sample)
      // 단가 필드 확인
      const sample = data.priceData[0]
      console.log('📋 합계단가 값:', sample.합계단가, sample['합계단가'])
      console.log('📋 품목코드 값:', sample.품목코드, sample['품목코드'])
    }
    if (data.wipInventoryData.length > 0) {
      console.log('📦 ========== 재고 데이터 디버그 ==========')
      const sampleInv = data.wipInventoryData[0]
      console.log('📦 재고 데이터 필드명:', Object.keys(sampleInv).filter(k => k !== 'id' && k !== 'data'))
      console.log('📦 재고 샘플 데이터:', sampleInv)
      console.log('📦 품목코드 값:', sampleInv.품목코드, sampleInv['품목코드'])

      // 매칭 테스트
      if (data.priceData.length > 0) {
        const invCode = String(sampleInv.품목코드 || sampleInv['품목코드'] || '').trim()
        const invName = String(sampleInv.품목명 || sampleInv['품목명'] || '').trim()
        console.log('🔍 매칭 테스트 - 재고 품목코드:', invCode, '품목명:', invName)

        const matchedPrice = findPriceData(data.priceData, invCode, invName)
        if (matchedPrice) {
          console.log('✅ 매칭 성공! 단가:', getPriceValue(matchedPrice))
        } else {
          console.log('❌ 매칭 실패 - 단가표에서 찾지 못함')
          // 첫 번째 단가표 품목코드와 비교
          const priceCode = String(data.priceData[0].품목코드 || data.priceData[0]['품목코드'] || '').trim()
          console.log('   단가표 첫번째 품목코드:', priceCode)
          console.log('   일치 여부:', invCode === priceCode)
        }
      }
    }
  }, [data.priceData, data.wipInventoryData, priceFieldInfo])

  // 정렬 핸들러
  const handleSort = (key: string) => {
    if (sortConfig?.key === key) {
      setSortConfig(sortConfig.direction === 'asc' ? { key, direction: 'desc' } : null)
    } else {
      setSortConfig({ key, direction: 'asc' })
    }
  }

  // 품목 클릭 시 창고별 재고 현황 팝업
  const handleItemClick = (row: Record<string, unknown>) => {
    const itemCode = String(getFieldValue(row, '품목코드', 'itemCode', 'code') || '')
    const itemName = String(getFieldValue(row, '품목명', 'itemName', 'name') || '')

    // 해당 품목의 창고별 재고 계산
    const warehouseMap: Record<string, number> = {}
    let totalQty = 0

    data.wipInventoryData.forEach(item => {
      const code = String(getFieldValue(item, '품목코드', 'itemCode', 'code') || '')
      if (code === itemCode) {
        const warehouse = String(getFieldValue(item, '창고명', '창고', 'warehouse') || '기타')
        const qty = parseNumber(getFieldValue(item, '재고', '재고수량', 'quantity', 'qty'))
        warehouseMap[warehouse] = (warehouseMap[warehouse] || 0) + qty
        totalQty += qty
      }
    })

    const warehouses = Object.entries(warehouseMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)

    setSelectedItem({ itemCode, itemName, warehouses, totalQty })
  }

  const handlePriceSort = (key: string) => {
    if (priceSort?.key === key) {
      setPriceSort(priceSort.direction === 'asc' ? { key, direction: 'desc' } : null)
    } else {
      setPriceSort({ key, direction: 'asc' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-blue-500 rounded" />
          <h2 className="text-xl font-bold text-gray-900">
            {subTab === 'status' ? '창고별 재고현황' : '부품단가표'}
          </h2>
        </div>
        {subTab === 'status' && warehouses.length > 0 && (
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-sm"
          >
            <option value="all">전체 창고</option>
            {warehouses.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        )}
      </div>

      {subTab === 'status' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="text-sm text-slate-500 mb-1">총 재고수량</div>
              <div className="text-3xl font-bold text-blue-600">{formatNumber(stats.totalQty)}</div>
              <div className="text-xs text-slate-400 mt-2">EA</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200">
              <div className="text-sm text-slate-500 mb-1">총 재고금액</div>
              <div className="text-3xl font-bold text-emerald-600">{formatNumber(Math.round(stats.totalAmount))}</div>
              <div className="text-xs text-slate-400 mt-2">
                원 (매칭: {stats.matchedCount}건 / 미매칭: {stats.unmatchedCount}건)
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
              <div className="text-sm text-slate-500 mb-1">창고 수</div>
              <div className="text-3xl font-bold text-amber-600">{stats.warehouseCount}</div>
              <div className="text-xs text-slate-400 mt-2">개 창고</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
              <div className="text-sm text-slate-500 mb-1">품목 수</div>
              <div className="text-3xl font-bold text-purple-600">{formatNumber(stats.itemCount)}</div>
              <div className="text-xs text-slate-400 mt-2">개 품목</div>
            </div>
          </div>

          {/* Charts */}
          {data.wipInventoryData.length > 0 && (
            <div className="grid grid-cols-2 gap-6">
              {/* 창고별 재고수량 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-base font-semibold mb-4">창고별 재고수량</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={warehouseStats.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tickFormatter={formatNumber} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatNumber(v as number)} />
                    <Bar dataKey="qty" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 품목유형별 재고 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-base font-semibold mb-4">품목유형별 재고</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={typeStats.slice(0, 8)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#999', strokeWidth: 1 }}
                    >
                      {typeStats.slice(0, 8).map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatNumber(v as number)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 창고별 상세 테이블 */}
          {warehouseStats.length > 0 && (
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-base font-semibold mb-4">창고별 현황 요약</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">창고명</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">재고수량</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">재고금액</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">품목 수</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseStats.map((row, idx) => (
                    <tr key={row.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.qty)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(Math.round(row.amount))}원</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.items)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detail Table */}
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                재고 상세
                <span className="text-sm font-normal text-slate-400">({filteredInventory.length}건)</span>
              </h3>
              <div className="flex items-center gap-3">
                {/* 분산 품목 필터 토글 */}
                <button
                  onClick={() => setShowOnlyDistributed(!showOnlyDistributed)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    showOnlyDistributed
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                  }`}
                >
                  🔴 분산품목만
                </button>
                <input
                  type="text"
                  placeholder="검색..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-40"
                />
                {data.wipInventoryData.length > 0 && (
                  <button
                    onClick={() => downloadExcel(data.wipInventoryData as Record<string, unknown>[], '창고별재고현황')}
                    className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    📥 엑셀
                  </button>
                )}
                <button
                  onClick={() => setShowTable(!showTable)}
                  className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
                >
                  {showTable ? '접기' : '펼치기'}
                </button>
              </div>
            </div>

            {data.wipInventoryData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>재고현황 데이터를 업로드해주세요</p>
                <p className="text-sm text-gray-400 mt-2">파일업로드 메뉴에서 업로드할 수 있습니다</p>
              </div>
            ) : showTable && (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-slate-50">
                      {/* 재고확인 컬럼 (맨 앞) */}
                      <th className="px-3 py-3 text-center font-semibold text-slate-600 whitespace-nowrap bg-red-50">
                        재고확인
                      </th>
                      {columns.map(key => (
                        <th
                          key={key}
                          className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort(key)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {key}
                            <span className="text-xs">
                              {sortConfig?.key === key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((row, idx) => {
                      const itemCode = String(getFieldValue(row, '품목코드', 'itemCode', 'code') || '')
                      const warehouseCount = getWarehouseCount(itemCode)
                      const isDistributed = warehouseCount > 1

                      return (
                        <tr
                          key={idx}
                          className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} cursor-pointer hover:bg-blue-50 transition-colors ${isDistributed ? 'text-red-600' : ''}`}
                          onClick={() => handleItemClick(row)}
                        >
                          {/* 재고확인 컬럼 */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            {isDistributed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                🔴 {warehouseCount}개 창고
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          {columns.map((key, colIdx) => (
                            <td key={colIdx} className={`px-4 py-3 whitespace-nowrap ${isDistributed ? 'font-medium' : ''}`}>
                              {typeof row[key as keyof typeof row] === 'number'
                                ? formatNumber(row[key as keyof typeof row] as number)
                                : String(row[key as keyof typeof row] || '')}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {data.wipInventoryData.length > 200 && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    총 {formatNumber(data.wipInventoryData.length)}건 중 200건 표시
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 피벗 테이블 - 재고조회 */}
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                📊 재고조회 (피벗 분석)
                <span className="text-sm font-normal text-slate-400">자유롭게 행/열/값을 선택하여 분석</span>
              </h3>
              <button
                onClick={() => setShowPivot(!showPivot)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                {showPivot ? '접기' : '펼치기'}
              </button>
            </div>

            {data.wipInventoryData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>재고현황 데이터를 업로드하면 피벗 분석이 가능합니다</p>
              </div>
            ) : showPivot && (
              <>
                {/* 피벗 설정 패널 */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-100">
                  <div className="grid grid-cols-4 gap-4">
                    {/* 행 선택 */}
                    <div>
                      <label className="block text-xs font-semibold text-blue-700 mb-1">📋 행 (Row)</label>
                      <select
                        value={pivotConfig.rowField}
                        onChange={(e) => handlePivotConfigChange('rowField', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      >
                        {pivotFields.dimension.map(field => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                      </select>
                    </div>

                    {/* 열 선택 */}
                    <div>
                      <label className="block text-xs font-semibold text-indigo-700 mb-1">📊 열 (Column)</label>
                      <select
                        value={pivotConfig.colField}
                        onChange={(e) => handlePivotConfigChange('colField', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                      >
                        {pivotFields.dimension.map(field => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                      </select>
                    </div>

                    {/* 값 선택 */}
                    <div>
                      <label className="block text-xs font-semibold text-emerald-700 mb-1">💰 값 (Value)</label>
                      <select
                        value={pivotConfig.valueField}
                        onChange={(e) => handlePivotConfigChange('valueField', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-emerald-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                      >
                        {pivotFields.measure.map(field => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                      </select>
                    </div>

                    {/* 집계 방식 */}
                    <div>
                      <label className="block text-xs font-semibold text-amber-700 mb-1">🔢 집계 방식</label>
                      <select
                        value={pivotConfig.aggregateMethod}
                        onChange={(e) => handlePivotConfigChange('aggregateMethod', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                      >
                        <option value="sum">합계 (SUM)</option>
                        <option value="count">개수 (COUNT)</option>
                        <option value="avg">평균 (AVG)</option>
                        <option value="min">최소값 (MIN)</option>
                        <option value="max">최대값 (MAX)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 피벗 테이블 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="px-3 py-3 text-left font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 border border-blue-700 sticky left-0 z-10">
                          {pivotConfig.rowField} \ {pivotConfig.colField}
                        </th>
                        {pivotData.cols.map(col => (
                          <th key={col} className="px-3 py-3 text-center font-semibold text-white bg-gradient-to-r from-indigo-500 to-indigo-400 border border-indigo-600 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                        <th className="px-3 py-3 text-center font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 border border-emerald-700">
                          합계
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pivotData.rows.map((row, rowIdx) => (
                        <tr key={row} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 font-medium text-slate-800 border border-slate-200 sticky left-0 bg-inherit z-10">
                            {row}
                          </td>
                          {pivotData.cols.map(col => {
                            const value = pivotData.matrix[row]?.[col] || 0
                            return (
                              <td key={col} className="px-3 py-2 text-right tabular-nums border border-slate-200">
                                {value !== 0 ? formatNumber(Math.round(value * 100) / 100) : '-'}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                            {formatNumber(Math.round((pivotData.rowTotals[row] || 0) * 100) / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-blue-50 to-emerald-50">
                        <td className="px-3 py-3 font-bold text-slate-800 border border-slate-300 sticky left-0 bg-blue-50 z-10">
                          합계
                        </td>
                        {pivotData.cols.map(col => (
                          <td key={col} className="px-3 py-3 text-right tabular-nums font-semibold text-blue-700 border border-blue-200">
                            {formatNumber(Math.round((pivotData.colTotals[col] || 0) * 100) / 100)}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-800 bg-emerald-100 border border-emerald-300">
                          {formatNumber(Math.round(pivotData.grandTotal * 100) / 100)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* 분석 정보 */}
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span>📊 행: {pivotData.rows.length}개</span>
                  <span>📋 열: {pivotData.cols.length}개</span>
                  <span>🔢 집계: {
                    pivotConfig.aggregateMethod === 'sum' ? '합계' :
                    pivotConfig.aggregateMethod === 'count' ? '개수' :
                    pivotConfig.aggregateMethod === 'avg' ? '평균' :
                    pivotConfig.aggregateMethod === 'min' ? '최소값' : '최대값'
                  }</span>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {subTab === 'price' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              부품단가표
              <span className="text-sm font-normal text-slate-400">({filteredPrice.length}건)</span>
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="검색..."
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-40"
              />
              {data.priceData.length > 0 && (
                <button
                  onClick={() => downloadExcel(data.priceData as Record<string, unknown>[], '부품단가표')}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  📥 엑셀
                </button>
              )}
              <button
                onClick={() => setShowPriceTable(!showPriceTable)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                {showPriceTable ? '접기' : '펼치기'}
              </button>
            </div>
          </div>

          {data.priceData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>부품단가표 데이터를 업로드해주세요</p>
              <p className="text-sm text-gray-400 mt-2">파일업로드 메뉴에서 업로드할 수 있습니다</p>
            </div>
          ) : showPriceTable && (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-slate-50">
                    {priceColumns.map(key => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100"
                        onClick={() => handlePriceSort(key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {key}
                          <span className="text-xs">
                            {priceSort?.key === key ? (priceSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPrice.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {priceColumns.map((key, colIdx) => (
                        <td key={colIdx} className="px-4 py-3 whitespace-nowrap">
                          {typeof row[key as keyof typeof row] === 'number'
                            ? formatNumber(row[key as keyof typeof row] as number)
                            : String(row[key as keyof typeof row] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.priceData.length > 500 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  총 {formatNumber(data.priceData.length)}건 표시
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 품목 상세 팝업 모달 */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">품목별 창고 재고 현황</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-500">품목코드</div>
              <div className="font-semibold text-blue-700">{selectedItem.itemCode}</div>
              {selectedItem.itemName && (
                <>
                  <div className="text-sm text-gray-500 mt-2">품목명</div>
                  <div className="font-medium text-gray-800">{selectedItem.itemName}</div>
                </>
              )}
            </div>

            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-slate-100">
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">창고명</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600">재고수량</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.warehouses.map((wh, idx) => (
                    <tr key={wh.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-2">{wh.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{formatNumber(wh.qty)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-100 font-bold">
                    <td className="px-4 py-2">합계</td>
                    <td className="px-4 py-2 text-right tabular-nums text-blue-700">{formatNumber(selectedItem.totalQty)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
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
