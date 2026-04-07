import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { fetchProfileAndNavigate } from '../lib/profileNavigation.js'

export function AuthenticatedRoleRedirect() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    if (loading || !user) {
      return
    }
    let cancelled = false
    ;(async () => {
      const { error: profileError } = await fetchProfileAndNavigate(
        navigate,
        user,
      )
      if (cancelled) {
        return
      }
      if (profileError) {
        setError(profileError.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, user, navigate])

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-error" role="alert">
            {error}
          </p>
          <p className="auth-footer">
            <Link to="/dashboard">Go to dashboard</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <p className="auth-status">Loading…</p>
    </div>
  )
}
