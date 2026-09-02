import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { GroupProvider, useGroup } from '@/hooks/useGroupContext'
import { ToastProvider } from '@/components/Toast'
import { firebaseConfigured } from '@/lib/firebase'
import AppShell from '@/components/AppShell'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Home from '@/pages/Home'
import MatchPage from '@/pages/MatchPage'
import History from '@/pages/History'
import Profile from '@/pages/Profile'
import NewGroup from '@/pages/NewGroup'
import JoinGroup from '@/pages/JoinGroup'
import Dashboard from '@/pages/manage/Dashboard'
import GroupSettings from '@/pages/manage/GroupSettings'
import Venues from '@/pages/manage/Venues'
import SchedulePage from '@/pages/manage/Schedule'
import Members from '@/pages/manage/Members'
import Announcements from '@/pages/manage/Announcements'
import NewMatch from '@/pages/manage/NewMatch'
import ManageMatch from '@/pages/manage/ManageMatch'

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="Abrindo…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

function RedirectIfAuth() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Abrindo…" />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

function RequireManager() {
  const { isManager, membershipsLoading, groupLoading } = useGroup()
  if (membershipsLoading || groupLoading) return <Spinner />
  if (!isManager) return <Navigate to="/" replace />
  return <Outlet />
}

function RequireGroup() {
  const { memberships, membershipsLoading } = useGroup()
  if (membershipsLoading) return <Spinner />
  if (memberships.length === 0) return <Navigate to="/" replace />
  return <Outlet />
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">Firebase não configurado</h1>
      <p className="mt-2 text-sm text-neutral-700">Copie <code>.env.example</code> para <code>.env</code> e preencha as variáveis <code>VITE_FIREBASE_*</code> com os dados do seu projeto Firebase (ou defina <code>VITE_USE_EMULATORS=true</code> para desenvolvimento local).</p>
    </div>
  )
}

export default function App() {
  if (!firebaseConfigured) return <NotConfigured />
  return (
    <ToastProvider>
      <AuthProvider>
        <GroupProvider>
          <Routes>
            <Route element={<RedirectIfAuth />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<Home />} />
                <Route path="/groups/new" element={<NewGroup />} />
                <Route path="/groups/join" element={<JoinGroup />} />
                <Route path="/profile" element={<Profile />} />
                <Route element={<RequireGroup />}>
                  <Route path="/match/:id" element={<MatchPage />} />
                  <Route path="/history" element={<History />} />
                  <Route element={<RequireManager />}>
                    <Route path="/manage" element={<Dashboard />} />
                    <Route path="/manage/group" element={<GroupSettings />} />
                    <Route path="/manage/venues" element={<Venues />} />
                    <Route path="/manage/schedule" element={<SchedulePage />} />
                    <Route path="/manage/members" element={<Members />} />
                    <Route path="/manage/announcements" element={<Announcements />} />
                    <Route path="/manage/match/new" element={<NewMatch />} />
                    <Route path="/manage/match/:id" element={<ManageMatch />} />
                  </Route>
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </GroupProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
