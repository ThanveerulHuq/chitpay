import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import OfflineBanner from '@/components/OfflineBanner'
import InstallPrompt from '@/components/InstallPrompt'
import BottomNav from '@/components/BottomNav'
import { RouteLoadingScreen } from '@/components/LoadingScreens'
import { GroupPaymentsRedirect, GroupRootRedirect } from '@/pages/admin/GroupRouteRedirects'
import { useAuth } from '@/lib/useAuth'
import { groupsPath, type Experience } from '@/lib/roleRoutes'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const LoginLinkPage = lazy(() => import('@/pages/LoginLinkPage'))
const GroupsListPage = lazy(() => import('@/pages/admin/GroupsListPage'))
const CreateGroupPage = lazy(() => import('@/pages/admin/CreateGroupPage'))
const GroupMembersPage = lazy(() => import('@/pages/admin/GroupMembersPage'))
const GroupCyclesPage = lazy(() => import('@/pages/admin/GroupCyclesPage'))
const GroupCycleDetailPage = lazy(() => import('@/pages/admin/GroupCycleDetailPage'))
const GroupReportsPage = lazy(() => import('@/pages/admin/GroupReportsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const ArchivedGroupsPage = lazy(() => import('@/pages/admin/ArchivedGroupsPage'))

function RequireAuth() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <RouteLoadingScreen pathname={pathname} />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { user, loading, isAdmin } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <RouteLoadingScreen pathname={pathname} />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/member/groups" replace />
  return <Outlet />
}

function RoleLanding() {
  const { user, loading, isAdmin } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <RouteLoadingScreen pathname={pathname} />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={groupsPath(isAdmin ? 'admin' : 'member')} replace />
}

function LegacyGroupsRedirect() {
  const { user, loading, isAdmin } = useAuth()
  const { '*': rest = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { pathname } = useLocation()
  if (loading) return <RouteLoadingScreen pathname={pathname} />
  if (!user) return <Navigate to="/login" replace />
  const experience: Experience = searchParams.get('view') === 'member' ? 'member' : isAdmin ? 'admin' : 'member'
  return <Navigate to={`${groupsPath(experience)}${rest ? `/${rest}` : ''}`} replace />
}

function LegacySettingsRedirect() {
  const { user, loading, isAdmin } = useAuth()
  const { '*': rest = '' } = useParams()
  const { pathname } = useLocation()
  if (loading) return <RouteLoadingScreen pathname={pathname} />
  if (!user) return <Navigate to="/login" replace />
  const base = `/${isAdmin ? 'admin' : 'member'}/settings`
  return <Navigate to={`${base}${rest ? `/${rest}` : ''}`} replace />
}

export default function App() {
  const { pathname } = useLocation()

  return (
    <>
      <OfflineBanner />
      <InstallPrompt />
      <Suspense fallback={<RouteLoadingScreen pathname={pathname} />}>
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
            <Route path="settings/archived-groups" element={<ArchivedGroupsPage />} />
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
          <Route path="/settings/*" element={<LegacySettingsRedirect />} />
          <Route path="/" element={<RoleLanding />} />
          <Route path="*" element={<RoleLanding />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </>
  )
}
