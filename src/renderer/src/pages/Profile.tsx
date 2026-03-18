import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import "../styles/profile.css";
import { CheckCircle, Loader2, KeyRound, Shield, ArrowLeft } from "lucide-react";

type ProviderId = "openai" | "gemini";

interface ProviderModelInfo {
  id: string;
  displayName: string;
}

interface PersonalProviderConfigSummary {
  hasKey: boolean;
  defaultModel: string | null;
  models: ProviderModelInfo[];
}

interface PersonalAIConfigSummary {
  openai: PersonalProviderConfigSummary;
  gemini: PersonalProviderConfigSummary;
}

interface SaveResult {
  success: boolean;
  error?: string;
  models?: ProviderModelInfo[];
  defaultModelId?: string | null;
}

interface ProviderLocalState {
  apiKeyInput: string;
  saving: boolean;
  success: boolean;
  error: string | null;
  models: ProviderModelInfo[];
  selectedModel: string | null;
  hasKey: boolean;
}

const initialProviderState: ProviderLocalState = {
  apiKeyInput: "",
  saving: false,
  success: false,
  error: null,
  models: [],
  selectedModel: null,
  hasKey: false,
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const fromPath: string | null =
    (location.state && typeof location.state.from === "string"
      ? location.state.from
      : null) || null;
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasProject, setHasProject] = useState(false);
  const [openaiState, setOpenaiState] =
    useState<ProviderLocalState>(initialProviderState);
  const [geminiState, setGeminiState] =
    useState<ProviderLocalState>(initialProviderState);

  useEffect(() => {
    const loadData = async () => {
      try {
        const desktop = DesktopManager.getInstance();
        const userData = await desktop.getConfig("github_user");
        setUser(userData);

        const currentProject = await desktop.getConfig("current_project");
        setHasProject(!!currentProject?.repoPath && !!currentProject?.repoName);

        const aiConfig =
          (await window.electronAPI.getPersonalAIConfig()) as PersonalAIConfigSummary;

        setOpenaiState((prev) => ({
          ...prev,
          hasKey: aiConfig.openai.hasKey,
          apiKeyInput: aiConfig.openai.hasKey ? "********" : "",
          models: aiConfig.openai.models,
          selectedModel: aiConfig.openai.defaultModel,
        }));

        setGeminiState((prev) => ({
          ...prev,
          hasKey: aiConfig.gemini.hasKey,
          apiKeyInput: aiConfig.gemini.hasKey ? "********" : "",
          models: aiConfig.gemini.models,
          selectedModel: aiConfig.gemini.defaultModel,
        }));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSaveProvider = async (provider: ProviderId) => {
    const isOpenai = provider === "openai";
    const state = isOpenai ? openaiState : geminiState;
    const setState = isOpenai ? setOpenaiState : setGeminiState;

    setState((prev) => ({
      ...prev,
      saving: true,
      success: false,
      error: null,
    }));

    try {
      const apiKeyValue = state.apiKeyInput;
      const preferredModelId = state.selectedModel;

      const masked = "********";
      const apiKeyArg =
        state.hasKey && (apiKeyValue === masked || apiKeyValue.trim() === "")
          ? null
          : apiKeyValue;

      const result = (await window.electronAPI.savePersonalAIConfig(
        provider,
        apiKeyArg,
        preferredModelId,
      )) as SaveResult;

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          saving: false,
          success: false,
          error: result.error || "No se pudo guardar la configuración.",
          hasKey: prev.hasKey,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        saving: false,
        success: true,
        error: null,
        hasKey: result.defaultModelId != null,
        apiKeyInput: result.defaultModelId != null ? masked : "",
        models: result.models && result.models.length > 0 ? result.models : prev.models,
        selectedModel:
          result.defaultModelId != null ? result.defaultModelId : prev.selectedModel,
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        saving: false,
        success: false,
        error: error?.message || String(error),
      }));
    }
  };

  const handleDeleteProviderKey = async (provider: ProviderId) => {
    const isOpenai = provider === "openai";
    const setState = isOpenai ? setOpenaiState : setGeminiState;

    setState((prev) => ({
      ...prev,
      saving: true,
      success: false,
      error: null,
    }));

    try {
      const result = (await window.electronAPI.savePersonalAIConfig(
        provider,
        "",
        null,
      )) as SaveResult;

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          saving: false,
          success: false,
          error: result.error || "No se pudo borrar la API key.",
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        saving: false,
        success: true,
        error: null,
        hasKey: false,
        apiKeyInput: "",
        models: [],
        selectedModel: null,
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        saving: false,
        success: false,
        error: error?.message || String(error),
      }));
    }
  };

  const renderProviderCard = (
    id: ProviderId,
    title: string,
    description: string,
    state: ProviderLocalState,
    setState: React.Dispatch<React.SetStateAction<ProviderLocalState>>,
  ) => {
    const label = id === "openai" ? "OpenAI" : "Gemini";

    return (
      <div className="profile-provider-card">
        <div className="profile-provider-header">
          <div className="profile-provider-title">
            <KeyRound size={18} />
            <div>
              <h3>{label}</h3>
              <p>{description}</p>
            </div>
          </div>
          {state.hasKey && (
            <span className="profile-provider-badge">Key configurada</span>
          )}
        </div>

        <div className="profile-provider-body">
          <label className="profile-input-label">
            API Key personal de {label}
          </label>
          <div className="profile-input-row">
            <input
              type="password"
              className="profile-input"
              placeholder={
                id === "openai"
                  ? "sk-... o clave de OpenAI"
                  : "AIza... o clave de Gemini"
              }
              value={state.apiKeyInput}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  apiKeyInput: e.target.value,
                  success: false,
                  error: null,
                }))
              }
            />
            <button
              className="profile-save-btn"
              disabled={state.saving}
              onClick={() => handleSaveProvider(id)}
            >
              {state.saving ? (
                <>
                  <Loader2 size={16} className="profile-spinner" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
          <div className="profile-status-row">
            {state.saving && (
              <span className="profile-status loading">Validando API key...</span>
            )}
            {!state.saving && state.success && (
              <span className="profile-status success">
                <CheckCircle size={16} />
                Funcionando
              </span>
            )}
            {!state.saving && state.error && (
              <span className="profile-status error">{state.error}</span>
            )}
          </div>

          {state.hasKey && !state.error && (
            <div className="profile-provider-hint">
              Ya tenés una API key guardada para {label}. Si modificás este campo,
              vas a reemplazarla.
            </div>
          )}

          <div className="profile-status-row">
            <button
              type="button"
              className="profile-delete-btn"
              disabled={!state.hasKey || state.saving}
              onClick={() => handleDeleteProviderKey(id)}
            >
              Borrar API key personal de {label}
            </button>
          </div>

          <div className="profile-model-section">
            <label className="profile-input-label">Modelo por defecto</label>
            <select
              className="profile-select"
              disabled={!state.hasKey || state.saving || state.models.length === 0}
              value={state.selectedModel || ""}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  selectedModel: e.target.value || null,
                  success: false,
                }))
              }
            >
              {state.models.length === 0 && (
                <option value="">Sin modelos disponibles</option>
              )}
              {state.models.length > 0 && (
                <>
                  <option value="">Seleccionar modelo</option>
                  {state.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="profile-container profile-loading">
        <div className="spinner-large" />
        <p>Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header-bar">
        <button
          type="button"
          className="profile-back-btn"
          onClick={() => {
            if (fromPath) {
              navigate(fromPath);
              return;
            }
            navigate(hasProject ? "/landing" : "/dashboard");
          }}
        >
          <ArrowLeft size={18} />
          <span>Volver</span>
        </button>
      </div>

      <div className="profile-header-card">
        {user?.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.login}
            className="profile-avatar"
          />
        )}
        <div className="profile-header-info">
          <h1 className="profile-name">{user?.name || user?.login}</h1>
          <p className="profile-username">@{user?.login}</p>
          <div className="profile-role">
            <Shield size={14} />
            <span>Desarrollador</span>
          </div>
        </div>
      </div>

      <div className="profile-providers-grid">
        {renderProviderCard(
          "openai",
          "OpenAI",
          "Usar tu propia API key de OpenAI para traducciones y corrección.",
          openaiState,
          setOpenaiState,
        )}
        {renderProviderCard(
          "gemini",
          "Gemini",
          "Usar tu propia API key de Gemini para traducciones y corrección.",
          geminiState,
          setGeminiState,
        )}
      </div>
    </div>
  );
};

export default Profile;

