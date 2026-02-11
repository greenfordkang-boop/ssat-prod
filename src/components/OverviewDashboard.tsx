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
  Legend,
  LabelList
} from 'recharts'
import { formatNumber, parseNumber, CHART_COLORS, EXCLUDED_PROCESSES } from '@/lib/utils'

// 필드 값 가져오기 (다양한 필드명 지원)
// 문자열 정규화 함수 (비교용)
const normalizeString = (val: unknown): string => {
  if (val === undefined || val === null) return ''
  return String(val).trim().toLowerCase().replace(/\s+/g, '')
}

// 필드 값 가져오기 (다양한 필드명 지원) - 모든 키를 순회
const getFieldFromPrice = (p: { [key: string]: string | number | undefined }, ...keys: string[]) => {
  // 먼저 정확한 키 매칭 시도
  for (const key of keys) {
    if (p[key] !== undefined && p[key] !== null && p[key] !== '') {
      return String(p[key]).trim()
    }
  }
  // 대소문자 무시하고 부분 매칭 시도
  const pKeys = Object.keys(p)
  for (const searchKey of keys) {
    const normalizedSearchKey = normalizeString(searchKey)
    for (const pKey of pKeys) {
      if (normalizeString(pKey) === normalizedSearchKey ||
          normalizeString(pKey).includes(normalizedSearchKey) ||
          normalizedSearchKey.includes(normalizeString(pKey))) {
        if (p[pKey] !== undefined && p[pKey] !== null && p[pKey] !== '') {
          return String(p[pKey]).trim()
        }
      }
    }
  }
  return ''
}

// 단가 데이터에서 매칭하는 헬퍼 함수 (개선된 버전)
const findPriceData = (
  priceData: { [key: string]: string | number | undefined }[],
  itemCode?: string,
  itemName?: string
) => {
  if (!priceData || priceData.length === 0) return undefined

  const searchCode = normalizeString(itemCode)
  const searchName = normalizeString(itemName)

  // 품목코드 키 후보
  const codeKeys = ['품목코드', '품번', '품목번호', 'itemCode', 'item_code', 'code', 'ITEM_CODE', 'PART_NO', 'partNo', 'part_no', '부품코드', '자재코드', '제품코드']
  // 품목명 키 후보
  const nameKeys = ['품목명', '품명', 'productName', 'product_name', 'name', 'ITEM_NAME', 'PRODUCT', 'itemName', 'item_name', '부품명', '자재명', '제품명']

  return priceData.find(p => {
    // 품목코드 매칭
    if (searchCode) {
      const priceItemCode = normalizeString(getFieldFromPrice(p, ...codeKeys))
      if (priceItemCode && priceItemCode === searchCode) {
        return true
      }
    }
    // 품목명 매칭
    if (searchName) {
      const priceItemName = normalizeString(getFieldFromPrice(p, ...nameKeys))
      if (priceItemName && priceItemName === searchName) {
        return true
      }
    }
    return false
  })
}

// 단가 값 추출 헬퍼 함수 (개선된 버전)
const getPriceValue = (priceItem: { [key: string]: string | number | undefined }) => {
  // 단가 키 후보들
  const priceKeys = ['합계단가', '단가', '가격', 'price', 'unitPrice', 'unit_price', 'PRICE', 'UNIT_PRICE', '단 가', '판매단가', '구매단가', 'cost', 'COST', '금액', '단위가격']

  // 모든 키를 순회하면서 단가 필드 찾기
  const allKeys = Object.keys(priceItem)

  // 먼저 정확한 매칭
  for (const key of priceKeys) {
    if (priceItem[key] !== undefined && priceItem[key] !== null && priceItem[key] !== '') {
      return parseNumber(priceItem[key])
    }
  }

  // 부분 매칭 시도 (단가가 포함된 필드)
  for (const key of allKeys) {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes('단가') || lowerKey.includes('price') || lowerKey.includes('금액')) {
      const val = priceItem[key]
      if (val !== undefined && val !== null && val !== '') {
        const numVal = parseNumber(val)
        if (numVal > 0) return numVal
      }
    }
  }

  return 0
}

