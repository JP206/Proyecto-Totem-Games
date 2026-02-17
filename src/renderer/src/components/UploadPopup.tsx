// src/renderer/src/components/UploadPopup.tsx
import React from "react";
import { BookOpen, FileText, FileSpreadsheet, AlertCircle } from "lucide-react";

interface UploadPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: "context" | "glossary" | "localize") => void;
  fileName: string;
  fileExtension: string;
  repoName: string;
}

const UploadPopup: React.FC<UploadPopupProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  fileExtension,
  repoName,
}) => {
  if (!isOpen) return null;

  const isTxt = fileExtension === ".txt";
  const isCsvOrXlsx = [".csv", ".xlsx"].includes(fileExtension);

  return (
    <div className="upload-popup-overlay" onClick={onClose}>
      <div className="upload-popup" onClick={(e) => e.stopPropagation()}>
        <button className="upload-popup-close" onClick={onClose}>
          ×
        </button>

        <div className="upload-popup-header">
          {isTxt && <BookOpen size={24} className="popup-icon" />}
          {isCsvOrXlsx && <FileSpreadsheet size={24} className="popup-icon" />}
          <h3>¿Qué tipo de archivo es?</h3>
        </div>

        <p className="upload-popup-filename">
          <strong>{fileName}</strong>
        </p>

        <div className="upload-popup-options">
          {isTxt && (
            <button
              className="upload-popup-btn context"
              onClick={() => onConfirm("context")}
            >
              <BookOpen size={20} />
              <div>
                <strong>Archivo de contexto</strong>
                <small>
                  Se guardará en: Localizacion/contextos_especificos/
                </small>
              </div>
            </button>
          )}

          {isCsvOrXlsx && (
            <>
              <button
                className="upload-popup-btn glossary"
                onClick={() => onConfirm("glossary")}
              >
                <FileText size={20} />
                <div>
                  <strong>Glosario</strong>
                  <small>
                    Se guardará en: Localizacion/glosarios_especificos/
                  </small>
                </div>
              </button>

              <button
                className="upload-popup-btn localize"
                onClick={() => onConfirm("localize")}
              >
                <FileSpreadsheet size={20} />
                <div>
                  <strong>Archivo a localizar</strong>
                  <small>
                    Se guardará como: {repoName}_localizar{fileExtension}
                  </small>
                </div>
              </button>
            </>
          )}
        </div>

        {isTxt && (
          <p className="upload-popup-note">
            <AlertCircle size={14} />
            Los archivos .txt solo pueden ser contextos
          </p>
        )}
      </div>
    </div>
  );
};

export default UploadPopup;
