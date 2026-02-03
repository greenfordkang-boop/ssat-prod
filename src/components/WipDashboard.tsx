'use client'

import { useData } from '@/contexts/DataContext'
import { formatNumber } from '@/lib/utils'
import FileUploader from './FileUploader'

interface WipDashboardProps {
  subTab: string
}

export default function WipDashboard({ subTab }: WipDashboardProps) {
  const { data, selectedMonth } = useData()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-blue-500 rounded" />
          <h2 className="text-xl font-bold text-gray-900">
            {selectedMonth}월 {subTab === 'status' ? '재공재고 현황' : '부품단가표'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {subTab === 'status' && (
            <FileUploader dataType="wipInventoryData" label="재공재고" />
          )}
          {subTab === 'price' && (
            <FileUploader dataType="priceData" label="단가표" />
          )}
        </div>
      </div>

      {subTab === 'status' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="text-base font-semibold mb-4">재공재고 현황</h3>

          {data.wipInventoryData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>재공재고 데이터를 업로드해주세요</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {Object.keys(data.wipInventoryData[0] || {})
                      .filter(key => key !== 'id')
                      .slice(0, 10)
                      .map(key => (
                        <th key={key} className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {data.wipInventoryData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {Object.entries(row)
                        .filter(([key]) => key !== 'id')
                        .slice(0, 10)
                        .map(([key, value], colIdx) => (
                          <td key={colIdx} className="px-4 py-3 whitespace-nowrap">
                            {typeof value === 'number' ? formatNumber(value) : String(value || '')}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.wipInventoryData.length > 50 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  총 {formatNumber(data.wipInventoryData.length)}건 중 50건 표시
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {subTab === 'price' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="text-base font-semibold mb-4">부품단가표</h3>

          {data.priceData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>부품단가표 데이터를 업로드해주세요</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {Object.keys(data.priceData[0] || {})
                      .filter(key => key !== 'id')
                      .slice(0, 10)
                      .map(key => (
                        <th key={key} className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {data.priceData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {Object.entries(row)
                        .filter(([key]) => key !== 'id')
                        .slice(0, 10)
                        .map(([key, value], colIdx) => (
                          <td key={colIdx} className="px-4 py-3 whitespace-nowrap">
                            {typeof value === 'number' ? formatNumber(value) : String(value || '')}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.priceData.length > 50 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  총 {formatNumber(data.priceData.length)}건 중 50건 표시
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
