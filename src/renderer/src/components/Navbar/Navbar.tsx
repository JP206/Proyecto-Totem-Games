import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  History,
  MessageSquare,
  Flag,
  BookOpen,
  MapPin,
  FolderOpen,
  Layers,
  User,
} from "lucide-react";
import DesktopManager from "../../utils/desktop";
import { NAVBAR_HIDDEN_PATHS, ROUTES } from "../../constants/routes";
import "./Navbar.css";

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentProject, setCurrentProject] = useState<{
    repoPath: string;
    repoName: string;
    repoOwner: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentProject();
  }, [location.pathname]);

  const loadCurrentProject = async () => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();
      const project = await desktop.getConfig("current_project");
      setCurrentProject(project);
    } catch (error) {
      console.error("Error cargando proyecto actual:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <nav className="navbar navbar-loading">
        <div className="navbar-spinner" />
      </nav>
    );
  }

  const showNavbar = !NAVBAR_HIDDEN_PATHS.includes(location.pathname);

  if (!showNavbar) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button
          className="nav-btn-explorer"
          data-tooltip="Explorador de proyectos"
          onClick={() => navigate(ROUTES.dashboard)}
        >
          <Eye size={22} />
        </button>

        {currentProject && (
          <div className="project-info">
            <h1 className="project-title">
              <FolderOpen size={20} />
              <span>{currentProject.repoName}</span>
            </h1>
            {currentProject.repoPath && (
              <p className="project-path">
                <MapPin size={12} /> {currentProject.repoPath}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="navbar-right">
        <button
          className={`nav-btn ${location.pathname === ROUTES.landing ? "active" : ""}`}
          data-tooltip="Localización"
          onClick={() => navigate(ROUTES.landing)}
        >
          <Layers size={20} />
        </button>

        <button
          className={`nav-btn ${location.pathname === ROUTES.changes ? "active" : ""}`}
          data-tooltip="Historial de cambios"
          onClick={() => navigate(ROUTES.changes)}
        >
          <History size={20} />
        </button>

        <button
          className={`nav-btn ${location.pathname === ROUTES.notes ? "active" : ""}`}
          data-tooltip="Notas rápidas"
          onClick={() => navigate(ROUTES.notes)}
        >
          <MessageSquare size={20} />
        </button>

        <button
          className={`nav-btn ${location.pathname === ROUTES.issues ? "active" : ""}`}
          data-tooltip="Reportes / Issues"
          onClick={() => navigate(ROUTES.issues)}
        >
          <Flag size={20} />
        </button>

        <button
          className={`nav-btn ${location.pathname === ROUTES.contextsGlossaries ? "active" : ""}`}
          data-tooltip="Contextos / Glosarios"
          onClick={() => navigate(ROUTES.contextsGlossaries)}
        >
          <BookOpen size={20} />
        </button>

        <button
          className={`nav-btn ${location.pathname === ROUTES.profile ? "active" : ""}`}
          data-tooltip="Perfil"
          onClick={() =>
            navigate(ROUTES.profile, { state: { from: location.pathname } })
          }
        >
          <User size={20} />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
