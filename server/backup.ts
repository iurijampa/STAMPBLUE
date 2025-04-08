import fs from 'fs';
import path from 'path';
import { db } from './db';
import { activities, activityProgress, notifications, users } from '@shared/schema';
import { log } from './vite';
import { storage } from './storage';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Garante que o diretório de backup exista
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Função para criar o nome do arquivo de backup com timestamp
function getBackupFilename(prefix: string): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  return path.join(BACKUP_DIR, `${prefix}_${timestamp}.json`);
}

// Função para fazer backup de uma tabela específica
async function backupTable<T>(tableName: string, getData: () => Promise<T[]>): Promise<void> {
  try {
    const data = await getData();
    const filename = getBackupFilename(tableName);
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    log(`Backup de ${tableName} concluído: ${filename}`, 'backup');
  } catch (error) {
    log(`Erro ao fazer backup de ${tableName}: ${error}`, 'backup-error');
  }
}

// Função principal de backup
export async function createBackup(): Promise<void> {
  log('Iniciando backup do banco de dados...', 'backup');
  
  try {
    // Backup de todas as tabelas usando o storage
    await backupTable('users', () => storage.getAllUsers());
    await backupTable('activities', () => storage.getAllActivities());
    await backupTable('activity_progress', async () => {
      // Buscar todos os IDs de atividades
      const activities = await storage.getAllActivities();
      // Buscar progresso para cada atividade
      const allProgress = [];
      for (const activity of activities) {
        const progress = await storage.getActivityProgress(activity.id);
        allProgress.push(...progress);
      }
      return allProgress;
    });
    await backupTable('notifications', async () => {
      // Buscar todos os IDs de usuários
      const users = await storage.getAllUsers();
      // Buscar notificações para cada usuário
      const allNotifications = [];
      for (const user of users) {
        const notifications = await storage.getNotificationsByUser(user.id);
        allNotifications.push(...notifications);
      }
      return allNotifications;
    });
    
    // Limpeza de backups antigos (manter apenas os últimos 30)
    cleanOldBackups();
    
    log('Backup do banco de dados concluído com sucesso!', 'backup');
  } catch (error) {
    log(`Erro ao realizar backup: ${error}`, 'backup-error');
  }
}

// Função para limpar backups antigos
function cleanOldBackups(): void {
  const MAX_BACKUPS_PER_TABLE = 30; // Manter 30 backups por tabela
  
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    
    // Agrupar arquivos por tabela
    const filesByPrefix: Record<string, string[]> = {};
    
    for (const file of files) {
      const prefixMatch = file.match(/^([^_]+)_/);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        if (!filesByPrefix[prefix]) {
          filesByPrefix[prefix] = [];
        }
        filesByPrefix[prefix].push(file);
      }
    }
    
    // Para cada tabela, manter apenas os MAX_BACKUPS_PER_TABLE mais recentes
    for (const prefix in filesByPrefix) {
      const tableFiles = filesByPrefix[prefix];
      if (tableFiles.length > MAX_BACKUPS_PER_TABLE) {
        // Ordenar por data de criação (mais antigos primeiro)
        tableFiles.sort((a, b) => {
          const aTime = fs.statSync(path.join(BACKUP_DIR, a)).mtime.getTime();
          const bTime = fs.statSync(path.join(BACKUP_DIR, b)).mtime.getTime();
          return aTime - bTime;
        });
        
        // Remover os mais antigos
        const filesToRemove = tableFiles.slice(0, tableFiles.length - MAX_BACKUPS_PER_TABLE);
        for (const file of filesToRemove) {
          fs.unlinkSync(path.join(BACKUP_DIR, file));
          log(`Backup antigo removido: ${file}`, 'backup');
        }
      }
    }
  } catch (error) {
    log(`Erro ao limpar backups antigos: ${error}`, 'backup-error');
  }
}

// Função para agendar backups automáticos (a cada 1 hora)
export function scheduleBackups(): NodeJS.Timeout {
  // Realizar backup imediatamente ao iniciar
  createBackup().catch(err => log(`Erro no backup inicial: ${err}`, 'backup-error'));
  
  // Agendar backups a cada 1 hora
  const BACKUP_INTERVAL = 60 * 60 * 1000; // 1 hora em milissegundos
  return setInterval(createBackup, BACKUP_INTERVAL);
}