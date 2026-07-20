/** DockX must never appear in activity (dev binary is often named "app"). */
export function isExcludedApp(
  appName: string,
  processName = '',
  windowTitle = '',
) {
  const app = appName.toLowerCase().trim();
  const proc = processName.toLowerCase().trim();
  const title = windowTitle.toLowerCase().trim();
  const hay = `${app} ${proc}`;

  if (/dockx|com\.dockx/.test(hay)) return true;

  const genericSelf = app === 'app' || app === 'app_lib' || proc === 'app' || proc === 'app_lib';
  if (genericSelf && title.includes('dockx')) return true;
  if (title === 'dockx' && genericSelf) return true;

  return false;
}
