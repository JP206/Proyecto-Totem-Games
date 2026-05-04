// src/renderer/src/pages/TranslationPreview.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DesktopManager from "../../utils/desktop";
import PageWithNavbar from "../../components/PageWithNavbar/PageWithNavbar";
import Toast from "../../components/Toast/Toast";
import { parseCSV, stringifyCSV, getDownloadDelimiter } from "../../utils/csv";
import { addTokensToday } from "../../utils/tokenUsage";
import {
  Shield,
  Undo2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Bookmark,
} from "lucide-react";
import "./translation-preview.css";
import "./dashboard.css";
import { SOURCE_LANG_CODE, SOURCE_LANG_NAME } from "./constants";
import { isRowPreExistingTranslation } from "./utils/rowHelpers";
import FloatingHelpIcon from "./components/FloatingHelpIcon";
import TranslationPreviewHeader from "./components/TranslationPreviewHeader";
import TranslationRowDetailModal from "./components/TranslationRowDetailModal";

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
          roundTripText?: string;
          textSimilarity?: number;
          embeddingSimilarity?: number;
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
  const [showRoundTripCheck, setShowRoundTripCheck] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [wordsMin, setWordsMin] = useState(0);
  const [wordsMax, setWordsMax] = useState(100);
  const [meaningMin, setMeaningMin] = useState(0);
  const [meaningMax, setMeaningMax] = useState(100);
  const [appliedWordsMin, setAppliedWordsMin] = useState(0);
  const [appliedWordsMax, setAppliedWordsMax] = useState(100);
  const [appliedMeaningMin, setAppliedMeaningMin] = useState(0);
  const [appliedMeaningMax, setAppliedMeaningMax] = useState(100);
  const [showOnlyCorrections, setShowOnlyCorrections] = useState(false);
  const [appliedShowOnlyCorrections, setAppliedShowOnlyCorrections] = useState(false);
  const [hidePreExistingTranslated, setHidePreExistingTranslated] = useState(false);
  const [rowModal, setRowModal] = useState<
    | null
    | {
        rowIndex: number;
        variant: "spellcheck" | "translation" | "spellDiff" | "sourceOnly";
      }
  >(null);
  const [modalDraft, setModalDraft] = useState({
    key: "",
    source: "",
    target: "",
    roundTrip: "",
  });

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
  const clampPct = (value: number): number => Math.min(100, Math.max(0, value));
  const formatAvgPct = (value: number | null): string =>
    value == null ? "-" : `${Math.round(value)}%`;

  const { keyCol, sourceCol, langCodeToColIndex } = useMemo(() => {
    const targetLangs =
      state?.previewData?.targetLanguages || state?.targetLanguages || [];
    if (!state?.fileInfo?.csvContent || !targetLangs.length) {
      return {
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

  useEffect(() => {
    if (!rowModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRowModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rowModal]);

  const fileInfo = state?.fileInfo;
  const repoPath = state?.repoPath || "";
  const providerMode = state?.providerMode || "openai";
  const previewData = state?.previewData;
  const sourceLabel = state?.sourceLanguageName || SOURCE_LANG_NAME;
  const targetLangs =
    previewData?.targetLanguages || state?.targetLanguages || [];
  const languageOptions: { code: string; name: string }[] = [
    { code: SOURCE_LANG_CODE, name: sourceLabel },
    ...targetLangs,
  ];
  const effectiveLangCode =
    selectedLangCode ||
    (languageOptions.length > 0 ? languageOptions[0].code : SOURCE_LANG_CODE);
  const isSourceView = effectiveLangCode === SOURCE_LANG_CODE;
  const effectiveLangName =
    languageOptions.find((l) => l.code === effectiveLangCode)?.name || "Idioma";
  const previewRows = previewData?.preview || [];
  const hasMeaningScoresForSelectedLanguage =
    !isSourceView &&
    previewRows.some(
      (row: any) =>
        row?.perLanguage?.[effectiveLangCode]?.embeddingSimilarity != null,
    );
  const hasWordScoresForSelectedLanguage =
    !isSourceView &&
    previewRows.some(
      (row: any) => row?.perLanguage?.[effectiveLangCode]?.textSimilarity != null,
    );
  const confidenceAverages = useMemo(() => {
    const computeAverages = (
      items: Array<{
        textSimilarity?: number | null;
        embeddingSimilarity?: number | null;
        confidence?: number | null;
      }>,
    ) => {
      let wordsSum = 0;
      let wordsCount = 0;
      let meaningSum = 0;
      let meaningCount = 0;
      let overallSum = 0;
      let overallCount = 0;
      for (const item of items) {
        if (item.textSimilarity != null) {
          wordsSum += item.textSimilarity * 100;
          wordsCount++;
        }
        if (item.embeddingSimilarity != null) {
          meaningSum += item.embeddingSimilarity * 100;
          meaningCount++;
        }
        const parts: number[] = [];
        if (item.textSimilarity != null) {
          parts.push(item.textSimilarity * 100);
        }
        if (item.embeddingSimilarity != null) {
          parts.push(item.embeddingSimilarity * 100);
        }
        const overallPct =
          item.confidence != null
            ? item.confidence * 100
            : parts.length > 0
              ? parts.reduce((acc, cur) => acc + cur, 0) / parts.length
              : null;
        if (overallPct != null) {
          overallSum += overallPct;
          overallCount++;
        }
      }
      return {
        overall: overallCount > 0 ? overallSum / overallCount : null,
        words: wordsCount > 0 ? wordsSum / wordsCount : null,
        meaning: meaningCount > 0 ? meaningSum / meaningCount : null,
      };
    };

    const sharedItems = previewRows.flatMap((row: any) =>
      Object.values((row?.perLanguage as Record<string, any>) || {}),
    );
    const langItems = isSourceView
      ? []
      : previewRows
          .map((row: any) => row?.perLanguage?.[effectiveLangCode])
          .filter(Boolean);

    return {
      shared: computeAverages(sharedItems),
      language: computeAverages(langItems as any[]),
    };
  }, [previewRows, effectiveLangCode, isSourceView]);
  const filteredDataRowIndices = useMemo(() => {
    if (spellCheckOnly) {
      if (!appliedShowOnlyCorrections) return dataRowIndices;
      return dataRowIndices.filter((rowIndex) => {
        const currentSource = String(editableRows[rowIndex]?.[sourceCol] ?? "").trim();
        const originalSource = String(originalRows[rowIndex]?.[sourceCol] ?? "").trim();
        return currentSource !== originalSource;
      });
    }
    if (isSourceView) return dataRowIndices;
    const langCol = langCodeToColIndex[effectiveLangCode];
    return dataRowIndices.filter((rowIndex) => {
      if (
        hidePreExistingTranslated &&
        isRowPreExistingTranslation(
          rowIndex,
          effectiveLangCode,
          editableRows,
          previewRows,
          sourceCol,
          langCol,
        )
      ) {
        return false;
      }
      const langData = previewRows.find((pr: any) => pr.rowIndex === rowIndex)
        ?.perLanguage?.[effectiveLangCode];
      const words = langData?.textSimilarity;
      if (words != null) {
        const wordsPct = Math.round(words * 100);
        if (wordsPct < appliedWordsMin || wordsPct > appliedWordsMax) return false;
      }
      if (hasMeaningScoresForSelectedLanguage) {
        const meaning = langData?.embeddingSimilarity;
        if (meaning != null) {
          const meaningPct = Math.round(meaning * 100);
          if (meaningPct < appliedMeaningMin || meaningPct > appliedMeaningMax)
            return false;
        }
      }
      return true;
    });
  }, [
    spellCheckOnly,
    appliedShowOnlyCorrections,
    isSourceView,
    dataRowIndices,
    editableRows,
    originalRows,
    sourceCol,
    previewRows,
    effectiveLangCode,
    appliedWordsMin,
    appliedWordsMax,
    appliedMeaningMin,
    appliedMeaningMax,
    hasMeaningScoresForSelectedLanguage,
    hidePreExistingTranslated,
    langCodeToColIndex,
  ]);
  const totalDataRows = filteredDataRowIndices.length;
  const totalPages = Math.max(1, Math.ceil(totalDataRows / ROWS_PER_PAGE));
  const effectiveTotalPages = totalPages;

  useEffect(() => {
    const maxPage = Math.max(0, effectiveTotalPages - 1);
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [effectiveTotalPages, currentPage]);

  if (!fileInfo || (!hasTranslationData && !hasSpellCheckData)) {
    navigate("/landing", { replace: true });
    return null;
  }

  const hasRoundTripDataForSelectedLanguage =
    !isSourceView &&
    previewRows.some(
      (row: any) => !!row?.perLanguage?.[effectiveLangCode]?.roundTripText,
    );
  const pageRowIndices = filteredDataRowIndices.slice(
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
    const numCols = Math.max(
      (rowsToExport[0] ?? []).length,
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
  const renderSimpleScore = (score: number | null | undefined) => {
    if (score == null) return <span className={getConfidenceClass(null)}>-</span>;
    return <span className={getConfidenceClass(score)}>{Math.round(score * 100)}%</span>;
  };

  const applyFilters = () => {
    setAppliedWordsMin(wordsMin);
    setAppliedWordsMax(wordsMax);
    setAppliedMeaningMin(meaningMin);
    setAppliedMeaningMax(meaningMax);
    setAppliedShowOnlyCorrections(showOnlyCorrections);
    setCurrentPage(0);
  };

  const clearFilters = () => {
    setWordsMin(0);
    setWordsMax(100);
    setMeaningMin(0);
    setMeaningMax(100);
    setAppliedWordsMin(0);
    setAppliedWordsMax(100);
    setAppliedMeaningMin(0);
    setAppliedMeaningMax(100);
    setShowOnlyCorrections(false);
    setAppliedShowOnlyCorrections(false);
    setHidePreExistingTranslated(false);
    setCurrentPage(0);
  };

  /** Translation column text for editing (not the round-trip view). */
  const getTranslationEditTextForRow = (dataRowIndex: number): string => {
    const previewRow = previewRows.find((pr: any) => pr.rowIndex === dataRowIndex);
    const langData = previewRow?.perLanguage?.[effectiveLangCode] || null;
    const editCol = langCodeToColIndex[effectiveLangCode];
    let t = "";
    if (editCol !== undefined) t = getCellValue(dataRowIndex, editCol);
    if (!t && langData) {
      if (currentProviderView === "openai")
        t = langData.openaiText || langData.mergedText || "";
      else if (currentProviderView === "gemini")
        t = langData.geminiText || langData.mergedText || "";
      else
        t =
          langData.mergedText ||
          langData.openaiText ||
          langData.geminiText ||
          "";
    }
    return t;
  };

  const handleRowModalCancel = () => {
    setRowModal(null);
  };

  const handleRowModalSave = () => {
    if (!rowModal) return;
    const { rowIndex, variant } = rowModal;
    if (variant === "spellcheck" || variant === "spellDiff") {
      setCellValue(rowIndex, sourceCol, modalDraft.target);
      setOriginalRows((prev) => {
        const next = prev.map((r) => r.slice());
        const row = next[rowIndex];
        if (row) {
          while (row.length <= sourceCol) row.push("");
          row[sourceCol] = modalDraft.source;
        }
        return next;
      });
    } else if (variant === "sourceOnly") {
      setCellValue(rowIndex, sourceCol, modalDraft.source);
    } else if (variant === "translation") {
      setCellValue(rowIndex, sourceCol, modalDraft.source);
      const col = langCodeToColIndex[effectiveLangCode];
      if (col !== undefined) setCellValue(rowIndex, col, modalDraft.target);
    }
    setRowModal(null);
  };

  const modalLangData =
    rowModal && rowModal.variant === "translation"
      ? previewRows.find((pr: any) => pr.rowIndex === rowModal.rowIndex)?.perLanguage?.[
          effectiveLangCode
        ]
      : null;

  return (
    <PageWithNavbar>
      <div className="translation-preview-page">
        <Toast notification={notification} className="translation-preview-toast" />

        <TranslationPreviewHeader
          spellCheckOnly={spellCheckOnly}
          totalDataRows={totalDataRows}
          translatedRows={previewData?.stats?.translatedRows ?? 0}
          correctedRows={state.spellCheckStats?.correctedRows ?? 0}
          effectiveTotalPages={effectiveTotalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          translating={translating}
          confirmProgressPercent={confirmProgressPercent}
          uploading={uploading}
          onBackToLanding={() => navigate("/landing")}
          onDiscardCorrections={() => navigate("/landing")}
          onConfirmTranslations={handleConfirmTranslations}
          onRollback={handleRollback}
          onDownload={handleDownload}
          onUpload={handleUploadToRepo}
          translationTokens={previewData?.stats?.tokensUsed ?? 0}
          spellcheckTokens={state.spellCheckStats?.tokensUsed ?? 0}
        />

        {!spellCheckOnly && (
          <div className="translation-preview-confidence-summary">
            <div className="translation-preview-confidence-summary-group">
              <div className="translation-preview-confidence-summary-head">
                <div className="translation-preview-confidence-summary-title">
                  Compartido (todas las traducciones)
                </div>
                <div className="translation-preview-confidence-summary-big">
                  {formatAvgPct(confidenceAverages.shared.overall)}{" "}
                  <span className="translation-preview-confidence-summary-big-label">
                    Confianza
                  </span>
                </div>
              </div>
              <div className="translation-preview-confidence-summary-metrics">
                <span>
                  Palabras:{" "}
                  {formatAvgPct(confidenceAverages.shared.words)}
                </span>
                <span>
                  Significado:{" "}
                  {formatAvgPct(confidenceAverages.shared.meaning)}
                </span>
              </div>
            </div>
            <div className="translation-preview-confidence-summary-group">
              <div className="translation-preview-confidence-summary-head">
                <div className="translation-preview-confidence-summary-title">
                  {effectiveLangName}
                </div>
                <div className="translation-preview-confidence-summary-big">
                  {formatAvgPct(confidenceAverages.language.overall)}{" "}
                  <span className="translation-preview-confidence-summary-big-label">
                    Confianza
                  </span>
                </div>
              </div>
              <div className="translation-preview-confidence-summary-metrics">
                <span>
                  Palabras:{" "}
                  {formatAvgPct(confidenceAverages.language.words)}
                </span>
                <span>
                  Significado:{" "}
                  {formatAvgPct(confidenceAverages.language.meaning)}
                </span>
              </div>
            </div>
          </div>
        )}

        {(!isSourceView || spellCheckOnly) && (
          <div className="translation-preview-filter-panel-wrap">
            <button
              type="button"
              aria-label="Desplegar filtros"
              className={
                "translation-preview-filter-panel-toggle-full" +
                (showFiltersPanel ? " active" : "")
              }
              onClick={() => setShowFiltersPanel((v) => !v)}
            >
              <span>Filtros</span>
              <span>{showFiltersPanel ? "Ocultar" : "Mostrar"}</span>
            </button>
            {showFiltersPanel && (
              <div className="translation-preview-confidence-filters">
                {!spellCheckOnly && !isSourceView && (
                  <>
                    <div className="translation-preview-filter-group">
                      <span className="translation-preview-filter-label">
                        Similitud de palabras
                      </span>
                      <div className="translation-preview-filter-slider-wrap">
                        <div className="translation-preview-filter-track" />
                        <div
                          className="translation-preview-filter-track-active"
                          style={{
                            left: `${wordsMin}%`,
                            width: `${Math.max(0, wordsMax - wordsMin)}%`,
                          }}
                        />
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={wordsMin}
                          className="translation-preview-filter-slider-thumb translation-preview-filter-slider-thumb-min"
                          disabled={!hasWordScoresForSelectedLanguage}
                          onChange={(e) => {
                            const next = clampPct(Number(e.target.value) || 0);
                            setWordsMin(Math.min(next, wordsMax));
                          }}
                        />
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={wordsMax}
                          className="translation-preview-filter-slider-thumb translation-preview-filter-slider-thumb-max"
                          disabled={!hasWordScoresForSelectedLanguage}
                          onChange={(e) => {
                            const next = clampPct(Number(e.target.value) || 0);
                            setWordsMax(Math.max(next, wordsMin));
                          }}
                        />
                      </div>
                      <div className="translation-preview-filter-range-text">
                        {wordsMin}% - {wordsMax}%
                      </div>
                    </div>
                    <div className="translation-preview-filter-group">
                      <span className="translation-preview-filter-label">
                        Similitud de significado
                      </span>
                      <div className="translation-preview-filter-slider-wrap">
                        <div className="translation-preview-filter-track" />
                        <div
                          className="translation-preview-filter-track-active"
                          style={{
                            left: `${meaningMin}%`,
                            width: `${Math.max(0, meaningMax - meaningMin)}%`,
                          }}
                        />
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={meaningMin}
                          className="translation-preview-filter-slider-thumb translation-preview-filter-slider-thumb-min"
                          disabled={!hasMeaningScoresForSelectedLanguage}
                          onChange={(e) => {
                            const next = clampPct(Number(e.target.value) || 0);
                            setMeaningMin(Math.min(next, meaningMax));
                          }}
                        />
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={meaningMax}
                          className="translation-preview-filter-slider-thumb translation-preview-filter-slider-thumb-max"
                          disabled={!hasMeaningScoresForSelectedLanguage}
                          onChange={(e) => {
                            const next = clampPct(Number(e.target.value) || 0);
                            setMeaningMax(Math.max(next, meaningMin));
                          }}
                        />
                      </div>
                      <div className="translation-preview-filter-range-text">
                        {meaningMin}% - {meaningMax}%
                      </div>
                    </div>
                    <div className="translation-preview-filter-group translation-preview-filter-group--checkbox">
                      <label className="translation-preview-filter-checkbox-row">
                        <input
                          type="checkbox"
                          checked={hidePreExistingTranslated}
                          onChange={(e) =>
                            setHidePreExistingTranslated(e.target.checked)
                          }
                        />
                        <span>Ocultar filas ya traducidas</span>
                        <span
                          style={{
                            marginLeft: 4,
                            display: "inline-flex",
                            verticalAlign: "middle",
                          }}
                        >
                          <FloatingHelpIcon text="Para el idioma que estás viendo: filas que ya tenían texto en esa columna y no se volvieron a traducir en esta ejecución. Las filas visibles muestran una etiqueta y un estilo distintivo." />
                        </span>
                      </label>
                    </div>
                  </>
                )}
                {spellCheckOnly && (
                  <div className="translation-preview-filter-group">
                    <label className="translation-preview-filter-checkbox-row">
                      <input
                        type="checkbox"
                        checked={showOnlyCorrections}
                        onChange={(e) => setShowOnlyCorrections(e.target.checked)}
                      />
                      <span>Mostrar solo correcciones</span>
                    </label>
                  </div>
                )}
                <div className="translation-preview-filter-actions">
                  <button
                    type="button"
                    className="translation-preview-btn translation-preview-btn-download"
                    onClick={applyFilters}
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    className="translation-preview-btn translation-preview-btn-rollback"
                    onClick={clearFilters}
                  >
                    Quitar filtros
                  </button>
                </div>
              </div>
            )}
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
              {!isSourceView && hasRoundTripDataForSelectedLanguage && (
                <div className="translation-preview-provider-toggle">
                  <button
                    type="button"
                    className={
                      "translation-preview-provider-btn" +
                      (!showRoundTripCheck ? " active" : "")
                    }
                    onClick={() => setShowRoundTripCheck(false)}
                  >
                    Traducción
                  </button>
                  <button
                    type="button"
                    className={
                      "translation-preview-provider-btn" +
                      (showRoundTripCheck ? " active" : "")
                    }
                    onClick={() => setShowRoundTripCheck(true)}
                  >
                    Re-traducción
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
                  <th className="col-key-header">Clave</th>
                  <th className="col-view" title="Ver en detalle" aria-label="Ver detalle" />
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
                          : showRoundTripCheck && !isSourceView
                            ? `Re-traducción a ${sourceLabel}`
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
                  {!spellCheckOnly && !isSourceView && (
                    <>
                      <th className="col-confidence">
                        Similitud de palabras
                        <FloatingHelpIcon text="Mide cuánto se parece el texto original a la re-traducción en palabras y estructura." />
                      </th>
                      <th className="col-confidence">
                        Similitud de significado
                        <FloatingHelpIcon text="Mide si conserva la misma idea general, aunque use palabras distintas." />
                      </th>
                    </>
                  )}
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
                          <td className="col-view">
                            <button
                              type="button"
                              className="translation-preview-eye-btn"
                              title="Ver y editar en detalle"
                              onClick={() => {
                                setModalDraft({
                                  key: String(key),
                                  source: originalVal,
                                  target: correctedVal,
                                  roundTrip: "",
                                });
                                setRowModal({
                                  rowIndex: dataRowIndex,
                                  variant: "spellcheck",
                                });
                              }}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
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
                          if (showRoundTripCheck) {
                            displayText = langData.roundTripText || "";
                          } else
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
                          getCellValue(dataRowIndex, sourceCol) ||
                          spellRow?.correctedSource ||
                          sourceVal;
                        return (
                          <tr key={key + String(dataRowIndex)}>
                            <td className="col-key">{key}</td>
                            <td className="col-view">
                              <button
                                type="button"
                                className="translation-preview-eye-btn"
                                title="Ver y editar en detalle"
                                onClick={() => {
                                  setModalDraft({
                                    key: String(key),
                                    source: originalVal,
                                    target: correctedVal,
                                    roundTrip: "",
                                  });
                                  setRowModal({
                                    rowIndex: dataRowIndex,
                                    variant: "spellDiff",
                                  });
                                }}
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                            <td className="col-text translation-preview-diff-original">
                              {originalVal}
                            </td>
                            <td className="col-text translation-preview-diff-corrected">
                              {correctedVal}
                            </td>
                          </tr>
                        );
                      }
                      const langColForRow = langCodeToColIndex[effectiveLangCode];
                      const isPreExistingRow =
                        !isSourceView &&
                        !spellCheckOnly &&
                        isRowPreExistingTranslation(
                          dataRowIndex,
                          effectiveLangCode,
                          editableRows,
                          previewRows,
                          sourceCol,
                          langColForRow,
                        );
                      return (
                        <tr
                          key={key + String(dataRowIndex)}
                          className={
                            isPreExistingRow
                              ? "translation-preview-row--preexisting"
                              : undefined
                          }
                        >
                          <td className="col-key">
                            <div className="translation-preview-key-cell">
                              <span className="translation-preview-key-text">
                                {key}
                              </span>
                              {isPreExistingRow && (
                                <span
                                  className="translation-preview-preexisting-badge"
                                  title="Esta celda ya tenía traducción; no se regeneró en esta ejecución."
                                >
                                  <Bookmark
                                    size={11}
                                    aria-hidden
                                    className="translation-preview-preexisting-badge-icon"
                                  />
                                  Ya existía
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="col-view">
                            <button
                              type="button"
                              className="translation-preview-eye-btn"
                              title="Ver y editar en detalle"
                              onClick={() => {
                                const previewRow = previewRows.find(
                                  (pr: any) => pr.rowIndex === dataRowIndex,
                                );
                                const s =
                                  getCellValue(dataRowIndex, sourceCol) ||
                                  previewRow?.sourceText ||
                                  "";
                                if (isSourceView) {
                                  setModalDraft({
                                    key: String(key),
                                    source: s,
                                    target: "",
                                    roundTrip: "",
                                  });
                                  setRowModal({
                                    rowIndex: dataRowIndex,
                                    variant: "sourceOnly",
                                  });
                                } else {
                                  const ld =
                                    previewRow?.perLanguage?.[effectiveLangCode];
                                  setModalDraft({
                                    key: String(key),
                                    source: s,
                                    target: getTranslationEditTextForRow(
                                      dataRowIndex,
                                    ),
                                    roundTrip: ld?.roundTripText || "",
                                  });
                                  setRowModal({
                                    rowIndex: dataRowIndex,
                                    variant: "translation",
                                  });
                                }
                              }}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
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
                              {showRoundTripCheck ? (
                                <input
                                  type="text"
                                  className="translation-preview-cell-input"
                                  value={displayText || "-"}
                                  readOnly
                                />
                              ) : (
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
                              )}
                              {!showRoundTripCheck &&
                                editCol !== undefined &&
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
                            <>
                              <td className="col-confidence">
                                {langData
                                  ? renderSimpleScore((langData as any).textSimilarity)
                                  : renderSimpleScore(null)}
                              </td>
                              <td className="col-confidence">
                                {langData
                                  ? renderSimpleScore((langData as any).embeddingSimilarity)
                                  : renderSimpleScore(null)}
                              </td>
                            </>
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
              {showRoundTripCheck
                ? "La vista de re-traducción muestra cómo vuelve cada idioma al texto original para facilitar la revisión."
                : "Las filas con baja confianza indican que la traducción y su re-traducción difieren y deberían revisarse manualmente."}
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

      <TranslationRowDetailModal
        rowModal={rowModal}
        modalDraft={modalDraft}
        effectiveLangCode={effectiveLangCode}
        modalLangData={modalLangData}
        onCancel={handleRowModalCancel}
        onSave={handleRowModalSave}
        onDraftChange={setModalDraft}
        renderSimpleScore={renderSimpleScore}
        renderConfidence={renderConfidence}
      />
    </PageWithNavbar>
  );
};

export default TranslationPreview;
