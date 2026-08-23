import { Page, Skeleton } from '@/components/ui'
import { useT } from '@/i18n'

function LoadingStatus({ children }: { children: React.ReactNode }) {
  const t = useT()
  return (
    <div role="status" aria-label={t('common.loading')}>
      <span className="sr-only">{t('common.loading')}</span>
      {children}
    </div>
  )
}

function HeaderSkeleton({ brand = false }: { brand?: boolean }) {
  return (
    <div className="-mx-4 mb-5 flex min-h-15 items-center justify-between border-b border-line/50 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        {brand && <Skeleton className="size-8 rounded-xl" />}
        <Skeleton className={brand ? 'h-7 w-24' : 'h-6 w-40'} />
      </div>
      <Skeleton className="size-9 rounded-full" />
    </div>
  )
}

function CardRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function LoginLoadingScreen() {
  return (
    <LoadingStatus>
      <div className="flex min-h-dvh flex-col px-6 pb-10 pt-6 sm:pt-[10dvh]">
        <Skeleton className="ml-auto h-9 w-24" />
        <div className="mx-auto mt-4 w-full max-w-sm sm:mt-8">
          <Skeleton className="mx-auto size-40 rounded-[2.5rem]" />
          <Skeleton className="mx-auto mt-6 h-9 w-36" />
          <Skeleton className="mx-auto mt-2 h-5 w-52" />
          <div className="mt-10 space-y-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="mx-auto h-3 w-56" />
          </div>
          <Skeleton className="mx-auto mt-8 h-5 w-40" />
        </div>
      </div>
    </LoadingStatus>
  )
}

export function GroupsListLoadingScreen() {
  return (
    <LoadingStatus>
      <Page>
        <HeaderSkeleton brand />
        <div className="mb-5 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface px-2 py-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col items-center gap-2 px-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-8" />
            </div>
          ))}
        </div>
        <CardRows />
      </Page>
    </LoadingStatus>
  )
}

export function GroupDetailLoadingScreen() {
  return (
    <LoadingStatus>
      <Page>
        <HeaderSkeleton />
        <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface px-2 py-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col items-center gap-2 px-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
          <Skeleton className="mt-5 h-11 w-full" />
        </div>
        <div className="mt-6">
          <Skeleton className="mb-3 h-4 w-28" />
          <CardRows count={3} />
        </div>
      </Page>
    </LoadingStatus>
  )
}

export function PaymentsLoadingScreen() {
  return (
    <LoadingStatus>
      <Page>
        <HeaderSkeleton />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index}>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-2 h-12 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-5 w-36" />
        <div className="mt-4">
          <CardRows count={4} />
        </div>
      </Page>
    </LoadingStatus>
  )
}

export function CreateGroupLoadingScreen() {
  return (
    <LoadingStatus>
      <Page>
        <HeaderSkeleton />
        <div className="space-y-8">
          <div className="space-y-5">
            <FieldSkeleton />
            <FieldSkeleton tall />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-6">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-6">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <Skeleton className="h-12 w-full" />
        </div>
      </Page>
    </LoadingStatus>
  )
}

function FieldSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div>
      <Skeleton className="h-4 w-28" />
      <Skeleton className={`mt-2 w-full ${tall ? 'h-20' : 'h-12'}`} />
    </div>
  )
}

export function SettingsLoadingScreen() {
  return (
    <LoadingStatus>
      <Page>
        <HeaderSkeleton />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-4 w-56" />
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="mt-6 h-3 w-20" />
        <Skeleton className="mt-3 h-20 w-full" />
        <Skeleton className="mt-8 h-12 w-full" />
      </Page>
    </LoadingStatus>
  )
}

export function RouteLoadingScreen({ pathname }: { pathname: string }) {
  if (pathname === '/login' || pathname.startsWith('/login/link/')) return <LoginLoadingScreen />
  if (pathname === '/groups/new') return <CreateGroupLoadingScreen />
  if (pathname === '/settings') return <SettingsLoadingScreen />
  if (/^\/groups\/[^/]+\/payments$/.test(pathname)) return <PaymentsLoadingScreen />
  if (/^\/groups\/[^/]+(?:\/.*)?$/.test(pathname)) return <GroupDetailLoadingScreen />
  return <GroupsListLoadingScreen />
}
