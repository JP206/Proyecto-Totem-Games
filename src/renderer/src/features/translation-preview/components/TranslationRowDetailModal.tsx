import React from "react";
import { createPortal } from "react-dom";

interface TranslationRowDetailModalProps {
  rowModal: any;
  modalDraft: {
    key: string;
    source: string;
    target: string;
    roundTrip: string;
  };
  effectiveLangCode: string;
  modalLangData: any;
  onCancel: () => void;
  onSave: () => void;
  onDraftChange: (next: {
    key: string;
    source: string;
    target: string;
    roundTrip: string;
  }) => void;
  renderSimpleScore: (value: number | null | undefined) => React.ReactNode;
  renderConfidence: (value: number | null | undefined) => React.ReactNode;
}

const TranslationRowDetailModal: React.FC<TranslationRowDetailModalProps> = ({
  rowModal,
  modalDraft,
  effectiveLangCode,
  modalLangData,
  onCancel,
  onSave,
  onDraftChange,
  renderSimpleScore,
  renderConfidence,
}) => {
  if (!rowModal) return null;

  return createPortal(
    <div
      className="translation-row-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="translation-row-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="translation-row-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="translation-row-modal-title" className="translation-row-modal-title">
          {rowModal.variant === "spellcheck" || rowModal.variant === "spellDiff"
            ? "Corrección — vista detalle"
            : rowModal.variant === "sourceOnly"
              ? "Texto origen — vista detalle"
              : `Traducción (${effectiveLangCode}) — vista detalle`}
        </h2>
        <p className="translation-row-modal-meta">
          Clave: <code>{modalDraft.key}</code>
        </p>

        {(rowModal.variant === "spellcheck" || rowModal.variant === "spellDiff") && (
          <div className="translation-row-modal-fields">
            <label className="translation-row-modal-label">Texto original</label>
            <textarea
              className="translation-row-modal-textarea"
              value={modalDraft.source}
              onChange={(e) =>
                onDraftChange({ ...modalDraft, source: e.target.value })
              }
              rows={8}
            />
            <label className="translation-row-modal-label">Texto corregido</label>
            <textarea
              className="translation-row-modal-textarea"
              value={modalDraft.target}
              onChange={(e) =>
                onDraftChange({ ...modalDraft, target: e.target.value })
              }
              rows={8}
            />
          </div>
        )}

        {rowModal.variant === "sourceOnly" && (
          <div className="translation-row-modal-fields">
            <label className="translation-row-modal-label">Texto origen</label>
            <textarea
              className="translation-row-modal-textarea"
              value={modalDraft.source}
              onChange={(e) =>
                onDraftChange({ ...modalDraft, source: e.target.value })
              }
              rows={14}
            />
          </div>
        )}

        {rowModal.variant === "translation" && (
          <div className="translation-row-modal-fields">
            <label className="translation-row-modal-label">Texto origen</label>
            <textarea
              className="translation-row-modal-textarea"
              value={modalDraft.source}
              onChange={(e) =>
                onDraftChange({ ...modalDraft, source: e.target.value })
              }
              rows={8}
            />
            <label className="translation-row-modal-label">
              Traducción ({effectiveLangCode})
            </label>
            <textarea
              className="translation-row-modal-textarea"
              value={modalDraft.target}
              onChange={(e) =>
                onDraftChange({ ...modalDraft, target: e.target.value })
              }
              rows={8}
            />
            {modalDraft.roundTrip ? (
              <>
                <label className="translation-row-modal-label">
                  Re-traducción al origen (referencia)
                </label>
                <textarea
                  className="translation-row-modal-textarea translation-row-modal-textarea-readonly"
                  value={modalDraft.roundTrip}
                  readOnly
                  rows={6}
                />
              </>
            ) : null}
            {modalLangData ? (
              <div className="translation-row-modal-scores">
                <div>
                  <strong>Similitud (palabras):</strong>{" "}
                  {renderSimpleScore((modalLangData as any).textSimilarity)}
                </div>
                <div>
                  <strong>Similitud (significado):</strong>{" "}
                  {renderSimpleScore((modalLangData as any).embeddingSimilarity)}
                </div>
                <div>
                  <strong>Confianza combinada:</strong>{" "}
                  {renderConfidence((modalLangData as any).confidence)}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="translation-row-modal-actions">
          <button
            type="button"
            className="translation-preview-btn translation-preview-btn-rollback"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="translation-preview-btn translation-preview-btn-upload"
            onClick={onSave}
          >
            Guardar cambios
          </button>
        </div>
        <p className="translation-row-modal-hint">
          Cancelar cierra sin aplicar cambios. Guardar actualiza la tabla.
        </p>
      </div>
    </div>,
    document.body,
  );
};

export default TranslationRowDetailModal;
