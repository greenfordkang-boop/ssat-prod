'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, ADMIN_EMAIL } from '@/lib/supabase'
import { UserProfile } from '@/types'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ success: boolean; message?: string; error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.email === ADMIN_EMAIL

  // 사용자 프로필 로드
  const loadProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    } catch (e) {
      console.error('프로필 로드 실패:', e)
      return null
    }
  }

  // 접근 로그 기록
  const logAccess = async (action: string, details?: Record<string, unknown>) => {
    if (!user) return
    try {
      await supabase.from('access_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action,
        details,
        user_agent: navigator.userAgent
      })
    } catch (e) {
      console.warn('로그 기록 실패:', e)
    }
  }

  // 세션 체크
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const userProfile = await loadProfile(session.user.id)

          // 비활성화 또는 미승인 체크 (관리자 제외)
          if (session.user.email !== ADMIN_EMAIL) {
            if (!userProfile || !userProfile.approved || !userProfile.is_active) {
              await supabase.auth.signOut()
              setUser(null)
              setProfile(null)
              setLoading(false)
              return
            }
          }

          setUser(session.user)
          setProfile(userProfile)
        }
      } catch (e) {
        console.error('세션 체크 실패:', e)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Auth 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const userProfile = await loadProfile(session.user.id)
        setUser(session.user)
        setProfile(userProfile)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 로그인
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const userProfile = await loadProfile(data.user.id)

      // 관리자가 아닌 경우 승인 확인
      if (email !== ADMIN_EMAIL) {
        if (!userProfile || !userProfile.approved) {
          await supabase.auth.signOut()
          return { success: false, error: '관리자 승인 대기 중입니다. 승인 후 로그인이 가능합니다.' }
        }
      }

      setUser(data.user)
      setProfile(userProfile)
      await logAccess('login')

      // 마지막 로그인 시간 업데이트
      await supabase.from('user_profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id)

      return { success: true }
    } catch (e: unknown) {
      const error = e as Error
      return { success: false, error: error.message }
    }
  }

  // 회원가입
  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      })
      if (error) throw error

      // 프로필 생성
      if (data.user) {
        const isAdminUser = email === ADMIN_EMAIL
        await supabase.from('user_profiles').insert({
          id: data.user.id,
          email,
          display_name: displayName || email.split('@')[0],
          role: isAdminUser ? 'admin' : 'viewer',
          approved: isAdminUser,
          is_active: true
        })
      }

      if (email === ADMIN_EMAIL) {
        return { success: true, message: '관리자 계정이 생성되었습니다.' }
      }
      return { success: true, message: '회원가입이 완료되었습니다. 관리자 승인 후 로그인이 가능합니다.' }
    } catch (e: unknown) {
      const error = e as Error
      return { success: false, error: error.message }
    }
  }

  // 로그아웃
  const signOut = async () => {
    await logAccess('logout')
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  // 비밀번호 재설정
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      })
      if (error) throw error
      return { success: true, message: '비밀번호 재설정 이메일을 발송했습니다.' }
    } catch (e: unknown) {
      const error = e as Error
      return { success: false, error: error.message }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAdmin,
      signIn,
      signUp,
      signOut,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
