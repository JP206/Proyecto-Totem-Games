import React, { useState } from "react";
import DesktopManager from "../utils/desktop";
import { X, Download, UploadCloud, Globe2, Shield } from "lucide-react";

interface TranslationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: any | null;
  fileInfo: { filePath: string; csvContent: string } | null;
  repoPath: string;
  providerMode: "openai" | "gemini" | "both";
}

const TranslationPreviewModal: React.FC<TranslationPreviewModalProps> = ({
  isOpen,
  onClose,
  previewData,
  fileInfo,
  repoPath,
  providerMode,
}) => {
  const [selectedLangCode, setSelectedLangCode] = useState<string | null>(null);
  const [providerView, setProviderView] = useState<"merged" | "openai" | "gemini">("merged");
  const [uploading, setUploading] = useState(false);

  if (!isOpen || !previewData || !fileInfo) return null;

  const languages: { code: string; name: string }[] = previewData.targetLanguages || [];
  const effectiveSelectedLangCode =
    selectedLangCode || (languages.length > 0 ? languages[0].code : "");

  const rows = previewData.preview || [];

  const handleDownload = () => {
    const blob = new Blob([fileInfo.csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${previewData?.projectName || "localizacion"}_traducido.csv`;
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

  const renderConfidence = (confidence: number | null | undefined) => {
    if (confidence == null) return <span className="confidence-badge neutral">-</span>;
    const pct = Math.round(confidence * 100);
    let cls = "low";
    if (pct >= 80) cls = "high";
    else if (pct >= 50) cls = "medium";
    return (
      <span className={`confidence-badge ${cls}`}>
        {pct}%
      </span>
    );
  };

  const currentProviderView =
    providerMode === "both" ? providerView : providerMode === "openai" ? "openai" : "gemini";

  return (
    <div className="translation-preview-overlay" onClick={onClose}>
      <div className="translation-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="preview-close-btn" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="preview-header">
          <div className="preview-title">
            <Globe2 size={20} />
            <div>
              <h3>Resultado de traducción AI</h3>
              <span className="preview-subtitle">
                {rows.length} filas en vista previa • {previewData.stats?.translatedRows ?? 0} filas traducidas
              </span>
            </div>
          </div>

          <div className="preview-actions">
            <button className="preview-btn" onClick={handleDownload}>
              <Download size={16} />
              Descargar CSV
            </button>
            <button
              className="preview-btn primary"
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
                  <UploadCloud size={16} />
                  Subir al repositorio
                </>
              )}
            </button>
          </div>
        </div>

        <div className="preview-toolbar">
          <div className="preview-lang-selector">
            {languages.map((lang) => (
              <button
                key={lang.code}
                className={
                  "preview-lang-tab" +
                  (lang.code === effectiveSelectedLangCode ? " active" : "")
                }
                onClick={() => setSelectedLangCode(lang.code)}
              >
                {lang.name}
              </button>
            ))}
          </div>

          {providerMode === "both" && (
            <div className="preview-provider-toggle">
              <button
                className={providerView === "merged" ? "active" : ""}
                onClick={() => setProviderView("merged")}
              >
                Combinado
              </button>
              <button
                className={providerView === "openai" ? "active" : ""}
                onClick={() => setProviderView("openai")}
              >
                OpenAI
              </button>
              <button
                className={providerView === "gemini" ? "active" : ""}
                onClick={() => setProviderView("gemini")}
              >
                Gemini
              </button>
            </div>
          )}
        </div>

        <div className="preview-table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                <th>Clave</th>
                <th>Texto origen</th>
                <th>
                  Traducción ({effectiveSelectedLangCode || "-"})
                  {providerMode === "both" && (
                    <span className="provider-indicator">
                      <Shield size={12} /> {currentProviderView === "merged" ? "Combinado" : currentProviderView}
                    </span>
                  )}
                </th>
                <th>Confianza</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, idx: number) => {
                const langData = row.perLanguage?.[effectiveSelectedLangCode] || null;
                let text = "";
                if (langData) {
                  if (currentProviderView === "openai") {
                    text = langData.openaiText || langData.mergedText || "";
                  } else if (currentProviderView === "gemini") {
                    text = langData.geminiText || langData.mergedText || "";
                  } else {
                    text = langData.mergedText || langData.openaiText || langData.geminiText || "";
                  }
                }

                return (
                  <tr key={idx}>
                    <td className="preview-key">{row.key}</td>
                    <td className="preview-source">{row.sourceText}</td>
                    <td className="preview-translation">{text}</td>
                    <td className="preview-confidence">
                      {langData ? renderConfidence(langData.confidence) : renderConfidence(null)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="preview-footer-note">
          <span>
            Las filas con baja confianza indican que las traducciones de los modelos difieren
            significativamente y deberían revisarse manualmente.
          </span>
        </div>
      </div>
    </div>
  );
};

export default TranslationPreviewModal;

