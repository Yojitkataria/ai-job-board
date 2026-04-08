import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { LogoutButton } from '../components/LogoutButton.jsx'

export default function Candidate() {
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [candidateId, setCandidateId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [applyingJobId, setApplyingJobId] = useState(null)

  useEffect(() => {
    let cancelled = false
    let channel

    async function fetchApplications(user) {
      const { data, error: appsError } = await supabase
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
        .eq('candidate_id', user.id)

      if (cancelled) return

      if (appsError) {
        setError(appsError.message)
        setApplications([])
      } else {
        setApplications(data ?? [])
      }
    }

    async function fetchJobs() {
      const { data, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (jobsError) {
        setError(jobsError.message)
        setJobs([])
        return
      }

      setJobs(data ?? [])
    }

    async function init() {
      setError(null)
      setLoading(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (userError) {
        setError(userError.message)
        setApplications([])
        setLoading(false)
        return
      }

      if (!user) {
        setError('You must be logged in to view applications.')
        setApplications([])
        setLoading(false)
        return
      }

      setCandidateId(user.id)
      await Promise.all([fetchJobs(), fetchApplications(user)])
      setLoading(false)

      channel = supabase
        .channel('applications-candidate')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'applications',
            filter: `candidate_id=eq.${user.id}`,
          },
          async () => {
            if (!cancelled) {
              await fetchApplications(user)
            }
          },
        )
        .subscribe()
    }

    init()

    return () => {
      cancelled = true
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  async function applyToJob(job) {
    if (!candidateId) {
      alert('You must be logged in to apply.')
      return
    }

    setApplyingJobId(job.id)
    try {
      const { error: applyError } = await supabase.from('applications').insert(
        {
          job_id: job.id,
          candidate_id: candidateId,
        },
      )

      if (applyError) {
        if (applyError.message.includes('unique_job_candidate')) {
          alert('You already applied to this job')
        } else {
          alert(applyError.message)
        }
        return
      }

      // Optimistic UI update (realtime listener will eventually refetch).
      setApplications((prev) => {
        if (prev.some((a) => a.job_id === job.id)) return prev
        return [
          ...prev,
          {
            job_id: job.id,
            status: 'applied',
            jobs: {
              id: job.id,
              title: job.title,
              company: job.company,
              location: job.location,
            },
          },
        ]
      })
    } finally {
      setApplyingJobId(null)
    }
  }

  const appliedJobIds = new Set(applications.map((a) => a.job_id))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const availableJobs = jobs.filter((job) => {
    const applied = appliedJobIds.has(job.id)
    const isOpen = job.is_open !== false
    const notExpired = !job.deadline || new Date(job.deadline) >= today

    console.log('[Candidate debug] job', {
      id: job.id,
      applied,
      isOpen,
      deadline: job.deadline,
      notExpired,
    })

    return !applied && isOpen && notExpired
  })

  const sortedApplications = applications
    .slice()
    .sort((a, b) => {
      const order = { shortlisted: 0, applied: 1, rejected: 2 }
      const sa = a.status ?? 'applied'
      const sb = b.status ?? 'applied'
      return (order[sa] ?? 3) - (order[sb] ?? 3)
    })

  console.log('[Candidate debug] jobs', jobs)
  console.log('[Candidate debug] applications', applications)
  console.log('[Candidate debug] appliedJobIds', [...appliedJobIds])
  console.log('[Candidate debug] availableJobs', availableJobs)

  return (
    <div className="auth-page dashboard">
      <div className="auth-card dashboard-card">
        <h1>Candidate</h1>

        {loading ? (
          <p className="auth-status">Loading…</p>
        ) : error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : (
          <>
            <h2>Available Jobs</h2>
            {availableJobs.length === 0 ? (
              <p className="auth-info">No available jobs right now.</p>
            ) : (
              <ul className="jobs-list">
                {availableJobs.map((job) => (
                  <li key={job.id} className="job-card">
                    <h2 className="job-title">{job.title}</h2>
                    <p className="job-meta">
                      <span className="job-company">{job.company}</span>
                      {' · '}
                      <span className="job-location">{job.location}</span>
                    </p>
                    <div className="job-actions">
                      <button
                        type="button"
                        className="auth-button secondary"
                        onClick={() => applyToJob(job)}
                        disabled={applyingJobId === job.id}
                      >
                        {applyingJobId === job.id ? 'Applying…' : 'Apply'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 style={{ marginTop: 28 }}>My Applications</h2>
            {sortedApplications.length === 0 ? (
              <p className="auth-info">No applications yet.</p>
            ) : (
              <ul className="jobs-list">
                {sortedApplications.map((app, idx) => (
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

