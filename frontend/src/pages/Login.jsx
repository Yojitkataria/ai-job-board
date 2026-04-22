import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthenticatedRoleRedirect } from '../components/AuthenticatedRoleRedirect.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchProfileAndNavigate } from '../lib/profileNavigation.js'
import { useAuth } from '../context/useAuth.js'

export function Login() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (authLoading) {
    return (
      <div className="auth-page">
        <p className="auth-status">Loading…</p>
      </div>
    )
  }

  if (session) {
    return <AuthenticatedRoleRedirect />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const cleanEmail = email.trim()
    const cleanPassword = password.trim()

    if (!cleanEmail || !cleanPassword) {
      setError('Email and password are required.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        })
      if (signInError) {
        setError(signInError.message)
        return
      }
      const user = signInData.user
      if (!user) {
        setError('Sign in did not return a user.')
        return
      }
      const { error: profileError } = await fetchProfileAndNavigate(
        navigate,
        user,
      )
      if (profileError) {
        setError(profileError.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Log in</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          {error ? (
            <p className="auth-error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-footer">
          No account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
