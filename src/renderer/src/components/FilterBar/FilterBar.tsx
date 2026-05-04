import React from "react";
import "./FilterBar.css";

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

const FilterBar: React.FC<FilterBarProps> = ({ children, className = "" }) => {
  return <div className={`app-filter-bar ${className}`.trim()}>{children}</div>;
};

export default FilterBar;
