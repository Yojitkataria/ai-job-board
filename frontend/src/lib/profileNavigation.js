import { supabase } from './supabase.js'

export async function fetchProfileAndNavigate(navigate, user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    return { error, data: null }
  }

  if (data.role === 'recruiter') {
    navigate('/recruiter', { replace: true })
  } else if (data.role === 'candidate') {
    navigate('/jobs', { replace: true })
  } else {
    navigate('/dashboard', { replace: true })
  }

  return { error: null, data }
}
