import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { SoundManagerProvider } from "./components/SoundManagerSimples";

// Script para ocultar o botão "Made with Replit"
document.addEventListener("DOMContentLoaded", function() {
  // Tenta encontrar o botão por vários seletores possíveis
  const hideReplitButton = () => {
    // Lista de possíveis seletores para o botão do Replit
    const selectors = [
      '[class*="replit-ui-"]',
      '[class*="replit-"]',
      '[class*="jsx-"]',
      '.jsx-replit-button',
      '.replit-ui-button',
      '[class*="repl-auth-"]',
      // Adiciona aqui qualquer outro seletor que você descobrir
    ];
    
    // Tenta esconder elementos que correspondam a qualquer seletor
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el instanceof HTMLElement) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          }
        });
      } catch (e) {
        // Ignora erros
      }
    });
  };

  // Executa imediatamente e também em intervalos, pois o botão pode ser injetado após o carregamento
  hideReplitButton();
  setInterval(hideReplitButton, 1000); // Verifica a cada segundo
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
