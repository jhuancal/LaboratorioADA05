/**
 * @file server.js
 * @brief Servidor Principal Express + Inicialización SQLite + Pre-cálculo O(V³) de Floyd-Warshall
 */
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV } from './config/env.js';
import { initDatabase } from './database/sqliteConnection.js';
import { cppEngineService } from './services/cppEngineService.js';
import { apiRouter } from './routes/apiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

const app = express();

app.use(cors());
app.use(express.json());

// Inicializar base de datos SQLite y precalcular la matriz de Floyd-Warshall en C++20
initDatabase();
try {
  const fwStartup = cppEngineService.precomputeFloydToSqlite('car');
  console.log(
    `[SQLite + C++20] Matriz Floyd-Warshall precalculada en ${fwStartup?.execution_time_us ?? 0} µs (${fwStartup?.operations_count ?? 0} ops).`
  );
} catch (err) {
  console.error('[Advertencia] Error precalculando Floyd-Warshall inicial:', err.message);
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'UNSA ADA Lab 05 - Arequipa Smart Traffic & Hive Mind Engine',
    cpp_engine: ENV.CPP_ENGINE_BIN,
    sqlite_db: ENV.DB_PATH
  });
});

app.use('/api', apiRouter);

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.listen(ENV.PORT, () => {
  console.log(`===================================================================`);
  console.log(`🚀 Servidor Backend UNSA ADA Lab 05 activo en http://localhost:${ENV.PORT}`);
  console.log(`🗄️  Base de datos SQLite: ${ENV.DB_PATH}`);
  console.log(`⚙️  Motor C++20 std::chrono: ${ENV.CPP_ENGINE_BIN}`);
  console.log(`===================================================================`);
});
