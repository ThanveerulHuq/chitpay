import { Navigate, Route, Routes } from 'react-router-dom'
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-dvh items-center justify-center text-faint">…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <div className="flex min-h-dvh items-center justify-center text-faint">…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/groups" replace />
  return <>{children}</>
}

import { ViewModeProvider } from '@/lib/useViewMode'
import BottomNav from '@/components/BottomNav'

export default function App() {
  return (
    <ViewModeProvider>
      <OfflineBanner />
      <InstallPrompt />
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
      <BottomNav />
    </ViewModeProvider>
  )
}
