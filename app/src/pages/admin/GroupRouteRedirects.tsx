import { Navigate, useParams, useSearchParams } from 'react-router-dom'

export function GroupRootRedirect() {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const [params] = useSearchParams()
  const query = params.get('view') === 'member' ? '?view=member' : ''
  return <Navigate to={`/groups/${groupId}/members${query}`} replace />
}

export function GroupPaymentsRedirect() {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const [params] = useSearchParams()
  const query = params.get('view') === 'member' ? '?view=member' : ''
  return <Navigate to={`/groups/${groupId}/reports${query}`} replace />
}
