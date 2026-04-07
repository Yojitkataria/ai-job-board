import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthenticatedRoleRedirect } from '../components/AuthenticatedRoleRedirect.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchProfileAndNavigate } from '../lib/profileNavigation.js'
import { useAuth } from '../context/useAuth.js'

const ROLES = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'recruiter', label: 'Recruiter' },
]

export function Signup() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('candidate')
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
    setError(null)
    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (signUpError) {
        setError(signUpError.message)
        return
      }

      const user = data.user
      if (!user) {
        setError('Sign up did not return a user.')
        return
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        name: name.trim(),
        role,
      })
      if (profileError) {
        setError(profileError.message)
        return
      }

      const { error: profileNavError } = await fetchProfileAndNavigate(
        navigate,
        user,
      )
      if (profileNavError) {
        setError(profileNavError.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sign up</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Name</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </label>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
          </label>
          <label className="auth-field">
            <span>Role</span>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              disabled={loading}
            >
              {ROLES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
