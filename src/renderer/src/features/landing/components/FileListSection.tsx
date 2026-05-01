import React from "react";
import { AlertCircle, CheckSquare, ChevronDown, Globe, Square } from "lucide-react";

export interface LandingContextFile {
  name: string;
  path: string;
  priority: number;
  selected: boolean;
  isGlobal?: boolean;
}

interface FileListSectionProps {
  title: string;
  icon: React.ElementType;
  files: LandingContextFile[];
  show: boolean;
  onToggleOpen: (next: boolean) => void;
  onToggleAll: () => void;
  onToggleSelection: (index: number) => void;
  onMoveItem: (index: number, direction: "up" | "down") => void;
}

const FileListSection: React.FC<FileListSectionProps> = ({
  title,
  icon: Icon,
  files,
  show,
  onToggleOpen,
  onToggleAll,
  onToggleSelection,
  onMoveItem,
}) => {
  const getToggleIcon = () => {
    if (!files.length) return null;
    const all = files.every((file) => file.selected);
    const none = files.every((file) => !file.selected);
    if (all) return <CheckSquare size={16} className="toggle-checkbox fully-selected" />;
    if (none) return <Square size={16} className="toggle-checkbox" />;
    return <Square size={16} className="toggle-checkbox partially-selected" />;
  };

  return (
    <div className="config-section">
      <div className="section-header">
        <h3>
          <Icon size={18} /> {title}{" "}
          <span className="section-count">
            {files.filter((file) => file.selected).length}/{files.length}
          </span>
        </h3>
        <div className="section-actions">
          {files.length > 0 ? (
            <button className="toggle-all-btn" onClick={onToggleAll}>
              {getToggleIcon()}
            </button>
          ) : null}
          <button className="dropdown-toggle" onClick={() => onToggleOpen(!show)}>
            <ChevronDown size={16} className={show ? "open" : ""} />
          </button>
        </div>
      </div>
      {show ? (
        <div className="dropdown-content">
          {files.length > 0 ? (
            <div className="priority-list">
              {files.map((file, index) => (
                <div
                  key={`${file.path}-${index}`}
                  className={`priority-item ${file.isGlobal ? "global" : ""}`}
                >
                  <button
                    className="select-toggle"
                    onClick={() => onToggleSelection(index)}
                  >
                    {file.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <span className="priority-badge">{file.priority}</span>
                  <span className={`priority-text ${file.isGlobal ? "global" : ""}`}>
                    {file.isGlobal ? (
                      <Globe size={14} className="global-icon" />
                    ) : null}
                    {file.name}
                  </span>
                  <div className="priority-controls">
                    <button
                      className="priority-btn"
                      onClick={() => onMoveItem(index, "up")}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="priority-btn"
                      onClick={() => onMoveItem(index, "down")}
                      disabled={index === files.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-dropdown">
              <AlertCircle size={16} /> No hay archivos
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default FileListSection;
