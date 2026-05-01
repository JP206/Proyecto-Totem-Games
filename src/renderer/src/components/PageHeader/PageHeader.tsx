import React from "react";
import "./PageHeader.css";

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  className = "",
  badge,
}) => {
  return (
    <div className={`app-page-header ${className}`.trim()}>
      <div className="app-page-header-main">
        <div className="app-page-header-title-row">
          {icon ? <span className="app-page-header-icon">{icon}</span> : null}
          <div className="app-page-header-copy">
            <h2 className="app-page-header-title">
              {title}
              {badge ? <span className="app-page-header-badge">{badge}</span> : null}
            </h2>
            {subtitle ? (
              <p className="app-page-header-subtitle">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
      {actions ? <div className="app-page-header-actions">{actions}</div> : null}
    </div>
  );
};

export default PageHeader;
