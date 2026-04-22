import { supabase } from './supabase.js'

export async function fetchProfileAndNavigate(navigate, user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .limit(1)

  if (error) {
    return { error, data: null }
  }

  let profile = data?.[0] ?? null
  if (!profile) {
    const fallbackName =
      (user.user_metadata?.name ?? user.email ?? '').toString().trim() || 'User'
    const fallbackRole =
      user.user_metadata?.role === 'recruiter' ? 'recruiter' : 'candidate'

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        name: fallbackName,
        role: fallbackRole,
      })
      .select('*')
      .limit(1)

    if (insertError) {
      return { error: insertError, data: null }
    }

    profile = inserted?.[0] ?? null
    if (!profile) {
      return {
        error: { message: 'Profile not found for this user.' },
        data: null,
      }
    }
  }

  if (profile.role === 'recruiter') {
    navigate('/recruiter', { replace: true })
  } else if (profile.role === 'candidate') {
    navigate('/jobs', { replace: true })
  } else {
    navigate('/dashboard', { replace: true })
  }

  return { error: null, data: profile }
}
