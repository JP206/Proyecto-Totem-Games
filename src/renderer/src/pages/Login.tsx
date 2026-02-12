// src/renderer/src/pages/Login.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  Link,
  AlertTriangle,
  Rocket,
  Loader2,
  FileText,
} from "lucide-react";
import DesktopManager from "../utils/desktop";
import "../styles/login.css";

const Login: React.FC = () => {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar si ya hay token guardado
    const checkSavedToken = async () => {
      try {
        const desktop = DesktopManager.getInstance();
        const savedToken = await desktop.getConfig("github_token");
        if (savedToken) {
          setToken(savedToken);
        }
      } catch (error) {
        console.log("No hay token guardado");
      }
    };

    checkSavedToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      setError("Por favor ingresa tu token de GitHub");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Verificar token con GitHub API
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Proyecto-Totem-Games",
        },
      });

      if (response.ok) {
        const userData = await response.json();

        // Guardar en configuración
        const desktop = DesktopManager.getInstance();
        await desktop.setConfig("github_token", token);
        await desktop.setConfig("github_user", userData);

        // Mostrar mensaje de éxito
        await desktop.showMessage(
          `¡Bienvenido ${userData.login}!`,
          "Autenticación exitosa",
        );

        // Navegar a la página principal
        navigate("/dashboard");
      } else if (response.status === 401) {
        setError("Token inválido o expirado");
      } else {
        setError(`Error ${response.status}: No se pudo autenticar`);
      }
    } catch (err) {
      setError("Error de conexión. Verifica tu internet.");
    } finally {
      setLoading(false);
    }
  };

  const openTokenPage = async () => {
    const desktop = DesktopManager.getInstance();
    await desktop.openInBrowser("https://github.com/settings/tokens");
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <Lock size={32} />
          </div>
          <h2 className="login-title">Iniciar Sesión en GitHub</h2>
          <p className="login-subtitle">
            Usa tu token personal para acceder a tus repositorios
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Token de Acceso Personal</label>

            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="token-input"
              disabled={loading}
            />

            <button
              type="button"
              onClick={openTokenPage}
              className="token-link-btn"
              disabled={loading}
            >
              <Link size={16} />
              Generar nuevo token en GitHub
            </button>
          </div>

          {error && (
            <div className="error-message">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className={`submit-btn ${loading ? "loading" : ""}`}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spinner" />
                Verificando...
              </>
            ) : (
              <>
                <Rocket size={18} />
                Iniciar Sesión
              </>
            )}
          </button>
        </form>

        <div className="instructions-card">
          <p className="instructions-title">
            <FileText size={18} />
            ¿Cómo obtener tu token?
          </p>
          <ol className="instructions-list">
            <li>
              Ve a GitHub Settings → Developer settings → Personal access tokens
            </li>
            <li>Haz clic en "Generate new token (classic)"</li>
            <li>
              Completa "Note" con lo que gustes y selecciona la expiración deseada. 
            </li>
            <li> Marca
              <code className="code-tag">repo</code> y
              <code className="code-tag">user</code>
            </li>
            <li>Presiona "Generate token"</li>
            <li>Copia el token y pégalo aquí</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Login;
