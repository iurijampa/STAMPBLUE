import type { IStorage } from './storage-interface';
import { DatabaseStorage } from './database-storage';

// Usar armazenamento em banco de dados para persistência
export const storage: IStorage = new DatabaseStorage();