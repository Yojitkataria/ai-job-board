import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/useAuth.js'
import { LogoutButton } from '../components/LogoutButton.jsx'

export function Jobs() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function applyToJob(jobId) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      alert('You must be logged in to apply.')
      return
    }

    const { error: applyError } = await supabase.from('applications').insert({
      job_id: jobId,
      candidate_id: authUser.id,
    })

    if (applyError) {
      if (applyError.message.includes('unique_job_candidate')) {
        alert('You already applied to this job')
      } else {
        alert(applyError.message)
      }
      return
    }

    alert('Applied successfully')
  }

  useEffect(() => {
    let cancelled = false

    async function loadJobs() {
      setError(null)
      setLoading(true)
      const { data, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (jobsError) {
        setError(jobsError.message)
        setJobs([])
      } else {
        setJobs(data ?? [])
      }
      setLoading(false)
    }

    loadJobs()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="auth-page dashboard">
      <div className="auth-card dashboard-card">
        <h1>Jobs</h1>
        <p className="dashboard-email">
          Signed in as <strong>{user?.email ?? '—'}</strong>
        </p>
        {loading ? (
          <p className="auth-status">Loading jobs…</p>
        ) : error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : jobs.length === 0 ? (
          <p className="auth-info">No jobs yet.</p>
        ) : (
          <ul className="jobs-list">
            {jobs.map((job) => (
              <li key={job.id} className="job-card">
                <h2 className="job-title">{job.title}</h2>
                <p className="job-meta">
                  <span className="job-company">{job.company}</span>
                  {' · '}
                  <span className="job-location">{job.location}</span>
                </p>
                <p className="job-description">{job.description}</p>
                <div className="job-actions">
                  <button
                    type="button"
                    className="auth-button secondary"
                    onClick={() => applyToJob(job.id)}
                  >
                    Apply
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="dashboard-actions">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
