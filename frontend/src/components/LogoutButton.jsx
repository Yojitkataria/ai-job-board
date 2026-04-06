import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

export function LogoutButton() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type="button" className="auth-button secondary" onClick={handleClick} disabled={loading}>
      {loading ? 'Signing out…' : 'Log out'}
    </button>
  )
}
