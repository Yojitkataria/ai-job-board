import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/useAuth.js'
import { LogoutButton } from '../components/LogoutButton.jsx'

export function Jobs() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [applying, setApplying] = useState({})
  const [appliedIds, setAppliedIds] = useState(new Set())

  const appliedJobIds = appliedIds

  function isDeadlinePassed(dateStr) {
    if (!dateStr) return false
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return false
    return d < new Date()
  }

  const availableJobs = jobs
    .filter(
      (j) =>
        !appliedJobIds.has(j.id) &&
        j.is_open !== false &&
        !isDeadlinePassed(j.deadline),
    )

  async function applyToJob(job) {
    if (applying[job.id] || appliedJobIds.has(job.id)) {
      return
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      alert('You must be logged in to apply.')
      return
    }

    setApplying((prev) => ({ ...prev, [job.id]: true }))
    try {
      const { error: applyError } = await supabase.from('applications').insert({
        job_id: job.id,
        candidate_id: authUser.id,
        status: 'applied',
      })

      if (applyError) {
        if (applyError.message.includes('unique_job_candidate')) {
          alert('You already applied to this job')
        } else {
          alert(applyError.message)
        }
        return
      }

      // Optimistically update UI.
      setApplications((prev) => [
        ...prev,
        {
          job_id: job.id,
          status: 'applied',
          jobs: job,
        },
      ])
      setAppliedIds(
        (prev) =>
          new Set([
            ...prev,
            job.id,
          ]),
      )
    } finally {
      setApplying((prev) => ({ ...prev, [job.id]: false }))
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadJobs() {
      setError(null)
      setLoading(true)
      const candidateId = user?.id

      // Fetch jobs and the logged-in user's applications together.
      const [{ data: jobsData, error: jobsError }, { data: appsData, error: appsError }] =
        await Promise.all([
          supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('applications')
            .select(
              `
  job_id,
  status,
  jobs (
    id,
    title,
    company,
    location
  )
`,
            )
            .eq('candidate_id', candidateId),
        ])

      if (cancelled) return

      if (jobsError) {
        setError(jobsError.message)
        setJobs([])
      } else {
        setJobs(jobsData ?? [])
      }

      if (appsError) {
        setError(appsError.message)
        setApplications([])
        setAppliedIds(new Set())
      } else {
        const apps = appsData ?? []
        setApplications(apps)
        setAppliedIds(new Set(apps.map((a) => a.job_id)))
      }

      setLoading(false)
    }

    loadJobs()

    return () => {
      cancelled = true
    }
  }, [user?.id])

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
        ) : (
          <>
            <h2>Available Jobs</h2>
            <ul className="jobs-list">
              {availableJobs.map((job) => (
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
                        onClick={() => applyToJob(job)}
                        disabled={
                          applying[job.id] ||
                          appliedJobIds.has(job.id) ||
                          job.is_open === false ||
                          isDeadlinePassed(job.deadline)
                        }
                      >
                        {job.is_open === false
                          ? 'Closed'
                          : appliedJobIds.has(job.id)
                            ? 'Applied'
                            : applying[job.id]
                              ? 'Applying…'
                              : 'Apply'}
                      </button>
                    </div>
                  </li>
                ))}
              {availableJobs.length === 0 && (
                <li className="job-card">
                  <p className="auth-info">No available jobs right now.</p>
                </li>
              )}
            </ul>

            <h2>My Applications</h2>
            {applications.length === 0 ? (
              <p className="auth-info">You have not applied to any jobs yet.</p>
            ) : (
              <ul className="jobs-list">
                {applications
                  .slice()
                  .sort((a, b) => {
                    const order = { shortlisted: 0, applied: 1, rejected: 2 }
                    const sa = a.status ?? 'applied'
                    const sb = b.status ?? 'applied'
                    return (order[sa] ?? 3) - (order[sb] ?? 3)
                  })
                  .map((app, idx) => (
                    <li
                      key={app.jobs?.id ? `${app.jobs.id}-${idx}` : idx}
                      className="job-card"
                    >
                      <div className="candidate-job-header">
                        <h2 className="job-title">
                          {app.jobs?.title ?? 'Job'}
                        </h2>
                        <span
                          className={`status-badge status-badge--${
                            (app.status ?? 'applied').toLowerCase()
                          }`}
                        >
                          {(app.status ?? 'applied').toUpperCase()}
                        </span>
                      </div>
                      <div className="candidate-job-grid">
                        <div className="candidate-job-row">
                          <span className="candidate-job-label">Company</span>
                          <span className="candidate-job-value">
                            {app.jobs?.company ?? '—'}
                          </span>
                        </div>
                        <div className="candidate-job-row">
                          <span className="candidate-job-label">Location</span>
                          <span className="candidate-job-value">
                            {app.jobs?.location ?? '—'}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
        <div className="dashboard-actions">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
