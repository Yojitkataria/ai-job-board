import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [applyFeedback, setApplyFeedback] = useState('')
  const mountedRef = useRef(true)
  const fetchIdRef = useRef(0)

  const appliedJobIds = useMemo(
    () => new Set(applications.map((a) => a.job_id)),
    [applications],
  )

  const getTodayStart = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  }, [])

  const isExpired = useCallback((deadline) => {
    if (!deadline) return false
    const d = new Date(deadline)
    if (Number.isNaN(d.getTime())) return false
    d.setHours(0, 0, 0, 0)
    return d < getTodayStart()
  }, [getTodayStart])

  const availableJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const applied = appliedJobIds.has(job.id)
        const isOpen = job.is_open !== false
        const notExpired = !isExpired(job.deadline)
        return !applied && isOpen && notExpired
      }),
    [jobs, appliedJobIds, isExpired],
  )

  const sortedApplications = useMemo(
    () =>
      applications.slice().sort((a, b) => {
        const order = { shortlisted: 0, applied: 1, rejected: 2 }
        const sa = a.status ?? 'applied'
        const sb = b.status ?? 'applied'
        return (order[sa] ?? 3) - (order[sb] ?? 3)
      }),
    [applications],
  )

  async function applyToJob(job) {
    if (!user?.id) {
      alert('You must be logged in to apply.')
      return
    }

    const expired = isExpired(job.deadline)
    const closed = job.is_open === false
    if (applying[job.id] || appliedJobIds.has(job.id) || closed || expired) {
      return
    }

    setApplying((prev) => ({ ...prev, [job.id]: true }))
    setApplyFeedback('')
    try {
      const { error: applyError } = await supabase.from('applications').insert({
        job_id: job.id,
        candidate_id: user.id,
        status: 'applied',
      })

      if (applyError) {
        if (applyError.message.includes('unique_job_candidate')) {
          // In case another tab/user action applied first.
          setApplications((prev) =>
            prev.some((a) => a.job_id === job.id)
              ? prev
              : [...prev, { job_id: job.id, status: 'applied', jobs: job }],
          )
        } else {
          alert(applyError.message)
        }
        return
      }

      setApplications((prev) =>
        prev.some((a) => a.job_id === job.id)
          ? prev
          : [...prev, { job_id: job.id, status: 'applied', jobs: job }],
      )
      setApplyFeedback('Applied successfully.')
    } finally {
      setApplying((prev) => ({ ...prev, [job.id]: false }))
    }
  }

  const loadJobs = useCallback(async () => {
    const fetchId = ++fetchIdRef.current
    setError(null)
    setLoading(true)

    if (!user?.id) {
      if (!mountedRef.current || fetchId !== fetchIdRef.current) return
      setJobs([])
      setApplications([])
      setLoading(false)
      return
    }

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
          .eq('candidate_id', user.id),
      ])

    if (!mountedRef.current || fetchId !== fetchIdRef.current) return

    if (jobsError || appsError) {
      setError(jobsError?.message ?? appsError?.message ?? 'Failed to load data.')
      setJobs([])
      setApplications([])
    } else {
      setJobs(jobsData ?? [])
      setApplications(appsData ?? [])
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    mountedRef.current = true
    loadJobs()

    return () => {
      mountedRef.current = false
    }
  }, [loadJobs])

  return (
    <div className="auth-page dashboard">
      <div className="auth-card dashboard-card">
        <h1>Jobs</h1>
        <p className="dashboard-email">
          Signed in as <strong>{user?.email ?? '—'}</strong>
        </p>
        {loading ? (
          <p className="auth-status" role="status" aria-live="polite">
            Loading jobs…
          </p>
        ) : error ? (
          <>
            <p className="auth-error" role="alert" aria-live="polite">
              {error}
            </p>
            <div className="job-actions">
              <button
                type="button"
                className="auth-button secondary"
                onClick={loadJobs}
                disabled={loading}
              >
                Retry
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Available Jobs</h2>
            {availableJobs.length === 0 ? (
              <p className="auth-info">No available jobs right now.</p>
            ) : (
              <ul className="jobs-list">
                {availableJobs.map((job) => {
                  const expired = isExpired(job.deadline)
                  const closed = job.is_open === false
                  return (
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
                            closed ||
                            expired
                          }
                        >
                          {closed
                            ? 'Closed'
                            : expired
                              ? 'Deadline passed'
                              : appliedJobIds.has(job.id)
                                ? 'Applied'
                                : applying[job.id]
                                  ? 'Applying…'
                                  : 'Apply'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <h2 className="jobs-section-title">My Applications</h2>
            {sortedApplications.length === 0 ? (
              <p className="auth-info">You have not applied to any jobs yet.</p>
            ) : (
              <ul className="jobs-list">
                {sortedApplications.map((app, idx) => (
                  <li
                    key={app.jobs?.id ? `${app.jobs.id}-${idx}` : `${app.job_id}-${idx}`}
                    className="job-card"
                  >
                    <h2 className="job-title">{app.jobs?.title ?? 'Job'}</h2>
                    <p className="job-meta">
                      <span className="job-company">{app.jobs?.company ?? '—'}</span>
                      {' · '}
                      <span className="job-location">{app.jobs?.location ?? '—'}</span>
                    </p>
                    <p className="job-description">
                      Status: <strong>{(app.status ?? 'applied').toUpperCase()}</strong>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {applyFeedback ? (
              <p className="auth-info" role="status" aria-live="polite">
                {applyFeedback}
              </p>
            ) : null}
          </>
        )}
        <div className="dashboard-actions">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
