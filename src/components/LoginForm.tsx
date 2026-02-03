'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

type Mode = 'login' | 'signup' | 'reset'

export default function LoginForm() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await signIn(email, password)
        if (!result.success) setError(result.error || '로그인 실패')
      } else if (mode === 'signup') {
        const result = await signUp(email, password, displayName)
        if (result.success) {
          setMessage(result.message || '회원가입 완료')
          setMode('login')
        } else {
          setError(result.error || '회원가입 실패')
        }
      } else if (mode === 'reset') {
        const result = await resetPassword(email)
        if (result.success) {
          setMessage(result.message || '이메일 발송 완료')
          setMode('login')
        } else {
          setError(result.error || '이메일 발송 실패')
        }
      }
    } catch (err) {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">신성오토텍</h1>
          <p className="text-gray-500 mt-1">생산실 대시보드</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
          )}
          {message && (
            <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm">{message}</div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="이름을 입력하세요"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="email@example.com"
              required
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '비밀번호 재설정'}
          </button>
        </form>

        {/* Mode Toggle */}
        <div className="mt-6 text-center text-sm">
          {mode === 'login' && (
            <>
              <button onClick={() => setMode('signup')} className="text-blue-500 hover:underline">
                회원가입
              </button>
              <span className="mx-2 text-gray-400">|</span>
              <button onClick={() => setMode('reset')} className="text-blue-500 hover:underline">
                비밀번호 찾기
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button onClick={() => setMode('login')} className="text-blue-500 hover:underline">
              로그인으로 돌아가기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
