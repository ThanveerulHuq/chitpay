import { Navigate, useParams } from 'react-router-dom'
import { groupPath, useExperience } from '@/lib/roleRoutes'

export function GroupRootRedirect() {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const experience = useExperience()
  return <Navigate to={groupPath(experience, groupId)} replace />
}

export function GroupPaymentsRedirect() {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const experience = useExperience()
  return <Navigate to={groupPath(experience, groupId, 'reports')} replace />
}
