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
  Line
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

  // 금형등급 추출 (A~E)
  const extractGrade = (gradeStr?: string): string => {
    if (!gradeStr) return '미지정'
    const match = gradeStr.match(/^([A-E])\s*등급/)
    return match ? match[1] : '미지정'
  }

  // 요약 통계
  const summary = useMemo(() => {
    const totalMolds = moldStatusData.length
    const totalRepairs = moldRepairData.length

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

    // 수리 유형별 현황
    const repairTypeCount: Record<string, number> = {}
    moldRepairData.forEach(r => {
      const type = (r.유형 as string) || '기타'
      repairTypeCount[type] = (repairTypeCount[type] || 0) + 1
    })

    // 총 수리 비용
    const totalRepairCost = moldRepairData.reduce((sum, r) => {
      return sum + (Number(r.수리금액) || 0)
    }, 0)

    // 평균 금형사용율
    const avgUsageRate = moldStatusData.length > 0
      ? moldStatusData.reduce((sum, m) => sum + (Number(m.금형사용율) || 0), 0) / moldStatusData.length
      : 0

    // 점검 필요 금형 (세척/연마율 80% 이상)
    const needsInspection = moldStatusData.filter(m => (Number(m['세척/연마율']) || 0) >= 80).length

    return {
      totalMolds,
      totalRepairs,
      gradeCount,
      categoryCount,
      repairTypeCount,
      totalRepairCost,
      avgUsageRate,
      needsInspection
    }
  }, [moldStatusData, moldRepairData])

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

  // 수리 유형별 차트 데이터
  const repairTypeChartData = useMemo(() => {
    return Object.entries(summary.repairTypeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [summary.repairTypeCount])

  // 월별 수리 추이
  const monthlyRepairData = useMemo(() => {
    const monthlyCount: Record<string, { count: number; cost: number }> = {}

    moldRepairData.forEach(r => {
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
      .slice(-12) // 최근 12개월
  }, [moldRepairData])

  // 필터링된 금형 목록
  const filteredMolds = useMemo(() => {
    return moldStatusData.filter(m => {
      const matchSearch = !searchTerm ||
        (m.금형번호 as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.부품명 as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m['품종(MODEL)'] as string)?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchGrade = selectedGrade === 'all' || extractGrade(m.금형등급 as string) === selectedGrade
      const matchCategory = selectedCategory === 'all' || m.금형구분 === selectedCategory

      return matchSearch && matchGrade && matchCategory
    })
  }, [moldStatusData, searchTerm, selectedGrade, selectedCategory])

  // 필터링된 수리이력
  const filteredRepairs = useMemo(() => {
    return moldRepairData.filter(r => {
      const matchSearch = !searchTerm ||
        (r.금형번호 as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.부품명 as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.금형수리내용 as string)?.toLowerCase().includes(searchTerm.toLowerCase())

      return matchSearch
    }).sort((a, b) => {
      const dateA = a.수리일자 as string || ''
      const dateB = b.수리일자 as string || ''
      return dateB.localeCompare(dateA)
    })
  }, [moldRepairData, searchTerm])

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

  // 수리업체별 현황
  const vendorData = useMemo(() => {
    const vendorCount: Record<string, { count: number; cost: number }> = {}
    moldRepairData.forEach(r => {
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
  }, [moldRepairData])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  const formatCurrency = (num: number) => {
    if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억`
    if (num >= 10000) return `${(num / 10000).toFixed(0)}만`
    return formatNumber(num)
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
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={customerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [formatNumber(Number(value) || 0), '금형 수']} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
            <h3 className="text-sm font-semibold text-gray-700">금형 목록</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="금형번호, 부품명, 품종 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">금형번호</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">부품명</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">품종</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">구분</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">등급</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">보증SHOT</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">사용SHOT</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">사용율</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">세척/연마율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMolds.slice(0, 100).map((m, idx) => {
                  const grade = extractGrade(m.금형등급 as string)
                  const cleanRate = Number(m['세척/연마율']) || 0
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{m.금형번호}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">{m.부품명}</td>
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
            {filteredMolds.length > 100 && (
              <p className="text-center text-sm text-gray-400 py-3">
                {filteredMolds.length}건 중 100건만 표시됩니다.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 수리이력 탭
  if (subTab === 'repair') {
    return (
      <div className="space-y-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">총 수리 건수</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.totalRepairs)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">총 수리 비용</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalRepairCost)}원</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">자체 수리</p>
            <p className="text-2xl font-bold text-green-600">
              {formatNumber(moldRepairData.filter(r => r.구분 === '자체').length)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">외주 수리</p>
            <p className="text-2xl font-bold text-amber-600">
              {formatNumber(moldRepairData.filter(r => r.구분 === '외주').length)}
            </p>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 월별 수리 추이 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">월별 수리 추이 (최근 12개월)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyRepairData}>
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
                <Line yAxisId="left" type="monotone" dataKey="count" name="수리 건수" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="cost" name="수리 비용" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 수리업체별 현황 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">수리업체별 현황</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={vendorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [
                  name === 'count' ? formatNumber(Number(value) || 0) + '건' : formatCurrency(Number(value) || 0) + '원',
                  name === 'count' ? '수리 건수' : '수리 비용'
                ]} />
                <Bar dataKey="count" fill="#3b82f6" name="수리 건수" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 수리 유형별 현황 */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">수리 유형별 현황</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={repairTypeChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(value) => [formatNumber(Number(value) || 0), '건수']} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 수리이력 테이블 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">수리이력</h3>
            <input
              type="text"
              placeholder="금형번호, 부품명, 수리내용 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
            />
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">수리일자</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">금형번호</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">부품명</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">구분</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">유형</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">수리업체</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">수리금액</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">수리내용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRepairs.slice(0, 100).map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600">{r.수리일자}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{r.금형번호}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[150px] truncate">{r.부품명}</td>
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
            {filteredRepairs.length > 100 && (
              <p className="text-center text-sm text-gray-400 py-3">
                {filteredRepairs.length}건 중 100건만 표시됩니다.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
