'use client'

import { useRef, useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { TABLE_MAPPING } from '@/lib/supabase'
import { parseCSV, getMonthFromDate } from '@/lib/utils'
import * as XLSX from 'xlsx'

// 엑셀 파일 파싱 함수
const parseExcel = (buffer: ArrayBuffer): Record<string, unknown>[] => {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
  return jsonData as Record<string, unknown>[]
}

interface FileUploaderProps {
  dataType: keyof typeof TABLE_MAPPING
  label: string
  accept?: string
}

export default function FileUploader({ dataType, label, accept = '.csv,.xlsx,.xls' }: FileUploaderProps) {
  const { uploadData, syncing } = useData()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setStatus({ type: '', message: '' })

    try {
      // 파일 확장자 확인
      const ext = file.name.split('.').pop()?.toLowerCase()
      let parsedData: Record<string, unknown>[]

      if (ext === 'xlsx' || ext === 'xls') {
        // 엑셀 파일 파싱
        const buffer = await file.arrayBuffer()
        parsedData = parseExcel(buffer)
      } else if (ext === 'csv') {
        // CSV 파일 파싱
        const text = await file.text()
        parsedData = parseCSV(text)
      } else {
        setStatus({ type: 'error', message: '지원하지 않는 파일 형식입니다.' })
        return
      }

      if (parsedData.length === 0) {
        setStatus({ type: 'error', message: '데이터가 없습니다.' })
        return
      }

      // 월 추출 (생산데이터의 경우)
      let months: number[] = []
      if (dataType === 'rawData') {
        const monthSet = new Set<number>()
        parsedData.forEach(row => {
          const dateValue = row['생산일자']
          const month = getMonthFromDate(typeof dateValue === 'string' ? dateValue : String(dateValue || ''))
          if (month > 0) monthSet.add(month)
        })
        months = Array.from(monthSet)
        console.log('📅 업로드 월:', months)
      }

      // 업로드
      const success = await uploadData(dataType, parsedData, months)

      if (success) {
        setStatus({
          type: 'success',
          message: `✅ ${parsedData.length}건 업로드 완료 (${file.name})`
        })
      } else {
        setStatus({ type: 'error', message: '업로드 실패' })
      }
    } catch (err) {
      console.error('파일 처리 오류:', err)
      setStatus({ type: 'error', message: '파일 처리 중 오류 발생' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        id={`upload-${dataType}`}
      />
      <label
        htmlFor={`upload-${dataType}`}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition ${
          uploading || syncing
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
        }`}
      >
        {uploading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            업로드 중...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {label}
          </>
        )}
      </label>
      {status.message && (
        <span className={`text-xs ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {status.message}
        </span>
      )}
    </div>
  )
}
