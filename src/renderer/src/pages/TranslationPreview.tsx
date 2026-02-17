// src/renderer/src/pages/TranslationPreview.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import { parseCSV, stringifyCSV } from "../utils/csv";
import {
  ArrowLeft,
  Download,
  UploadCloud,
  Globe2,
  Shield,
  RotateCcw,
  Undo2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import "../styles/translation-preview.css";
import "../styles/dashboard.css";

const SOURCE_LANG_CODE = "__source__";
const SOURCE_LANG_NAME = "Origen";

interface TranslationPreviewState {
  fileInfo: { filePath: string; csvContent: string };
  previewData?: {
    preview: Array<{
      rowIndex?: number;
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
  /** Spell-check-only mode: show diff and "Confirmar traducciones" */
  spellCheckOnly?: boolean;
  spellCheckPreview?: Array<{
    rowIndex: number;
    key: string;
    originalSource: string;
    correctedSource: string;
  }>;
  spellCheckStats?: { totalRows: number; correctedRows: number };
  translationPayload?: any;
  repoPath: string;
  providerMode: "openai" | "gemini" | "both";
  sourceLanguageName?: string;
  targetLanguages?: Array<{ code: string; name: string }>;
}

const TranslationPreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as TranslationPreviewState | null;

  const [selectedLangCode, setSelectedLangCode] =
    useState<string>(SOURCE_LANG_CODE);
  const [providerView, setProviderView] = useState<
    "merged" | "openai" | "gemini"
  >("merged");
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [confirmProgressPercent, setConfirmProgressPercent] = useState(0);
  const [editableRows, setEditableRows] = useState<string[][]>([]);
  const [originalRows, setOriginalRows] = useState<string[][]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  const ROWS_PER_PAGE = 40;
  const spellCheckOnly = Boolean(state?.spellCheckOnly);
  const hasTranslationData = Boolean(
    state?.fileInfo && state?.previewData && !spellCheckOnly,
  );
  const hasSpellCheckData = Boolean(
    state?.fileInfo && state?.spellCheckPreview && spellCheckOnly,
  );

  const { header, keyCol, sourceCol, langCodeToColIndex } = useMemo(() => {
    const targetLangs =
      state?.previewData?.targetLanguages || state?.targetLanguages || [];
    if (!state?.fileInfo?.csvContent || !targetLangs.length) {
      return {
        header: [] as string[],
        keyCol: 0,
        sourceCol: 1,
        langCodeToColIndex: {} as Record<string, number>,
      };
    }
    const rows = parseCSV(state.fileInfo.csvContent);
    const h = rows[0] || [];
    const langCodeToCol: Record<string, number> = {};
    for (let col = 2; col < h.length; col++) {
      const name = (h[col] || "").trim().toLowerCase();
      const lang = targetLangs.find((l) => l.name.toLowerCase() === name);
      if (lang) langCodeToCol[lang.code] = col;
    }
    targetLangs.forEach((lang, i) => {
      if (langCodeToCol[lang.code] === undefined)
        langCodeToCol[lang.code] = 2 + i;
    });
    return {
      header: h,
      keyCol: 0,
      sourceCol: 1,
      langCodeToColIndex: langCodeToCol,
    };
  }, [
    state?.fileInfo?.csvContent,
    state?.previewData?.targetLanguages,
    state?.targetLanguages,
  ]);

  useEffect(() => {
    if (!state?.fileInfo?.csvContent || editableRows.length > 0) return;
    const rows = parseCSV(state.fileInfo.csvContent);
    setEditableRows(rows.map((r) => r.slice()));
    const orig = rows.map((r) => r.slice());
    if (state.spellCheckOnly && state.spellCheckPreview?.length) {
      for (const p of state.spellCheckPreview) {
        if (orig[p.rowIndex] && orig[p.rowIndex]!.length > 1)
          orig[p.rowIndex]![1] = p.originalSource;
      }
    }
    setOriginalRows(orig);
  }, [state?.fileInfo?.csvContent]);

  const totalDataRows = editableRows.length <= 1 ? 0 : editableRows.length - 1;
  const totalPages = Math.max(1, Math.ceil(totalDataRows / ROWS_PER_PAGE));
  const effectiveTotalPages = totalPages;

  useEffect(() => {
    const maxPage = Math.max(0, effectiveTotalPages - 1);
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [effectiveTotalPages, currentPage]);

  if (!state?.fileInfo || (!hasTranslationData && !hasSpellCheckData)) {
    navigate("/landing", { replace: true });
    return null;
  }

  const { fileInfo, repoPath, providerMode } = state;
  const previewData = state.previewData;
  const sourceLabel = state.sourceLanguageName || SOURCE_LANG_NAME;
  const targetLangs =
    previewData?.targetLanguages || state.targetLanguages || [];
  const languageOptions: { code: string; name: string }[] = [
    { code: SOURCE_LANG_CODE, name: sourceLabel },
    ...targetLangs,
  ];
  const effectiveLangCode =
    selectedLangCode ||
    (languageOptions.length > 0 ? languageOptions[0].code : SOURCE_LANG_CODE);
  const isSourceView = effectiveLangCode === SOURCE_LANG_CODE;
  const previewRows = previewData?.preview || [];
  const pageStart = currentPage * ROWS_PER_PAGE + 1;
  const pageEnd = Math.min(editableRows.length, pageStart + ROWS_PER_PAGE);
  const pageRowIndices: number[] = [];
  for (let i = pageStart; i < pageEnd; i++) pageRowIndices.push(i);

  const currentProviderView =
    providerMode === "both"
      ? providerView
      : providerMode === "openai"
        ? "openai"
        : "gemini";

  const getCellValue = (rowIndex: number, colIndex: number): string => {
    if (rowIndex < 0 || rowIndex >= editableRows.length) return "";
    const row = editableRows[rowIndex];
    if (!row || colIndex < 0 || colIndex >= row.length) return "";
    return row[colIndex] ?? "";
  };

  const setCellValue = (rowIndex: number, colIndex: number, value: string) => {
    setEditableRows((prev) => {
      const next = prev.map((r) => r.slice());
      if (rowIndex < 0 || rowIndex >= next.length) return prev;
      const row = next[rowIndex];
      if (!row) return prev;
      while (row.length <= colIndex) row.push("");
      row[colIndex] = value;
      return next;
    });
  };

  const getOriginalCellValue = (rowIndex: number, colIndex: number): string => {
    if (rowIndex < 0 || rowIndex >= originalRows.length) return "";
    const row = originalRows[rowIndex];
    if (!row || colIndex < 0 || colIndex >= row.length) return "";
    return row[colIndex] ?? "";
  };

  const hasCellChanged = (rowIndex: number, colIndex: number): boolean =>
    getCellValue(rowIndex, colIndex) !==
    getOriginalCellValue(rowIndex, colIndex);

  const handleDownload = () => {
    const content =
      editableRows.length > 0
        ? stringifyCSV(editableRows)
        : fileInfo.csvContent;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `localizacion_traducido.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRollback = () => {
    setEditableRows(originalRows.map((r) => r.slice()));
  };

  const handleConfirmTranslations = async () => {
    if (!state?.translationPayload || !state?.fileInfo) return;
    const desktop = DesktopManager.getInstance();
    try {
      setTranslating(true);
      setConfirmProgressPercent(0);
      const writeResult = await desktop.writeTranslationFile({
        filePath: state.fileInfo.filePath,
        content: state.fileInfo.csvContent,
      });
      if (!writeResult.success) {
        await desktop.showMessage(
          writeResult.error || "Error al guardar correcciones.",
          "Error",
          "error",
        );
        return;
      }
      const unsub = desktop.onTranslationProgress((d) =>
        setConfirmProgressPercent(d.percent),
      );
      const result = await desktop.translateFile(state.translationPayload);
      unsub();
      setConfirmProgressPercent(100);
      const fileInfo = {
        filePath: result.filePath,
        csvContent: result.csvContent,
      };
      const previewData = {
        preview: result.preview,
        stats: result.stats,
        providerMode: state.providerMode,
        targetLanguages: state.targetLanguages || [],
      };
      navigate("/translation-preview", {
        replace: true,
        state: {
          fileInfo,
          previewData,
          repoPath: state.repoPath,
          providerMode: state.providerMode,
          sourceLanguageName: state.sourceLanguageName || "Origen",
        },
      });
    } catch (error: any) {
      await desktop.showMessage(
        error?.message || String(error),
        "Error en traducción",
        "error",
      );
    } finally {
      setTranslating(false);
      setConfirmProgressPercent(0);
    }
  };

  const handleUploadToRepo = async () => {
    if (!repoPath || !fileInfo.filePath) return;
    const desktop = DesktopManager.getInstance();
    try {
      setUploading(true);
      const content = editableRows.length
        ? stringifyCSV(editableRows)
        : fileInfo.csvContent;
      const writeResult = await desktop.writeTranslationFile({
        filePath: fileInfo.filePath,
        content,
      });
      if (!writeResult.success) {
        await desktop.showMessage(
          writeResult.error || "Error al guardar el archivo.",
          "Error",
          "error",
        );
        return;
      }
      const result = await desktop.uploadTranslation({
        repoPath,
        filePath: fileInfo.filePath,
      });
      if (result.success) {
        await desktop.showMessage(
          "Traducciones subidas correctamente al repositorio (git push origin main).",
          "Subida completada",
          "info",
        );
      } else {
        await desktop.showMessage(
          result.error || "Error desconocido al subir las traducciones.",
          "Error al subir",
          "error",
        );
      }
    } catch (error: any) {
      await desktop.showMessage(
        error?.message || String(error),
        "Error al subir traducciones",
        "error",
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
    if (confidence == null)
      return <span className={getConfidenceClass(null)}>-</span>;
    const pct = Math.round(confidence * 100);
    return <span className={getConfidenceClass(confidence)}>{pct}%</span>;
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
                {spellCheckOnly
                  ? "Revisión ortográfica y gramatical (IA)"
                  : "Resultado de traducción AI"}
              </h1>
              <p className="translation-preview-subtitle">
                {spellCheckOnly
                  ? `${totalDataRows} filas revisadas • ${state.spellCheckStats?.correctedRows ?? 0} corregidas. Confirma para traducir.`
                  : `${totalDataRows} filas en vista previa • ${previewData?.stats?.translatedRows ?? 0} filas traducidas`}
                {effectiveTotalPages > 1 &&
                  ` • Mostrando ${pageStart}–${Math.min(pageEnd - 1, totalDataRows)} de ${totalDataRows}`}
              </p>
            </div>
          </div>
          <div className="translation-preview-actions">
            {spellCheckOnly ? (
              <>
                <button
                  type="button"
                  className="translation-preview-btn translation-preview-btn-rollback"
                  onClick={() => navigate("/landing")}
                  disabled={translating}
                  title="Descartar correcciones y volver sin guardar"
                >
                  <RotateCcw size={18} />
                  Descartar correcciones
                </button>
                <button
                  type="button"
                  className="translation-preview-btn translation-preview-btn-upload"
                  onClick={handleConfirmTranslations}
                  disabled={translating}
                >
                  {translating ? (
                    <>
                      <div className="spinner-small" />
                      Traduciendo... {confirmProgressPercent}%
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      Confirmar traducciones
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="translation-preview-btn translation-preview-btn-rollback"
                  onClick={handleRollback}
                  title="Revertir a las traducciones originales"
                >
                  <RotateCcw size={18} />
                  Revertir cambios
                </button>
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
              </>
            )}
          </div>
        </header>

        <div className="translation-preview-card">
          {!spellCheckOnly && (
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
          )}

          {spellCheckOnly && (
            <div className="translation-preview-toolbar translation-preview-toolbar-disabled">
              <span className="translation-preview-tabs-disabled-label">
                Idiomas disponibles después de confirmar traducciones
              </span>
              <div className="translation-preview-lang-tabs">
                {languageOptions.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    className="translation-preview-lang-tab"
                    disabled
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="translation-preview-table-wrap">
            <table className="translation-preview-table">
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>{spellCheckOnly ? "Texto original" : "Texto origen"}</th>
                  <th>
                    {spellCheckOnly
                      ? "Texto corregido"
                      : isSourceView
                        ? "Texto (origen)"
                        : `Traducción (${effectiveLangCode})`}
                    {!spellCheckOnly &&
                      providerMode === "both" &&
                      !isSourceView && (
                        <span style={{ marginLeft: 8, opacity: 0.9 }}>
                          <Shield
                            size={12}
                            style={{ verticalAlign: "middle" }}
                          />
                          {currentProviderView === "merged"
                            ? " Combinado"
                            : ` ${currentProviderView}`}
                        </span>
                      )}
                  </th>
                  {!spellCheckOnly && !isSourceView && <th>Confianza</th>}
                </tr>
              </thead>
              <tbody>
                {spellCheckOnly
                  ? pageRowIndices.map((dataRowIndex) => {
                      const row = editableRows[dataRowIndex];
                      const key = row?.[keyCol] ?? "";
                      const originalVal = getOriginalCellValue(
                        dataRowIndex,
                        sourceCol,
                      );
                      const correctedVal = getCellValue(
                        dataRowIndex,
                        sourceCol,
                      );
                      const hasChanged = correctedVal !== originalVal;
                      return (
                        <tr key={key + String(dataRowIndex)}>
                          <td className="col-key">{key}</td>
                          <td className="col-text translation-preview-diff-original">
                            {originalVal}
                          </td>
                          <td className="col-text">
                            <span className="translation-preview-cell-with-undo">
                              <input
                                type="text"
                                className="translation-preview-cell-input translation-preview-diff-corrected"
                                value={correctedVal}
                                onChange={(e) =>
                                  setCellValue(
                                    dataRowIndex,
                                    sourceCol,
                                    e.target.value,
                                  )
                                }
                              />
                              {hasChanged && (
                                <button
                                  type="button"
                                  className="translation-preview-cell-undo"
                                  title="Restaurar texto original"
                                  onClick={() =>
                                    setCellValue(
                                      dataRowIndex,
                                      sourceCol,
                                      getOriginalCellValue(
                                        dataRowIndex,
                                        sourceCol,
                                      ),
                                    )
                                  }
                                >
                                  <Undo2 size={14} />
                                </button>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  : pageRowIndices.map((dataRowIndex) => {
                      const row = editableRows[dataRowIndex];
                      const key = row?.[keyCol] ?? "";
                      const previewRow = previewRows.find(
                        (pr: any) => pr.rowIndex === dataRowIndex,
                      );
                      const langData = isSourceView
                        ? null
                        : previewRow?.perLanguage?.[effectiveLangCode] || null;
                      const editCol = isSourceView
                        ? sourceCol
                        : langCodeToColIndex[effectiveLangCode];
                      let displayText = "";
                      if (isSourceView) {
                        displayText =
                          getCellValue(dataRowIndex, sourceCol) ||
                          previewRow?.sourceText ||
                          "";
                      } else {
                        if (editCol !== undefined)
                          displayText = getCellValue(dataRowIndex, editCol);
                        if (!displayText && langData) {
                          if (currentProviderView === "openai")
                            displayText =
                              langData.openaiText || langData.mergedText || "";
                          else if (currentProviderView === "gemini")
                            displayText =
                              langData.geminiText || langData.mergedText || "";
                          else
                            displayText =
                              langData.mergedText ||
                              langData.openaiText ||
                              langData.geminiText ||
                              "";
                        }
                      }
                      const sourceVal =
                        getCellValue(dataRowIndex, sourceCol) ||
                        previewRow?.sourceText ||
                        "";
                      return (
                        <tr key={key + String(dataRowIndex)}>
                          <td className="col-key">{key}</td>
                          <td className="col-text">
                            <span className="translation-preview-cell-with-undo">
                              <input
                                type="text"
                                className="translation-preview-cell-input"
                                value={sourceVal}
                                onChange={(e) =>
                                  setCellValue(
                                    dataRowIndex,
                                    sourceCol,
                                    e.target.value,
                                  )
                                }
                              />
                              {hasCellChanged(dataRowIndex, sourceCol) && (
                                <button
                                  type="button"
                                  className="translation-preview-cell-undo"
                                  title="Revertir este campo"
                                  onClick={() =>
                                    setCellValue(
                                      dataRowIndex,
                                      sourceCol,
                                      getOriginalCellValue(
                                        dataRowIndex,
                                        sourceCol,
                                      ),
                                    )
                                  }
                                >
                                  <Undo2 size={14} />
                                </button>
                              )}
                            </span>
                          </td>
                          <td className="col-text">
                            <span className="translation-preview-cell-with-undo">
                              <input
                                type="text"
                                className="translation-preview-cell-input"
                                value={displayText}
                                onChange={(e) => {
                                  if (isSourceView)
                                    setCellValue(
                                      dataRowIndex,
                                      sourceCol,
                                      e.target.value,
                                    );
                                  else if (editCol !== undefined)
                                    setCellValue(
                                      dataRowIndex,
                                      editCol,
                                      e.target.value,
                                    );
                                }}
                              />
                              {editCol !== undefined &&
                                hasCellChanged(dataRowIndex, editCol) && (
                                  <button
                                    type="button"
                                    className="translation-preview-cell-undo"
                                    title="Revertir este campo"
                                    onClick={() =>
                                      setCellValue(
                                        dataRowIndex,
                                        editCol,
                                        getOriginalCellValue(
                                          dataRowIndex,
                                          editCol,
                                        ),
                                      )
                                    }
                                  >
                                    <Undo2 size={14} />
                                  </button>
                                )}
                            </span>
                          </td>
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

          {effectiveTotalPages > 1 && (
            <div className="translation-preview-pagination">
              <button
                type="button"
                className="translation-preview-pagination-btn"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                title="Página anterior"
              >
                <ChevronLeft size={18} />
                Anterior
              </button>
              <span className="translation-preview-pagination-info">
                Página {currentPage + 1} de {effectiveTotalPages}
              </span>
              <button
                type="button"
                className="translation-preview-pagination-btn"
                disabled={currentPage >= effectiveTotalPages - 1}
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(effectiveTotalPages - 1, p + 1),
                  )
                }
                title="Página siguiente"
              >
                Siguiente
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {!spellCheckOnly && !isSourceView && (
            <div className="translation-preview-footer-note">
              Las filas con baja confianza indican que las traducciones de los
              modelos difieren significativamente y deberían revisarse
              manualmente.
            </div>
          )}
          {spellCheckOnly && (
            <div className="translation-preview-footer-note">
              Revisión ortográfica y gramatical con IA. Puedes restaurar el
              texto original por diálogo (deshacer) o confirmar para traducir
              con el texto corregido.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TranslationPreview;
