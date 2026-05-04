import React from "react";
import { ArrowLeft, Coins, Download, Globe2, RotateCcw, UploadCloud } from "lucide-react";

interface TranslationPreviewHeaderProps {
  spellCheckOnly: boolean;
  totalDataRows: number;
  translatedRows: number;
  correctedRows: number;
  effectiveTotalPages: number;
  rangeStart: number;
  rangeEnd: number;
  translating: boolean;
  confirmProgressPercent: number;
  uploading: boolean;
  onBackToLanding: () => void;
  onDiscardCorrections: () => void;
  onConfirmTranslations: () => void;
  onRollback: () => void;
  onDownload: () => void;
  onUpload: () => void;
  translationTokens: number;
  spellcheckTokens: number;
}

const TranslationPreviewHeader: React.FC<TranslationPreviewHeaderProps> = ({
  spellCheckOnly,
  totalDataRows,
  translatedRows,
  correctedRows,
  effectiveTotalPages,
  rangeStart,
  rangeEnd,
  translating,
  confirmProgressPercent,
  uploading,
  onBackToLanding,
  onDiscardCorrections,
  onConfirmTranslations,
  onRollback,
  onDownload,
  onUpload,
  translationTokens,
  spellcheckTokens,
}) => {
  const totalTokens = translationTokens + spellcheckTokens;

  return (
    <>
      <header className="translation-preview-header">
        <div className="translation-preview-header-left">
          <button
            type="button"
            className="translation-preview-back-btn"
            onClick={onBackToLanding}
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
                ? `${totalDataRows} filas revisadas • ${correctedRows} corregidas. Confirma para traducir.`
                : `${totalDataRows} filas en vista previa • ${translatedRows} filas traducidas`}
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
                onClick={onDiscardCorrections}
                disabled={translating}
                title="Descartar correcciones y volver sin guardar"
              >
                <RotateCcw size={18} />
                Descartar correcciones
              </button>
              <button
                type="button"
                className="translation-preview-btn translation-preview-btn-upload"
                onClick={onConfirmTranslations}
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
                onClick={onRollback}
                title="Revertir a las traducciones originales"
              >
                <RotateCcw size={18} />
                Revertir cambios
              </button>
              <button
                type="button"
                className="translation-preview-btn translation-preview-btn-download"
                onClick={onDownload}
              >
                <Download size={18} />
                Descargar CSV
              </button>
              <button
                type="button"
                className="translation-preview-btn translation-preview-btn-upload"
                onClick={onUpload}
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

      {((spellCheckOnly && spellcheckTokens > 0) ||
        (!spellCheckOnly && totalTokens > 0)) && (
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
                  {spellcheckTokens.toLocaleString()}
                </span>
              </div>
            ) : (
              <>
                {spellcheckTokens > 0 && (
                  <div className="translation-preview-tokens-row">
                    <span className="translation-preview-tokens-label">
                      Revisión ortográfica
                    </span>
                    <span className="translation-preview-tokens-value">
                      {spellcheckTokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {translationTokens > 0 && (
                  <div className="translation-preview-tokens-row">
                    <span className="translation-preview-tokens-label">
                      Traducción
                    </span>
                    <span className="translation-preview-tokens-value">
                      {translationTokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {spellcheckTokens > 0 && translationTokens > 0 && (
                  <div className="translation-preview-tokens-row translation-preview-tokens-total">
                    <span className="translation-preview-tokens-label">Total</span>
                    <span className="translation-preview-tokens-value">
                      {totalTokens.toLocaleString()}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TranslationPreviewHeader;
