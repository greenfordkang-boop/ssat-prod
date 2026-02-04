'use client'

import { useMemo, useState, useEffect } from 'react'
import { useData } from '@/contexts/DataContext'
import { parseNumber } from '@/lib/utils'

// 관리 기준 타입
interface CriteriaSettings {
  operationRateThreshold: number  // 시간가동율 미달 기준 (%)
  ctExcessThreshold: number       // CT 초과 기준 (%)
  defectRateThreshold: number     // 불량률 과다 기준 (%)
  materialDefectTop: number       // 자재불량 표시 건수
  packagingDefectTop: number      // 검포장불량 표시 건수
}

// 프리셋 정의
const PRESETS: Record<string, CriteriaSettings> = {
  strict: {
    operationRateThreshold: 95,
    ctExcessThreshold: 5,
    defectRateThreshold: 2,
    materialDefectTop: 5,
    packagingDefectTop: 5,
  },
  normal: {
    operationRateThreshold: 90,
    ctExcessThreshold: 10,
    defectRateThreshold: 3,
    materialDefectTop: 3,
    packagingDefectTop: 3,
  },
  loose: {
    operationRateThreshold: 85,
    ctExcessThreshold: 15,
    defectRateThreshold: 5,
    materialDefectTop: 3,
    packagingDefectTop: 3,
  },
}

// 이슈 심각도
type Severity = 'critical' | 'warning' | 'caution'

interface Issue {
  id: string
  process: string
  equipment: string
  product?: string
  metric: string
  currentValue: number
  targetValue?: number
  threshold: number
  diff: number
  severity: Severity
  detail?: string
}

// 로컬 스토리지 키
const STORAGE_KEY = 'keyIssuesCriteria'

