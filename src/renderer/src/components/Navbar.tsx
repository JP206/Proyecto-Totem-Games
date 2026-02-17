// src/renderer/src/components/Navbar.tsx
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
  Layers
} from "lucide-react";
import DesktopManager from "../utils/desktop";
import "../styles/navbar.css";

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

  // No mostrar la navbar si estamos en login o dashboard
  if (loading) {
    return <nav className="navbar navbar-loading"><div className="spinner-small" /></nav>;
  }

  const showNavbar = !['/login', '/dashboard'].includes(location.pathname);

  if (!showNavbar) {
    return null;
  }

  return (
    <nav className="navbar">
      {/* LEFT SECTION: Explorador + Info del proyecto */}
      <div className="navbar-left">
        <button 
          className="nav-btn-explorer" 
          data-tooltip="Explorador de proyectos"
          onClick={() => navigate("/dashboard")}
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

      {/* RIGHT SECTION: Todos los botones de funcionalidades */}
      <div className="navbar-right">
        <button 
          className={`nav-btn ${location.pathname === '/landing' ? 'active' : ''}`}
          data-tooltip="Localización"
          onClick={() => navigate('/landing')}
        >
          <Layers size={20} />
        </button>
        
        {/* TODO: Crear página ChangeHistory */}
        <button 
          className="nav-btn" 
          data-tooltip="Historial de cambios"
          onClick={() => navigate('/history')}
          disabled={true}
        >
          <History size={20} />
        </button>
        
        <button 
          className={`nav-btn ${location.pathname === '/notes' ? 'active' : ''}`}
          data-tooltip="Notas rápidas"
          onClick={() => navigate('/notes')}
        >
          <MessageSquare size={20} />
        </button>
        
        <button 
          className={`nav-btn ${location.pathname === '/issues' ? 'active' : ''}`}
          data-tooltip="Reportes / Issues"
          onClick={() => navigate('/issues')}
        >
          <Flag size={20} />
        </button>
        
        {/* TODO: Crear página ContextsGlossaries */}
        <button 
          className="nav-btn" 
          data-tooltip="Contextos / Glosarios"
          onClick={() => navigate('/contexts-glossaries')}
          disabled={true}
        >
          <BookOpen size={20} />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;