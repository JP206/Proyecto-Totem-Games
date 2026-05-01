import React from "react";
import "./EntityCard.css";

export interface EntityCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

const EntityCard: React.FC<EntityCardProps> = ({
  title,
  description,
  meta,
  badge,
  className = "",
  onClick,
  selected = false,
}) => {
  return (
    <div
      className={[
        "app-entity-card",
        selected ? "app-entity-card--selected" : "",
        onClick ? "app-entity-card--interactive" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {badge ? <div className="app-entity-card-badge">{badge}</div> : null}
      <h3 className="app-entity-card-title">{title}</h3>
      {description ? (
        <div className="app-entity-card-description">{description}</div>
      ) : null}
      {meta ? <div className="app-entity-card-meta">{meta}</div> : null}
    </div>
  );
};

export default EntityCard;
