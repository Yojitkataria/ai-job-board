import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { supabase } from '../lib/supabase.js'
import { useEffect, useState } from 'react'

export function ProtectedRoute({ children, requiredRole }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [role, setRole] = useState(null)
  const [roleLoading, setRoleLoading] = useState(false)
  const [roleError, setRoleError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadRole() {
      if (!session?.user?.id || !requiredRole) {
        setRole(null)
        setRoleError(null)
        setRoleLoading(false)
        return
      }

      setRoleLoading(true)
      setRoleError(null)

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .limit(1)

      if (cancelled) return

      if (error) {
        setRoleError(error.message)
        setRole(null)
      } else {
        setRole(data?.[0]?.role ?? null)
      }

      setRoleLoading(false)
    }

    loadRole()

    return () => {
      cancelled = true
    }
  }, [session?.user?.id, requiredRole])

  if (loading || roleLoading) {
    return (
      <div className="auth-page">
        <p className="auth-status">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole) {
    if (roleError) {
      return (
        <div className="auth-page">
          <div className="auth-card">
            <p className="auth-error" role="alert">
              {roleError}
            </p>
          </div>
        </div>
      )
    }

    if (!role || role !== requiredRole) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}
