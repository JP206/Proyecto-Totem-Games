// src/renderer/src/pages/TranslationPreview.tsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import { ArrowLeft, Download, UploadCloud, Globe2, Shield } from "lucide-react";
import "../styles/translation-preview.css";
import "../styles/dashboard.css";

const SOURCE_LANG_CODE = "__source__";
const SOURCE_LANG_NAME = "Origen";

interface TranslationPreviewState {
  fileInfo: { filePath: string; csvContent: string };
  previewData: {
    preview: Array<{
      key: string;
      sourceText: string;
      perLanguage?: Record<
        string,
        {
          openaiText?: string;
          geminiText?: string;
          mergedText?: string;
          confidence?: number;
        }
      >;
    }>;
    stats?: { translatedRows?: number };
    targetLanguages: Array<{ code: string; name: string }>;
    providerMode?: "openai" | "gemini" | "both";
  };
  repoPath: string;
  providerMode: "openai" | "gemini" | "both";
  sourceLanguageName?: string;
}

const TranslationPreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as TranslationPreviewState | null;

  const [selectedLangCode, setSelectedLangCode] = useState<string>(SOURCE_LANG_CODE);
  const [providerView, setProviderView] = useState<"merged" | "openai" | "gemini">("merged");
  const [uploading, setUploading] = useState(false);

  if (!state?.fileInfo || !state?.previewData) {
    navigate("/landing", { replace: true });
    return null;
  }

  const { fileInfo, previewData, repoPath, providerMode } = state;
  const sourceLabel = state.sourceLanguageName || SOURCE_LANG_NAME;
  const targetLangs = previewData.targetLanguages || [];
  const languageOptions: { code: string; name: string }[] = [
    { code: SOURCE_LANG_CODE, name: sourceLabel },
    ...targetLangs,
  ];
  const effectiveLangCode =
    selectedLangCode || (languageOptions.length > 0 ? languageOptions[0].code : SOURCE_LANG_CODE);
  const isSourceView = effectiveLangCode === SOURCE_LANG_CODE;
  const rows = previewData.preview || [];
  const currentProviderView =
    providerMode === "both"
      ? providerView
      : providerMode === "openai"
        ? "openai"
        : "gemini";

  const handleDownload = () => {
    const blob = new Blob([fileInfo.csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `localizacion_traducido.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadToRepo = async () => {
    if (!repoPath || !fileInfo.filePath) return;
    const desktop = DesktopManager.getInstance();
    try {
      setUploading(true);
      const result = await desktop.uploadTranslation({
        repoPath,
        filePath: fileInfo.filePath,
      });
      if (result.success) {
        await desktop.showMessage(
          "Traducciones subidas correctamente al repositorio (git push origin main).",
          "Subida completada",
          "info"
        );
      } else {
        await desktop.showMessage(
          result.error || "Error desconocido al subir las traducciones.",
          "Error al subir",
          "error"
        );
      }
    } catch (error: any) {
      await desktop.showMessage(
        error?.message || String(error),
        "Error al subir traducciones",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const getConfidenceClass = (confidence: number | null | undefined) => {
    if (confidence == null) return "translation-preview-confidence-neutral";
    const pct = Math.round(confidence * 100);
    if (pct >= 80) return "translation-preview-confidence-high";
    if (pct >= 50) return "translation-preview-confidence-medium";
    return "translation-preview-confidence-low";
  };

  const renderConfidence = (confidence: number | null | undefined) => {
    if (confidence == null) return <span className={getConfidenceClass(null)}>-</span>;
    const pct = Math.round(confidence * 100);
    return (
      <span className={getConfidenceClass(confidence)}>
        {pct}%
      </span>
    );
  };

  return (
    <>
      <Navbar />
      <div className="translation-preview-page">
        <header className="translation-preview-header">
          <div className="translation-preview-header-left">
            <button
              type="button"
              className="translation-preview-back-btn"
              onClick={() => navigate("/landing")}
            >
              <ArrowLeft size={18} />
              Volver
            </button>
            <div className="translation-preview-title-wrap">
              <h1 className="translation-preview-title">
                <Globe2 size={24} />
                Resultado de traducción AI
              </h1>
              <p className="translation-preview-subtitle">
                {rows.length} filas en vista previa • {previewData.stats?.translatedRows ?? 0} filas traducidas
              </p>
            </div>
          </div>
          <div className="translation-preview-actions">
            <button
              type="button"
              className="translation-preview-btn translation-preview-btn-download"
              onClick={handleDownload}
            >
              <Download size={18} />
              Descargar CSV
            </button>
            <button
              type="button"
              className="translation-preview-btn translation-preview-btn-upload"
              onClick={handleUploadToRepo}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <div className="spinner-small" />
                  Subiendo...
                </>
              ) : (
                <>
                  <UploadCloud size={18} />
                  Subir al repositorio
                </>
              )}
            </button>
          </div>
        </header>

        <div className="translation-preview-card">
          <div className="translation-preview-toolbar">
            <div className="translation-preview-lang-tabs">
              {languageOptions.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={
                    "translation-preview-lang-tab" +
                    (lang.code === effectiveLangCode ? " active" : "")
                  }
                  onClick={() => setSelectedLangCode(lang.code)}
                >
                  {lang.name}
                </button>
              ))}
            </div>
            {providerMode === "both" && (
              <div className="translation-preview-provider-toggle">
                <button
                  type="button"
                  className={
                    "translation-preview-provider-btn" +
                    (providerView === "merged" ? " active" : "")
                  }
                  onClick={() => setProviderView("merged")}
                >
                  Combinado
                </button>
                <button
                  type="button"
                  className={
                    "translation-preview-provider-btn" +
                    (providerView === "openai" ? " active" : "")
                  }
                  onClick={() => setProviderView("openai")}
                >
                  OpenAI
                </button>
                <button
                  type="button"
                  className={
                    "translation-preview-provider-btn" +
                    (providerView === "gemini" ? " active" : "")
                  }
                  onClick={() => setProviderView("gemini")}
                >
                  Gemini
                </button>
              </div>
            )}
          </div>

          <div className="translation-preview-table-wrap">
            <table className="translation-preview-table">
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Texto origen</th>
                  <th>
                    {isSourceView
                      ? "Texto (origen)"
                      : `Traducción (${effectiveLangCode})`}
                    {providerMode === "both" && !isSourceView && (
                      <span style={{ marginLeft: 8, opacity: 0.9 }}>
                        <Shield size={12} style={{ verticalAlign: "middle" }} />
                        {currentProviderView === "merged"
                          ? " Combinado"
                          : ` ${currentProviderView}`}
                      </span>
                    )}
                  </th>
                  {!isSourceView && <th>Confianza</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, idx: number) => {
                  const langData = isSourceView
                    ? null
                    : row.perLanguage?.[effectiveLangCode] || null;
                  let text = "";
                  if (isSourceView) {
                    text = row.sourceText || "";
                  } else if (langData) {
                    if (currentProviderView === "openai") {
                      text = langData.openaiText || langData.mergedText || "";
                    } else if (currentProviderView === "gemini") {
                      text = langData.geminiText || langData.mergedText || "";
                    } else {
                      text =
                        langData.mergedText ||
                        langData.openaiText ||
                        langData.geminiText ||
                        "";
                    }
                  }
                  return (
                    <tr key={idx}>
                      <td className="col-key">{row.key}</td>
                      <td className="col-text">{row.sourceText}</td>
                      <td className="col-text">{text}</td>
                      {!isSourceView && (
                        <td>
                          {langData
                            ? renderConfidence(langData.confidence)
                            : renderConfidence(null)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isSourceView && (
            <div className="translation-preview-footer-note">
              Las filas con baja confianza indican que las traducciones de los
              modelos difieren significativamente y deberían revisarse manualmente.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TranslationPreview;
