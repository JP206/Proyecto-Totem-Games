import React from "react";
import "./EmptyState.css";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = "",
}) => {
  return (
    <div className={`app-empty-state ${className}`.trim()}>
      {icon ? <div className="app-empty-state-icon">{icon}</div> : null}
      <div className="app-empty-state-title">{title}</div>
      {description ? (
        <div className="app-empty-state-description">{description}</div>
      ) : null}
      {action ? <div className="app-empty-state-action">{action}</div> : null}
    </div>
  );
};

export default EmptyState;
