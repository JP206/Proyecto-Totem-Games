import React from "react";
import { Plus, Trash2 } from "lucide-react";

export interface GlossaryRow {
  Palabra?: string;
}

interface GlossaryTableProps {
  rows: GlossaryRow[];
  isEditing?: boolean;
  onRowChange?: (rowIndex: number, value: string) => void;
  onDeleteRow?: (rowIndex: number) => void;
  onAddRow?: () => void;
}

const GlossaryTable: React.FC<GlossaryTableProps> = ({
  rows,
  isEditing = false,
  onRowChange,
  onDeleteRow,
  onAddRow,
}) => {
  return (
    <div className="table-container">
      <table className="csv-table">
        <thead>
          <tr>
            <th>Palabra / Frase</th>
            {isEditing ? <th className="actions-header">Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td>
                <input
                  type="text"
                  value={row.Palabra || ""}
                  onChange={(e) => onRowChange?.(rowIndex, e.target.value)}
                  className="table-input"
                  placeholder="Escribe una palabra o frase..."
                  disabled={!isEditing}
                />
              </td>
              {isEditing ? (
                <td className="actions-cell">
                  <button
                    className="table-delete-btn"
                    onClick={() => onDeleteRow?.(rowIndex)}
                    title="Eliminar fila"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {isEditing ? (
        <button className="add-row-btn" onClick={onAddRow}>
          <Plus size={14} /> Añadir palabra
        </button>
      ) : null}
    </div>
  );
};

export default GlossaryTable;
