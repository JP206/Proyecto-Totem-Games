import { useNavigate } from "react-router-dom";
import { useCallback } from "react";
import DesktopManager from "../utils/desktop";
import { ROUTES } from "../constants/routes";
import type { NotificationType } from "./useNotification";

export type CurrentProject = {
  repoPath: string;
  repoName: string;
  repoOwner: string;
};

/**
 * Returns true if GitHub token exists; otherwise shows warning and redirects to login.
 */
export async function ensureGithubToken(
  navigate: ReturnType<typeof useNavigate>,
  showNotification: (type: NotificationType, message: string) => void,
  delayMs = 2000,
): Promise<boolean> {
  const desktop = DesktopManager.getInstance();
  const token = await desktop.getConfig("github_token");
  if (!token) {
    showNotification(
      "warning",
      "Debes iniciar sesión para acceder a esta sección",
    );
    setTimeout(() => navigate(ROUTES.login), delayMs);
    return false;
  }
  return true;
}

/**
 * Returns project if repoName and repoOwner are set; otherwise shows error and redirects to dashboard.
 */
export async function ensureCurrentProject(
  navigate: ReturnType<typeof useNavigate>,
  showNotification: (type: NotificationType, message: string) => void,
  delayMs = 2000,
): Promise<CurrentProject | null> {
  const desktop = DesktopManager.getInstance();
  const project = await desktop.getConfig("current_project");
  if (!project?.repoName || !project?.repoOwner) {
    showNotification("error", "No hay un proyecto seleccionado");
    setTimeout(() => navigate(ROUTES.dashboard), delayMs);
    return null;
  }
  return project as CurrentProject;
}

export function useSessionGuards() {
  const navigate = useNavigate();
  const ensureToken = useCallback(
    (
      showNotification: (type: NotificationType, message: string) => void,
      delayMs?: number,
    ) => ensureGithubToken(navigate, showNotification, delayMs),
    [navigate],
  );
  const ensureProject = useCallback(
    (
      showNotification: (type: NotificationType, message: string) => void,
      delayMs?: number,
    ) => ensureCurrentProject(navigate, showNotification, delayMs),
    [navigate],
  );
  return { navigate, ensureGithubToken: ensureToken, ensureCurrentProject: ensureProject };
}
