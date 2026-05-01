/** Hash-router paths (include leading slash). */
export const ROUTES = {
  root: "/",
  login: "/login",
  dashboard: "/dashboard",
  landing: "/landing",
  translationPreview: "/translation-preview",
  issues: "/issues",
  notes: "/notes",
  changes: "/changes",
  contextsGlossaries: "/contexts-glossaries",
  profile: "/profile",
  users: "/users",
  projects: "/projects",
} as const;

/** Routes where the main Navbar is not rendered. */
export const NAVBAR_HIDDEN_PATHS: readonly string[] = [
  ROUTES.login,
  ROUTES.dashboard,
];
