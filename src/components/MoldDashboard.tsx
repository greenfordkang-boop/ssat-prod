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
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  LabelList
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const GRADE_COLORS: Record<string, string> = {
  'A': '#10b981',
  'B': '#3b82f6',
  'C': '#f59e0b',
  'D': '#f97316',
  'E': '#ef4444'
}

interface MoldDashboardProps {
  subTab: string
}

export default function MoldDashboard({ subTab }: MoldDashboardProps) {
  const { data } = useData()
  const { moldStatusData, moldRepairData } = data

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [isRepairTableExpanded, setIsRepairTableExpanded] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [repairSortConfig, setRepairSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [selectedYear, setSelectedYear] = useState('all')

  // 피벗테이블 관련 상태
  const [pivotDataSource, setPivotDataSource] = useState<'status' | 'repair'>('status')
  const [pivotRowFields, setPivotRowFields] = useState<string[]>([])
  const [pivotColFields, setPivotColFields] = useState<string[]>([])
  const [pivotValueField, setPivotValueField] = useState('')
  const [pivotAggMethod, setPivotAggMethod] = useState<'count' | 'sum' | 'avg'>('count')

  // 금형등급 추출 (A~E)
  const extractGrade = (gradeStr?: string): string => {
    if (!gradeStr) return '미지정'
    const match = gradeStr.match(/^([A-E])\s*등급/)
    return match ? match[1] : '미지정'
  }

  // 년도 추출
  const extractYear = (dateStr?: string): string => {
    if (!dateStr) return ''
    const match = dateStr.match(/(\d{4})/)
    return match ? match[1] : ''
  }

  // 수리이력에서 년도 목록 추출
  const yearList = useMemo(() => {
    const years = new Set<string>()
    moldRepairData.forEach(r => {
      const year = extractYear(r.수리일자 as string)
      if (year) years.add(year)
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [moldRepairData])

  // 년도별 필터링된 수리 데이터
  const yearFilteredRepairData = useMemo(() => {
    if (selectedYear === 'all') return moldRepairData
    return moldRepairData.filter(r => extractYear(r.수리일자 as string) === selectedYear)
  }, [moldRepairData, selectedYear])

  // 요약 통계
  const summary = useMemo(() => {
    const totalMolds = moldStatusData.length

    // 등급별 현황
    const gradeCount: Record<string, number> = {}
    moldStatusData.forEach(m => {
      const grade = extractGrade(m.금형등급 as string)
      gradeCount[grade] = (gradeCount[grade] || 0) + 1
    })

    // 금형구분별 현황
    const categoryCount: Record<string, number> = {}
    moldStatusData.forEach(m => {
      const cat = (m.금형구분 as string) || '미분류'
      categoryCount[cat] = (categoryCount[cat] || 0) + 1
    })

    // 평균 금형사용율
    const avgUsageRate = moldStatusData.length > 0
      ? moldStatusData.reduce((sum, m) => sum + (Number(m.금형사용율) || 0), 0) / moldStatusData.length
      : 0

    // 점검 필요 금형 (세척/연마율 80% 이상)
    const needsInspection = moldStatusData.filter(m => (Number(m['세척/연마율']) || 0) >= 80).length

    // 총 수리 건수 (전체 기준)
    const totalRepairs = moldRepairData.length

    return {
      totalMolds,
      gradeCount,
      categoryCount,
      avgUsageRate,
      needsInspection,
      totalRepairs
    }
  }, [moldStatusData, moldRepairData])

  // 수리 요약 통계 (년도 필터 적용)
  const repairSummary = useMemo(() => {
    const totalRepairs = yearFilteredRepairData.length

    // 수리 유형별 현황
    const repairTypeCount: Record<string, number> = {}
    yearFilteredRepairData.forEach(r => {
      const type = (r.유형 as string) || '기타'
      repairTypeCount[type] = (repairTypeCount[type] || 0) + 1
    })

    // 총 수리 비용
    const totalRepairCost = yearFilteredRepairData.reduce((sum, r) => {
      return sum + (Number(r.수리금액) || 0)
    }, 0)

    // 자체/외주 수리 건수
    const selfRepairCount = yearFilteredRepairData.filter(r => r.구분 === '자체').length
    const outsourceRepairCount = yearFilteredRepairData.filter(r => r.구분 === '외주').length

    return {
      totalRepairs,
      repairTypeCount,
      totalRepairCost,
      selfRepairCount,
      outsourceRepairCount
    }
  }, [yearFilteredRepairData])

  // 등급별 차트 데이터
  const gradeChartData = useMemo(() => {
    return Object.entries(summary.gradeCount)
      .map(([grade, count]) => ({ name: `${grade}등급`, value: count, grade }))
      .sort((a, b) => a.grade.localeCompare(b.grade))
  }, [summary.gradeCount])

  // 금형구분별 차트 데이터
  const categoryChartData = useMemo(() => {
    return Object.entries(summary.categoryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [summary.categoryCount])

  // 수리 유형별 차트 데이터 (년도 필터 적용)
  const repairTypeChartData = useMemo(() => {
    return Object.entries(repairSummary.repairTypeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [repairSummary.repairTypeCount])

  // 월별 수리 추이 (년도 필터 적용)
  const monthlyRepairData = useMemo(() => {
    const monthlyCount: Record<string, { count: number; cost: number }> = {}

    yearFilteredRepairData.forEach(r => {
      const dateStr = r.수리일자 as string
      if (!dateStr) return
      const match = dateStr.match(/(\d{4})-(\d{2})/)
      if (match) {
        const yearMonth = `${match[1]}-${match[2]}`
        if (!monthlyCount[yearMonth]) {
          monthlyCount[yearMonth] = { count: 0, cost: 0 }
        }
        monthlyCount[yearMonth].count++
        monthlyCount[yearMonth].cost += Number(r.수리금액) || 0
      }
    })

    return Object.entries(monthlyCount)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [yearFilteredRepairData])

  // 필터링된 금형 목록
  const filteredMolds = useMemo(() => {
    let filtered = moldStatusData.filter(m => {
      const matchSearch = !searchTerm ||
        (m.금형번호 as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.부품명 as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m['품종(MODEL)'] as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.고객사명 as string)?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchGrade = selectedGrade === 'all' || extractGrade(m.금형등급 as string) === selectedGrade
      const matchCategory = selectedCategory === 'all' || m.금형구분 === selectedCategory

      return matchSearch && matchGrade && matchCategory
    })

    // 정렬 적용
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number = ''
        let bVal: string | number = ''

        switch (sortConfig.key) {
          case '금형번호':
            aVal = (a.금형번호 as string) || ''
            bVal = (b.금형번호 as string) || ''
            break
          case '고객사명':
            aVal = (a.고객사명 as string) || ''
            bVal = (b.고객사명 as string) || ''
            break
          case '부품명':
            aVal = (a.부품명 as string) || ''
            bVal = (b.부품명 as string) || ''
            break
          case '품종':
            aVal = (a['품종(MODEL)'] as string) || ''
            bVal = (b['품종(MODEL)'] as string) || ''
            break
          case '구분':
            aVal = (a.금형구분 as string) || ''
            bVal = (b.금형구분 as string) || ''
            break
          case '등급':
            aVal = extractGrade(a.금형등급 as string)
            bVal = extractGrade(b.금형등급 as string)
            break
          case '보증SHOT':
            aVal = Number(a.금형보증SHOT수) || 0
            bVal = Number(b.금형보증SHOT수) || 0
            break
          case '사용SHOT':
            aVal = Number(a.금형사용SHOT수) || 0
            bVal = Number(b.금형사용SHOT수) || 0
            break
          case '사용율':
            aVal = Number(a.금형사용율) || 0
            bVal = Number(b.금형사용율) || 0
            break
          case '세척연마율':
            aVal = Number(a['세척/연마율']) || 0
            bVal = Number(b['세척/연마율']) || 0
            break
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
        }
        return sortConfig.direction === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal))
      })
    }

    return filtered
  }, [moldStatusData, searchTerm, selectedGrade, selectedCategory, sortConfig])

  // 정렬 핸들러
  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' ? { key, direction: 'desc' } : null
      }
      return { key, direction: 'asc' }
    })
  }

  // 정렬 아이콘
  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) {
      return <span className="ml-1 text-gray-300">↕</span>
    }
    return <span className="ml-1 text-blue-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  // 필터링된 수리이력 (년도 필터 + 정렬 적용)
  const filteredRepairs = useMemo(() => {
    let filtered = yearFilteredRepairData.filter(r => {
      const matchSearch = !searchTerm ||
        (r.금형번호 as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.부품명 as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.금형수리내용 as string)?.toLowerCase().includes(searchTerm.toLowerCase())

      return matchSearch
    })

    // 정렬 적용
    if (repairSortConfig) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number = ''
        let bVal: string | number = ''

        switch (repairSortConfig.key) {
          case '수리일자':
            aVal = (a.수리일자 as string) || ''
            bVal = (b.수리일자 as string) || ''
            break
          case '금형번호':
            aVal = (a.금형번호 as string) || ''
            bVal = (b.금형번호 as string) || ''
            break
          case '부품명':
            aVal = (a.부품명 as string) || ''
            bVal = (b.부품명 as string) || ''
            break
          case '구분':
            aVal = (a.구분 as string) || ''
            bVal = (b.구분 as string) || ''
            break
          case '유형':
            aVal = (a.유형 as string) || ''
            bVal = (b.유형 as string) || ''
            break
          case '수리업체':
            aVal = (a.수리업체 as string) || ''
            bVal = (b.수리업체 as string) || ''
            break
          case '수리금액':
            aVal = Number(a.수리금액) || 0
            bVal = Number(b.수리금액) || 0
            break
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return repairSortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
        }
        return repairSortConfig.direction === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal))
      })
    } else {
      // 기본 정렬: 수리일자 내림차순
      filtered = [...filtered].sort((a, b) => {
        const dateA = a.수리일자 as string || ''
        const dateB = b.수리일자 as string || ''
        return dateB.localeCompare(dateA)
      })
    }

    return filtered
  }, [yearFilteredRepairData, searchTerm, repairSortConfig])

  // 수리이력 정렬 핸들러
  const handleRepairSort = (key: string) => {
    setRepairSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' ? { key, direction: 'desc' } : null
      }
      return { key, direction: 'asc' }
    })
  }

  // 수리이력 정렬 아이콘
  const RepairSortIcon = ({ columnKey }: { columnKey: string }) => {
    if (repairSortConfig?.key !== columnKey) {
      return <span className="ml-1 text-gray-300">↕</span>
    }
    return <span className="ml-1 text-blue-500">{repairSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  // 고객사별 금형 현황
  const customerData = useMemo(() => {
    const customerCount: Record<string, number> = {}
    moldStatusData.forEach(m => {
      const customer = (m.고객사명 as string) || '미지정'
      customerCount[customer] = (customerCount[customer] || 0) + 1
    })
    return Object.entries(customerCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [moldStatusData])

  // 수리업체별 현황 (년도 필터 적용)
  const vendorData = useMemo(() => {
    const vendorCount: Record<string, { count: number; cost: number }> = {}
    yearFilteredRepairData.forEach(r => {
      const vendor = (r.수리업체 as string) || '미지정'
      if (!vendorCount[vendor]) {
        vendorCount[vendor] = { count: 0, cost: 0 }
      }
      vendorCount[vendor].count++
      vendorCount[vendor].cost += Number(r.수리금액) || 0
    })
    return Object.entries(vendorCount)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
  }, [yearFilteredRepairData])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  const formatCurrency = (num: number) => {
    if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억`
    if (num >= 10000) return `${(num / 10000).toFixed(0)}만`
    return formatNumber(num)
  }

  // 피벗 데이터 소스 선택
  const pivotSourceData = useMemo(() => {
    return pivotDataSource === 'status' ? moldStatusData : moldRepairData
  }, [pivotDataSource, moldStatusData, moldRepairData])

  // 피벗 필드 목록 (숫자형/문자형 구분)
  const pivotFields = useMemo(() => {
    if (pivotSourceData.length === 0) return { text: [], numeric: [] }

    const sample = pivotSourceData[0]
    const textFields: string[] = []
    const numericFields: string[] = []

    Object.entries(sample).forEach(([key, value]) => {
      if (key === 'id') return
      if (typeof value === 'number' || (!isNaN(Number(value)) && value !== '' && value !== null)) {
        numericFields.push(key)
      }
      textFields.push(key)
    })

    return { text: textFields, numeric: numericFields }
  }, [pivotSourceData])

  // 피벗 테이블 계산
  const pivotResult = useMemo(() => {
    if (pivotSourceData.length === 0) return { headers: [], rows: [], totals: {} }
    if (pivotRowFields.length === 0 && pivotColFields.length === 0) return { headers: [], rows: [], totals: {} }

    // 고유값 추출
    const getUniqueValues = (field: string) => {
      const values = new Set<string>()
      pivotSourceData.forEach(row => {
        values.add(String(row[field] || '(빈값)'))
      })
      return Array.from(values).sort()
    }

    // 열 헤더 조합 생성
    const colCombinations: string[][] = []
    if (pivotColFields.length === 0) {
      colCombinations.push(['합계'])
    } else {
      const colValues = pivotColFields.map(f => getUniqueValues(f))
      const generateCombinations = (arrays: string[][], current: string[] = []): string[][] => {
        if (arrays.length === 0) return [current]
        const [first, ...rest] = arrays
        return first.flatMap(v => generateCombinations(rest, [...current, v]))
      }
      colCombinations.push(...generateCombinations(colValues))
    }

    // 행 키 생성
    const getRowKey = (row: Record<string, unknown>) => {
      return pivotRowFields.map(f => String(row[f] || '(빈값)')).join('|||')
    }

    // 열 키 생성
    const getColKey = (row: Record<string, unknown>) => {
      if (pivotColFields.length === 0) return '합계'
      return pivotColFields.map(f => String(row[f] || '(빈값)')).join('|||')
    }

    // 데이터 집계
    const aggregated: Record<string, Record<string, { sum: number; count: number }>> = {}

    pivotSourceData.forEach(row => {
      const rowKey = getRowKey(row)
      const colKey = getColKey(row)

      if (!aggregated[rowKey]) aggregated[rowKey] = {}
      if (!aggregated[rowKey][colKey]) aggregated[rowKey][colKey] = { sum: 0, count: 0 }

      const value = pivotValueField ? Number(row[pivotValueField]) || 0 : 1
      aggregated[rowKey][colKey].sum += value
      aggregated[rowKey][colKey].count += 1
    })

    // 결과 행 생성
    const rowKeys = Object.keys(aggregated).sort()
    const rows = rowKeys.map(rowKey => {
      const rowParts = rowKey.split('|||')
      const values: Record<string, number> = {}
      let rowTotal = 0

      colCombinations.forEach(colCombo => {
        const colKey = colCombo.join('|||')
        const cell = aggregated[rowKey]?.[colKey]
        let val = 0
        if (cell) {
          if (pivotAggMethod === 'count') val = cell.count
          else if (pivotAggMethod === 'sum') val = cell.sum
          else if (pivotAggMethod === 'avg') val = cell.count > 0 ? cell.sum / cell.count : 0
        }
        values[colKey] = val
        rowTotal += val
      })

      return { rowParts, values, rowTotal }
    })

    // 열 합계 계산
    const colTotals: Record<string, number> = {}
    let grandTotal = 0
    colCombinations.forEach(colCombo => {
      const colKey = colCombo.join('|||')
      let total = 0
      rows.forEach(row => {
        total += row.values[colKey] || 0
      })
      colTotals[colKey] = total
      grandTotal += total
    })

    return {
      headers: colCombinations,
      rows,
      colTotals,
      grandTotal
    }
  }, [pivotSourceData, pivotRowFields, pivotColFields, pivotValueField, pivotAggMethod])

  // 필드 선택 토글
  const toggleField = (field: string, type: 'row' | 'col') => {
    if (type === 'row') {
      if (pivotRowFields.includes(field)) {
        setPivotRowFields(pivotRowFields.filter(f => f !== field))
      } else if (pivotRowFields.length < 3) {
        setPivotRowFields([...pivotRowFields, field])
      }
    } else {
      if (pivotColFields.includes(field)) {
        setPivotColFields(pivotColFields.filter(f => f !== field))
      } else if (pivotColFields.length < 3) {
        setPivotColFields([...pivotColFields, field])
      }
    }
  }

  // 현황 탭
  if (subTab === 'status') {
    return (
      <div className="space-y-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">총 금형 수</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.totalMolds)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">평균 사용율</p>
            <p className="text-2xl font-bold text-blue-600">{summary.avgUsageRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">총 수리 건수</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.totalRepairs)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">점검 필요</p>
            <p className="text-2xl font-bold text-red-500">{formatNumber(summary.needsInspection)}</p>
            <p className="text-xs text-gray-400">세척/연마율 80%↑</p>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 등급별 현황 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">금형등급별 현황</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={gradeChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={60} />
                <Tooltip
                  formatter={(value) => [formatNumber(Number(value) || 0), '수량']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {gradeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GRADE_COLORS[entry.grade] || COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList dataKey="value" position="right" fontSize={11} fill="#374151" formatter={(v) => formatNumber(Number(v) || 0)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 금형구분별 현황 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">금형구분별 현황</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categoryChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatNumber(Number(value) || 0), '수량']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 고객사별 금형 현황 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">고객사별 금형 현황 (Top 10)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={customerData} margin={{ bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-90}
                  textAnchor="end"
                  interval={0}
                  height={80}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [formatNumber(Number(value) || 0), '금형 수']} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" fontSize={10} fill="#374151" formatter={(v) => formatNumber(Number(v) || 0)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 수리 유형별 현황 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">수리 유형별 현황</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={repairTypeChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {repairTypeChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatNumber(Number(value) || 0), '건수']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 금형 목록 테이블 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-700">금형 목록</h3>
              <span className="text-xs text-gray-400">({formatNumber(filteredMolds.length)}건)</span>
              <button
                onClick={() => setIsTableExpanded(!isTableExpanded)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
              >
                {isTableExpanded ? '접기 ▲' : '펼치기 ▼'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="금형번호, 부품명, 품종, 고객사 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체 등급</option>
                {['A', 'B', 'C', 'D', 'E'].map(g => (
                  <option key={g} value={g}>{g}등급</option>
                ))}
              </select>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체 구분</option>
                {Object.keys(summary.categoryCount).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={`overflow-x-auto ${isTableExpanded ? 'max-h-[600px]' : 'max-h-80'} transition-all duration-300`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th onClick={() => handleSort('금형번호')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    금형번호<SortIcon columnKey="금형번호" />
                  </th>
                  <th onClick={() => handleSort('고객사명')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    고객사<SortIcon columnKey="고객사명" />
                  </th>
                  <th onClick={() => handleSort('부품명')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    부품명<SortIcon columnKey="부품명" />
                  </th>
                  <th onClick={() => handleSort('품종')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    품종<SortIcon columnKey="품종" />
                  </th>
                  <th onClick={() => handleSort('구분')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    구분<SortIcon columnKey="구분" />
                  </th>
                  <th onClick={() => handleSort('등급')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    등급<SortIcon columnKey="등급" />
                  </th>
                  <th onClick={() => handleSort('보증SHOT')} className="px-3 py-2 text-right text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    보증SHOT<SortIcon columnKey="보증SHOT" />
                  </th>
                  <th onClick={() => handleSort('사용SHOT')} className="px-3 py-2 text-right text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    사용SHOT<SortIcon columnKey="사용SHOT" />
                  </th>
                  <th onClick={() => handleSort('사용율')} className="px-3 py-2 text-right text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    사용율<SortIcon columnKey="사용율" />
                  </th>
                  <th onClick={() => handleSort('세척연마율')} className="px-3 py-2 text-right text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    세척/연마율<SortIcon columnKey="세척연마율" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMolds.map((m, idx) => {
                  const grade = extractGrade(m.금형등급 as string)
                  const cleanRate = Number(m['세척/연마율']) || 0
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{m.금형번호}</td>
                      <td className="px-3 py-2 text-gray-600">{m.고객사명}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate" title={m.부품명 as string}>{m.부품명}</td>
                      <td className="px-3 py-2 text-gray-600">{m['품종(MODEL)']}</td>
                      <td className="px-3 py-2 text-gray-600">{m.금형구분}</td>
                      <td className="px-3 py-2">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${GRADE_COLORS[grade] || '#9ca3af'}20`,
                            color: GRADE_COLORS[grade] || '#6b7280'
                          }}
                        >
                          {grade}등급
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{formatNumber(Number(m.금형보증SHOT수) || 0)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{formatNumber(Number(m.금형사용SHOT수) || 0)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{(Number(m.금형사용율) || 0).toFixed(2)}%</td>
                      <td className={`px-3 py-2 text-right font-medium ${cleanRate >= 80 ? 'text-red-500' : cleanRate >= 60 ? 'text-amber-500' : 'text-gray-600'}`}>
                        {cleanRate.toFixed(2)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 수리이력 탭
  if (subTab === 'repair') {
    return (
      <div className="space-y-6">
        {/* 년도 필터 */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">조회 년도:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">전체</option>
            {yearList.map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          {selectedYear !== 'all' && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              {selectedYear}년 데이터만 표시중
            </span>
          )}
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">총 수리 건수</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(repairSummary.totalRepairs)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">총 수리 비용</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(repairSummary.totalRepairCost)}원</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">자체 수리</p>
            <p className="text-2xl font-bold text-green-600">
              {formatNumber(repairSummary.selfRepairCount)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">외주 수리</p>
            <p className="text-2xl font-bold text-amber-600">
              {formatNumber(repairSummary.outsourceRepairCount)}
            </p>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 월별 수리 추이 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">월별 수리 추이 (최근 12개월)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyRepairData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'count' ? formatNumber(Number(value) || 0) + '건' : formatCurrency(Number(value) || 0) + '원',
                    name === 'count' ? '수리 건수' : '수리 비용'
                  ]}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="count" name="수리 건수" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }}>
                  <LabelList dataKey="count" position="top" fontSize={10} fill="#3b82f6" formatter={(v) => formatNumber(Number(v) || 0)} />
                </Line>
                <Line yAxisId="right" type="monotone" dataKey="cost" name="수리 비용" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 수리업체별 현황 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">수리업체별 현황</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={vendorData} margin={{ top: 20, right: 20, left: 0, bottom: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                  height={100}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [
                  name === 'count' ? formatNumber(Number(value) || 0) + '건' : formatCurrency(Number(value) || 0) + '원',
                  name === 'count' ? '수리 건수' : '수리 비용'
                ]} />
                <Bar dataKey="count" fill="#3b82f6" name="수리 건수" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" fontSize={10} fill="#374151" formatter={(v) => formatNumber(Number(v) || 0)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 수리 유형별 현황 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">수리 유형별 현황</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={repairTypeChartData} layout="vertical" margin={{ top: 5, right: 50, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(value) => [formatNumber(Number(value) || 0), '건수']} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" fontSize={11} fill="#374151" formatter={(v) => formatNumber(Number(v) || 0)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 수리이력 테이블 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-700">수리이력</h3>
              <span className="text-xs text-gray-400">({formatNumber(filteredRepairs.length)}건)</span>
              <button
                onClick={() => setIsRepairTableExpanded(!isRepairTableExpanded)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
              >
                {isRepairTableExpanded ? '접기 ▲' : '펼치기 ▼'}
              </button>
            </div>
            <input
              type="text"
              placeholder="금형번호, 부품명, 수리내용 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
            />
          </div>
          <div className={`overflow-x-auto ${isRepairTableExpanded ? 'max-h-[600px]' : 'max-h-80'} transition-all duration-300`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th onClick={() => handleRepairSort('수리일자')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    수리일자<RepairSortIcon columnKey="수리일자" />
                  </th>
                  <th onClick={() => handleRepairSort('금형번호')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    금형번호<RepairSortIcon columnKey="금형번호" />
                  </th>
                  <th onClick={() => handleRepairSort('부품명')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    부품명<RepairSortIcon columnKey="부품명" />
                  </th>
                  <th onClick={() => handleRepairSort('구분')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    구분<RepairSortIcon columnKey="구분" />
                  </th>
                  <th onClick={() => handleRepairSort('유형')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    유형<RepairSortIcon columnKey="유형" />
                  </th>
                  <th onClick={() => handleRepairSort('수리업체')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    수리업체<RepairSortIcon columnKey="수리업체" />
                  </th>
                  <th onClick={() => handleRepairSort('수리금액')} className="px-3 py-2 text-right text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
                    수리금액<RepairSortIcon columnKey="수리금액" />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">수리내용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRepairs.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600">{r.수리일자}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{r.금형번호}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[150px] truncate" title={r.부품명 as string}>{r.부품명}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.구분 === '자체' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {r.구분}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.유형 === '세척' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {r.유형}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.수리업체}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{formatNumber(Number(r.수리금액) || 0)}원</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={r.금형수리내용 as string}>
                      {r.금형수리내용}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 데이터조회 탭 (피벗테이블)
  if (subTab === 'query') {
    return (
      <div className="space-y-6">
        {/* 데이터 소스 선택 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">데이터 소스 선택</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dataSource"
                checked={pivotDataSource === 'status'}
                onChange={() => {
                  setPivotDataSource('status')
                  setPivotRowFields([])
                  setPivotColFields([])
                  setPivotValueField('')
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">금형현황 ({formatNumber(moldStatusData.length)}건)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dataSource"
                checked={pivotDataSource === 'repair'}
                onChange={() => {
                  setPivotDataSource('repair')
                  setPivotRowFields([])
                  setPivotColFields([])
                  setPivotValueField('')
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">수리이력 ({formatNumber(moldRepairData.length)}건)</span>
            </label>
          </div>
        </div>

        {/* 피벗 설정 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 행 필드 선택 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              행 필드 <span className="text-gray-400 font-normal">({pivotRowFields.length}/3)</span>
            </h3>
            <p className="text-xs text-gray-400 mb-3">클릭하여 선택 (최대 3개)</p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {pivotFields.text.map(field => (
                <button
                  key={field}
                  onClick={() => toggleField(field, 'row')}
                  disabled={!pivotRowFields.includes(field) && pivotRowFields.length >= 3}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                    pivotRowFields.includes(field)
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : pivotRowFields.length >= 3
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pivotRowFields.includes(field) && (
                    <span className="mr-2 text-blue-500">#{pivotRowFields.indexOf(field) + 1}</span>
                  )}
                  {field}
                </button>
              ))}
            </div>
          </div>

          {/* 열 필드 선택 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              열 필드 <span className="text-gray-400 font-normal">({pivotColFields.length}/3)</span>
            </h3>
            <p className="text-xs text-gray-400 mb-3">클릭하여 선택 (최대 3개)</p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {pivotFields.text.map(field => (
                <button
                  key={field}
                  onClick={() => toggleField(field, 'col')}
                  disabled={!pivotColFields.includes(field) && pivotColFields.length >= 3}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                    pivotColFields.includes(field)
                      ? 'bg-green-100 text-green-700 font-medium'
                      : pivotColFields.length >= 3
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pivotColFields.includes(field) && (
                    <span className="mr-2 text-green-500">#{pivotColFields.indexOf(field) + 1}</span>
                  )}
                  {field}
                </button>
              ))}
            </div>
          </div>

          {/* 값 및 집계 방식 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">값 필드 및 집계</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">값 필드</label>
                <select
                  value={pivotValueField}
                  onChange={(e) => setPivotValueField(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">건수만 계산</option>
                  {pivotFields.numeric.map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">집계 방식</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPivotAggMethod('count')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pivotAggMethod === 'count'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    건수
                  </button>
                  <button
                    onClick={() => setPivotAggMethod('sum')}
                    disabled={!pivotValueField}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pivotAggMethod === 'sum'
                        ? 'bg-blue-500 text-white'
                        : !pivotValueField
                          ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    합계
                  </button>
                  <button
                    onClick={() => setPivotAggMethod('avg')}
                    disabled={!pivotValueField}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pivotAggMethod === 'avg'
                        ? 'bg-blue-500 text-white'
                        : !pivotValueField
                          ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    평균
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setPivotRowFields([])
                  setPivotColFields([])
                  setPivotValueField('')
                  setPivotAggMethod('count')
                }}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                초기화
              </button>
            </div>
          </div>
        </div>

        {/* 피벗 테이블 결과 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              피벗 테이블 결과
              {pivotResult.rows.length > 0 && (
                <span className="ml-2 text-gray-400 font-normal">({pivotResult.rows.length}행)</span>
              )}
            </h3>
            {pivotRowFields.length === 0 && pivotColFields.length === 0 && (
              <span className="text-xs text-gray-400">행 또는 열 필드를 선택하세요</span>
            )}
          </div>

          {(pivotRowFields.length > 0 || pivotColFields.length > 0) && (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {pivotRowFields.map((field, idx) => (
                      <th key={idx} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b border-r border-gray-200 bg-blue-50">
                        {field}
                      </th>
                    ))}
                    {pivotResult.headers.map((header, idx) => (
                      <th key={idx} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 border-b border-gray-200 bg-green-50 min-w-[80px]">
                        {header.join(' / ')}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b border-l border-gray-200 bg-gray-100">
                      행 합계
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pivotResult.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50">
                      {row.rowParts.map((part, partIdx) => (
                        <td key={partIdx} className="px-3 py-2 text-gray-700 border-b border-r border-gray-100 font-medium bg-blue-50/30">
                          {part}
                        </td>
                      ))}
                      {pivotResult.headers.map((header, colIdx) => {
                        const colKey = header.join('|||')
                        const val = row.values[colKey] || 0
                        return (
                          <td key={colIdx} className="px-3 py-2 text-right text-gray-600 border-b border-gray-100">
                            {pivotAggMethod === 'avg' ? val.toFixed(1) : formatNumber(val)}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-right font-semibold text-gray-700 border-b border-l border-gray-200 bg-gray-50">
                        {pivotAggMethod === 'avg' ? row.rowTotal.toFixed(1) : formatNumber(row.rowTotal)}
                      </td>
                    </tr>
                  ))}
                  {/* 열 합계 행 */}
                  <tr className="bg-gray-100 font-semibold">
                    {pivotRowFields.length > 0 && (
                      <td colSpan={pivotRowFields.length} className="px-3 py-2 text-gray-700 border-t border-r border-gray-200">
                        열 합계
                      </td>
                    )}
                    {pivotResult.headers.map((header, colIdx) => {
                      const colKey = header.join('|||')
                      const val = pivotResult.colTotals?.[colKey] || 0
                      return (
                        <td key={colIdx} className="px-3 py-2 text-right text-gray-700 border-t border-gray-200">
                          {pivotAggMethod === 'avg' ? val.toFixed(1) : formatNumber(val)}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right font-bold text-gray-900 border-t border-l border-gray-200 bg-gray-200">
                      {pivotAggMethod === 'avg'
                        ? (pivotResult.grandTotal || 0).toFixed(1)
                        : formatNumber(pivotResult.grandTotal || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
