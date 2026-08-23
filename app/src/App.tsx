import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import OfflineBanner from '@/components/OfflineBanner'
import InstallPrompt from '@/components/InstallPrompt'
import { RouteLoadingScreen } from '@/components/LoadingScreens'
import { GroupPaymentsRedirect, GroupRootRedirect } from '@/pages/admin/GroupRouteRedirects'
import { useAuth } from '@/lib/useAuth'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const LoginLinkPage = lazy(() => import('@/pages/LoginLinkPage'))
const GroupsListPage = lazy(() => import('@/pages/admin/GroupsListPage'))
const CreateGroupPage = lazy(() => import('@/pages/admin/CreateGroupPage'))
const GroupMembersPage = lazy(() => import('@/pages/admin/GroupMembersPage'))
const GroupCyclesPage = lazy(() => import('@/pages/admin/GroupCyclesPage'))
const GroupCycleDetailPage = lazy(() => import('@/pages/admin/GroupCycleDetailPage'))
const GroupReportsPage = lazy(() => import('@/pages/admin/GroupReportsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <RouteLoadingScreen pathname={pathname} />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <RouteLoadingScreen pathname={pathname} />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/groups" replace />
  return <>{children}</>
}

import { ViewModeProvider } from '@/lib/useViewMode'
import BottomNav from '@/components/BottomNav'

export default function App() {
  const { pathname } = useLocation()

  return (
    <ViewModeProvider>
      <OfflineBanner />
      <InstallPrompt />
      <Suspense fallback={<RouteLoadingScreen pathname={pathname} />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/link/:id" element={<LoginLinkPage />} />
          <Route
            path="/groups"
            element={
              <RequireAuth>
                <GroupsListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/new"
            element={
              <RequireAdmin>
                <CreateGroupPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/groups/:groupId"
            element={
              <RequireAuth>
                <GroupRootRedirect />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/:groupId/members"
            element={
              <RequireAuth>
                <GroupMembersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/:groupId/cycles"
            element={
              <RequireAuth>
                <GroupCyclesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/:groupId/cycles/:cycleNumber"
            element={
              <RequireAuth>
                <GroupCycleDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/:groupId/reports"
            element={
              <RequireAuth>
                <GroupReportsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/:groupId/payments"
            element={
              <RequireAuth>
                <GroupPaymentsRedirect />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/groups" replace />} />
          <Route path="*" element={<Navigate to="/groups" replace />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </ViewModeProvider>
  )
}
