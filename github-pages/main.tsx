import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LearningApp from "../app/LearningApp";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("未找到页面根节点");
}

createRoot(root).render(
  <StrictMode>
    <LearningApp />
  </StrictMode>,
);
