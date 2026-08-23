import { Navigate } from 'react-router-dom'

export default function MemberGroupView({ groupId }: { groupId: string }) {
  return <Navigate to={`/member/groups/${groupId}/cycles`} replace />
}
