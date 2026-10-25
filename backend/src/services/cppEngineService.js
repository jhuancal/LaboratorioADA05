/**
 * @file cppEngineService.js
 * @brief Servicio puente hacia el motor nativo C++20 (cpp_engine/bin/engine.exe)
 *        Instrumentado con std::chrono::high_resolution_clock y caché SQLite de Floyd-Warshall
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ENV } from '../config/env.js';
import { graphRepository } from '../repositories/graphRepository.js';

function ensureBinaryCompiled() {
  if (fs.existsSync(ENV.CPP_ENGINE_BIN)) return;
  fs.mkdirSync(path.dirname(ENV.CPP_ENGINE_BIN), { recursive: true });
  execFileSync('g++', [
    '-O3',
    '-std=c++20',
    `-I${ENV.CPP_ENGINE_INC}`,
    ENV.CPP_ENGINE_SRC,
    '-o',
    ENV.CPP_ENGINE_BIN
  ]);
}

function writeGraphInputFile(nodes, edges, params = {}) {
  fs.mkdirSync(ENV.TEMP_DIR, { recursive: true });
  const filePath = path.join(ENV.TEMP_DIR, `graph_input_${ process.pid }_${ Date.now() }.txt`);
  const lines = [];
  lines.push(`NODES|${nodes.length}`);
  for (const [k, v] of Object.entries(params)) {
    lines.push(`PARAM|${k}|${v}`);
  }
  for (const e of edges) {
    const cleanName = String(e.street_name || '').replace(/\|/g, '/');
    lines.push(
      `EDGE|${e.id}|${e.from}|${e.to}|${cleanName}|${e.distance_m}|${e.base_time_sec}|${e.max_vehicles}|${e.current_vehicles}|${e.is_directed ? 1 : 0}|${e.is_closed ? 1 : 0}|${e.hive_bonus || 0}`
    );
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return filePath;
}

function executeCpp(args) {
  ensureBinaryCompiled();
  const stdout = execFileSync(ENV.CPP_ENGINE_BIN, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  return JSON.parse(stdout.trim());
}

export const cppEngineService = {
  precomputeFloydToSqlite(mode = 'car') {
    const nodes = graphRepository.getAllNodes();
    const edges = graphRepository.getAllEdges();
    const inputFile = writeGraphInputFile(nodes, edges, { mode });
    try {
      const result = executeCpp(['floyd_precompute', inputFile]);
      graphRepository.saveFloydCache(mode, result.pairs || [], result.metrics || {});
      return result.metrics;
    } finally {
      if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
    }
  },

  calculateRoute({ source = 0, target = 1, mode = 'car', compareAllAlgorithms = false }) {
    const nodes = graphRepository.getAllNodes();
    const edges = graphRepository.getAllEdges();

    const closedEdges = edges.filter((e) => e.is_closed);
    const negativeEdges = edges.filter((e) => e.hive_bonus < -1e-6);
    const floydMeta = graphRepository.getFloydMeta(mode);

    // Si estamos en modo normal sin cierres ni pesos negativos y la caché SQLite está lista,
    // también medimos el lookup real desde SQLite para adjuntarlo a la respuesta.
    if ((!floydMeta || !floydMeta.is_valid) && closedEdges.length === 0 && negativeEdges.length === 0) {
      this.precomputeFloydToSqlite(mode);
    }

    const sqliteLookup =
      closedEdges.length === 0 && negativeEdges.length === 0
        ? graphRepository.lookupFloydRouteFromSqlite(mode, source, target)
        : null;

    const inputFile = writeGraphInputFile(nodes, edges, {
      source,
      target,
      mode,
      compare_all: compareAllAlgorithms ? '1' : '0'
    });

    try {
      const cppOutput = executeCpp(['route_query', inputFile]);
      return {
        ...cppOutput,
        sqlite_cache_status: {
          is_valid: closedEdges.length === 0 && negativeEdges.length === 0,
          closed_edges_count: closedEdges.length,
          negative_edges_count: negativeEdges.length,
          sqlite_lookup: sqliteLookup,
          last_precomputed_meta: graphRepository.getFloydMeta(mode)
        }
      };
    } finally {
      if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
    }
  },

  runHiveMind({
    source = 0,
    target = 8,
    mode = 'car',
    kPaths = 3,
    concurrentVehicles = 75,
    injectNegativeCycle = false,
    persistChanges = true
  }) {
    const nodes = graphRepository.getAllNodes();
    // Limpiar bonos previos antes de recalcular la Mente Colmena
    graphRepository.clearHiveBonuses();
    const edges = graphRepository.getAllEdges();

    const inputFile = writeGraphInputFile(nodes, edges, {
      source,
      target,
      mode,
      k_paths: String(kPaths),
      vehicles: String(concurrentVehicles),
      inject_cycle: injectNegativeCycle ? '1' : '0'
    });

    try {
      const cppOutput = executeCpp(['hive_mind', inputFile]);
      if (persistChanges && Array.isArray(cppOutput.updated_edges)) {
        graphRepository.applyHiveMindUpdates(cppOutput.updated_edges);
      }
      return {
        ...cppOutput,
        edges_after: graphRepository.getAllEdges()
      };
    } finally {
      if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
    }
  },

  runRandomTour({ stops = [0, 3, 4, 1, 7], mode = 'car' }) {
    const nodes = graphRepository.getAllNodes();
    const edges = graphRepository.getAllEdges();
    const inputFile = writeGraphInputFile(nodes, edges, {
      mode,
      stops: stops.join(',')
    });
    try {
      return executeCpp(['random_tour', inputFile]);
    } finally {
      if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
    }
  },

  runExercise7({ source = 0, target = 7, scenario = 'normal' }) {
    return executeCpp(['exercise7', String(source), String(target), scenario]);
  },

  runExercise8({
    V = 24,
    density = 0.28,
    negativeMode = 0,
    hasNegativeWeights = false,
    allPairsQuery = false,
    roadClosureEvent = false,
    source = 0,
    target = -1,
    seed = 42,
    cachedQuery = false
  }) {
    const negParam = (negativeMode !== undefined && negativeMode !== null)
      ? String(negativeMode)
      : (hasNegativeWeights ? '1' : '0');

    return executeCpp([
      'exercise8',
      String(V),
      String(density),
      negParam,
      allPairsQuery ? '1' : '0',
      roadClosureEvent ? '1' : '0',
      String(source),
      String(target),
      String(seed),
      cachedQuery ? '1' : '0'
    ]);
  }
};
