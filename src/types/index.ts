// 사용자 프로필
export interface UserProfile {
  id: string
  email: string
  display_name: string
  role: 'admin' | 'viewer'
  approved: boolean
  is_active: boolean
  last_login?: string
  created_at?: string
}

// 생산 데이터
export interface ProductionData {
  id?: number
  사업장?: string
  생산구분?: string
  생산일자?: string
  공정?: string
  공정구분?: string
  품종?: string
  품목코드?: string
  '고객사 P/N'?: string
  품목명?: string
  규격?: string
  단위?: string
  고객사?: string
  협력업체?: string
  재질코드1?: string
  재질코드2?: string
  퍼징중량1?: string
  퍼징중량2?: string
  '표준C/T'?: string
  '실제C/T'?: string
  사용Cavity?: string
  생산Shot수?: string
  안전재고?: string
  검사유형?: string
  조달구분?: string
  '생산 Lot No'?: string
  '설비(라인)코드'?: string
  '설비(라인)명'?: string
  시작시간?: string
  종료일자?: string
  종료시간?: string
  '작업시간(분)'?: string
  작업인원?: string
  생산수량?: string
  양품수량?: string
  불량수량?: string
  폐기수량?: string
  불량율?: string
  폐기율?: string
  UPH?: string
  UPPH?: string
  작업자?: string
  특이사항?: string
  month?: number
  [key: string]: string | number | undefined
}

// 가동율 데이터
export interface AvailabilityData {
  id?: number
  [key: string]: string | number | undefined
}

// CT 데이터
export interface CTData {
  id?: number
  [key: string]: string | number | undefined
}

// 상세 데이터
export interface DetailData {
  id?: number
  [key: string]: string | number | undefined
}

// 자재불량 데이터
export interface MaterialDefectData {
  id?: number
  [key: string]: string | number | undefined
}

// 재공재고 데이터
export interface WipInventoryData {
  id?: number
  [key: string]: string | number | undefined
}

// 불량수리현황 데이터
export interface RepairStatusData {
  id?: number
  [key: string]: string | number | undefined
}

// 검포장현황 데이터
export interface PackagingStatusData {
  id?: number
  [key: string]: string | number | undefined
}

// 단가표 데이터
export interface PriceData {
  id?: number
  [key: string]: string | number | undefined
}

// 금형현황 데이터
export interface MoldStatusData {
  id?: number
  PLANT?: string
  CODE?: string
  금형번호?: string
  고객사명?: string
  금형구분?: string
  '품종(MODEL)'?: string
  부품코드?: string
  '고객사 P/N'?: string
  부품명?: string
  '수주(인수)일자'?: string
  금형등급?: string
  CORE재질?: string
  금형보증SHOT수?: number
  금형사용SHOT수?: number
  금형사용율?: number
  점검주기?: number
  사용SHOT수?: number
  '세척/연마율'?: number
  [key: string]: string | number | undefined
}

// 금형수리현황 데이터
export interface MoldRepairData {
  id?: number
  금형번호?: string
  고객사명?: string
  금형구분?: string
  '품종(MODEL)'?: string
  부품코드?: string
  '고객사 P/N'?: string
  부품명?: string
  금형등급?: string
  금형보증SHOT수?: number
  금형사용SHOT수?: number
  점검주기?: number
  순번?: number
  구분?: string
  유형?: string
  수리일자?: string
  고객요구일?: string
  예상수리일?: string
  수리업체?: string
  수리금액?: number
  금형수리내용?: string
  [key: string]: string | number | undefined
}

// 전체 데이터 상태
export interface DashboardData {
  rawData: ProductionData[]
  availabilityData: AvailabilityData[]
  detailData: DetailData[]
  ctData: CTData[]
  materialDefectData: MaterialDefectData[]
  wipInventoryData: WipInventoryData[]
  repairStatusData: RepairStatusData[]
  packagingStatusData: PackagingStatusData[]
  priceData: PriceData[]
  moldStatusData: MoldStatusData[]
  moldRepairData: MoldRepairData[]
}

// 필터 상태
export interface FilterState {
  process: string
  equipment: string
  product: string
}

// 피봇 설정
export interface PivotConfig {
  rows: string[]
  cols: string[]
  values: string
  aggFunc: 'sum' | 'count' | 'avg'
}

// 네비게이션 탭
export type MainTab = 'overview' | 'upload' | 'process' | 'downtime' | 'wip'
export type ProcessTab = 'injection' | 'painting' | 'printing' | 'assembly'
export type SubMenu = 'production' | 'uph' | 'cycletime' | 'packaging' | 'defect-repair' | 'material-defect'
export type WipSubTab = 'status' | 'price'

// 데이터 타입 키
export type DataType =
  | 'rawData'
  | 'availabilityData'
  | 'detailData'
  | 'ctData'
  | 'materialDefectData'
  | 'wipInventoryData'
  | 'repairStatusData'
  | 'packagingStatusData'
  | 'priceData'
  | 'moldStatusData'
  | 'moldRepairData'
