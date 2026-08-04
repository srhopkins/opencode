// Pure helpers for the MVP layout (murfy-7ur) nav-collapse toggle — kept free of
// solid-js so they're testable without a reactive root (the persisted() store
// wrapper itself is exercised generically by utils/persist.test.ts).
export function nextNavCollapsed(current: boolean) {
  return !current
}

export function homeNavToggleLabel(collapsed: boolean, t: (key: string) => string) {
  return collapsed ? t("home.nav.expand") : t("home.nav.collapse")
}

export function homeNavAriaExpanded(collapsed: boolean) {
  return !collapsed
}
