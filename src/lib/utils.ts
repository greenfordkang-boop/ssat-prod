// 숫자 포맷팅 (천단위 콤마)
export function formatNumber(num: number | string | undefined): string {
  if (num === undefined || num === null || num === '') return '0'
  const n = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num
  if (isNaN(n)) return '0'
  return n.toLocaleString('ko-KR')
}

// 콤팩트 숫자 포맷 (1,000 → 1K)
export function formatCompact(num: number | string | undefined): string {
  if (num === undefined || num === null || num === '') return '0'
  const n = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num
  if (isNaN(n)) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

// 퍼센트 포맷팅
export function formatPercent(num: number | string | undefined, decimals = 1): string {
  if (num === undefined || num === null || num === '') return '0%'
  const n = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num
  if (isNaN(n)) return '0%'
  return n.toFixed(decimals) + '%'
}

// 숫자 파싱 (콤마 제거)
export function parseNumber(str: string | number | undefined): number {
  if (str === undefined || str === null || str === '') return 0
  if (typeof str === 'number') return str
  const cleaned = str.replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// 날짜에서 월 추출
export function getMonthFromDate(dateStr: string | undefined): number {
  if (!dateStr) return 0
  const match = dateStr.match(/\d{4}-(\d{2})-\d{2}/)
  return match ? parseInt(match[1], 10) : 0
}

// 날짜에서 일 추출
export function getDayFromDate(dateStr: string | undefined): number {
  if (!dateStr) return 0
  const match = dateStr.match(/\d{4}-\d{2}-(\d{2})/)
  return match ? parseInt(match[1], 10) : 0
}

// 차트 색상
export const CHART_COLORS = {
  pastel: [
    'rgba(147, 197, 253, 0.85)',   // 파스텔 블루
    'rgba(110, 231, 183, 0.85)',   // 파스텔 그린
    'rgba(253, 186, 116, 0.85)',   // 파스텔 오렌지
    'rgba(252, 165, 165, 0.85)',   // 파스텔 레드
    'rgba(196, 181, 253, 0.85)',   // 파스텔 퍼플
    'rgba(253, 224, 71, 0.85)',    // 파스텔 옐로우
    'rgba(165, 243, 252, 0.85)',   // 파스텔 시안
    'rgba(251, 207, 232, 0.85)'    // 파스텔 핑크
  ],
  process: {
    사출: '#fdba74',
    도장: '#7dd3fc',
    인쇄: '#fcd34d',
    조립: '#c4b5fd'
  },
  status: {
    good: 'rgba(110, 231, 183, 0.85)',
    warning: 'rgba(253, 186, 116, 0.85)',
    bad: 'rgba(252, 165, 165, 0.85)'
  }
}

// 파스텔 색상 가져오기
export function getPastelColor(index: number): string {
  return CHART_COLORS.pastel[index % CHART_COLORS.pastel.length]
}

// 공정 데이터 매핑
export const PROCESS_MAPPING = {
  injection: '사출',
  painting: '도장',
  printing: '인쇄',
  assembly: '조립'
} as const

// 제외 공정
export const EXCLUDED_PROCESSES = ['Laser', 'LASER', 'laser']

// CSV 파싱 - 빈 헤더 필터링 추가
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  // 헤더 파싱 및 빈 헤더 필터링
  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''))
  const validHeaderIndices: number[] = []
  const headers: string[] = []

  rawHeaders.forEach((h, i) => {
    if (h && h.length > 0) {
      validHeaderIndices.push(i)
      headers.push(h)
    }
  })

  const data: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of lines[i]) {
      if (char === '"') inQuotes = !inQuotes
      else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      }
      else current += char
    }
    values.push(current.trim())

    const row: Record<string, string> = {}
    // 유효한 헤더 인덱스만 사용
    headers.forEach((header, idx) => {
      const valueIndex = validHeaderIndices[idx]
      row[header] = values[valueIndex] || ''
    })
    data.push(row)
  }

  return data
}

// 날짜 포맷팅
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return dateStr
  return `${match[2]}/${match[3]}`
}
