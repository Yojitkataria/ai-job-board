import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/useAuth.js'
import { LogoutButton } from '../components/LogoutButton.jsx'

export function Recruiter() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [myJobs, setMyJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState(null)
  const mountedRef = useRef(true)
  const fetchIdRef = useRef(0)
  const myJobIdsRef = useRef(new Set())
  const getTodayStart = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  }, [])

  const isPastDeadline = useCallback(
    (dateStr) => {
      if (!dateStr) return false
      const d = new Date(dateStr)
      if (Number.isNaN(d.getTime())) return false
      d.setHours(0, 0, 0, 0)
      return d < getTodayStart()
    },
    [getTodayStart],
  )

  const loadMyJobs = useCallback(async ({ silent = false } = {}) => {
    const fetchId = ++fetchIdRef.current
    setJobsError(null)
    if (!silent) {
      setJobsLoading(true)
    }
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (!mountedRef.current || fetchId !== fetchIdRef.current) return

      if (authError) {
        setJobsError(authError.message)
        setMyJobs([])
        return
      }
      if (!authUser) {
        setJobsError('You must be logged in to view your jobs.')
        setMyJobs([])
        return
      }

      const { data: jobs, error: jobsFetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('created_by', authUser.id)

      if (jobsFetchError) {
        setJobsError(jobsFetchError.message)
        setMyJobs([])
        return
      }

      const jobIds = (jobs ?? []).map((job) => job.id)
      let appsByJobId = new Map()
      let appsErrorMessage = null

      if (jobIds.length > 0) {
        const { data: allApps, error: appsError } = await supabase
          .from('applications')
          .select(
            `id,
job_id,
candidate_id,
status,
profiles (
name,
email
)`,
          )
          .in('job_id', jobIds)

        if (appsError) {
          appsErrorMessage = appsError.message
        } else {
          appsByJobId = (allApps ?? []).reduce((acc, app) => {
            const current = acc.get(app.job_id) ?? []
            acc.set(app.job_id, [...current, app])
            return acc
          }, new Map())
        }
      }

      const jobsWithApps = (jobs ?? []).map((job) => ({
        job,
        apps: appsErrorMessage ? [] : appsByJobId.get(job.id) ?? [],
        appsError: appsErrorMessage,
      }))

      if (!mountedRef.current || fetchId !== fetchIdRef.current) return
      setMyJobs(jobsWithApps)
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current && !silent) {
        setJobsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    loadMyJobs()
  }, [loadMyJobs])

  useEffect(() => {
    myJobIdsRef.current = new Set(myJobs.map(({ job }) => job.id))
  }, [myJobs])

  useEffect(() => {
    if (!user?.id) return

    const jobsChannel = supabase
      .channel(`recruiter-jobs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `created_by=eq.${user.id}`,
        },
        () => {
          loadMyJobs({ silent: true })
        },
      )
      .subscribe()

    const applicationsChannel = supabase
      .channel(`recruiter-applications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
        },
        (payload) => {
          const changedJobId = payload.new?.job_id ?? payload.old?.job_id
          if (changedJobId && myJobIdsRef.current.has(changedJobId)) {
            loadMyJobs({ silent: true })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(jobsChannel)
      supabase.removeChannel(applicationsChannel)
    }
  }, [user?.id, loadMyJobs])

  async function handleSubmit(e) {
    e.preventDefault()
    const cleanTitle = title.trim()
    const cleanCompany = company.trim()
    const cleanLocation = location.trim()
    const cleanDescription = description.trim()

    if (!cleanTitle) {
      setError('Title is required.')
      return
    }
    if (!cleanCompany) {
      setError('Company is required.')
      return
    }
    if (isPastDeadline(deadline)) {
      setError('Deadline cannot be in the past.')
      return
    }

    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError) {
        setError(sessionError.message)
        return
      }
      if (!session?.user) {
        setError('You must be logged in to create a job.')
        return
      }

      const insertPayload = {
        title: cleanTitle,
        company: cleanCompany,
        location: cleanLocation || null,
        description: cleanDescription || null,
        deadline: deadline || null,
        is_open: true,
        created_by: session.user.id,
      }

      const { error: insertError } = await supabase.from('jobs').insert(insertPayload)
      if (insertError) {
        setError(insertError.message)
        return
      }

      setSuccess(true)
      setTitle('')
      setCompany('')
      setLocation('')
      setDescription('')
      setDeadline('')
      await loadMyJobs()
    } finally {
      setLoading(false)
    }
  }

  async function closeJob(jobId) {
    setJobsError(null)
    setClosingJobId(jobId)
    try {
      const { error: closeError } = await supabase
        .from('jobs')
        .update({ is_open: false })
        .eq('id', jobId)

      if (closeError) {
        setJobsError(closeError.message)
        return
      }

      await loadMyJobs()
    } finally {
      setClosingJobId(null)
    }
  }

  function formatDeadline(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  function isDeadlineExpired(dateStr) {
    if (!dateStr) return false
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return false
    return d < new Date()
  }

  async function updateApplicationStatus(appId, newStatus) {
    setJobsError(null)
    setUpdatingAppId(appId)
    setUpdatingStatus(newStatus)
    try {
      const { error: updateError } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', appId)

      if (updateError) {
        setJobsError(updateError.message)
        return
      }

      await loadMyJobs()
    } finally {
      setUpdatingAppId(null)
      setUpdatingStatus(null)
    }
  }

  return (
    <div className="auth-page dashboard">
      <div className="auth-card dashboard-card">
        <h1>Recruiter</h1>
        <p className="dashboard-email">
          Signed in as <strong>{user?.email ?? '—'}</strong>
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Title</span>
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          <label className="auth-field">
            <span>Company</span>
            <input
              type="text"
              name="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          <label className="auth-field">
            <span>Location</span>
            <input
              type="text"
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          <label className="auth-field">
            <span>Deadline</span>
            <input
              type="date"
              name="deadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          <label className="auth-field">
            <span>Description</span>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={loading}
              rows={5}
            />
          </label>
          <label className="auth-field">
            <span>Deadline</span>
            <input
              type="date"
              name="deadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={loading}
            />
          </label>
          {error ? (
            <p className="auth-error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="auth-info" role="status" aria-live="polite">
              Job created
            </p>
          ) : null}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Creating…' : 'Create job'}
          </button>
        </form>

        <div className="jobs-section">
          <h2 className="jobs-section-title">Your jobs</h2>
          {jobsLoading ? (
            <p className="auth-status" role="status" aria-live="polite">
              Loading…
            </p>
          ) : jobsError ? (
            <>
              <p className="auth-error" role="alert" aria-live="polite">
                {jobsError}
              </p>
              <div className="job-actions">
                <button
                  type="button"
                  className="auth-button secondary"
                  onClick={() => loadMyJobs()}
                >
                  Retry
                </button>
              </div>
            </>
          ) : myJobs.length === 0 ? (
            <p className="auth-info">No jobs created yet.</p>
          ) : (
            <ul className="jobs-list">
              {myJobs.map(({ job, apps, appsError }) => (
                <li key={job.id} className="job-card">
                  {(() => {
                    const total = apps.length
                    const shortlisted = apps.filter(
                      (a) => a.status === 'shortlisted',
                    ).length
                    const rejected = apps.filter(
                      (a) => a.status === 'rejected',
                    ).length
                    const expired = isDeadlineExpired(job.deadline)
                    const closed = job.is_open === false || expired

                    return (
                      <>
                        <h3 className="job-title">{job.title}</h3>
                        <div className="job-meta">
                          <div>
                            Applicants: <strong>{total}</strong>
                          </div>
                          <div>
                            Shortlisted: <strong>{shortlisted}</strong>
                          </div>
                          <div>
                            Rejected: <strong>{rejected}</strong>
                          </div>
                          <div>
                            Deadline:{' '}
                            <strong>
                              {formatDeadline(job.deadline) ?? '—'}
                            </strong>
                          </div>
                          <div>
                            Status: <strong>{closed ? 'Closed' : 'Open'}</strong>
                          </div>
                        </div>
                        <div className="job-actions">
                          <button
                            type="button"
                            className="auth-button secondary"
                            onClick={() => closeJob(job.id)}
                            disabled={closed || closingJobId === job.id}
                          >
                            {closed
                              ? 'Closed'
                              : closingJobId === job.id
                                ? 'Closing…'
                                : 'Close Job'}
                          </button>
                        </div>
                      </>
                    )
                  })()}
                  {appsError ? (
                    <p className="auth-error" role="alert">
                      {appsError}
                    </p>
                  ) : apps.length === 0 ? (
                    <p className="auth-info">No applicants yet.</p>
                  ) : (
                    <ul className="applicants-list">
                      {apps.map((app) => {
                        const profile = Array.isArray(app.profiles)
                          ? app.profiles[0]
                          : app.profiles

                        return (
                          <li key={app.id} className="applicant-item">
                            <div>
                              <strong>{profile?.name ?? 'Unknown'}</strong>
                            </div>
                            <div>{profile?.email ?? app.candidate_id}</div>
                            <div className="applicant-status-row">
                              <span className="applicant-status-label">
                                Status
                              </span>
                              <span className="applicant-status-value">
                                {app.status ?? 'applied'}
                              </span>
                            </div>
                            <div className="applicant-actions">
                              <button
                                type="button"
                                className={`auth-button secondary ${
                                  app.status === 'shortlisted' ? 'active' : ''
                                }`}
                                disabled={
                                  app.status === 'shortlisted' ||
                                  updatingAppId === app.id
                                }
                                onClick={() =>
                                  updateApplicationStatus(app.id, 'shortlisted')
                                }
                              >
                                {updatingAppId === app.id &&
                                updatingStatus === 'shortlisted'
                                  ? 'Shortlisting…'
                                  : app.status === 'shortlisted'
                                    ? 'Shortlisted'
                                    : 'Shortlist'}
                              </button>
                              <button
                                type="button"
                                className={`auth-button secondary ${
                                  app.status === 'rejected' ? 'active' : ''
                                }`}
                                disabled={
                                  app.status === 'rejected' ||
                                  updatingAppId === app.id
                                }
                                onClick={() =>
                                  updateApplicationStatus(app.id, 'rejected')
                                }
                              >
                                {updatingAppId === app.id &&
                                updatingStatus === 'rejected'
                                  ? 'Rejecting…'
                                  : app.status === 'rejected'
                                    ? 'Rejected'
                                    : 'Reject'}
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-actions">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