// 엑셀 다운로드 함수
const downloadExcel = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h]
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
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

export default function OverviewDashboard() {
  const { data, selectedMonth, setSelectedMonth, getFilteredData } = useData()
  const filteredData = getFilteredData()
  const [showDetailTable, setShowDetailTable] = useState(true)
  const [processFilter, setProcessFilter] = useState('all')
  const [sortField, setSortField] = useState<string>('종합효율(OEE)')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // 날짜 문자열에서 월 추출 헬퍼 함수
  const extractMonthFromDate = (dateStr: string): number | null => {
    if (!dateStr) return null

    // YYYY-MM-DD 형식
    if (dateStr.includes('-')) {
      const match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
      if (match) return parseInt(match[2])
    }
    // YYYY/MM/DD 또는 MM/DD/YYYY 형식
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/')
      if (parts[0].length === 4) return parseInt(parts[1])
      return parseInt(parts[0])
    }
    // YYYY.MM.DD 형식
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.')
      if (parts[0].length === 4 && parts.length >= 2) return parseInt(parts[1])
    }
    // 엑셀 시리얼 날짜 (숫자)
    const num = parseFloat(dateStr)
    if (!isNaN(num) && num > 40000 && num < 50000) {
      const date = new Date((num - 25569) * 86400 * 1000)
      return date.getMonth() + 1
    }
    return null
  }

  // 가동율 데이터에서 공정별 시간가동율 매핑 생성
  const processAvailabilityMap = useMemo(() => {
    const map = new Map<string, { operatingTime: number; totalTime: number; availRate: number }>()

    // 선택된 월에 맞는 가동율 데이터 필터링
    const filteredAvail = data.availabilityData.filter(row => {
      // 다양한 날짜 필드명 지원
      const dateStr = String(row.date || row.일자 || row.생산일자 || row.날짜 || row.Date || row.DATE || '')
      const rowMonth = extractMonthFromDate(dateStr)
      // 월을 파싱할 수 없으면 모든 월에 포함
      return !rowMonth || rowMonth === selectedMonth
    })

    filteredAvail.forEach(row => {
      const process = String(row.공정 || row.process || '').trim()
      if (!process || process === '합계' || process === 'TOTAL') return

      // 기존 시간가동율 컬럼이 있으면 사용
      const directRate = parseNumber(row.시간가동율 || row.가동율 || row.가동률 || row['시간가동율(%)'] || row['가동율(%)'])

      // 조업시간과 가동시간으로 계산
      const operatingTime = parseNumber(row.가동시간 || row['가동시간(분)'] || row.operating_minutes || 0)
      const totalTime = parseNumber(row.조업시간 || row['조업시간(분)'] || row.scheduled_minutes || 0)
      const downtimeTotal = parseNumber(row.비가동합계 || row.downtime_total || 0)

      if (!map.has(process)) {
        map.set(process, { operatingTime: 0, totalTime: 0, availRate: 0 })
      }

      const current = map.get(process)!

      // 직접 시간가동율 값이 있고 유효하면 평균 계산을 위해 저장
      if (directRate > 0 && directRate <= 100) {
        // 가중평균을 위해 조업시간을 가중치로 사용
        const weight = totalTime > 0 ? totalTime : 1
        current.availRate = ((current.availRate * current.totalTime) + (directRate * weight)) / (current.totalTime + weight)
        current.totalTime += weight
      } else if (totalTime > 0) {
        // 조업시간과 가동시간으로 계산
        current.operatingTime += operatingTime
        current.totalTime += totalTime
      } else if (downtimeTotal > 0 && operatingTime > 0) {
        // 비가동합계와 가동시간으로 계산
        current.operatingTime += operatingTime
        current.totalTime += operatingTime + downtimeTotal
      }
    })

    // 최종 시간가동율 계산
    const result = new Map<string, number>()
    map.forEach((values, process) => {
      if (values.availRate > 0) {
        result.set(process, Math.round(values.availRate * 10) / 10)
      } else if (values.totalTime > 0) {
        const rate = (values.operatingTime / values.totalTime) * 100
        result.set(process, Math.round(rate * 10) / 10)
      }
    })

    return result
  }, [data.availabilityData, selectedMonth])

  // 공정별 종합효율 계산 (테이블 데이터)
  const processOEE = useMemo(() => {
    const stats: Record<string, { production: number; good: number; defect: number; defectAmount: number }> = {}

    filteredData.forEach(row => {
      const process = row.공정 || '기타'
      if (EXCLUDED_PROCESSES.includes(process)) return

      const prod = parseNumber(row.생산수량)
      const goodQty = parseNumber(row.양품수량)
      const defectQty = parseNumber(row.불량수량) || (prod - goodQty)
      const actualDefect = defectQty > 0 ? defectQty : 0

      if (!stats[process]) {
        stats[process] = { production: 0, good: 0, defect: 0, defectAmount: 0 }
      }

      stats[process].production += prod
      stats[process].good += goodQty
      stats[process].defect += actualDefect

      // 불량금액 계산
      const price = findPriceData(data.priceData, row.품목코드, row.품목명)
      if (price) {
        stats[process].defectAmount += actualDefect * getPriceValue(price)
      }
    })

    return Object.entries(stats)
      .filter(([, v]) => v.production > 0)
      .map(([name, values]) => {
        const qualityRate = values.production > 0 ? (values.good / values.production) * 100 : 0
        // 가동율 데이터에서 실제 시간가동율 가져오기 (없으면 100%)
        const timeAvail = processAvailabilityMap.get(name) ?? 100
        const perfRate = 100 // 성능가동율은 별도 데이터 없으면 100%
        const oee = (timeAvail * perfRate * qualityRate) / 10000

        return {
          공정: name,
          생산수량: values.production,
          양품수량: values.good,
          불량수량: values.defect,
          불량금액: Math.round(values.defectAmount),
          시간가동율: timeAvail,
          성능가동율: perfRate,
          양품율: Math.round(qualityRate * 10) / 10,
          '종합효율(OEE)': Math.round(oee * 10) / 10
        }
      })
  }, [filteredData, data.priceData, processAvailabilityMap])

  // 정렬된 데이터
  const sortedProcessOEE = useMemo(() => {
    return [...processOEE].sort((a, b) => {
      const aVal = a[sortField as keyof typeof a] as number
      const bVal = b[sortField as keyof typeof b] as number
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [processOEE, sortField, sortDirection])

  // 필터링된 데이터
  const filteredProcessOEE = useMemo(() => {
    if (processFilter === 'all') return sortedProcessOEE
    return sortedProcessOEE.filter(row => row.공정 === processFilter)
  }, [sortedProcessOEE, processFilter])

  // 월별 보유시간 (일수 × 24시간, 하드세팅)
  const MONTHLY_HOURS = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744]
  // 선택된 월의 보유시간(분)
  const monthlyCapacityMin = MONTHLY_HOURS[selectedMonth - 1] * 60

  // 사출설비별 설비가동율 = 가동시간(분) / 보유시간(분) × 100
  const injectionEquipUtil = useMemo(() => {
    const capacityHours = MONTHLY_HOURS[selectedMonth - 1]
    const equipMap = new Map<string, number>()

    // 1차: availabilityData에서 사출 데이터 필터링
    const filtered = data.availabilityData.filter(row => {
      const process = String(row.공정 || row.process || '').trim()
      if (process !== '사출') return false
      const dateStr = String(row.date || row.일자 || row.생산일자 || row.날짜 || row.Date || row.DATE || '')
      const rowMonth = extractMonthFromDate(dateStr)
      return !rowMonth || rowMonth === selectedMonth
    })

    if (filtered.length > 0) {
      // availabilityData 사용
      filtered.forEach(row => {
        const equip = String(
          row['설비/LINE'] || row['설비(라인)명'] || row.LINE ||
          row.설비명 || row.설비 || row.라인명 || '기타'
        ).trim()
        if (!equip || equip === '합계' || equip === 'TOTAL' || equip === '총계') return
        const operatingMin = parseNumber(row['가동시간(분)'] || row.가동시간 || 0)
        equipMap.set(equip, (equipMap.get(equip) || 0) + operatingMin)
      })
    } else {
      // 2차: rawData(생산실적)에서 사출 데이터 fallback
      const rawFiltered = data.rawData.filter(row => {
        const process = String(row.공정 || '').trim()
        if (process !== '사출') return false
        const dateStr = String(row.생산일자 || '')
        const rowMonth = extractMonthFromDate(dateStr)
        return rowMonth === selectedMonth
      })
      rawFiltered.forEach(row => {
        const equip = String(row['설비(라인)명'] || '기타').trim()
        if (!equip || equip === '합계' || equip === 'TOTAL' || equip === '총계') return
        const operatingMin = parseNumber(row['작업시간(분)'] || 0)
        equipMap.set(equip, (equipMap.get(equip) || 0) + operatingMin)
      })
    }

    // 설비별 가동율 계산
    const result = Array.from(equipMap.entries())
      .map(([name, totalMin]) => ({
        설비: name,
        가동시간: Math.round(totalMin / 60 * 10) / 10, // 시간 단위
        보유시간: capacityHours,
        설비가동율: Math.round((totalMin / monthlyCapacityMin) * 1000) / 10
      }))
      .sort((a, b) => b.설비가동율 - a.설비가동율)

    return result
  }, [data.availabilityData, data.rawData, selectedMonth, monthlyCapacityMin])

  // 사출설비 평균 설비가동율 (선택된 월)
  const avgEquipUtil = useMemo(() => {
    if (injectionEquipUtil.length === 0) return 0
    const sum = injectionEquipUtil.reduce((acc, e) => acc + e.설비가동율, 0)
    return Math.round((sum / injectionEquipUtil.length) * 10) / 10
  }, [injectionEquipUtil])

  // 월별 사출 설비가동율 추이 (1~12월)
  const monthlyEquipUtil = useMemo(() => {
    // 사출 가동율 데이터만 추출
    const injectionAvail = data.availabilityData.filter(row => {
      const process = String(row.공정 || row.process || '').trim()
      return process === '사출'
    })

    // 사출 생산실적 데이터 (fallback용)
    const injectionRaw = data.rawData.filter(row => {
      const process = String(row.공정 || '').trim()
      return process === '사출'
    })

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const capMin = MONTHLY_HOURS[i] * 60
      const equipMap = new Map<string, number>()

      // 1차: availabilityData에서 해당 월 데이터
      const monthAvailData = injectionAvail.filter(row => {
        const dateStr = String(row.date || row.일자 || row.생산일자 || row.날짜 || row.Date || row.DATE || '')
        const rowMonth = extractMonthFromDate(dateStr)
        return rowMonth === month
      })

      if (monthAvailData.length > 0) {
        monthAvailData.forEach(row => {
          const equip = String(
            row['설비/LINE'] || row['설비(라인)명'] || row.LINE ||
            row.설비명 || row.설비 || row.라인명 || '기타'
          ).trim()
          if (!equip || equip === '합계' || equip === 'TOTAL' || equip === '총계') return
          const operatingMin = parseNumber(row['가동시간(분)'] || row.가동시간 || 0)
          equipMap.set(equip, (equipMap.get(equip) || 0) + operatingMin)
        })
      } else {
        // 2차: rawData(생산실적) fallback
        const monthRawData = injectionRaw.filter(row => {
          const dateStr = String(row.생산일자 || '')
          const rowMonth = extractMonthFromDate(dateStr)
          return rowMonth === month
        })
        monthRawData.forEach(row => {
          const equip = String(row['설비(라인)명'] || '기타').trim()
          if (!equip || equip === '합계' || equip === 'TOTAL' || equip === '총계') return
          const operatingMin = parseNumber(row['작업시간(분)'] || 0)
          equipMap.set(equip, (equipMap.get(equip) || 0) + operatingMin)
        })
      }

      if (equipMap.size === 0) {
        return { month: `${month}월`, 설비가동율: 0, 보유시간: MONTHLY_HOURS[i], 대수: 0 }
      }

      // 설비별 가동율 → 평균
      const rates = Array.from(equipMap.values()).map(totalMin =>
        (totalMin / capMin) * 100
      )
      const avg = rates.length > 0
        ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 10) / 10
        : 0

      return { month: `${month}월`, 설비가동율: avg, 보유시간: MONTHLY_HOURS[i], 대수: equipMap.size }
    })
  }, [data.availabilityData, data.rawData])

  // OEE 요약 통계 (테이블 데이터 기반)
  const oeeStats = useMemo(() => {
    if (processOEE.length === 0) {
      return { oee: 0, timeAvailability: 0, performanceRate: 0, qualityRate: 0, totalDefect: 0, totalDefectAmount: 0 }
    }

    // 전체 생산량 기준 가중평균
    let totalProduction = 0
    let totalGood = 0
    let totalDefect = 0
    let totalDefectAmount = 0
    let weightedTimeAvail = 0

    processOEE.forEach(row => {
      totalProduction += row.생산수량
      totalGood += row.양품수량
      totalDefect += row.불량수량
      totalDefectAmount += row.불량금액
      // 생산량 가중 시간가동율
      weightedTimeAvail += row.시간가동율 * row.생산수량
    })

    const avgQuality = totalProduction > 0 ? (totalGood / totalProduction) * 100 : 0
    // 생산량 기준 가중평균 시간가동율
    const avgTimeAvail = totalProduction > 0 ? weightedTimeAvail / totalProduction : 100
    const avgPerfRate = 100 // 성능가동율은 별도 데이터 없으면 100%
    const avgOEE = (avgTimeAvail * avgPerfRate * avgQuality) / 10000

    return {
      oee: Math.round(avgOEE * 10) / 10,
      timeAvailability: Math.round(avgTimeAvail * 10) / 10,
      performanceRate: avgPerfRate,
      qualityRate: Math.round(avgQuality * 10) / 10,
      totalDefect,
      totalDefectAmount
    }
  }, [processOEE])

  // 월별 OEE 추이
  const monthlyOEE = useMemo(() => {
    // 디버깅: 가동율 데이터 날짜 필드 확인
    if (data.availabilityData.length > 0) {
      const sample = data.availabilityData[0]
      const dateFields = ['date', '일자', '생산일자', '날짜', 'Date', 'DATE']
      const foundDate = dateFields.find(f => sample[f as keyof typeof sample])
      console.log('📊 가동율 데이터 날짜 필드:', foundDate || '없음',
        '| 샘플값:', sample[foundDate as keyof typeof sample] || '없음',
        '| 총 레코드:', data.availabilityData.length)
    }

    // 월별 시간가동율 계산 함수
    const getMonthlyAvailability = (month: number): number => {
      const monthAvailData = data.availabilityData.filter(row => {
        // 다양한 날짜 필드명 지원
        const dateStr = String(row.date || row.일자 || row.생산일자 || row.날짜 || row.Date || row.DATE || '')
        const rowMonth = extractMonthFromDate(dateStr)
        return rowMonth === month
      })

      // 디버깅: 월별 필터링 결과
      if (month === 1 || month === 2) {
        console.log(`📊 ${month}월 가동율 데이터:`, monthAvailData.length, '건')
      }

      if (monthAvailData.length === 0) return 100

      let totalOperating = 0
      let totalScheduled = 0
      let directRateSum = 0
      let directRateCount = 0

      monthAvailData.forEach(row => {
        const process = String(row.공정 || row.process || '').trim()
        if (!process || process === '합계' || process === 'TOTAL') return

        const directRate = parseNumber(row.시간가동율 || row.가동율 || row.가동률 || row['시간가동율(%)'] || row['가동율(%)'])
        const operatingTime = parseNumber(row.가동시간 || row['가동시간(분)'] || 0)
        const scheduledTime = parseNumber(row.조업시간 || row['조업시간(분)'] || 0)

        if (directRate > 0 && directRate <= 100) {
          directRateSum += directRate
          directRateCount++
        } else if (scheduledTime > 0) {
          totalOperating += operatingTime
          totalScheduled += scheduledTime
        }
      })

      if (directRateCount > 0) {
        return Math.round((directRateSum / directRateCount) * 10) / 10
      } else if (totalScheduled > 0) {
        return Math.round((totalOperating / totalScheduled) * 1000) / 10
      }
      return 100
    }

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const monthData = data.rawData.filter(row => {
        const dateStr = row.생산일자 || ''
        const match = dateStr.match(/\d{4}-(\d{2})-\d{2}/)
        return match && parseInt(match[1]) === month
      })

      if (monthData.length === 0) {
        return { month: `${month}월`, 'OEE (%)': 0, 시간가동율: 0, 성능가동율: 0, 양품율: 0 }
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
      // 해당 월의 실제 시간가동율 가져오기
      const timeAvail = getMonthlyAvailability(month)
      const perfRate = 100
      const oee = (timeAvail * perfRate * qualityRate) / 10000

      return {
        month: `${month}월`,
        'OEE (%)': Math.round(oee * 10) / 10,
        시간가동율: timeAvail,
        성능가동율: perfRate,
        양품율: Math.round(qualityRate * 10) / 10
      }
    })
  }, [data.rawData, data.availabilityData])

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

  // 정렬 핸들러
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

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
              <option value="all">전체 공정</option>
              {processes.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 데이터 현황 */}
        <div className="flex items-center gap-4 mt-4 text-sm">
          <span className="text-green-600 flex items-center gap-1">
            ✓ 가동율 {formatNumber(data.availabilityData.length)}건
          </span>
          <span className="text-amber-600 flex items-center gap-1">
            ✓ CT현황 {formatNumber(data.ctData.length)}건
          </span>
        </div>
      </div>

      {/* OEE 요약 카드 */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{selectedMonth}월 종합효율 (OEE)</div>
          <div className="text-4xl font-bold text-slate-800">{oeeStats.oee.toFixed(1)}%</div>
          <div className="text-xs text-slate-400 mt-2">시간가동율 × 성능가동율 × 양품율</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="text-sm text-slate-500 mb-1">평균 시간가동율</div>
          <div className="text-4xl font-bold text-blue-600">{oeeStats.timeAvailability.toFixed(1)}%</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200">
          <div className="text-sm text-slate-500 mb-1">설비가동율 (사출)</div>
          <div className="text-4xl font-bold text-emerald-600">{avgEquipUtil.toFixed(1)}%</div>
          <div className="text-xs text-slate-400 mt-2">보유 {MONTHLY_HOURS[selectedMonth - 1]}h × {injectionEquipUtil.length}대</div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">평균 성능가동율</div>
          <div className="text-4xl font-bold text-slate-700">{oeeStats.performanceRate.toFixed(1)}%</div>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-6 border border-cyan-200">
          <div className="text-sm text-slate-500 mb-1">평균 양품율</div>
          <div className="text-4xl font-bold text-cyan-600">{oeeStats.qualityRate.toFixed(1)}%</div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="text-sm text-slate-500 mb-1">불량금액</div>
          <div className="text-3xl font-bold text-red-600">{formatNumber(oeeStats.totalDefectAmount)}</div>
          <div className="text-xs text-slate-400 mt-2">불량 {formatNumber(oeeStats.totalDefect)} EA</div>
        </div>
      </div>

      {/* 월별 사출 설비가동율 추이 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-emerald-500 rounded-full" />
          월별 사출 설비가동율 추이
        </h3>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={monthlyEquipUtil} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
                    <div className="font-bold text-slate-700 mb-1">{label}</div>
                    <div className="text-emerald-600">설비가동율: {d.설비가동율.toFixed(1)}%</div>
                    <div className="text-slate-500">보유시간: {d.보유시간}h/대 · {d.대수}대</div>
                  </div>
                )
              }}
            />
            <Bar dataKey="설비가동율" fill="#6ee7b7" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="설비가동율" position="top" fill="#059669" fontSize={10} fontWeight="bold" formatter={(v) => (v as number) > 0 ? `${(v as number).toFixed(1)}%` : ''} />
            </Bar>
            <Line type="monotone" dataKey="설비가동율" stroke="#059669" strokeWidth={2} dot={{ r: 4, fill: '#059669' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 사출기별 설비가동율 (선택월 상세) */}
      {injectionEquipUtil.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-emerald-500 rounded-full" />
            사출기별 설비가동율 ({selectedMonth}월, 보유시간 {MONTHLY_HOURS[selectedMonth - 1]}h/대)
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(300, injectionEquipUtil.length * 40)}>
            <BarChart
              data={injectionEquipUtil}
              layout="vertical"
              margin={{ top: 10, right: 60, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis
                type="category"
                dataKey="설비"
                width={140}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
                      <div className="font-bold text-slate-700 mb-1">{label}</div>
                      <div className="text-emerald-600">설비가동율: {d.설비가동율.toFixed(1)}%</div>
                      <div className="text-slate-500">가동시간: {d.가동시간.toFixed(1)}h / {d.보유시간}h</div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="설비가동율" fill="#34d399" radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="설비가동율"
                  position="right"
                  fill="#059669"
                  fontSize={11}
                  fontWeight="bold"
                  formatter={(v) => `${(v as number).toFixed(1)}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 월별 OEE 추이 차트 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full" />
          월별 종합효율 (OEE) 추이
        </h3>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={monthlyOEE} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, '']} />
            <Legend />
            <Bar yAxisId="left" dataKey="시간가동율" fill="#e2e8f0" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="시간가동율" position="inside" fill="#64748b" fontSize={9} formatter={(v) => `${Number(v).toFixed(1)}%`} />
            </Bar>
            <Bar yAxisId="left" dataKey="성능가동율" fill="#cbd5e1" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="성능가동율" position="inside" fill="#475569" fontSize={9} formatter={(v) => `${Number(v).toFixed(1)}%`} />
            </Bar>
            <Bar yAxisId="left" dataKey="양품율" fill="#bfdbfe" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="양품율" position="inside" fill="#1e40af" fontSize={9} formatter={(v) => `${Number(v).toFixed(1)}%`} />
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="OEE (%)" stroke="#f87171" strokeWidth={3} dot={{ r: 5, fill: '#f87171' }}>
              <LabelList dataKey="OEE (%)" position="top" fill="#dc2626" fontSize={10} fontWeight="bold" formatter={(v) => `${Number(v).toFixed(1)}%`} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 공정별 종합효율 상세 테이블 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-full" />
            공정별 종합효율 상세
            <span className="text-sm font-normal text-slate-400">({filteredProcessOEE.length}건)</span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDetailTable(!showDetailTable)}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg transition"
            >
              {showDetailTable ? '📁 접기' : '📂 펼치기'}
            </button>
            <button
              onClick={() => downloadExcel(filteredProcessOEE, `OEE_${selectedMonth}월`)}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
            >
              📥 엑셀 다운로드
            </button>
          </div>
        </div>

        {showDetailTable && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['공정', '생산수량', '양품수량', '불량수량', '불량금액', '시간가동율', '성능가동율', '양품율', '종합효율(OEE)'].map((field, idx) => (
                    <th
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap ${idx === 0 ? 'text-center' : 'text-center'}`}
                    >
                      <div className={`flex items-center gap-1 ${idx === 0 ? 'justify-center' : 'justify-center'}`}>
                        {field}
                        {sortField === field && (
                          <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProcessOEE.map((row, idx) => (
                  <tr key={row.공정} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-3 font-medium text-slate-700 text-center">{row.공정}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.생산수량)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.양품수량)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatNumber(row.불량수량)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatNumber(row.불량금액)}원</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.시간가동율.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.성능가동율.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.양품율.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600">
                      {row['종합효율(OEE)'].toFixed(1)}%
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
