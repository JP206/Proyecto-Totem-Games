// src/renderer/src/pages/TranslationPreview.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import { parseCSV, stringifyCSV, getDownloadDelimiter } from "../utils/csv";
import { addTokensToday } from "../utils/tokenUsage";
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
  CheckCircle,
  AlertCircle,
  Coins,
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
    stats?: { translatedRows?: number; tokensUsed?: number };
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
  spellCheckStats?: {
    totalRows: number;
    correctedRows: number;
    tokensUsed?: number;
  };
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
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const ROWS_PER_PAGE = 40;
  const spellCheckOnly = Boolean(state?.spellCheckOnly);
  const originSpellCheckDiff =
    !spellCheckOnly &&
    (state?.spellCheckPreview?.length ?? 0) > 0 &&
    selectedLangCode === SOURCE_LANG_CODE;
  const hasTranslationData = Boolean(
    state?.fileInfo && state?.previewData && !spellCheckOnly,
  );
  const hasSpellCheckData = Boolean(
    state?.fileInfo && state?.spellCheckPreview && spellCheckOnly,
  );

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

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

  const dataRowIndices = useMemo(() => {
    // Only show rows that actually have content (key or source text).
    // This avoids paginating hundreds of empty rows from .xlsx exports or trailing blank lines.
    const indices: number[] = [];
    for (let i = 1; i < editableRows.length; i++) {
      const row = editableRows[i];
      if (!row) continue;
      const key = String(row[keyCol] ?? "").trim();
      const source = String(row[sourceCol] ?? "").trim();
      if (spellCheckOnly) {
        // Spellcheck only runs on rows with non-empty source text.
        if (source) indices.push(i);
      } else {
        if (key || source) indices.push(i);
      }
    }
    return indices;
  }, [editableRows, keyCol, sourceCol, spellCheckOnly]);

  const totalDataRows = dataRowIndices.length;
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
  const pageRowIndices = dataRowIndices.slice(
    currentPage * ROWS_PER_PAGE,
    (currentPage + 1) * ROWS_PER_PAGE,
  );
  const rangeStart = totalDataRows ? currentPage * ROWS_PER_PAGE + 1 : 0;
  const rangeEnd = Math.min(
    totalDataRows,
    currentPage * ROWS_PER_PAGE + pageRowIndices.length,
  );

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
    const delimiter = getDownloadDelimiter();
    let rowsToExport: string[][];

    if (!spellCheckOnly && targetLangs.length > 0 && previewRows.length > 0) {
      const headerRow: string[] = [
        "Clave",
        sourceLabel,
        ...targetLangs.map((l) => l.name),
      ];
      const dataRows: string[][] = dataRowIndices.map((dataRowIndex) => {
        const key = getCellValue(dataRowIndex, keyCol);
        const source =
          getCellValue(dataRowIndex, sourceCol) ||
          previewRows.find((pr: any) => pr.rowIndex === dataRowIndex)
            ?.sourceText ||
          "";
        const langCells = targetLangs.map((lang) => {
          const col = langCodeToColIndex[lang.code];
          const fromCell =
            col !== undefined ? getCellValue(dataRowIndex, col) : "";
          if (fromCell) return fromCell;
          const pr = previewRows.find((p: any) => p.rowIndex === dataRowIndex);
          const merged =
            pr?.perLanguage?.[lang.code]?.mergedText ??
            pr?.perLanguage?.[lang.code]?.openaiText ??
            pr?.perLanguage?.[lang.code]?.geminiText ??
            "";
          return merged;
        });
        return [key, source, ...langCells];
      });
      rowsToExport = [headerRow, ...dataRows];
    } else {
      rowsToExport =
        editableRows.length > 0
          ? editableRows.map((r) => r.slice())
          : parseCSV(fileInfo.csvContent);
    }

    if (!rowsToExport.length) return;
    const header = rowsToExport[0] ?? [];
    const numCols = Math.max(
      header.length,
      ...rowsToExport.map((r) => r.length),
    );
    const normalizedRows = rowsToExport.map((row) => {
      const r = row.slice();
      while (r.length < numCols) r.push("");
      return r;
    });
    const content = stringifyCSV(normalizedRows, delimiter);
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + content], {
      type: "text/csv;charset=utf-8;",
    });
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
      const contentToWrite =
        editableRows.length > 0
          ? stringifyCSV(editableRows)
          : state.fileInfo.csvContent;
      const writeResult = await desktop.writeTranslationFile({
        filePath: state.fileInfo.filePath,
        content: contentToWrite,
      });
      if (!writeResult.success) {
        showNotification("error", writeResult.error || "Error al guardar correcciones.");
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
      if (state.repoPath && (result.stats?.tokensUsed ?? 0) > 0) {
        addTokensToday(state.repoPath, result.stats.tokensUsed ?? 0);
      }
      navigate("/translation-preview", {
        replace: true,
        state: {
          fileInfo,
          previewData,
          repoPath: state.repoPath,
          providerMode: state.providerMode,
          sourceLanguageName: state.sourceLanguageName || "Origen",
          targetLanguages: state.targetLanguages || [],
          spellCheckPreview: state.spellCheckPreview,
          spellCheckStats: state.spellCheckStats,
        },
      });
    } catch (error: any) {
      showNotification("error", error?.message || "Error en traducción");
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
        showNotification("error", writeResult.error || "Error al guardar el archivo.");
        return;
      }
      const result = await desktop.uploadTranslation({
        repoPath,
        filePath: fileInfo.filePath,
      });
      if (result.success) {
        showNotification("success", "Traducciones subidas correctamente al repositorio");
      } else {
        showNotification("error", result.error || "Error al subir las traducciones");
      }
    } catch (error: any) {
      showNotification("error", error?.message || "Error al subir traducciones");
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
        {notification && (
          <div className={`translation-preview-notification ${notification.type}`}>
            {notification.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{notification.message}</span>
          </div>
        )}

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
                  ` • Mostrando ${rangeStart}–${rangeEnd} de ${totalDataRows}`}
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

        {((spellCheckOnly && (state.spellCheckStats?.tokensUsed ?? 0) > 0) ||
          (!spellCheckOnly &&
            ((previewData?.stats?.tokensUsed ?? 0) > 0 ||
              (state?.spellCheckStats?.tokensUsed ?? 0) > 0))) && (
          <div className="translation-preview-tokens-card">
            <div className="translation-preview-tokens-header">
              <Coins size={20} />
              <span>Tokens utilizados (traducción + revisión ortográfica)</span>
            </div>
            <div className="translation-preview-tokens-body">
              {spellCheckOnly ? (
                <div className="translation-preview-tokens-row">
                  <span className="translation-preview-tokens-label">
                    Revisión ortográfica
                  </span>
                  <span className="translation-preview-tokens-value">
                    {(state.spellCheckStats?.tokensUsed ?? 0).toLocaleString()}
                  </span>
                </div>
              ) : (
                <>
                  {(state?.spellCheckStats?.tokensUsed ?? 0) > 0 && (
                    <div className="translation-preview-tokens-row">
                      <span className="translation-preview-tokens-label">
                        Revisión ortográfica
                      </span>
                      <span className="translation-preview-tokens-value">
                        {(
                          state.spellCheckStats?.tokensUsed ?? 0
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {(previewData?.stats?.tokensUsed ?? 0) > 0 && (
                    <div className="translation-preview-tokens-row">
                      <span className="translation-preview-tokens-label">
                        Traducción
                      </span>
                      <span className="translation-preview-tokens-value">
                        {(previewData?.stats?.tokensUsed ?? 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {(state?.spellCheckStats?.tokensUsed ?? 0) > 0 &&
                    (previewData?.stats?.tokensUsed ?? 0) > 0 && (
                      <div className="translation-preview-tokens-row translation-preview-tokens-total">
                        <span className="translation-preview-tokens-label">
                          Total
                        </span>
                        <span className="translation-preview-tokens-value">
                          {(
                            (state?.spellCheckStats?.tokensUsed ?? 0) +
                            (previewData?.stats?.tokensUsed ?? 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        )}

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
                  <th>
                    {spellCheckOnly
                      ? "Texto original"
                      : originSpellCheckDiff
                        ? "Texto original (antes de corrección)"
                        : "Texto origen"}
                  </th>
                  <th>
                    {spellCheckOnly
                      ? "Texto corregido"
                      : originSpellCheckDiff
                        ? "Texto corregido (origen)"
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
                      const spellRow = state?.spellCheckPreview?.find(
                        (p) => p.rowIndex === dataRowIndex,
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
                      if (originSpellCheckDiff) {
                        const originalVal =
                          spellRow?.originalSource ?? sourceVal;
                        const correctedVal =
                          spellRow?.correctedSource ?? sourceVal;
                        return (
                          <tr key={key + String(dataRowIndex)}>
                            <td className="col-key">{key}</td>
                            <td className="col-text translation-preview-diff-original">
                              {originalVal}
                            </td>
                            <td className="col-text translation-preview-diff-corrected">
                              {correctedVal}
                            </td>
                          </tr>
                        );
                      }
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
