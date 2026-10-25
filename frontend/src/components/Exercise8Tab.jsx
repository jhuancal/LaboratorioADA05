import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import {
  Activity,
  Cpu,
  Play,
  RotateCw,
  BarChart3,
  Database,
  Layers,
  Sparkles,
  Zap,
  Network,
  TreePine,
  ZoomIn,
  Maximize2,
  AlertTriangle
} from 'lucide-react';

export default function Exercise8Tab() {
  const [V, setV] = useState(24);
  const [density, setDensity] = useState(0.25);
  // Régimen de pesos negativos: 'none' (normal) | 'acyclic' (bonos sin ciclos) | 'cycle' (fuerza ciclo para auditoría)
  const [negativeMode, setNegativeMode] = useState('none');
  const hasNegativeWeights = negativeMode !== 'none';
  const [allPairsQuery, setAllPairsQuery] = useState(false);
  const [roadClosureEvent, setRoadClosureEvent] = useState(false);
  const [source, setSource] = useState(0);
  const [target, setTarget] = useState(23);
  const [seed, setSeed] = useState(42);
  const [cachedQuery, setCachedQuery] = useState(false);

  const [activeRouteAlgo, setActiveRouteAlgo] = useState('selected'); // 'selected', 'dijkstra', 'bellman', 'kruskal', 'floyd'
  const [chartScaleMode, setChartScaleMode] = useState('log'); // 'log' | 'zoom_linear' | 'full_linear'
  const [hoveredAlgoId, setHoveredAlgoId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Ejecuta el benchmark llamando al motor C++20
  const runBenchmark = async (overrideParams = {}) => {
    setLoading(true);
    try {
      const nextV = overrideParams.V ?? V;
      const nextDensity = overrideParams.density ?? density;
      const nextNegMode = overrideParams.negativeMode ?? negativeMode;
      const nextAllPairs = overrideParams.allPairsQuery ?? allPairsQuery;
      const nextClosure = overrideParams.roadClosureEvent ?? roadClosureEvent;
      const nextSource = overrideParams.source ?? source;
      const nextTarget = overrideParams.target ?? (nextV - 1);
      const nextSeed = overrideParams.seed ?? seed;
      const nextCached = overrideParams.cachedQuery ?? cachedQuery;

      let negNum = 0;
      if (nextNegMode === 'cycle') negNum = 2;
      else if (nextNegMode === 'acyclic') negNum = 1;

      const res = await api.runExercise8({
        V: nextV,
        density: nextDensity,
        negativeMode: negNum,
        hasNegativeWeights: negNum > 0,
        allPairsQuery: nextAllPairs,
        roadClosureEvent: nextClosure,
        source: nextSource,
        target: nextTarget,
        seed: nextSeed,
        cachedQuery: nextCached
      });

      setData(res);
      setSource(res.custom_graph.source);
      setTarget(res.custom_graph.target);

      if (res?.benchmarks?.bellman_ford?.negative_cycle_detected) {
        setActiveRouteAlgo('cycle');
      } else if (activeRouteAlgo === 'cycle') {
        setActiveRouteAlgo('selected');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runBenchmark();
  }, []);

  // Botón 1: Generar un nuevo grafo sintético
  const handleGenerateNewGraph = () => {
    const newSeed = Math.floor(Math.random() * 90000) + 1000;
    const newTarget = V - 1;
    setSeed(newSeed);
    setSource(0);
    setTarget(newTarget);
    setCachedQuery(false);
    runBenchmark({
      seed: newSeed,
      source: 0,
      target: newTarget,
      cachedQuery: false
    });
  };

  // Botón 2: Consultar otro par de nodos sobre el grafo ya en memoria (Demostración O(1) de Floyd)
  const handleQueryAnotherPair = () => {
    if (V < 2) return;
    const s = Math.floor(Math.random() * V);
    let t = Math.floor(Math.random() * (V - 1));
    if (t >= s) t = t + 1;

    setSource(s);
    setTarget(t);
    setCachedQuery(true);
    runBenchmark({
      source: s,
      target: t,
      cachedQuery: true
    });
  };

  const benchmarks = data?.benchmarks ? Object.values(data.benchmarks) : [];
  const chosenAlgoId = data?.selector?.chosen_algorithm_id || 'dijkstra_heap';

  const bfMetrics = data?.benchmarks?.bellman_ford;
  const negativeCycleDetected = Boolean(
    hasNegativeWeights &&
    bfMetrics?.negative_cycle_detected &&
    bfMetrics?.negative_cycle_nodes?.length > 1
  );
  const negCycleNodes = bfMetrics?.negative_cycle_nodes || [];
  const negCycleNodesSet = new Set(negCycleNodes);
  const negCycleEdgesSet = new Set(bfMetrics?.negative_cycle_edges || []);

  const negCyclePairsSet = new Set();
  if (negCycleNodes.length > 1) {
    for (let i = 0; i < negCycleNodes.length - 1; i++) {
      negCyclePairsSet.add(`${negCycleNodes[i]}->${negCycleNodes[i + 1]}`);
    }
  }

  // Obtener la ruta activa según el algoritmo seleccionado para el lienzo
  const getActiveRouteData = () => {
    if (!data?.benchmarks) return { nodes: [], edges: [], cost: 0, time_us: 0, name: '', algoKey: chosenAlgoId || 'dijkstra_heap', reachable: false };

    if (activeRouteAlgo === 'cycle' && negativeCycleDetected) {
      return {
        nodes: negCycleNodes,
        edges: bfMetrics?.negative_cycle_edges || [],
        cost: -Infinity,
        time_us: bfMetrics?.execution_time_us ?? 0,
        name: 'Ciclo Negativo (Bellman-Ford)',
        algoKey: 'cycle',
        reachable: true
      };
    }

    let algoKey = chosenAlgoId;
    if (activeRouteAlgo === 'dijkstra') algoKey = 'dijkstra_heap';
    else if (activeRouteAlgo === 'bellman') algoKey = 'bellman_ford';
    else if (activeRouteAlgo === 'kruskal') algoKey = 'kruskal_mst';
    else if (activeRouteAlgo === 'floyd') algoKey = 'floyd_warshall_cache';

    const b = data.benchmarks[algoKey] || data.benchmarks[chosenAlgoId];
    return {
      nodes: b?.path_nodes || [],
      edges: b?.path_edges || [],
      cost: b?.total_cost ?? 0,
      time_us: b?.execution_time_us ?? 0,
      name: b?.algorithm_name ?? algoKey,
      algoKey: algoKey || 'dijkstra_heap',
      reachable: Boolean(b?.reachable)
    };
  };

  const activeRoute = getActiveRouteData();
  const activePathEdgesSet = new Set(activeRoute.edges);
  const activePathNodesSet = new Set(activeRoute.nodes);

  // Pares ordenados y bidireccionales de la ruta activa para ocultar de filamentos de fondo
  const activeRoutePairsSet = new Set();
  if (activeRoute.nodes && activeRoute.nodes.length > 1) {
    for (let i = 0; i < activeRoute.nodes.length - 1; i++) {
      activeRoutePairsSet.add(`${activeRoute.nodes[i]}->${activeRoute.nodes[i + 1]}`);
      activeRoutePairsSet.add(`${activeRoute.nodes[i + 1]}->${activeRoute.nodes[i]}`);
    }
  }

  // Coordenadas orbitales para los V nodos en lienzo SVG 500x500
  const svgCenter = 250;
  const svgRadius = 185; // Margen de seguridad amplio para que los nodos y halos nunca desborden el contenedor
  const renderNodes = [];
  const nodePositions = {};

  if (data?.custom_graph?.V) {
    const curV = data.custom_graph.V;
    for (let i = 0; i < curV; ++i) {
      const angle = (2 * Math.PI * i) / curV - Math.PI / 2;
      const x = svgCenter + svgRadius * Math.cos(angle);
      const y = svgCenter + svgRadius * Math.sin(angle);
      nodePositions[i] = { x, y };
      renderNodes.push({ id: i, x, y });
    }
  }

  // Color de la ruta activa
  const getRouteColor = (key = '') => {
    if (!key || typeof key !== 'string') return '#38bdf8';
    if (key === 'cycle') return '#f43f5e'; // Rose/Red for negative cycle
    if (key.includes('floyd') || key.includes('cache')) return '#10b981'; // Emerald
    if (key.includes('dijkstra')) return '#38bdf8'; // Cyan
    if (key.includes('bellman')) return '#c084fc'; // Purple
    if (key.includes('kruskal')) return '#facc15'; // Amber
    return '#38bdf8';
  };

  // Datos para la gráfica de escalabilidad
  const scalingSeries = data?.scaling_series || [];
  const maxSeriesTime = Math.max(
    1,
    ...scalingSeries.map((s) => Math.max(s.floyd_full_us, s.bellman_ford_us, s.dijkstra_heap_us))
  );

  return (
    <div className="space-y-6">
      {/* Encabezado y Configuración del Generador */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 px-3 py-0.5 text-xs font-bold text-cyan-300">
                <Activity className="h-3.5 w-3.5" />
                Laboratorio 05 — Ejercicio 08
              </span>
              <span className="rounded-md bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                Generador de Grafos &amp; Selector Inteligente
              </span>
            </div>
            <h2 className="mt-1 text-base font-bold text-white sm:text-lg">
              Selector Inteligente de Algoritmos &amp; Telemetría C++20 (<code className="text-amber-300 font-mono">std::chrono</code>)
            </h2>
            <p className="text-xs text-slate-300 max-w-4xl">
              Genera grafos sintéticos con topología y densidad variable, evalúa empíricamente cómo escalan los algoritmos y demuestra cómo <strong>Floyd-Warshall responde consultas en O(1)</strong> una vez precalculado en memoria.
            </p>
          </div>

          {/* Dos Botones Principales de Acción */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={handleGenerateNewGraph}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-lg cursor-pointer transition"
            >
              <Play className="h-4 w-4" />
              {loading ? 'Generando...' : '🎲 Generar Nuevo Grafo'}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleQueryAnotherPair}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/40 px-4 py-2 text-xs font-bold text-emerald-300 shadow-lg cursor-pointer transition"
              title="Consulta la ruta de otro par de nodos en el mismo grafo usando la matriz precalculada en O(1)"
            >
              <Zap className="h-4 w-4 text-emerald-400" />
              ⚡ Consultar Otro Par (O(1) Caché)
            </button>
          </div>
        </div>

        {/* Sliders de V y Densidad + Toggles de Escenario */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5 pt-3 border-t border-slate-800">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 md:col-span-2">
            <div className="flex justify-between text-xs font-semibold text-slate-200">
              <span>Número de Vértices (V):</span>
              <span className="text-cyan-300 font-bold font-mono">V = {V} nodos</span>
            </div>
            <input
              type="range"
              min="8"
              max="60"
              step="4"
              value={V}
              onChange={(e) => {
                const newV = Number(e.target.value);
                setV(newV);
                setTarget(newV - 1);
                runBenchmark({ V: newV, target: newV - 1, cachedQuery: false });
              }}
              className="mt-2 w-full accent-cyan-500 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
              <span>V=8 (Pequeño)</span>
              <span>V=24 (Mediano)</span>
              <span>V=60 (Máx. SVG)</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex justify-between text-xs font-semibold text-slate-200">
              <span>Densidad de Aristas:</span>
              <span className="text-indigo-300 font-bold font-mono">{Math.round(density * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.15"
              max="0.80"
              step="0.05"
              value={density}
              onChange={(e) => {
                const newD = Number(e.target.value);
                setDensity(newD);
                runBenchmark({ density: newD, cachedQuery: false });
              }}
              className="mt-2 w-full accent-indigo-500 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
              <span>15% (Disperso)</span>
              <span>80% (Denso)</span>
            </div>
          </div>

          {/* Selector de Régimen de Pesos: Normal vs Negativos Acíclicos vs Ciclo Negativo */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 md:col-span-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-purple-400" />
                Régimen de Pesos &amp; Ciclos:
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {negativeMode === 'none' && '🟢 w ≥ 0'}
                {negativeMode === 'acyclic' && '🟣 Acíclico'}
                {negativeMode === 'cycle' && '🔴 Con Ciclo'}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setNegativeMode('none');
                  runBenchmark({ negativeMode: 'none', cachedQuery: false });
                }}
                className={`rounded-lg py-1.5 px-1.5 font-semibold transition cursor-pointer text-center border truncate ${
                  negativeMode === 'none'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Pesos estrictamente no negativos. Dijkstra y Floyd-Warshall O(1) óptimos."
              >
                🟢 Normal (w≥0)
              </button>
              <button
                type="button"
                onClick={() => {
                  setNegativeMode('acyclic');
                  runBenchmark({ negativeMode: 'acyclic', cachedQuery: false });
                }}
                className={`rounded-lg py-1.5 px-1.5 font-semibold transition cursor-pointer text-center border truncate ${
                  negativeMode === 'acyclic'
                    ? 'bg-purple-500/25 border-purple-400/60 text-purple-200 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Incentivos negativos hacia adelante garantizando CERO ciclos negativos. Bellman-Ford O(V·E) halla el costo mínimo."
              >
                🟣 Sin Ciclos
              </button>
              <button
                type="button"
                onClick={() => {
                  setNegativeMode('cycle');
                  runBenchmark({ negativeMode: 'cycle', cachedQuery: false });
                }}
                className={`rounded-lg py-1.5 px-1.5 font-semibold transition cursor-pointer text-center border truncate ${
                  negativeMode === 'cycle'
                    ? 'bg-rose-500/25 border-rose-400/60 text-rose-200 shadow ring-1 ring-rose-400/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Inserta 1 ciclo negativo controlado y localizado para auditoría con Bellman-Ford."
              >
                🔴 Con Ciclo
              </button>
            </div>

            <p className="mt-1.5 text-[10px] text-slate-400 leading-tight">
              {negativeMode === 'none' && 'Red estándar positiva. Dijkstra y Floyd-Warshall O(1) funcionan al 100%.'}
              {negativeMode === 'acyclic' && 'Bonificaciones viales seguras sin ciclos. Bellman-Ford O(V·E) calcula la ruta óptima global.'}
              {negativeMode === 'cycle' && 'Un solo ciclo absorbente aislado. Bellman-Ford aísla la anomalía infinita (-∞).'}
            </p>
          </div>
        </div>
      </div>

      {!data && (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 text-slate-400">
          <div className="flex flex-col items-center gap-3">
            <RotateCw className="h-8 w-8 animate-spin text-cyan-400" />
            <span className="text-xs font-semibold">Generando grafo sintético y ejecutando benchmarks C++20...</span>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Veredicto del Selector Inteligente */}
          <div
            className={`rounded-2xl border p-4 shadow-lg transition-all ${
              data.custom_graph.cached_query
                ? 'border-emerald-500/50 bg-emerald-950/30'
                : 'border-cyan-500/40 bg-cyan-950/20'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-200">
                <Cpu className="h-4 w-4 text-cyan-400" />
                <span>Veredicto del Selector Inteligente de Algoritmos</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                  V = {data.custom_graph.V} | E = {data.custom_graph.E} aristas
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-300">Par Consultado:</span>
                <span className="rounded-md bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 font-bold font-mono text-emerald-300">
                  V{data.custom_graph.source} ➔ V{data.custom_graph.target}
                </span>
                {data.custom_graph.cached_query && (
                  <span className="rounded-md bg-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-200 animate-pulse">
                    ⚡ Modo O(1) Activo
                  </span>
                )}
              </div>
            </div>

            <h3 className="mt-2 text-base font-bold text-white sm:text-lg flex items-center gap-2">
              <span>Algoritmo Seleccionado:</span>
              <span className="text-cyan-300 underline decoration-cyan-500/50">
                {data.selector.chosen_algorithm_name}
              </span>
            </h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-4xl">
              {data.selector.explanation}
            </p>
          </div>

          {/* Banner de Diagnóstico de Ciclo Negativo (Bellman-Ford) */}
          {negativeCycleDetected && (
            <div className="rounded-2xl border border-rose-500/60 bg-rose-950/40 p-4 shadow-xl text-xs text-rose-200 flex items-start gap-3.5">
              <div className="rounded-xl bg-rose-500/20 p-2.5 border border-rose-500/40 shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-400 animate-pulse" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sm text-rose-100 flex items-center gap-2">
                    ⚠️ Ciclo de Costo Negativo Detectado por Bellman-Ford O(V·E)
                  </span>
                  <span className="rounded bg-rose-500/30 border border-rose-400/40 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-200">
                    Costo Total: -∞ (Bucle Infinito Absorbente)
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  En la iteración <em>V</em> = {data.custom_graph.V}, Bellman-Ford comprobó que una arista continuó relajando distancias, confirmando un ciclo cerrado cuya suma de pesos es negativa. Cualquier recorrido que entre en este bucle puede reducir su costo indefinidamente hacia <strong>-∞</strong>.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
                  <span className="text-slate-400">Vértices del ciclo detectado:</span>
                  <span className="rounded bg-slate-900 border border-rose-500/50 px-2 py-0.5 font-bold text-rose-300">
                    {negCycleNodes.map((n) => `V${n}`).join(' ➔ ')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {hasNegativeWeights && !negativeCycleDetected && (
            <div className="rounded-2xl border border-purple-500/40 bg-purple-950/20 p-3.5 shadow-lg text-xs text-purple-200 flex items-center gap-3">
              <Zap className="h-4 w-4 text-purple-400 shrink-0" />
              <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>Pesos Negativos Acíclicos:</strong> Se inyectaron bonificaciones negativas y Bellman-Ford convergió en <em>V-1</em> pasos sin encontrar ciclos absorbentes.
                </span>
                <span className="rounded bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 font-mono text-[10px] text-purple-300">
                  Ruta Óptima Válida
                </span>
              </div>
            </div>
          )}

          {/* GRID PRINCIPAL: MÓDULO 1 (Lienzo Topológico) + MÓDULO 2 (Inspector de Memoria) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* MÓDULO 1: Lienzo Topológico Dinámico de Rutas (8 col en desktop) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-4 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Network className="h-4 w-4 text-cyan-400" />
                  <span>Módulo 1: Topología Limpia &amp; Ruta Iluminada (V={data.custom_graph.V})</span>
                </div>

                {/* Filtro de qué ruta iluminar en el lienzo */}
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setActiveRouteAlgo('selected')}
                    className={`rounded px-2.5 py-1 font-semibold transition cursor-pointer ${
                      activeRouteAlgo === 'selected'
                        ? (chosenAlgoId === 'bellman_ford'
                            ? 'bg-purple-600 text-white shadow'
                            : chosenAlgoId === 'floyd_warshall_cache'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-cyan-600 text-white shadow')
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⭐ Recomendado ({data.selector.chosen_algorithm_name.split(' ')[0]})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRouteAlgo('dijkstra')}
                    className={`rounded px-2 py-1 font-semibold transition cursor-pointer ${
                      activeRouteAlgo === 'dijkstra'
                        ? 'bg-cyan-500 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⚡ Dijkstra
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRouteAlgo('bellman')}
                    className={`rounded px-2 py-1 font-semibold transition cursor-pointer ${
                      activeRouteAlgo === 'bellman'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🧠 Bellman
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRouteAlgo('kruskal')}
                    className={`rounded px-2 py-1 font-semibold transition cursor-pointer ${
                      activeRouteAlgo === 'kruskal'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🌲 MST
                  </button>
                  {negativeCycleDetected && (
                    <button
                      type="button"
                      onClick={() => setActiveRouteAlgo('cycle')}
                      className={`rounded px-2.5 py-1 font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        activeRouteAlgo === 'cycle'
                          ? 'bg-rose-600 text-white shadow ring-2 ring-rose-400 animate-pulse'
                          : 'bg-rose-950/60 text-rose-300 border border-rose-500/50 hover:bg-rose-900/60'
                      }`}
                    >
                      <AlertTriangle className="h-3 w-3 text-rose-400" />
                      ⚠️ Ciclo Negativo
                    </button>
                  )}
                </div>
              </div>

              {/* Contenedor del Lienzo SVG */}
              <div className="relative h-[480px] w-full rounded-xl border border-slate-800 bg-slate-950 overflow-hidden select-none flex items-center justify-center">
                <svg viewBox="0 0 500 500" className="h-full w-full">
                  <defs>
                    <filter id="glow-route" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={getRouteColor(activeRoute.algoKey)} floodOpacity="0.8" />
                    </filter>
                    <filter id="glow-cycle" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f43f5e" floodOpacity="1" />
                    </filter>
                    <marker id="arrow-cycle" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 8 5 L 0 9 z" fill="#f43f5e" />
                    </marker>
                    <marker id="arrow-route" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={getRouteColor(activeRoute.algoKey)} />
                    </marker>
                  </defs>

                  {/* 1. Filamentos sutiles de todas las aristas del grafo */}
                  {(data.render_edges || []).map((edge) => {
                    const u = nodePositions[edge.from];
                    const v = nodePositions[edge.to];
                    if (!u || !v) return null;
                    const isCycleEdge = negativeCycleDetected && (
                      negCycleEdgesSet.has(edge.id) ||
                      negCyclePairsSet.has(`${edge.from}->${edge.to}`)
                    );
                    const isInRoute = activePathEdgesSet.has(edge.id) || activeRoutePairsSet.has(`${edge.from}->${edge.to}`);
                    if (isInRoute || isCycleEdge) return null; // Se dibujan en capas superiores

                    const isNegWeight = edge.weight < 0;

                    return (
                      <line
                        key={`bg-${edge.id}`}
                        x1={u.x}
                        y1={u.y}
                        x2={v.x}
                        y2={v.y}
                        stroke={isNegWeight ? '#c084fc' : '#1e293b'}
                        strokeWidth={isNegWeight ? '1.8' : '1.2'}
                        strokeDasharray={isNegWeight ? '4 2' : undefined}
                        strokeOpacity={isNegWeight ? '0.75' : '0.45'}
                      />
                    );
                  })}

                  {/* 2. Aristas de la Ruta Mínima Iluminada (Renderizado 100% garantizado por pares consecutivos con flechas direccionales) */}
                  {activeRouteAlgo !== 'cycle' && activeRoute.nodes && activeRoute.nodes.length > 1 && (
                    activeRoute.nodes.slice(0, -1).map((uId, idx) => {
                      const vId = activeRoute.nodes[idx + 1];
                      const u = nodePositions[uId];
                      const v = nodePositions[vId];
                      if (!u || !v) return null;

                      // Ajustar el punto final para que la punta de flecha toque el borde exterior del nodo
                      const dx = v.x - u.x;
                      const dy = v.y - u.y;
                      const dist = Math.hypot(dx, dy) || 1;
                      const targetRadius = V > 35 ? 9 : 13;
                      const x2Adj = v.x - (dx / dist) * targetRadius;
                      const y2Adj = v.y - (dy / dist) * targetRadius;

                      return (
                        <g key={`route-link-${uId}-${vId}-${idx}`}>
                          {/* Halo de resplandor exterior */}
                          <line
                            x1={u.x}
                            y1={u.y}
                            x2={x2Adj}
                            y2={y2Adj}
                            stroke={getRouteColor(activeRoute.algoKey)}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeOpacity="0.4"
                            filter="url(#glow-route)"
                          />
                          {/* Trazo nítido principal con flecha direccional */}
                          <line
                            x1={u.x}
                            y1={u.y}
                            x2={x2Adj}
                            y2={y2Adj}
                            stroke={getRouteColor(activeRoute.algoKey)}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            markerEnd="url(#arrow-route)"
                          />
                        </g>
                      );
                    })
                  )}

                  {/* 3. Capa Destacada de Ciclo Negativo Detectado (si existe) */}
                  {negativeCycleDetected && (data.render_edges || []).map((edge) => {
                    const u = nodePositions[edge.from];
                    const v = nodePositions[edge.to];
                    if (!u || !v) return null;
                    const isCycleEdge = negCycleEdgesSet.has(edge.id) || negCyclePairsSet.has(`${edge.from}->${edge.to}`);
                    if (!isCycleEdge) return null;

                    return (
                      <g key={`cycle-edge-${edge.id}`}>
                        <line
                          x1={u.x}
                          y1={u.y}
                          x2={v.x}
                          y2={v.y}
                          stroke="#f43f5e"
                          strokeWidth="4.5"
                          strokeLinecap="round"
                          strokeDasharray="6 3"
                          filter="url(#glow-cycle)"
                          markerEnd="url(#arrow-cycle)"
                          className="animate-pulse"
                        />
                        {/* Etiqueta con peso negativo del ciclo */}
                        <text
                          x={(u.x + v.x) / 2}
                          y={(u.y + v.y) / 2 - 3}
                          textAnchor="middle"
                          fill="#fecdd3"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {edge.weight?.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}

                  {/* 4. Nodos en Anillo Circular */}
                  {renderNodes.map((node) => {
                    const isSrc = node.id === source;
                    const isDst = node.id === target;
                    const isInRouteNode = activePathNodesSet.has(node.id);
                    const isInCycleNode = negativeCycleDetected && negCycleNodesSet.has(node.id);

                    let nodeFill = '#0f172a';
                    let nodeStroke = '#334155';
                    let nodeRadius = V > 35 ? 7 : 11;

                    if (isInCycleNode) {
                      nodeFill = '#e11d48';
                      nodeStroke = '#fda4af';
                      nodeRadius = V > 35 ? 9 : 13;
                    } else if (isSrc) {
                      nodeFill = '#10b981';
                      nodeStroke = '#34d399';
                      nodeRadius = V > 35 ? 9 : 13;
                    } else if (isDst) {
                      nodeFill = '#ef4444';
                      nodeStroke = '#f87171';
                      nodeRadius = V > 35 ? 9 : 13;
                    } else if (isInRouteNode) {
                      nodeFill = getRouteColor(activeRoute.algoKey);
                      nodeStroke = '#ffffff';
                      nodeRadius = V > 35 ? 8 : 12;
                    }

                    return (
                      <g key={`node-${node.id}`}>
                        {/* Radar animado nativo en SVG para ciclo negativo (100% centrado y contenido) */}
                        {isInCycleNode && (
                          <>
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={nodeRadius + 3}
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth="2"
                              opacity="0.8"
                            >
                              <animate attributeName="r" values={`${nodeRadius + 2};${nodeRadius + 8}`} dur="1.4s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="0.85;0" dur="1.4s" repeatCount="indefinite" />
                            </circle>
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={nodeRadius + 4}
                              fill="rgba(244, 63, 94, 0.25)"
                              className="animate-pulse"
                            />
                          </>
                        )}

                        {/* Aura pulsante para origen y destino */}
                        {(isSrc || isDst) && !isInCycleNode && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={nodeRadius + 5}
                            fill={isSrc ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}
                            className="animate-pulse"
                          />
                        )}

                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={nodeRadius}
                          fill={nodeFill}
                          stroke={nodeStroke}
                          strokeWidth="2"
                        />

                        {/* Texto de ID de nodo solo si V <= 32 para no empastar */}
                        {V <= 32 && (
                          <text
                            x={node.x}
                            y={node.y + 3.5}
                            textAnchor="middle"
                            fill={isInCycleNode || isSrc || isDst || isInRouteNode ? '#ffffff' : '#94a3b8'}
                            fontSize="8"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {node.id}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Banner de ruta o ciclo en el lienzo */}
                <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs text-slate-200 shadow-xl backdrop-blur flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: activeRouteAlgo === 'cycle' ? '#f43f5e' : getRouteColor(activeRoute.algoKey) }}
                    />
                    <span>
                      {activeRouteAlgo === 'cycle' ? (
                        <strong className="text-rose-400">¡Ciclo Negativo Absorbente!:</strong>
                      ) : (
                        <>Ruta <strong>{activeRoute.name}</strong>:</>
                      )}
                    </span>
                    <span className="font-mono font-bold text-cyan-300">
                      {activeRoute.nodes?.length > 0
                        ? activeRoute.nodes.map((n) => `V${n}`).join(' → ')
                        : (loading ? 'Calculando...' : '⚠️ Sin ruta conexa (Vértice inalcanzable)')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                    <span>
                      Costo:{' '}
                      <strong className={activeRouteAlgo === 'cycle' ? 'text-rose-400 font-bold' : (activeRoute.reachable ? 'text-emerald-400' : 'text-slate-400')}>
                        {activeRouteAlgo === 'cycle'
                          ? '-∞ (Indefinido)'
                          : (activeRoute.reachable ? `${activeRoute.cost?.toFixed(2)}s` : 'Inalcanzable')}
                      </strong>
                    </span>
                    <span>
                      Tiempo: <strong className="text-amber-300">{activeRoute.time_us?.toFixed(3)} µs</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MÓDULO 2: Inspector de Estructuras en Memoria (5 col en desktop) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-4 lg:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Database className="h-4 w-4 text-indigo-400" />
                  <span>Módulo 2: Inspector de Estructuras en Memoria (RAM)</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Comparación del consumo de memoria en bytes calculado por C++ entre la representación por listas y la matriz de adyacencia:
                </p>

                <div className="mt-4 space-y-3">
                  {/* Tarjeta Lista de Adyacencia */}
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" />
                        Lista de Adyacencia
                      </span>
                      <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                        O(V + E)
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">Huella en RAM:</span>
                      <span className="text-sm font-bold font-mono text-white">
                        {((data.memory?.adj_list_bytes || 0) / 1024).toFixed(2)} KB
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Usada por <strong>Dijkstra (Min-Heap)</strong> y <strong>Bellman-Ford</strong>. Solo guarda aristas existentes, optimizando la memoria en grafos dispersos.
                    </p>
                  </div>

                  {/* Tarjeta Matriz de Adyacencia */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5" />
                        Matriz de Adyacencia
                      </span>
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                        O(V²)
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">Huella en RAM:</span>
                      <span className="text-sm font-bold font-mono text-white">
                        {((data.memory?.matrix_bytes || 0) / 1024).toFixed(2)} KB
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Usada por <strong>Floyd-Warshall</strong> y <strong>Dijkstra Matriz</strong>. Reserva V × V doubles en memoria contigua para accesos en O(1).
                    </p>
                  </div>

                  {/* Comparativa de Expansión */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between font-semibold text-slate-300">
                      <span>Multiplicador de Memoria (Matriz / Lista):</span>
                      <span className="font-bold text-indigo-400 font-mono">
                        {data.memory?.ratio ? data.memory.ratio.toFixed(2) : '1.0'}x
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Para este tamaño V = {data.custom_graph.V}, la matriz requiere un almacenamiento cuadrático que crece al escalar el grafo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tiempos de los algoritmos para el par actual */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-300">
                  Tiempos std::chrono para el par (V{source} ➔ V{target}):
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <span className="block text-[10px] text-emerald-400 font-sans font-bold">Floyd O(1) Caché</span>
                    <span className="font-bold text-white">{(data.benchmarks.floyd_warshall_cache?.execution_time_us ?? 0).toFixed(4)} µs</span>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <span className="block text-[10px] text-cyan-400 font-sans font-bold">Dijkstra Min-Heap</span>
                    <span className="font-bold text-white">{(data.benchmarks.dijkstra_heap?.execution_time_us ?? 0).toFixed(3)} µs</span>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <span className="block text-[10px] text-purple-400 font-sans font-bold">Bellman-Ford</span>
                    <span className="font-bold text-white">{(data.benchmarks.bellman_ford?.execution_time_us ?? 0).toFixed(3)} µs</span>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <span className="block text-[10px] text-amber-400 font-sans font-bold">Floyd Full O(V³)</span>
                    <span className="font-bold text-white">{(data.benchmarks.floyd_warshall_full?.execution_time_us ?? 0).toFixed(1)} µs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MÓDULO 3: Gráfica Estadística Interactiva de Escalabilidad Asintótica */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <BarChart3 className="h-4 w-4 text-amber-400" />
                  <span>Módulo 3: Curvas de Complejidad Asintótica en Tiempo Real (C++20 std::chrono)</span>
                </div>
                <p className="mt-1 text-xs text-slate-400 max-w-2xl">
                  Compara empíricamente el crecimiento cúbico de <strong>Floyd Full O(V³)</strong>, cuadrático de <strong>Dijkstra Matriz O(V²)</strong>, cuasi-lineal de <strong>Dijkstra Min-Heap O(E log V)</strong> y <strong>Bellman-Ford O(V·E)</strong>, frente al tiempo plano de <strong>Floyd Caché O(1)</strong>:
                </p>
              </div>

              {/* Selector de Modo de Zoom y Escala */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
                <span className="px-2 text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <ZoomIn className="h-3.5 w-3.5 text-cyan-400" />
                  Escala / Zoom:
                </span>
                <button
                  type="button"
                  onClick={() => setChartScaleMode('log')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                    chartScaleMode === 'log'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="La escala logarítmica distribuye uniformemente desde 0.001 µs hasta 5000 µs permitiendo ver TODAS las curvas y puntos con claridad"
                >
                  📊 Escala Logarítmica (Óptima para ver todas)
                </button>
                <button
                  type="button"
                  onClick={() => setChartScaleMode('zoom_linear')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                    chartScaleMode === 'zoom_linear'
                      ? 'bg-cyan-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Zoom lineal ampliado (0 a 50 µs) para comparar en alta resolución Dijkstra, Bellman y Floyd Caché"
                >
                  🔍 Zoom Micro (0 a 50 µs)
                </button>
                <button
                  type="button"
                  onClick={() => setChartScaleMode('full_linear')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                    chartScaleMode === 'full_linear'
                      ? 'bg-indigo-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Escala lineal macro de 0 a 5000 µs que demuestra visualmente la explosión cúbica de Floyd Full"
                >
                  🌐 Macro Lineal (0 a {maxSeriesTime.toFixed(0)} µs)
                </button>
              </div>
            </div>

            {/* Leyenda de Algoritmos */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pt-1 border-t border-slate-800/60">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="h-2 w-4 rounded-full bg-emerald-400" /> Floyd Caché O(1)
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <span className="h-2 w-4 rounded-full bg-cyan-400" /> Dijkstra Heap O(E log V)
                </span>
                <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                  <span className="h-2 w-4 rounded-full bg-purple-400" /> Bellman-Ford O(V·E)
                </span>
                <span className="flex items-center gap-1.5 text-indigo-400 font-bold">
                  <span className="h-2 w-4 rounded-full bg-indigo-400 border border-indigo-300" /> Dijkstra Matriz O(V²)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <span className="h-2 w-4 rounded-full bg-amber-400" /> Floyd Full O(V³)
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                {chartScaleMode === 'log' && 'Eje Y en log₁₀: distribuye equitativamente ns, µs y ms para ver cada algoritmo con separación total.'}
                {chartScaleMode === 'zoom_linear' && 'Eje Y lineal ampliado [0, 50 µs]: máxima precisión en la zona de microsegundos.'}
                {chartScaleMode === 'full_linear' && 'Eje Y lineal completo: muestra el impacto cúbico masivo de O(V³).'}
              </div>
            </div>

            {/* Gráfica SVG Vectorial de Líneas con Marcadores Simultáneos de TODOS los Algoritmos */}
            <div className="relative h-[340px] w-full rounded-xl border border-slate-800 bg-slate-950 p-3 select-none">
              <svg viewBox="0 0 860 300" className="h-full w-full overflow-visible">
                {scalingSeries.length > 0 && (() => {
                  const chartHeight = 220;
                  const chartYBottom = 255;
                  const chartYTop = 35;
                  const chartXLeft = 70;
                  const chartXRight = 825;
                  const chartWidth = chartXRight - chartXLeft;

                  const minV = scalingSeries[0]?.V ?? 8;
                  const maxV = scalingSeries[scalingSeries.length - 1]?.V ?? 150;

                  const getX = (v) => {
                    const clamped = Math.min(maxV, Math.max(minV, v));
                    return chartXLeft + ((clamped - minV) / (maxV - minV)) * chartWidth;
                  };

                  const currentX = getX(V);

                  // 1. Escala Logarítmica: de min 0.0008 µs (0.8 ns) a max 10000 µs (10 ms)
                  const logMin = -3.1;
                  const logMax = 4.0;
                  const logRange = logMax - logMin;

                  const zoomLinearMax = 50.0;
                  const macroLinearMax = Math.max(500, maxSeriesTime);

                  const getY = (val) => {
                    const safeVal = Math.max(0.0005, Number(val) || 0.0005);
                    if (chartScaleMode === 'log') {
                      const logV = Math.log10(safeVal);
                      const clampedLog = Math.max(logMin, Math.min(logMax, logV));
                      const ratio = (clampedLog - logMin) / logRange;
                      return chartYBottom - ratio * chartHeight;
                    }
                    if (chartScaleMode === 'zoom_linear') {
                      const ratio = Math.min(1.05, safeVal / zoomLinearMax);
                      return chartYBottom - ratio * chartHeight;
                    }
                    const ratio = Math.min(1.0, safeVal / macroLinearMax);
                    return chartYBottom - ratio * chartHeight;
                  };

                  // Ticks del Eje Y según la escala activa
                  const yTicks =
                    chartScaleMode === 'log'
                      ? [
                          { val: 0.001, label: '1 ns (0.001 µs)' },
                          { val: 0.01, label: '10 ns' },
                          { val: 0.1, label: '100 ns' },
                          { val: 1.0, label: '1 µs' },
                          { val: 10.0, label: '10 µs' },
                          { val: 100.0, label: '100 µs' },
                          { val: 1000.0, label: '1 ms (1000 µs)' },
                          { val: 5000.0, label: '5 ms (5000 µs)' }
                        ]
                      : chartScaleMode === 'zoom_linear'
                      ? [
                          { val: 0, label: '0 µs' },
                          { val: 10, label: '10 µs' },
                          { val: 20, label: '20 µs' },
                          { val: 30, label: '30 µs' },
                          { val: 40, label: '40 µs' },
                          { val: 50, label: '50 µs' }
                        ]
                      : [
                          { val: 0, label: '0 µs' },
                          { val: macroLinearMax * 0.25, label: `${(macroLinearMax * 0.25).toFixed(0)} µs` },
                          { val: macroLinearMax * 0.5, label: `${(macroLinearMax * 0.5).toFixed(0)} µs` },
                          { val: macroLinearMax * 0.75, label: `${(macroLinearMax * 0.75).toFixed(0)} µs` },
                          { val: macroLinearMax, label: `${macroLinearMax.toFixed(0)} µs` }
                        ];

                  // Curvas para cada algoritmo
                  const ptsFloydFull = scalingSeries.map((s) => `${getX(s.V)},${getY(s.floyd_full_us)}`).join(' ');
                  const ptsDijkstraMatrix = scalingSeries.map((s) => `${getX(s.V)},${getY(s.dijkstra_matrix_us)}`).join(' ');
                  const ptsDijkstraHeap = scalingSeries.map((s) => `${getX(s.V)},${getY(s.dijkstra_heap_us)}`).join(' ');
                  const ptsBellman = scalingSeries.map((s) => `${getX(s.V)},${getY(s.bellman_ford_us)}`).join(' ');
                  const ptsCache = scalingSeries.map((s) => `${getX(s.V)},${getY(s.floyd_cache_us)}`).join(' ');

                  // Lista de TODOS los algoritmos evaluados en la ejecución actual
                  const executedAlgos = [
                    {
                      id: 'floyd_warshall_cache',
                      name: 'Floyd Caché O(1)',
                      short: 'Caché O(1)',
                      time_us: data.benchmarks.floyd_warshall_cache?.execution_time_us ?? 0,
                      color: '#10b981',
                      complexity: 'O(1)',
                      align: 'right',
                      isSelected: chosenAlgoId === 'floyd_warshall_cache'
                    },
                    {
                      id: 'bellman_ford',
                      name: 'Bellman-Ford',
                      short: 'Bellman',
                      time_us: data.benchmarks.bellman_ford?.execution_time_us ?? 0,
                      color: '#c084fc',
                      complexity: 'O(V·E)',
                      align: 'left',
                      isSelected: chosenAlgoId === 'bellman_ford'
                    },
                    {
                      id: 'dijkstra_heap',
                      name: 'Dijkstra Heap',
                      short: 'Dijkstra Heap',
                      time_us: data.benchmarks.dijkstra_heap?.execution_time_us ?? 0,
                      color: '#38bdf8',
                      complexity: 'O(E log V)',
                      align: 'right',
                      isSelected: chosenAlgoId === 'dijkstra_heap'
                    },
                    {
                      id: 'dijkstra_matrix',
                      name: 'Dijkstra Matriz',
                      short: 'Dijkstra Mat.',
                      time_us: data.benchmarks.dijkstra_matrix?.execution_time_us ?? 0,
                      color: '#818cf8',
                      complexity: 'O(V²)',
                      align: 'left',
                      isSelected: chosenAlgoId === 'dijkstra_matrix'
                    },
                    {
                      id: 'floyd_warshall_full',
                      name: 'Floyd Full Recálculo',
                      short: 'Floyd Full',
                      time_us: data.benchmarks.floyd_warshall_full?.execution_time_us ?? 0,
                      color: '#f59e0b',
                      complexity: 'O(V³)',
                      align: 'right',
                      isSelected: chosenAlgoId === 'floyd_warshall_full'
                    }
                  ];

                  const hudX = currentX < 460 ? 590 : 80;

                  return (
                    <>
                      {/* Cuadrícula horizontal y etiquetas del Eje Y */}
                      {yTicks.map((t, idx) => {
                        const y = getY(t.val);
                        return (
                          <g key={`ytick-${idx}`}>
                            <line x1={chartXLeft} y1={y} x2={chartXRight} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                            <text x={chartXLeft - 8} y={y + 3.5} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                              {t.label}
                            </text>
                          </g>
                        );
                      })}

                      {/* Ejes X e Y principales */}
                      <line x1={chartXLeft} y1={chartYBottom} x2={chartXRight} y2={chartYBottom} stroke="#475569" strokeWidth="1.5" />
                      <line x1={chartXLeft} y1={chartYTop - 10} x2={chartXLeft} y2={chartYBottom} stroke="#475569" strokeWidth="1.5" />

                      {/* Curvas de Complejidad */}
                      {/* 1. Floyd Full O(V³) */}
                      <polyline points={ptsFloydFull} fill="none" stroke="#f59e0b" strokeWidth="2.8" strokeLinecap="round" />
                      {/* 2. Dijkstra Matriz O(V²) */}
                      <polyline points={ptsDijkstraMatrix} fill="none" stroke="#818cf8" strokeWidth="2" strokeDasharray="4,2" />
                      {/* 3. Bellman-Ford O(V*E) */}
                      <polyline points={ptsBellman} fill="none" stroke="#c084fc" strokeWidth="2.2" strokeDasharray="5,2" />
                      {/* 4. Dijkstra Min-Heap O(E log V) */}
                      <polyline points={ptsDijkstraHeap} fill="none" stroke="#38bdf8" strokeWidth="2.6" strokeLinecap="round" />
                      {/* 5. Floyd Caché O(1) */}
                      <polyline points={ptsCache} fill="none" stroke="#10b981" strokeWidth="3.2" strokeLinecap="round" />

                      {/* Marcas y etiquetas del Eje X */}
                      {scalingSeries.map((s) => {
                        const px = getX(s.V);
                        return (
                          <g key={`x-tick-${s.V}`}>
                            <line x1={px} y1={chartYBottom} x2={px} y2={chartYBottom + 6} stroke="#475569" strokeWidth="1.5" />
                            <text x={px} y={chartYBottom + 18} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                              V={s.V}
                            </text>
                            {/* Puntos de referencia de las series */}
                            <circle cx={px} cy={getY(s.floyd_full_us)} r="3.5" fill="#f59e0b" />
                            <circle cx={px} cy={getY(s.dijkstra_matrix_us)} r="3" fill="#818cf8" />
                            <circle cx={px} cy={getY(s.bellman_ford_us)} r="3" fill="#c084fc" />
                            <circle cx={px} cy={getY(s.dijkstra_heap_us)} r="3.5" fill="#38bdf8" />
                            <circle cx={px} cy={getY(s.floyd_cache_us)} r="3.5" fill="#10b981" />
                          </g>
                        );
                      })}

                      {/* LÍNEA GUÍA VERTICAL DE LA EJECUCIÓN ACTUAL (V = currentV) */}
                      <line
                        x1={currentX}
                        y1={chartYTop - 12}
                        x2={currentX}
                        y2={chartYBottom}
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        strokeOpacity="0.8"
                      />

                      {/* Etiqueta superior del V actual */}
                      <g transform={`translate(${currentX}, ${chartYTop - 14})`}>
                        <rect x="-38" y="-14" width="76" height="18" rx="4" fill="#0284c7" />
                        <text x="0" y="-1.5" textAnchor="middle" fill="#ffffff" fontSize="10" fontFamily="monospace" fontWeight="bold">
                          V={V} (Actual)
                        </text>
                      </g>

                      {/* PUNTOS ACTUALES DE TODOS LOS ALGORITMOS EJECUTADOS */}
                      {executedAlgos.map((algo) => {
                        const isOffZoom = chartScaleMode === 'zoom_linear' && algo.time_us > zoomLinearMax;
                        const y = isOffZoom ? chartYTop - 4 : getY(algo.time_us);
                        const isRight = algo.align === 'right';
                        const badgeX = isRight ? currentX + 10 : currentX - 10;
                        const textAnchor = isRight ? 'start' : 'end';

                        const formattedTime =
                          algo.time_us < 0.01
                            ? `${algo.time_us.toFixed(4)}µs`
                            : algo.time_us < 1
                            ? `${algo.time_us.toFixed(3)}µs`
                            : `${algo.time_us.toFixed(2)}µs`;

                        return (
                          <g
                            key={`live-point-${algo.id}`}
                            className="transition-all cursor-pointer"
                            onMouseEnter={() => setHoveredAlgoId(algo.id)}
                            onMouseLeave={() => setHoveredAlgoId(null)}
                          >
                            {/* Halo pulsante concéntrico para el algoritmo seleccionado */}
                            {algo.isSelected && (
                              <>
                                <circle
                                  cx={currentX}
                                  cy={y}
                                  r="13"
                                  fill={algo.color}
                                  fillOpacity="0.25"
                                  className="animate-pulse"
                                />
                                <circle
                                  cx={currentX}
                                  cy={y}
                                  r="18"
                                  fill="none"
                                  stroke={algo.color}
                                  strokeWidth="1.5"
                                  strokeOpacity="0.4"
                                  className="animate-pulse"
                                />
                              </>
                            )}

                            {/* Círculo externo del punto */}
                            <circle
                              cx={currentX}
                              cy={y}
                              r={algo.isSelected ? 7 : 5}
                              fill={algo.color}
                              stroke="#ffffff"
                              strokeWidth={algo.isSelected ? '2.5' : '1.8'}
                            />

                            {/* Badge/Etiqueta flotante adherida al punto */}
                            <g transform={`translate(${badgeX}, ${y + 3.5})`}>
                              <rect
                                x={isRight ? 0 : -100}
                                y="-11"
                                width="100"
                                height="16"
                                rx="4"
                                fill="#090d16"
                                fillOpacity="0.92"
                                stroke={algo.color}
                                strokeWidth={algo.isSelected ? '1.8' : '1'}
                              />
                              <text
                                x={isRight ? 5 : -5}
                                y="1"
                                textAnchor={textAnchor}
                                fill={algo.isSelected ? '#ffffff' : algo.color}
                                fontSize="9"
                                fontFamily="monospace"
                                fontWeight={algo.isSelected ? 'bold' : 'normal'}
                              >
                                {algo.isSelected ? '⭐ ' : ''}{algo.short}: {formattedTime}
                              </text>
                            </g>
                          </g>
                        );
                      })}

                      {/* HUD FLOTANTE: Telemetría simultánea de todos los algoritmos en esta corrida */}
                      <g transform={`translate(${hudX}, 20)`} className="pointer-events-none select-none">
                        <rect
                          x="0"
                          y="0"
                          width="240"
                          height="146"
                          rx="8"
                          fill="#030712"
                          fillOpacity="0.90"
                          stroke="#334155"
                          strokeWidth="1.2"
                        />
                        <text x="12" y="18" fill="#e2e8f0" fontSize="10" fontFamily="sans-serif" fontWeight="bold">
                          📍 Telemetría en Vivo (Grafo V={V})
                        </text>
                        <line x1="12" y1="24" x2="228" y2="24" stroke="#1e293b" strokeWidth="1" />

                        {executedAlgos.map((algo, idx) => {
                          const rowY = 40 + idx * 20;
                          return (
                            <g key={`hud-row-${algo.id}`}>
                              {algo.isSelected && (
                                <rect x="8" y={rowY - 11} width="224" height="17" rx="3" fill="#0c4a6e" fillOpacity="0.4" />
                              )}
                              <circle cx="18" cy={rowY - 3} r="3.5" fill={algo.color} />
                              <text x="28" y={rowY} fill={algo.isSelected ? '#ffffff' : '#94a3b8'} fontSize="9.5" fontFamily="monospace">
                                {algo.short}
                              </text>
                              <text x="135" y={rowY} fill="#64748b" fontSize="8" fontFamily="monospace">
                                [{algo.complexity}]
                              </text>
                              <text
                                x="228"
                                y={rowY}
                                textAnchor="end"
                                fill={algo.isSelected ? '#38bdf8' : '#ffffff'}
                                fontSize="9.5"
                                fontFamily="monospace"
                                fontWeight={algo.isSelected ? 'bold' : 'normal'}
                              >
                                {algo.time_us < 0.01
                                  ? `${algo.time_us.toFixed(4)} µs`
                                  : algo.time_us < 1
                                  ? `${algo.time_us.toFixed(3)} µs`
                                  : `${algo.time_us.toFixed(2)} µs`}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Tabla resumen de los puntos evaluados en C++20 */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2">Vértices (V) / Aristas</th>
                    <th className="py-2 text-emerald-300">Floyd Caché O(1)</th>
                    <th className="py-2 text-cyan-300">Dijkstra Min-Heap</th>
                    <th className="py-2 text-indigo-300">Dijkstra Matriz</th>
                    <th className="py-2 text-purple-300">Bellman-Ford</th>
                    <th className="py-2 text-amber-300">Floyd Full O(V³)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {scalingSeries.map((row) => (
                    <tr
                      key={row.V}
                      className={row.V === V ? 'bg-cyan-950/30 text-white font-bold' : 'text-slate-200'}
                    >
                      <td className="py-2">
                        V={row.V} <span className="text-slate-500 font-normal">({row.E}e)</span>
                        {row.V === V && <span className="ml-2 text-[10px] text-cyan-400">● actual</span>}
                      </td>
                      <td className="py-2 text-emerald-300">{row.floyd_cache_us.toFixed(4)} µs</td>
                      <td className="py-2 text-cyan-300">{row.dijkstra_heap_us.toFixed(3)} µs</td>
                      <td className="py-2 text-indigo-300">{row.dijkstra_matrix_us.toFixed(3)} µs</td>
                      <td className="py-2 text-purple-300">{row.bellman_ford_us.toFixed(3)} µs</td>
                      <td className="py-2 text-amber-300 font-bold">{row.floyd_full_us.toFixed(1)} µs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
