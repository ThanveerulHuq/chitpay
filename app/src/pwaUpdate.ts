const SERVICE_WORKER_URL = '/sw.js'
const STARTUP_UPDATE_TIMEOUT_MS = 3_000
const RELOAD_GUARD_KEY = 'chitapp-pwa-update-reload'

function waitForInstall(worker: ServiceWorker): Promise<void> {
  if (worker.state === 'installed' || worker.state === 'redundant') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const handleStateChange = () => {
      if (worker.state !== 'installed' && worker.state !== 'redundant') return

      worker.removeEventListener('statechange', handleStateChange)
      resolve()
    }

    worker.addEventListener('statechange', handleStateChange)
  })
}

async function findWaitingWorker(): Promise<ServiceWorker | null> {
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
    updateViaCache: 'none',
  })

  // The first installation already contains the current build and should not
  // cause a second load.
  if (!navigator.serviceWorker.controller) return null
  if (registration.waiting) return registration.waiting

  if (registration.installing) {
    await waitForInstall(registration.installing)
    return registration.waiting
  }

  await registration.update()
  if (registration.waiting) return registration.waiting
  if (!registration.installing) return null

  await waitForInstall(registration.installing)
  return registration.waiting
}

function findWaitingWorkerWithinStartupWindow(): Promise<ServiceWorker | null> {
  return new Promise((resolve) => {
    let settled = false

    const finish = (worker: ServiceWorker | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      resolve(worker)
    }

    const timeoutId = window.setTimeout(() => finish(null), STARTUP_UPDATE_TIMEOUT_MS)

    void findWaitingWorker().then(finish).catch(() => finish(null))
  })
}

function activateAndReload(worker: ServiceWorker): void {
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1')

  let reloading = false
  const reload = () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  }

  navigator.serviceWorker.addEventListener(
    'controllerchange',
    reload,
    { once: true },
  )

  worker.postMessage({ type: 'SKIP_WAITING' })

  // Avoid leaving a blank startup screen if a browser fails to dispatch the
  // controllerchange event after activating the worker.
  window.setTimeout(reload, STARTUP_UPDATE_TIMEOUT_MS)
}

/**
 * Checks for and activates a new build only during a full app startup.
 * Once this promise resolves, no update discovered later can reload the page.
 */
export async function updateAppOnColdStart(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // Prevent a failed activation from causing a reload loop. A successful
  // activation has already loaded the new build, so it does not need a check.
  if (sessionStorage.getItem(RELOAD_GUARD_KEY)) {
    sessionStorage.removeItem(RELOAD_GUARD_KEY)
    return
  }

  const waitingWorker = await findWaitingWorkerWithinStartupWindow()
  if (!waitingWorker) return

  activateAndReload(waitingWorker)

  // Do not render the old app while the new worker takes control.
  await new Promise<void>(() => {})
}
