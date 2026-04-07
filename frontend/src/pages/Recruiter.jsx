import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/useAuth.js'
import { LogoutButton } from '../components/LogoutButton.jsx'

export function Recruiter() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [myJobs, setMyJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState(null)

  async function loadMyJobs() {
    setJobsError(null)
    setJobsLoading(true)
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()

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

      const jobsWithApps = await Promise.all(
        (jobs ?? []).map(async (job) => {
          const { data: apps, error: appsError } = await supabase
            .from('applications')
            .select(
              `id,
candidate_id,
status,
profiles (
name,
email
)`,
            )
            .eq('job_id', job.id)

          return {
            job,
            apps: appsError ? [] : apps ?? [],
            appsError: appsError?.message ?? null,
          }
        }),
      )

      setMyJobs(jobsWithApps)
    } finally {
      setJobsLoading(false)
    }
  }

  useEffect(() => {
    loadMyJobs()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
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
        title: title.trim(),
        company: company.trim(),
        location: location.trim(),
        description: description.trim(),
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
      await loadMyJobs()
    } finally {
      setLoading(false)
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
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="auth-info" role="status">
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
            <p className="auth-status">Loading…</p>
          ) : jobsError ? (
            <p className="auth-error" role="alert">
              {jobsError}
            </p>
          ) : myJobs.length === 0 ? (
            <p className="auth-info">No jobs created yet.</p>
          ) : (
            <ul className="jobs-list">
              {myJobs.map(({ job, apps, appsError }) => (
                <li key={job.id} className="job-card">
                  <h3 className="job-title">{job.title}</h3>
                  <p className="job-meta">
                    Applicants: <strong>{apps.length}</strong>
                  </p>
                  {appsError ? (
                    <p className="auth-error" role="alert">
                      {appsError}
                    </p>
                  ) : apps.length === 0 ? (
                    <p className="auth-info">No applicants yet.</p>
                  ) : (
                    <ul className="applicants-list">
                      {apps.map((app) => (
                        <li key={app.id} className="applicant-item">
                          <div>
                            <strong>{app.profiles?.name ?? 'Unknown'}</strong>
                          </div>
                          <div>{app.profiles?.email ?? app.candidate_id}</div>
                        </li>
                      ))}
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
