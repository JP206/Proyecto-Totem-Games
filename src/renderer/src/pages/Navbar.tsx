// src/renderer/src/pages/Navbar.tsx

import React from "react";
import { useNavigate } from "react-router-dom";
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
import "../styles/navbar.css";

interface NavbarProps {
  projectName?: string;
  repoPath?: string;
  repoName?: string;
}

const Navbar: React.FC<NavbarProps> = ({ projectName, repoPath, repoName }) => {
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      {/* LEFT SECTION: Explorador + Info del proyecto */}
      <div className="navbar-left">
        <button 
          className="nav-btn-explorer" 
          title="Explorador de proyectos"
          onClick={() => navigate("/dashboard")}
        >
          <Eye size={22} />
        </button>
        
        {repoName && (
          <div className="project-info">
            <h1 className="project-title">
              <FolderOpen size={20} />
              <span>{repoName}</span>
            </h1>
            {repoPath && (
              <p className="project-path">
                <MapPin size={12} /> {repoPath}
              </p>
            )}
          </div>
        )}
      </div>

      {/* RIGHT SECTION: Todos los botones de funcionalidades */}
      <div className="navbar-right">
        <button 
          className="nav-btn active" 
          title="Localización"
        >
          <Layers size={20} />
        </button>
        
        <button className="nav-btn" title="Historial de cambios">
          <History size={20} />
        </button>
        
        <button className="nav-btn" title="Notas rápidas">
          <MessageSquare size={20} />
        </button>
        
        <button className="nav-btn" title="Reportes / Issues">
          <Flag size={20} />
        </button>
        
        <button className="nav-btn" title="Contextos / Glosarios">
          <BookOpen size={20} />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;