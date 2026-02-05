import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gipksxojxdkqpyyiihcc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpcGtzeG9qeGRrcXB5eWlpaGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTExOTQsImV4cCI6MjA4NTI2NzE5NH0.ZE7kpdUUEW--Ggum7s3f6OJ4bm7CdKkW3yuAZldgrqg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const ADMIN_EMAIL = 'greenfordkang@gmail.com'

// 테이블명 매핑
export const TABLE_MAPPING = {
  rawData: 'production_data',
  availabilityData: 'availability_data',
  detailData: 'detail_data',
  ctData: 'ct_data',
  materialDefectData: 'material_defect_data',
  wipInventoryData: 'wip_inventory_data',
  repairStatusData: 'repair_status_data',
  packagingStatusData: 'packaging_status_data',
  priceData: 'price_data',
  moldStatusData: 'mold_status_data',
  moldRepairData: 'mold_repair_data'
} as const

// JSONB로 저장하는 테이블 (모든 테이블 - 컬럼명 문제 해결)
export const JSONB_TABLES = [
  'production_data',
  'availability_data',
  'detail_data',
  'ct_data',
  'material_defect_data',
  'wip_inventory_data',
  'repair_status_data',
  'packaging_status_data',
  'price_data',
  'mold_status_data',
  'mold_repair_data'
]
