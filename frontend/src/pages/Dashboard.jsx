import { useAuth } from '../context/useAuth.js'
import { LogoutButton } from '../components/LogoutButton.jsx'

export function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="auth-page dashboard">
      <div className="auth-card dashboard-card">
        <h1>Dashboard</h1>
        <p className="dashboard-email">
          Signed in as <strong>{user?.email ?? '—'}</strong>
        </p>
        <div className="dashboard-actions">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
