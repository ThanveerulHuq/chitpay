import { Navigate } from 'react-router-dom'

export default function MemberGroupView({ groupId }: { groupId: string }) {
  return <Navigate to={`/groups/${groupId}/cycles?view=member`} replace />
}
