/**
 * @file env.js
 * @brief Configuración centralizada de variables de entorno y rutas del sistema
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

export const ENV = {
  PORT: Number(process.env.PORT || 3001),
  GOOGLE_MAPS_API_KEY:
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    (process.env.apiMapsJavascript || '').replace(/["';]/g, '').trim() ||
    'AIzaSyDX6QjBjev5OiY5Yh-BtahdHmfGOJpVehc',
  DB_PATH: path.join(BACKEND_ROOT, 'data', 'arequipa_traffic.db'),
  TEMP_DIR: path.join(BACKEND_ROOT, 'data', 'tmp'),
  CPP_ENGINE_BIN: path.join(PROJECT_ROOT, 'cpp_engine', 'bin', 'engine.exe'),
  CPP_ENGINE_SRC: path.join(PROJECT_ROOT, 'cpp_engine', 'src', 'cli_engine.cpp'),
  CPP_ENGINE_INC: path.join(PROJECT_ROOT, 'cpp_engine', 'include')
};
