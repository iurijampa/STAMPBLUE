import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduleBackups } from "./backup";
import path from 'path';
import fs from 'fs';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Configurar middleware para servir arquivos estáticos
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Diretório de uploads criado: ${uploadsDir}`);
}
// Servir arquivos da pasta uploads
app.use('/uploads', express.static(uploadsDir));

// Servir arquivos estáticos da pasta client/public
const publicDir = path.join(process.cwd(), 'client/public');
if (fs.existsSync(publicDir)) {
  console.log(`Servindo arquivos estáticos da pasta: ${publicDir}`);
  app.use(express.static(publicDir));
} else {
  console.log(`Diretório public não encontrado: ${publicDir}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Importar funções de otimização
import { atualizarCachePersistenteDepartamentos } from "./solucao-emergencial";

(async () => {
  const server = await registerRoutes(app);
  
  // Iniciar processo de pré-cálculo para cache persistente de departamentos
  // Executar imediatamente para preencher o cache inicial
  atualizarCachePersistenteDepartamentos();
  
  // Definir interval ligeiramente mais rápido para departamentos com poucos itens
  // e mais lento para departamentos com muitos itens
  setInterval(() => {
    // Buscar primeiro os departamentos que normalmente têm poucos itens
    atualizarCachePersistenteDepartamentos(['embalagem', 'costura', 'batida', 'impressao', 'admin']);
  }, 5 * 1000); // A cada 5 segundos
  
  // Atualizar departamento de gabarito (que tem muitos itens) com menos frequência
  setInterval(() => {
    atualizarCachePersistenteDepartamentos(['gabarito']);
  }, 12 * 1000); // A cada 12 segundos

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Iniciar sistema de backups automáticos
    const backupTimer = scheduleBackups();
    log("Sistema de backup automático iniciado com sucesso", "express");
    
    // Garantir que o timer de backup seja limpo ao encerrar o servidor
    process.on('SIGINT', () => {
      clearInterval(backupTimer);
      log("Sistema de backup interrompido", "express");
      process.exit(0);
    });
  });
})();
