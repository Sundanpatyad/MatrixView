/** DockX must never appear in activity (dev binary is often named "app"). */
export function isExcludedApp(
  appName: string | null | undefined,
  processName = '',
  windowTitle = '',
) {
  const app = String(appName ?? '').toLowerCase().trim();
  const proc = String(processName ?? '').toLowerCase().trim();
  const title = String(windowTitle ?? '').toLowerCase().trim();
  const hay = `${app} ${proc}`;

  if (/dockx|com\.dockx/.test(hay)) return true;

  const genericSelf = app === 'app' || app === 'app_lib' || proc === 'app' || proc === 'app_lib';
  if (genericSelf && title.includes('dockx')) return true;
  if (title === 'dockx' && genericSelf) return true;

  return false;
}
