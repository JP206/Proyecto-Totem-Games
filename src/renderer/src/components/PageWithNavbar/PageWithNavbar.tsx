import React from "react";
import Navbar from "../Navbar/Navbar";
import "./PageWithNavbar.css";

export interface PageWithNavbarProps {
  children: React.ReactNode;
  /** Applied to the outer wrapper (e.g. feature container class). */
  className?: string;
  /** Applied to the scrollable main element. */
  mainClassName?: string;
}

const PageWithNavbar: React.FC<PageWithNavbarProps> = ({
  children,
  className = "",
  mainClassName = "",
}) => {
  return (
    <div className={`app-page-with-navbar ${className}`.trim()}>
      <Navbar />
      <main className={`app-page-with-navbar-main ${mainClassName}`.trim()}>
        {children}
      </main>
    </div>
  );
};

export default PageWithNavbar;