export default function KeyIssuesBoard() {
  const { data, selectedMonth } = useData()

  // 기준 설정 상태
  const [preset, setPreset] = useState<'strict' | 'normal' | 'loose' | 'custom'>('normal')
  const [criteria, setCriteria] = useState<CriteriaSettings>(PRESETS.normal)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [tempCriteria, setTempCriteria] = useState<CriteriaSettings>(PRESETS.normal)

  // 필터 상태
  const [processFilter, setProcessFilter] = useState<string>('all')

  // 로컬 스토리지에서 설정 로드
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPreset(parsed.preset || 'normal')
        setCriteria(parsed.criteria || PRESETS.normal)
      } catch {
        // 파싱 실패 시 기본값 사용
      }
    }
  }, [])

  // 설정 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, criteria }))
  }, [preset, criteria])

  // 프리셋 변경 핸들러
  const handlePresetChange = (newPreset: 'strict' | 'normal' | 'loose' | 'custom') => {
    setPreset(newPreset)
    if (newPreset !== 'custom') {
      setCriteria(PRESETS[newPreset])
    }
  }

  // 설정 모달 열기
  const openSettingsModal = () => {
    setTempCriteria(criteria)
    setShowSettingsModal(true)
  }

  // 설정 적용
  const applySettings = () => {
    setCriteria(tempCriteria)
    setPreset('custom')
    setShowSettingsModal(false)
  }

  // 기본값 복원
  const resetToDefault = () => {
    setTempCriteria(PRESETS.normal)
  }

  // 심각도 계산 (목표 대비 차이 기준)
  const getSeverity = (diff: number): Severity => {
    if (diff >= 20) return 'critical'
    if (diff >= 10) return 'warning'
    return 'caution'
  }

  // ============================================
  // 1. 시간가동율 미달 분석
  // ============================================
  const operationRateIssues = useMemo(() => {
    const issues: Issue[] = []
    const processes = ['사출', '도장', '인쇄', '조립']

    processes.forEach(processName => {
      // detailData에서 해당 공정 데이터 필터링
      const processData = data.detailData.filter((row: Record<string, unknown>) => {
        const rowProcess = String(row.공정 || row.공정명 || row.process || '')
        return rowProcess === processName
      })

      // 선택된 월 필터링
      const monthFiltered = processData.filter((row: Record<string, unknown>) => {
        const dateStr = String(row['일자'] || row['날짜'] || row['생산일자'] || row['작업일자'] || '')
        if (!dateStr) return true
        let month = 0
        if (dateStr.includes('-')) {
          month = parseInt(dateStr.split('-')[1], 10)
        } else if (dateStr.includes('/')) {
          month = parseInt(dateStr.split('/')[1], 10)
        } else if (dateStr.length === 8) {
          month = parseInt(dateStr.substring(4, 6), 10)
        }
        return isNaN(month) || month === 0 || month === selectedMonth
      })

      // 설비별 가동율 계산
      const equipmentMap = new Map<string, { total: number; count: number }>()

      monthFiltered.forEach((row: Record<string, unknown>) => {
        const keys = Object.keys(row)
        const equipKey = keys.find(k =>
          k.includes('설비') || k.toLowerCase().includes('line')
        )
        const rateKey = keys.find(k =>
          k.includes('시간가동율') || k.includes('가동율') || k.includes('가동률')
        )

        if (equipKey && rateKey) {
          const equip = String(row[equipKey] || '').trim()
          let rate = parseNumber(row[rateKey] as string | number)

          // 100 이하면 이미 퍼센트, 아니면 변환
          if (rate > 1 && rate <= 100) {
            // 이미 퍼센트
          } else if (rate <= 1) {
            rate = rate * 100
          }

          if (equip && rate > 0) {
            const existing = equipmentMap.get(equip) || { total: 0, count: 0 }
            equipmentMap.set(equip, {
              total: existing.total + rate,
              count: existing.count + 1
            })
          }
        }
      })

      // 기준 미달 설비 추출
      equipmentMap.forEach((stats, equipment) => {
        const avgRate = stats.total / stats.count
        if (avgRate < criteria.operationRateThreshold) {
          const diff = criteria.operationRateThreshold - avgRate
          issues.push({
            id: `op-${processName}-${equipment}`,
            process: processName,
            equipment,
            metric: '시간가동율',
            currentValue: avgRate,
            threshold: criteria.operationRateThreshold,
            diff,
            severity: getSeverity(diff),
            detail: `목표 ${criteria.operationRateThreshold}% 대비 ${diff.toFixed(1)}%p 미달`
          })
        }
      })
    })

    return issues.sort((a, b) => b.diff - a.diff)
  }, [data.detailData, selectedMonth, criteria.operationRateThreshold])

  // ============================================
  // 2. CT 초과 분석
  // ============================================
  const ctExcessIssues = useMemo(() => {
    const issues: Issue[] = []
    const processes = ['사출', '도장', '인쇄', '조립']

    processes.forEach(processName => {
      // ctData에서 해당 공정 데이터 필터링
      const processCtData = data.ctData.filter((row: Record<string, unknown>) => {
        const rowProcess = String(row.공정 || row.공정명 || row.process || '')
        return rowProcess === processName
      })

      // 선택된 월 필터링
      const monthFiltered = processCtData.filter((row: Record<string, unknown>) => {
        const dateStr = String(row['일자'] || row['날짜'] || row['생산일자'] || row['작업일자'] || '')
        if (!dateStr) return true
        let month = 0
        if (dateStr.includes('-')) {
          month = parseInt(dateStr.split('-')[1], 10)
        } else if (dateStr.includes('/')) {
          month = parseInt(dateStr.split('/')[1], 10)
        } else if (dateStr.length === 8) {
          month = parseInt(dateStr.substring(4, 6), 10)
        }
        return isNaN(month) || month === 0 || month === selectedMonth
      })

      // 품목별 CT 분석
      const productMap = new Map<string, { actual: number; target: number; count: number }>()

      monthFiltered.forEach((row: Record<string, unknown>) => {
        const keys = Object.keys(row)
        const productKey = keys.find(k =>
          k.includes('품목') || k.includes('품명') || k.includes('제품')
        )
        const actualCtKey = keys.find(k =>
          (k.includes('실적') || k.includes('actual')) && k.toLowerCase().includes('ct')
        ) || keys.find(k => k.includes('실적CT') || k.includes('실적 CT') || k.includes('실제C/T'))
        const targetCtKey = keys.find(k =>
          (k.includes('목표') || k.includes('기준') || k.includes('target') || k.includes('표준')) && k.toLowerCase().includes('ct')
        ) || keys.find(k => k.includes('목표CT') || k.includes('기준CT') || k.includes('표준C/T'))

        if (productKey && actualCtKey && targetCtKey) {
          const product = String(row[productKey] || '').trim()
          const actualCt = parseNumber(row[actualCtKey] as string | number)
          const targetCt = parseNumber(row[targetCtKey] as string | number)

          if (product && actualCt > 0 && targetCt > 0) {
            const existing = productMap.get(product) || { actual: 0, target: 0, count: 0 }
            productMap.set(product, {
              actual: existing.actual + actualCt,
              target: existing.target + targetCt,
              count: existing.count + 1
            })
          }
        }
      })

      // CT 초과 품목 추출
      productMap.forEach((stats, product) => {
        const avgActual = stats.actual / stats.count
        const avgTarget = stats.target / stats.count
        const excessRate = ((avgActual - avgTarget) / avgTarget) * 100

        if (excessRate > criteria.ctExcessThreshold) {
          issues.push({
            id: `ct-${processName}-${product}`,
            process: processName,
            equipment: product,
            product,
            metric: 'CT 초과',
            currentValue: excessRate,
            targetValue: avgTarget,
            threshold: criteria.ctExcessThreshold,
            diff: excessRate,
            severity: getSeverity(excessRate),
            detail: `실적 ${avgActual.toFixed(1)}s / 목표 ${avgTarget.toFixed(1)}s (+${excessRate.toFixed(1)}%)`
          })
        }
      })
    })

    return issues.sort((a, b) => b.diff - a.diff)
  }, [data.ctData, selectedMonth, criteria.ctExcessThreshold])

  // ============================================
  // 3. 불량률 과다 분석
  // ============================================
  const defectRateIssues = useMemo(() => {
    const issues: Issue[] = []
    const processes = ['사출', '도장', '인쇄', '조립']

    processes.forEach(processName => {
      // detailData에서 해당 공정 데이터 필터링
      const processData = data.detailData.filter((row: Record<string, unknown>) => {
        const rowProcess = String(row.공정 || row.공정명 || row.process || '')
        return rowProcess === processName
      })

      // 선택된 월 필터링
      const monthFiltered = processData.filter((row: Record<string, unknown>) => {
        const dateStr = String(row['일자'] || row['날짜'] || row['생산일자'] || row['작업일자'] || '')
        if (!dateStr) return true
        let month = 0
        if (dateStr.includes('-')) {
          month = parseInt(dateStr.split('-')[1], 10)
        } else if (dateStr.includes('/')) {
          month = parseInt(dateStr.split('/')[1], 10)
        } else if (dateStr.length === 8) {
          month = parseInt(dateStr.substring(4, 6), 10)
        }
        return isNaN(month) || month === 0 || month === selectedMonth
      })

      // 설비별 불량률 계산
      const equipmentMap = new Map<string, { good: number; defect: number }>()

      monthFiltered.forEach((row: Record<string, unknown>) => {
        const keys = Object.keys(row)
        const equipKey = keys.find(k =>
          k.includes('설비') || k.toLowerCase().includes('line')
        )
        const goodKey = keys.find(k => k.includes('양품') && k.includes('수량'))
        const defectKey = keys.find(k => k.includes('불량') && k.includes('수량'))

        if (equipKey) {
          const equip = String(row[equipKey] || '').trim()
          const good = parseNumber(row[goodKey || ''] as string | number)
          const defect = parseNumber(row[defectKey || ''] as string | number)

          if (equip && (good > 0 || defect > 0)) {
            const existing = equipmentMap.get(equip) || { good: 0, defect: 0 }
            equipmentMap.set(equip, {
              good: existing.good + good,
              defect: existing.defect + defect
            })
          }
        }
      })

      // 불량률 과다 설비 추출
      equipmentMap.forEach((stats, equipment) => {
        const total = stats.good + stats.defect
        if (total > 0) {
          const defectRate = (stats.defect / total) * 100
          if (defectRate > criteria.defectRateThreshold) {
            const diff = defectRate - criteria.defectRateThreshold
            issues.push({
              id: `def-${processName}-${equipment}`,
              process: processName,
              equipment,
              metric: '불량률',
              currentValue: defectRate,
              threshold: criteria.defectRateThreshold,
              diff,
              severity: getSeverity(diff * 3), // 불량률은 민감하므로 3배 가중
              detail: `불량 ${stats.defect.toLocaleString()}개 / 총 ${total.toLocaleString()}개`
            })
          }
        }
      })
    })

    return issues.sort((a, b) => b.diff - a.diff)
  }, [data.detailData, selectedMonth, criteria.defectRateThreshold])

  // ============================================
  // 4. 자재불량 다발 분석 (조립만)
  // ============================================
  const materialDefectIssues = useMemo(() => {
    const issues: Issue[] = []

    // materialDefectData에서 조립 공정 필터링 (또는 전체 사용)
    const materialData = data.materialDefectData.filter((row: Record<string, unknown>) => {
      const rowProcess = String(row.공정 || row.공정명 || row.process || '')
      // 공정 필드가 없으면 전체 사용 (조립 전용 데이터로 간주)
      return !rowProcess || rowProcess === '조립'
    })

    // 선택된 월 필터링
    const monthFiltered = materialData.filter((row: Record<string, unknown>) => {
      const dateStr = String(row['일자'] || row['날짜'] || row['생산일자'] || row['작업일자'] || '')
      if (!dateStr) return true
      let month = 0
      if (dateStr.includes('-')) {
        month = parseInt(dateStr.split('-')[1], 10)
      } else if (dateStr.includes('/')) {
        month = parseInt(dateStr.split('/')[1], 10)
      } else if (dateStr.length === 8) {
        month = parseInt(dateStr.substring(4, 6), 10)
      }
      return isNaN(month) || month === 0 || month === selectedMonth
    })

    // 품목별 불량 합계
    const productMap = new Map<string, { total: number; mainDefect: string; mainCount: number }>()

    monthFiltered.forEach((row: Record<string, unknown>) => {
      const keys = Object.keys(row)
      const productKey = keys.find(k => k.includes('품목') || k.includes('품명') || k.includes('부품'))
      const totalKey = keys.find(k => k.includes('불량합계') || k.includes('합계'))

      // 불량유형 컬럼 (괄호로 시작하는 것)
      const defectTypeKeys = keys.filter(k => k.startsWith('('))

      if (productKey) {
        const product = String(row[productKey] || '').trim()
        const total = parseNumber(row[totalKey || ''] as string | number)

        // 가장 많은 불량유형 찾기
        let mainDefect = ''
        let mainCount = 0
        defectTypeKeys.forEach(k => {
          const count = parseNumber(row[k] as string | number)
          if (count > mainCount) {
            mainCount = count
            mainDefect = k.replace(/[()]/g, '')
          }
        })

        if (product && total > 0) {
          const existing = productMap.get(product) || { total: 0, mainDefect: '', mainCount: 0 }
          productMap.set(product, {
            total: existing.total + total,
            mainDefect: existing.mainCount > mainCount ? existing.mainDefect : mainDefect,
            mainCount: Math.max(existing.mainCount, mainCount)
          })
        }
      }
    })

    // TOP N 추출
    const sorted = Array.from(productMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, criteria.materialDefectTop)

    sorted.forEach(([product, stats], index) => {
      const severity: Severity = index === 0 ? 'critical' : index < 2 ? 'warning' : 'caution'
      issues.push({
        id: `mat-조립-${product}`,
        process: '조립',
        equipment: product,
        product,
        metric: '자재불량',
        currentValue: stats.total,
        threshold: 0,
        diff: stats.total,
        severity,
        detail: stats.mainDefect ? `주요: ${stats.mainDefect}` : ''
      })
    })

    return issues
  }, [data.materialDefectData, selectedMonth, criteria.materialDefectTop])

  // ============================================
  // 5. 검포장 불량 분석 (조립만)
  // ============================================
  const packagingDefectIssues = useMemo(() => {
    const issues: Issue[] = []

    // packagingStatusData에서 조립 공정 필터링 (또는 전체 사용)
    const packagingData = data.packagingStatusData.filter((row: Record<string, unknown>) => {
      const rowProcess = String(row.공정 || row.공정명 || row.process || '')
      // 공정 필드가 없으면 전체 사용 (조립 전용 데이터로 간주)
      return !rowProcess || rowProcess === '조립'
    })

    // 설비별 불량 합계
    const equipmentMap = new Map<string, number>()

    packagingData.forEach((row: Record<string, unknown>) => {
      const keys = Object.keys(row)
      const equipKey = keys.find(k =>
        k.includes('설비') || k.toLowerCase().includes('line') || k.includes('라인')
      )
      const defectKey = keys.find(k => k.includes('불량수량') || k.includes('불량'))
      const scrapKey = keys.find(k => k.includes('폐기수량') || k.includes('폐기'))

      if (equipKey) {
        const equip = String(row[equipKey] || '').trim()
        const defect = parseNumber(row[defectKey || ''] as string | number)
        const scrap = parseNumber(row[scrapKey || ''] as string | number)
        const total = defect + scrap

        if (equip && total > 0) {
          equipmentMap.set(equip, (equipmentMap.get(equip) || 0) + total)
        }
      }
    })

    // TOP N 추출
    const sorted = Array.from(equipmentMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, criteria.packagingDefectTop)

    sorted.forEach(([equipment, total], index) => {
      const severity: Severity = index === 0 ? 'critical' : index < 2 ? 'warning' : 'caution'
      issues.push({
        id: `pkg-조립-${equipment}`,
        process: '조립',
        equipment,
        metric: '검포장불량',
        currentValue: total,
        threshold: 0,
        diff: total,
        severity,
        detail: `불량+폐기 ${total.toLocaleString()}개`
      })
    })

    return issues
  }, [data.packagingStatusData, criteria.packagingDefectTop])

  // 공정 필터링
  const filterByProcess = (issues: Issue[]) => {
    if (processFilter === 'all') return issues
    return issues.filter(i => i.process === processFilter)
  }

  // 심각도별 아이콘
  const getSeverityIcon = (severity: Severity) => {
    switch (severity) {
      case 'critical': return '🔴'
      case 'warning': return '🟠'
      case 'caution': return '🟡'
    }
  }

  // 심각도별 스타일
  const getSeverityStyle = (severity: Severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-200 text-red-700'
      case 'warning': return 'bg-orange-50 border-orange-200 text-orange-700'
      case 'caution': return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🚨 중점관리항목
            </h1>
            <p className="text-red-100 mt-1">
              2025년 {selectedMonth}월 기준 · 생산성/품질 이슈 현황
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* 공정 필터 */}
            <select
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              className="bg-white/20 text-white px-3 py-2 rounded-lg border border-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="all" className="text-gray-900">전체 공정</option>
              <option value="사출" className="text-gray-900">사출</option>
              <option value="도장" className="text-gray-900">도장</option>
              <option value="인쇄" className="text-gray-900">인쇄</option>
              <option value="조립" className="text-gray-900">조립</option>
            </select>

            {/* 관리수준 프리셋 */}
            <div className="flex bg-white/20 rounded-lg p-1">
              {(['strict', 'normal', 'loose'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePresetChange(p)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    preset === p
                      ? 'bg-white text-red-600 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {p === 'strict' ? '엄격' : p === 'normal' ? '보통' : '관대'}
                </button>
              ))}
              <button
                onClick={openSettingsModal}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  preset === 'custom'
                    ? 'bg-white text-red-600 shadow'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                ⚙️ 사용자정의
              </button>
            </div>
          </div>
        </div>

        {/* 현재 적용 기준 */}
        <div className="mt-4 flex items-center gap-4 text-sm text-red-100">
          <span className="bg-white/20 px-3 py-1 rounded-full">
            가동율 &lt; {criteria.operationRateThreshold}%
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full">
            CT초과 &gt; {criteria.ctExcessThreshold}%
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full">
            불량률 &gt; {criteria.defectRateThreshold}%
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full">
            자재불량 TOP {criteria.materialDefectTop}
          </span>
        </div>
      </div>

      {/* 이슈 보드 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 생산성 이슈 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 text-white px-5 py-3">
            <h2 className="font-semibold flex items-center gap-2">
              ⚡ 생산성 이슈
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {filterByProcess(operationRateIssues).length + filterByProcess(ctExcessIssues).length}건
              </span>
            </h2>
          </div>

          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {/* 가동율 미달 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                시간가동율 미달
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                  {filterByProcess(operationRateIssues).length}건
                </span>
              </h3>
              {filterByProcess(operationRateIssues).length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">
                  ✓ 이슈 없음
                </div>
              ) : (
                <div className="space-y-2">
                  {filterByProcess(operationRateIssues).map(issue => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border ${getSeverityStyle(issue.severity)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getSeverityIcon(issue.severity)}</span>
                          <span className="font-medium">{issue.process}</span>
                          <span className="text-slate-400">·</span>
                          <span>{issue.equipment}</span>
                        </div>
                        <span className="font-bold text-lg">
                          {issue.currentValue.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs mt-1 opacity-75">
                        {issue.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CT 초과 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                CT 초과
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                  {filterByProcess(ctExcessIssues).length}건
                </span>
              </h3>
              {filterByProcess(ctExcessIssues).length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">
                  ✓ 이슈 없음
                </div>
              ) : (
                <div className="space-y-2">
                  {filterByProcess(ctExcessIssues).map(issue => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border ${getSeverityStyle(issue.severity)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getSeverityIcon(issue.severity)}</span>
                          <span className="font-medium">{issue.process}</span>
                          <span className="text-slate-400">·</span>
                          <span>{issue.product}</span>
                        </div>
                        <span className="font-bold text-lg">
                          +{issue.currentValue.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs mt-1 opacity-75">
                        {issue.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 품질 이슈 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-red-600 text-white px-5 py-3">
            <h2 className="font-semibold flex items-center gap-2">
              🔍 품질 이슈
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {filterByProcess(defectRateIssues).length +
                 filterByProcess(materialDefectIssues).length +
                 filterByProcess(packagingDefectIssues).length}건
              </span>
            </h2>
          </div>

          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {/* 불량률 과다 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                불량률 과다
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                  {filterByProcess(defectRateIssues).length}건
                </span>
              </h3>
              {filterByProcess(defectRateIssues).length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">
                  ✓ 이슈 없음
                </div>
              ) : (
                <div className="space-y-2">
                  {filterByProcess(defectRateIssues).map(issue => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border ${getSeverityStyle(issue.severity)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getSeverityIcon(issue.severity)}</span>
                          <span className="font-medium">{issue.process}</span>
                          <span className="text-slate-400">·</span>
                          <span>{issue.equipment}</span>
                        </div>
                        <span className="font-bold text-lg">
                          {issue.currentValue.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs mt-1 opacity-75">
                        {issue.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 자재불량 다발 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                자재불량 다발 (조립)
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                  TOP {criteria.materialDefectTop}
                </span>
              </h3>
              {filterByProcess(materialDefectIssues).length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">
                  ✓ 데이터 없음
                </div>
              ) : (
                <div className="space-y-2">
                  {filterByProcess(materialDefectIssues).map(issue => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border ${getSeverityStyle(issue.severity)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getSeverityIcon(issue.severity)}</span>
                          <span>{issue.product}</span>
                        </div>
                        <span className="font-bold text-lg">
                          {issue.currentValue.toLocaleString()}개
                        </span>
                      </div>
                      {issue.detail && (
                        <div className="text-xs mt-1 opacity-75">
                          {issue.detail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 검포장 불량 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                검포장 불량 (조립)
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                  TOP {criteria.packagingDefectTop}
                </span>
              </h3>
              {filterByProcess(packagingDefectIssues).length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">
                  ✓ 데이터 없음
                </div>
              ) : (
                <div className="space-y-2">
                  {filterByProcess(packagingDefectIssues).map(issue => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border ${getSeverityStyle(issue.severity)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getSeverityIcon(issue.severity)}</span>
                          <span>{issue.equipment}</span>
                        </div>
                        <span className="font-bold text-lg">
                          {issue.currentValue.toLocaleString()}개
                        </span>
                      </div>
                      <div className="text-xs mt-1 opacity-75">
                        {issue.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
          <div className="text-3xl font-bold text-red-600">
            {filterByProcess(operationRateIssues).length}
          </div>
          <div className="text-sm text-slate-500 mt-1">가동율 미달</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
          <div className="text-3xl font-bold text-orange-600">
            {filterByProcess(ctExcessIssues).length}
          </div>
          <div className="text-sm text-slate-500 mt-1">CT 초과</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
          <div className="text-3xl font-bold text-yellow-600">
            {filterByProcess(defectRateIssues).length}
          </div>
          <div className="text-sm text-slate-500 mt-1">불량률 과다</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
          <div className="text-3xl font-bold text-purple-600">
            {filterByProcess(materialDefectIssues).length}
          </div>
          <div className="text-sm text-slate-500 mt-1">자재불량 TOP</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
          <div className="text-3xl font-bold text-blue-600">
            {filterByProcess(packagingDefectIssues).length}
          </div>
          <div className="text-sm text-slate-500 mt-1">검포장불량 TOP</div>
        </div>
      </div>

      {/* 설정 모달 */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-hidden">
            <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold">⚙️ 기준 설정</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 프리셋 선택 */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  프리셋 선택
                </label>
                <div className="flex gap-2">
                  {(['strict', 'normal', 'loose', 'custom'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        if (p !== 'custom') {
                          setTempCriteria(PRESETS[p])
                        }
                      }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        (p === 'custom' ?
                          JSON.stringify(tempCriteria) !== JSON.stringify(PRESETS.strict) &&
                          JSON.stringify(tempCriteria) !== JSON.stringify(PRESETS.normal) &&
                          JSON.stringify(tempCriteria) !== JSON.stringify(PRESETS.loose)
                          : JSON.stringify(tempCriteria) === JSON.stringify(PRESETS[p]))
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p === 'strict' ? '엄격' : p === 'normal' ? '보통' : p === 'loose' ? '관대' : '사용자정의'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 세부 기준 */}
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-slate-700 mb-3 block">
                  세부 기준
                </label>

                <div className="space-y-4">
                  {/* 생산성 */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-slate-600 mb-3">생산성</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">시간가동율 미달 기준</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={tempCriteria.operationRateThreshold}
                            onChange={(e) => setTempCriteria({
                              ...tempCriteria,
                              operationRateThreshold: Number(e.target.value)
                            })}
                            className="w-20 px-3 py-1.5 border rounded-lg text-right text-sm"
                          />
                          <span className="text-sm text-slate-500">% 미만</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">CT 초과 기준</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={tempCriteria.ctExcessThreshold}
                            onChange={(e) => setTempCriteria({
                              ...tempCriteria,
                              ctExcessThreshold: Number(e.target.value)
                            })}
                            className="w-20 px-3 py-1.5 border rounded-lg text-right text-sm"
                          />
                          <span className="text-sm text-slate-500">% 이상</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 품질 */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-slate-600 mb-3">품질</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">불량률 과다 기준</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={tempCriteria.defectRateThreshold}
                            onChange={(e) => setTempCriteria({
                              ...tempCriteria,
                              defectRateThreshold: Number(e.target.value)
                            })}
                            className="w-20 px-3 py-1.5 border rounded-lg text-right text-sm"
                            step="0.5"
                          />
                          <span className="text-sm text-slate-500">% 이상</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">자재불량 표시</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={tempCriteria.materialDefectTop}
                            onChange={(e) => setTempCriteria({
                              ...tempCriteria,
                              materialDefectTop: Number(e.target.value)
                            })}
                            className="w-20 px-3 py-1.5 border rounded-lg text-right text-sm"
                            min="1"
                            max="10"
                          />
                          <span className="text-sm text-slate-500">건</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">검포장불량 표시</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={tempCriteria.packagingDefectTop}
                            onChange={(e) => setTempCriteria({
                              ...tempCriteria,
                              packagingDefectTop: Number(e.target.value)
                            })}
                            className="w-20 px-3 py-1.5 border rounded-lg text-right text-sm"
                            min="1"
                            max="10"
                          />
                          <span className="text-sm text-slate-500">건</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-between">
              <button
                onClick={resetToDefault}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                기본값으로 복원
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  취소
                </button>
                <button
                  onClick={applySettings}
                  className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
