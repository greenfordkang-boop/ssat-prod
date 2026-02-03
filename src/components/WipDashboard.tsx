'use client'

import { useMemo, useState } from 'react'
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

// 단가 데이터에서 매칭하는 헬퍼 함수
const findPriceData = (
  priceData: { [key: string]: string | number | undefined }[],
  itemCode?: string,
  itemName?: string,
  customerPN?: string
) => {
  return priceData.find(p => {
    // 품목코드 매칭 (다양한 필드명 지원)
    const priceItemCode = p.품목코드 || p.품번 || p.품목번호 || p.itemCode || p.item_code || p.code || p.ITEM_CODE || p.PART_NO
    if (itemCode && priceItemCode && String(priceItemCode).trim() === String(itemCode).trim()) {
      return true
    }
    // 고객사 P/N 매칭
    const priceCustPN = p['고객사 P/N'] || p['고객P/N'] || p.customerPN || p.customer_pn || p.CUST_PN
    if (customerPN && priceCustPN && String(priceCustPN).trim() === String(customerPN).trim()) {
      return true
    }
    // 품목명 매칭 (다양한 필드명 지원)
    const priceItemName = p.품목명 || p.품명 || p.productName || p.product_name || p.name || p.ITEM_NAME || p.PRODUCT
    if (itemName && priceItemName && String(priceItemName).trim() === String(itemName).trim()) {
      return true
    }
    return false
  })
}

// 단가 값 추출 헬퍼 함수
const getPriceValue = (priceItem: { [key: string]: string | number | undefined }) => {
  const priceVal = priceItem.단가 || priceItem.가격 || priceItem.price || priceItem.unitPrice ||
                   priceItem.unit_price || priceItem.PRICE || priceItem.UNIT_PRICE || 0
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

export default function WipDashboard({ subTab }: WipDashboardProps) {
  const { data, selectedMonth } = useData()
  const [showTable, setShowTable] = useState(true)
  const [showPriceTable, setShowPriceTable] = useState(true)
  const [filter, setFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [priceSort, setPriceSort] = useState<SortConfig>(null)
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
  }, [data.wipInventoryData, warehouseFilter, filter, sortConfig])

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

    return result.slice(0, 100)
  }, [data.priceData, priceFilter, priceSort])

  // 컬럼 추출
  const columns = useMemo(() => {
    if (data.wipInventoryData.length === 0) return []
    return Object.keys(data.wipInventoryData[0]).filter(key => key !== 'id' && key !== 'data').slice(0, 12)
  }, [data.wipInventoryData])

  const priceColumns = useMemo(() => {
    if (data.priceData.length === 0) return []
    return Object.keys(data.priceData[0]).filter(key => key !== 'id' && key !== 'data').slice(0, 10)
  }, [data.priceData])

  // 정렬 핸들러
  const handleSort = (key: string) => {
    if (sortConfig?.key === key) {
      setSortConfig(sortConfig.direction === 'asc' ? { key, direction: 'desc' } : null)
    } else {
      setSortConfig({ key, direction: 'asc' })
    }
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
                    {filteredInventory.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        {columns.map((key, colIdx) => (
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
                {data.wipInventoryData.length > 200 && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    총 {formatNumber(data.wipInventoryData.length)}건 중 200건 표시
                  </p>
                )}
              </div>
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
              {data.priceData.length > 100 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  총 {formatNumber(data.priceData.length)}건 중 100건 표시
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
