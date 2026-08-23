import { Navigate, Outlet, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import LoginLinkPage from '@/pages/LoginLinkPage'
import GroupsListPage from '@/pages/admin/GroupsListPage'
import CreateGroupPage from '@/pages/admin/CreateGroupPage'
import GroupMembersPage from '@/pages/admin/GroupMembersPage'
import GroupCyclesPage from '@/pages/admin/GroupCyclesPage'
import GroupCycleDetailPage from '@/pages/admin/GroupCycleDetailPage'
import GroupReportsPage from '@/pages/admin/GroupReportsPage'
import { GroupPaymentsRedirect, GroupRootRedirect } from '@/pages/admin/GroupRouteRedirects'
import SettingsPage from '@/pages/SettingsPage'
import OfflineBanner from '@/components/OfflineBanner'
import InstallPrompt from '@/components/InstallPrompt'
import { useAuth } from '@/lib/useAuth'
import { groupsPath, type Experience } from '@/lib/roleRoutes'

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-dvh items-center justify-center text-faint">…</div>
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <div className="flex min-h-dvh items-center justify-center text-faint">…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/member/groups" replace />
  return <Outlet />
}

import BottomNav from '@/components/BottomNav'

function RoleLanding() {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <div className="flex min-h-dvh items-center justify-center text-faint">…</div>
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={groupsPath(isAdmin ? 'admin' : 'member')} replace />
}

function LegacyGroupsRedirect() {
  const { user, loading, isAdmin } = useAuth()
  const { '*': rest = '' } = useParams()
  const [searchParams] = useSearchParams()
  if (loading) return <div className="flex min-h-dvh items-center justify-center text-faint">…</div>
  if (!user) return <Navigate to="/login" replace />
  const experience: Experience = searchParams.get('view') === 'member' ? 'member' : isAdmin ? 'admin' : 'member'
  const suffix = rest ? `/${rest}` : ''
  return <Navigate to={`${groupsPath(experience)}${suffix}`} replace />
}

function LegacySettingsRedirect() {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <div className="flex min-h-dvh items-center justify-center text-faint">…</div>
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={`/${isAdmin ? 'admin' : 'member'}/settings`} replace />
}

export default function App() {
  return (
    <>
      <OfflineBanner />
      <InstallPrompt />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/link/:id" element={<LoginLinkPage />} />
        <Route path="/admin" element={<RequireAdmin />}>
          <Route index element={<Navigate to="groups" replace />} />
          <Route path="groups" element={<GroupsListPage />} />
          <Route path="groups/new" element={<CreateGroupPage />} />
          <Route path="groups/:groupId" element={<GroupRootRedirect />} />
          <Route path="groups/:groupId/members" element={<GroupMembersPage />} />
          <Route path="groups/:groupId/cycles" element={<GroupCyclesPage />} />
          <Route path="groups/:groupId/cycles/:cycleNumber" element={<GroupCycleDetailPage />} />
          <Route path="groups/:groupId/reports" element={<GroupReportsPage />} />
          <Route path="groups/:groupId/payments" element={<GroupPaymentsRedirect />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="groups" replace />} />
        </Route>
        <Route path="/member" element={<RequireAuth />}>
          <Route index element={<Navigate to="groups" replace />} />
          <Route path="groups" element={<GroupsListPage />} />
          <Route path="groups/:groupId" element={<GroupRootRedirect />} />
          <Route path="groups/:groupId/members" element={<GroupMembersPage />} />
          <Route path="groups/:groupId/cycles" element={<GroupCyclesPage />} />
          <Route path="groups/:groupId/cycles/:cycleNumber" element={<GroupCycleDetailPage />} />
          <Route path="groups/:groupId/reports" element={<GroupReportsPage />} />
          <Route path="groups/:groupId/payments" element={<GroupPaymentsRedirect />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="groups" replace />} />
        </Route>
        <Route path="/groups/*" element={<LegacyGroupsRedirect />} />
        <Route path="/settings" element={<LegacySettingsRedirect />} />
        <Route path="/" element={<RoleLanding />} />
        <Route path="*" element={<RoleLanding />} />
      </Routes>
      <BottomNav />
    </>
  )
}
