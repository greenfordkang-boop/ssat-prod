'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { supabase, TABLE_MAPPING, JSONB_TABLES } from '@/lib/supabase'
import {
  DashboardData,
  ProductionData,
  AvailabilityData,
  DetailData,
  CTData,
  MaterialDefectData,
  WipInventoryData,
  RepairStatusData,
  PackagingStatusData,
  PriceData,
  FilterState,
  PivotConfig
} from '@/types'
import { useAuth } from './AuthContext'

interface DataContextType {
  data: DashboardData
  loading: boolean
  syncing: boolean
  selectedMonth: number
  filters: FilterState
  pivot: PivotConfig
  setSelectedMonth: (month: number) => void
  setFilters: (filters: FilterState) => void
  setPivot: (pivot: PivotConfig) => void
  uploadData: (type: keyof typeof TABLE_MAPPING, newData: unknown[], months?: number[]) => Promise<boolean>
  refreshData: () => Promise<void>
  clearData: (type?: keyof typeof TABLE_MAPPING) => Promise<void>
  getFilteredData: () => ProductionData[]
}

const initialData: DashboardData = {
  rawData: [],
  availabilityData: [],
  detailData: [],
  ctData: [],
  materialDefectData: [],
  wipInventoryData: [],
  repairStatusData: [],
  packagingStatusData: [],
  priceData: []
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData>(initialData)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [filters, setFilters] = useState<FilterState>({ process: 'all', equipment: 'all', product: 'all' })
  const [pivot, setPivot] = useState<PivotConfig>({ rows: '공정', cols: '품종', values: '생산수량', aggFunc: 'sum' })

  // snake_case → camelCase 변환
  const toCamelCase = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const key in obj) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      let value = obj[key]
      if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
        try { value = JSON.parse(value) } catch { /* ignore */ }
      }
      result[camelKey] = value
    }
    return result
  }

  // Supabase에서 데이터 로드
  const loadFromSupabase = async (tableName: string): Promise<unknown[]> => {
    try {
      const { data: result, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(10000)

      if (error) throw error
      if (!result) return []

      // JSONB 테이블 처리
      if (JSONB_TABLES.includes(tableName)) {
        if (result.length > 0 && result[0].data !== undefined) {
          return result.map(row => row.data).filter(Boolean)
        }
        return result.map(toCamelCase)
      }
      return result.map(toCamelCase)
    } catch (e) {
      console.error(`로드 실패 (${tableName}):`, e)
      return []
    }
  }

  // Supabase에 데이터 저장 (완전 교체)
  const saveToSupabase = async (tableName: string, items: unknown[]): Promise<boolean> => {
    if (!items || items.length === 0) return true

    try {
      // 기존 데이터 삭제
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .neq('id', 0)

      if (deleteError) throw deleteError

      // 새 데이터 준비 - 빈 키 필터링 추가
      let insertData: Record<string, unknown>[]
      if (JSONB_TABLES.includes(tableName)) {
        insertData = items.map(item => ({ data: item }))
      } else {
        insertData = items.map(item => {
          const result: Record<string, unknown> = {}
          const obj = item as Record<string, unknown>
          for (const key in obj) {
            // 빈 키 건너뛰기
            if (!key || key.trim() === '') continue

            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
            // 빈 snake_key도 건너뛰기
            if (!snakeKey || snakeKey.trim() === '' || snakeKey === '_') continue

            const value = obj[key]
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              result[snakeKey] = JSON.stringify(value)
            } else {
              result[snakeKey] = value
            }
          }
          return result
        })
      }

      // 배치 처리 (500건씩)
      const BATCH_SIZE = 500
      for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
        const batch = insertData.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from(tableName).insert(batch)
        if (error) throw error
        console.log(`저장 완료: ${tableName} ${i + batch.length}/${insertData.length}건`)
      }

      return true
    } catch (e) {
      console.error(`저장 실패 (${tableName}):`, e)
      return false
    }
  }

  // 전체 데이터 새로고침 (수동 호출용)
  const refreshData = useCallback(async () => {
    if (!user || loading) return // 이미 로딩 중이면 중복 호출 방지

    setLoading(true)
    try {
      const results: Partial<DashboardData> = {}

      for (const [stateKey, tableName] of Object.entries(TABLE_MAPPING)) {
        const loaded = await loadFromSupabase(tableName)
        results[stateKey as keyof DashboardData] = loaded as never
        console.log(`🔄 ${tableName}: ${loaded.length}건 새로고침`)
      }

      setData(prev => ({ ...prev, ...results }))
    } catch (e) {
      console.error('데이터 새로고침 실패:', e)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading])

  // 데이터 업로드 (핵심 함수 - 충돌 방지)
  const uploadData = async (
    type: keyof typeof TABLE_MAPPING,
    newData: unknown[],
    months?: number[]
  ): Promise<boolean> => {
    if (!user) return false

    setSyncing(true)
    try {
      const tableName = TABLE_MAPPING[type]
      let finalData: unknown[]

      if (type === 'rawData' && months && months.length > 0) {
        // 월별 데이터 병합: 기존 데이터에서 해당 월 제거 후 새 데이터 추가
        const existingData = data.rawData.filter(item => {
          const itemMonth = getMonthFromDate(item.생산일자)
          return !months.includes(itemMonth)
        })
        finalData = [...existingData, ...newData]
        console.log(`📊 업로드: 기존 ${existingData.length}건 + 신규 ${newData.length}건 = 총 ${finalData.length}건`)
      } else {
        finalData = newData
      }

      // Supabase에 저장
      const success = await saveToSupabase(tableName, finalData)

      if (success) {
        // 로컬 상태 업데이트
        setData(prev => ({
          ...prev,
          [type]: finalData
        }))
        console.log(`✅ 업로드 완료: ${tableName} (${finalData.length}건)`)
        return true
      }

      return false
    } catch (e) {
      console.error('업로드 실패:', e)
      return false
    } finally {
      setSyncing(false)
    }
  }

  // 데이터 삭제
  const clearData = async (type?: keyof typeof TABLE_MAPPING) => {
    if (!user) return

    setSyncing(true)
    try {
      if (type) {
        const tableName = TABLE_MAPPING[type]
        await supabase.from(tableName).delete().neq('id', 0)
        setData(prev => ({ ...prev, [type]: [] }))
      } else {
        // 전체 삭제
        for (const tableName of Object.values(TABLE_MAPPING)) {
          await supabase.from(tableName).delete().neq('id', 0)
        }
        setData(initialData)
      }
    } catch (e) {
      console.error('삭제 실패:', e)
    } finally {
      setSyncing(false)
    }
  }

  // 필터링된 데이터 반환
  const getFilteredData = useCallback((): ProductionData[] => {
    let filtered = data.rawData

    // 월 필터링
    filtered = filtered.filter(item => {
      const month = getMonthFromDate(item.생산일자)
      return month === selectedMonth
    })

    // 공정 필터
    if (filters.process !== 'all') {
      filtered = filtered.filter(item => item.공정 === filters.process)
    }

    // 설비 필터
    if (filters.equipment !== 'all') {
      filtered = filtered.filter(item => item['설비(라인)명'] === filters.equipment)
    }

    // 품종 필터
    if (filters.product !== 'all') {
      filtered = filtered.filter(item => item.품종 === filters.product)
    }

    return filtered
  }, [data.rawData, selectedMonth, filters])

  // 날짜에서 월 추출
  const getMonthFromDate = (dateStr?: string): number => {
    if (!dateStr) return 0
    const match = dateStr.match(/\d{4}-(\d{2})-\d{2}/)
    return match ? parseInt(match[1], 10) : 0
  }

  // 초기 데이터 로드 (user 변경 시에만)
  useEffect(() => {
    let isMounted = true

    const loadInitialData = async () => {
      if (!user || loading) return

      setLoading(true)
      try {
        const results: Partial<DashboardData> = {}

        for (const [stateKey, tableName] of Object.entries(TABLE_MAPPING)) {
          if (!isMounted) return
          const loaded = await loadFromSupabase(tableName)
          results[stateKey as keyof DashboardData] = loaded as never
          console.log(`📥 ${tableName}: ${loaded.length}건 로드`)
        }

        if (isMounted) {
          setData(prev => ({ ...prev, ...results }))
        }
      } catch (e) {
        console.error('데이터 로드 실패:', e)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]) // user만 dependency - 무한 루프 방지

  return (
    <DataContext.Provider value={{
      data,
      loading,
      syncing,
      selectedMonth,
      filters,
      pivot,
      setSelectedMonth,
      setFilters,
      setPivot,
      uploadData,
      refreshData,
      clearData,
      getFilteredData
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
