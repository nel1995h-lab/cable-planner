import React from "react";
import { createRoot } from "react-dom/client";
import { CablePlannerApp } from "./components/planner/CablePlannerApp";
import { Toaster } from "./components/ui/sonner";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CablePlannerApp />
    <Toaster richColors position="bottom-left" />
  </React.StrictMode>
);
