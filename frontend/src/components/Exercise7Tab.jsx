import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  Table,
  Clock,
  Sparkles,
  Zap,
  Network,
  TreePine,
  ArrowRight,
  Info
} from 'lucide-react';

export default function Exercise7Tab() {
  const [source, setSource] = useState(0); // Plaza de Armas
  const [target, setTarget] = useState(7); // Terminal Terrestre
  const [activeOverlay, setActiveOverlay] = useState('dijkstra'); // 'dijkstra' | 'bellman' | 'mst' | 'cycle'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hoveredEdge, setHoveredEdge] = useState(null);

  const runExperiment = async (s = source, t = target) => {
    setLoading(true);
    try {
      const res = await api.runExercise7({ source: s, target: t, scenario: 'unified' });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runExperiment(source, target);
  }, [source, target]);

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];
  const algos = data?.algorithms || {};

  // Posiciones octogonales armónicas para los 8 nodos en lienzo SVG 900x520
  const nodeCoords = {
    0: { x: 450, y: 70, name: 'V0: Plaza de Armas', zone: 'Centro', col: '#38bdf8' },
    1: { x: 670, y: 120, name: 'V1: Puente Grau', zone: 'Norte', col: '#818cf8' },
    2: { x: 790, y: 260, name: 'V2: Mirador Yanahuara', zone: 'Yanahuara', col: '#a855f7' },
    3: { x: 670, y: 400, name: 'V3: Mall Plaza Cayma', zone: 'Cayma', col: '#f43f5e' },
    7: { x: 450, y: 460, name: 'V7: Terminal Terrestre', zone: 'Terminal', col: '#ef4444' },
    6: { x: 230, y: 400, name: 'V6: Hospital Honorio', zone: 'Hospital', col: '#f59e0b' },
    5: { x: 110, y: 260, name: 'V5: UNSA Ingenierías', zone: 'Universidad', col: '#10b981' },
    4: { x: 230, y: 120, name: 'V4: Puente Chilina', zone: 'Selva Alegre', col: '#06b6d4' }
  };

  // Determinar qué aristas resaltar según la opción activa
  const dijkstraEdges = new Set(algos.dijkstra_heap?.path_edges || []);
  const bellmanEdges = new Set(algos.bellman_ford?.path_edges || []);
  const mstEdges = new Set(data?.mst_edges || []);
  const cycleEdges = new Set([5, 6]); // V2 -> V3 (id 5, +9s), V3 -> V2 (id 6, -14s => total -5s < 0)

  const dijkstraNodes = new Set(algos.dijkstra_heap?.path_nodes || []);
  const bellmanNodes = new Set(algos.bellman_ford?.path_nodes || []);
  const cycleNodes = new Set([2, 3]);

  const isEdgeHighlighted = (edgeId) => {
    if (activeOverlay === 'dijkstra') return dijkstraEdges.has(edgeId);
    if (activeOverlay === 'bellman') return bellmanEdges.has(edgeId);
    if (activeOverlay === 'mst') return mstEdges.has(edgeId);
    if (activeOverlay === 'cycle') return cycleEdges.has(edgeId);
    return false;
  };

  const getOverlayColor = () => {
    if (activeOverlay === 'dijkstra') return '#38bdf8'; // Cyan
    if (activeOverlay === 'bellman') return '#c084fc'; // Purple
    if (activeOverlay === 'mst') return '#facc15'; // Amber/Gold
    if (activeOverlay === 'cycle') return '#f43f5e'; // Rose
    return '#38bdf8';
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Selección de Vértices */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-xl backdrop-blur space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-3 py-0.5 text-xs font-bold text-indigo-300">
                <Layers className="h-3.5 w-3.5" />
                Laboratorio 05 — Ejercicio 07
              </span>
              <span className="rounded-md bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                Grafo Didáctico Unificado (8 Vértices)
              </span>
            </div>
            <h2 className="mt-1 text-base font-bold text-white sm:text-lg">
              Red de Transporte Dirigida de 8 Vértices en Arequipa
            </h2>
            <p className="text-xs text-slate-300 max-w-4xl">
              Grafo didáctico integral que reúne <strong>caminos 100% positivos</strong> (para demostrar Dijkstra),{' '}
              <strong>aristas con pesos negativos</strong> (<code className="text-purple-300">-5s</code> y <code className="text-purple-300">-4s</code> con subsidio para Bellman-Ford),{' '}
              un <strong>ciclo negativo localizado</strong> (<code className="text-rose-400">V2 ⇄ V3 = 9 - 14 = -5s &lt; 0</code>) y la matriz global de <strong>Floyd-Warshall 8×8</strong>.
            </p>
          </div>

          {/* Selector de Resaltado en Grafo Didáctico */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveOverlay('dijkstra')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                activeOverlay === 'dijkstra'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              ⚡ Camino Dijkstra
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay('bellman')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                activeOverlay === 'bellman'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              🧠 Camino Bellman-Ford
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay('mst')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                activeOverlay === 'mst'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TreePine className="h-3.5 w-3.5" />
              🌲 Árbol MST (Kruskal)
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay('cycle')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                activeOverlay === 'cycle'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              ⚠️ Ciclo Negativo
            </button>
          </div>
        </div>

        {/* Selectores de Vértice Origen y Destino */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-emerald-400 mb-1">
              🟢 Vértice Origen (Source):
            </label>
            <select
              value={source}
              onChange={(e) => setSource(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white cursor-pointer"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [V{n.id}] {n.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-rose-400 mb-1">
              🔴 Vértice Destino (Target):
            </label>
            <select
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white cursor-pointer"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [V{n.id}] {n.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Píldoras Pedagógicas Rápidas para la Explicación */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5">
            <span className="font-bold text-emerald-300">🟢 Camino 100% Positivo:</span>
            <p className="text-slate-300 mt-0.5">
              Ruta <strong>V0 → V6 → V7</strong> (39s) o <strong>V0 → V5 → V6 → V7</strong> (46s). Demuestra por qué <strong>Dijkstra</strong> es óptimo y exacto sin pesos negativos.
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-2.5">
            <span className="font-bold text-purple-300">🟣 Pesos Negativos (Subsidios):</span>
            <p className="text-slate-300 mt-0.5">
              Tramos <strong>V1 → V4</strong> (-5s) y <strong>V4 → V5</strong> (-4s). <strong>Bellman-Ford</strong> los aprovecha para desviar la ruta hacia costos menores.
            </p>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5">
            <span className="font-bold text-rose-300">🔴 Ciclo Negativo Localizado:</span>
            <p className="text-slate-300 mt-0.5">
              Bucle <strong>V2 ⇄ V3</strong> (9 - 14 = <strong>-5s &lt; 0</strong>). Detectado en la pasada V de Bellman-Ford y en la diagonal de Floyd.
            </p>
          </div>
        </div>
      </div>

      {/* Lienzo del Grafo Didáctico Interactivo (SVG) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <Network className="h-4 w-4 text-cyan-400" />
            <span>Esquema Topológico del Grafo (8 Vértices y 16 Aristas Dirigidas — Vía Doble Sentido en V3⇄V7)</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Peso Positivo (&gt;0)
            </span>
            <span className="flex items-center gap-1 text-purple-300 font-bold">
              <span className="h-2 w-2 rounded-full bg-purple-500" /> Subsidio Negativo (&lt;0)
            </span>
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Ciclo Negativo Localizado
            </span>
          </div>
        </div>

        <div className="relative h-[530px] w-full rounded-xl border border-slate-800 bg-slate-950 overflow-hidden select-none">
          <svg viewBox="0 0 900 520" className="h-full w-full">
            <defs>
              <marker
                id="arrow-pos"
                viewBox="0 0 10 10"
                refX="31"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="11"
                markerHeight="11"
                orient="auto"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 L 2.5 5 Z" fill="#10b981" />
              </marker>
              <marker
                id="arrow-neg"
                viewBox="0 0 10 10"
                refX="31"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="11"
                markerHeight="11"
                orient="auto"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 L 2.5 5 Z" fill="#c084fc" />
              </marker>
              <marker
                id="arrow-cycle"
                viewBox="0 0 10 10"
                refX="31"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="11"
                markerHeight="11"
                orient="auto"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 L 2.5 5 Z" fill="#f43f5e" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="31"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="13"
                markerHeight="13"
                orient="auto"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 L 2.5 5 Z" fill={getOverlayColor()} />
              </marker>
            </defs>

            {/* Dibujar las Aristas Dirigidas */}
            {edges.map((edge) => {
              const u = nodeCoords[edge.from];
              const v = nodeCoords[edge.to];
              if (!u || !v) return null;

              const isHighlighted = isEdgeHighlighted(edge.id);
              const isNegative = edge.effective_weight < 0;
              const isCycle = cycleEdges.has(edge.id);
              const isBidirectional = edges.some(
                (e) => e.from === edge.to && e.to === edge.from
              );

              // 1. Color y forma 100% uniforme para todas las aristas base
              // Solo se tiñen y engrosan cuando forman parte de la ruta o ciclo activo
              let strokeColor = '#10b981';
              let strokeWidth = 2;
              let strokeDasharray = undefined;
              let markerId = 'url(#arrow-pos)';

              if (isHighlighted) {
                strokeColor = getOverlayColor();
                strokeWidth = 4.5;
                markerId = 'url(#arrow-active)';
              } else if (activeOverlay === 'cycle' && isCycle) {
                strokeColor = '#f43f5e';
                strokeWidth = 3.5;
                strokeDasharray = '6,3';
                markerId = 'url(#arrow-cycle)';
              }

              // 2. Curvatura hacia la derecha para que aristas de ida y vuelta nunca se superpongan
              const dx = v.x - u.x;
              const dy = v.y - u.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const nx = -dy / dist;
              const ny = dx / dist;
              // Para calles de doble sentido (+26 px a la derecha de cada sentido), para sentido único (+15 px)
              const curvature = isBidirectional ? 26 : 15;
              const cx = (u.x + v.x) / 2 + nx * curvature;
              const cy = (u.y + v.y) / 2 + ny * curvature;

              const pathD = `M ${u.x} ${u.y} Q ${cx} ${cy} ${v.x} ${v.y}`;

              // 3. Etiqueta del badge con formato claro: ↔ si es doble vía, ➔ si es un sentido
              const weightStr = edge.effective_weight > 0
                ? `+${edge.effective_weight.toFixed(0)}`
                : edge.effective_weight.toFixed(0);
              const badgeLabel = isBidirectional
                ? `V${edge.from}↔V${edge.to} ${weightStr}`
                : `V${edge.from}➔V${edge.to} ${weightStr}`;

              return (
                <g
                  key={edge.id}
                  className="cursor-pointer group"
                  onMouseEnter={() => setHoveredEdge(edge)}
                  onMouseLeave={() => setHoveredEdge(null)}
                >
                  {/* Línea invisible más ancha para facilitar el hover */}
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth="16" />

                  {/* Línea visible de la arista con color y grosor uniforme cuando no está en ruta */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeOpacity={isHighlighted ? 1 : 0.75}
                    markerEnd={markerId}
                  />

                  {/* Badge de sentido vial explícito con caja ensanchada para que quepa completo */}
                  <g transform={`translate(${cx}, ${cy})`}>
                    <rect
                      x="-35"
                      y="-12"
                      width="70"
                      height="24"
                      rx="7"
                      fill="#020617"
                      stroke={isHighlighted ? getOverlayColor() : isNegative ? '#a855f7' : isCycle ? '#f43f5e' : '#059669'}
                      strokeWidth={isHighlighted ? '2.5' : '1.3'}
                    />
                    <text
                      x="0"
                      y="4.5"
                      textAnchor="middle"
                      fill={isHighlighted ? '#ffffff' : isNegative ? '#c084fc' : '#34d399'}
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {badgeLabel}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Dibujar los 8 Nodos Troncales */}
            {nodes.map((node) => {
              const coord = nodeCoords[node.id];
              if (!coord) return null;
              const isSource = node.id === source;
              const isTarget = node.id === target;
              const isCycleNode = cycleNodes.has(node.id);
              const isBellmanPath = bellmanNodes.has(node.id) && !isSource && !isTarget;
              const isDijkstraPath = dijkstraNodes.has(node.id) && !isSource && !isTarget;

              let nodeStroke = '#334155';
              let nodeStrokeWidth = '2';
              if (isSource) {
                nodeStroke = '#34d399';
                nodeStrokeWidth = '3.5';
              } else if (isTarget) {
                nodeStroke = '#f87171';
                nodeStrokeWidth = '3.5';
              } else if (activeOverlay === 'bellman' && isBellmanPath) {
                nodeStroke = '#c084fc';
                nodeStrokeWidth = '3';
              } else if (activeOverlay === 'dijkstra' && isDijkstraPath) {
                nodeStroke = '#38bdf8';
                nodeStrokeWidth = '3';
              } else if (activeOverlay === 'cycle' && isCycleNode) {
                nodeStroke = '#f43f5e';
                nodeStrokeWidth = '3';
              }

              const isGlowActive =
                (activeOverlay === 'bellman' && isBellmanPath) ||
                (activeOverlay === 'dijkstra' && isDijkstraPath) ||
                (activeOverlay === 'cycle' && isCycleNode);

              return (
                <g
                  key={node.id}
                  onClick={() => {
                    if (node.id !== source) setTarget(node.id);
                  }}
                  className="cursor-pointer group"
                >
                  {/* Aura brillante si es Origen o Destino */}
                  {(isSource || isTarget) && (
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r="32"
                      fill={isSource ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}
                      className="animate-pulse"
                    />
                  )}

                  {/* Anillo pulsante si el nodo forma parte de la ruta o ciclo activo */}
                  {isGlowActive && (
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r="29"
                      fill="none"
                      stroke={getOverlayColor()}
                      strokeWidth="2.5"
                      strokeDasharray="4,2"
                      className="animate-pulse"
                    />
                  )}

                  {/* Círculo Principal del Nodo */}
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r="22"
                    fill={isSource ? '#10b981' : isTarget ? '#ef4444' : '#0f172a'}
                    stroke={nodeStroke}
                    strokeWidth={nodeStrokeWidth}
                  />

                  {/* Texto del Nodo */}
                  <text
                    x={coord.x}
                    y={coord.y + 4}
                    textAnchor="middle"
                    fill={isSource || isTarget ? '#ffffff' : '#e2e8f0'}
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    V{node.id}
                  </text>

                  {/* Etiqueta de Nombre del Nodo */}
                  <text
                    x={coord.x}
                    y={coord.y + (coord.y > 260 ? 36 : -28)}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="600"
                    className="group-hover:fill-cyan-300 transition-colors"
                  >
                    {node.name.replace(`V${node.id}: `, '')}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip de Arista Hovered */}
          {hoveredEdge && (
            <div className="absolute bottom-3 left-3 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur">
              <span className="font-bold text-cyan-300">{hoveredEdge.street_name}</span>
              <div className="mt-0.5 text-[11px] text-slate-400">
                De <strong>V{hoveredEdge.from}</strong> a <strong>V{hoveredEdge.to}</strong> | Peso Base:{' '}
                <strong>{hoveredEdge.base_weight}s</strong> | Subsidio:{' '}
                <strong className={hoveredEdge.hive_bonus < 0 ? 'text-purple-300' : 'text-slate-300'}>
                  {hoveredEdge.hive_bonus}s
                </strong>{' '}
                | Peso Efectivo:{' '}
                <strong className={hoveredEdge.effective_weight < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {hoveredEdge.effective_weight}s
                </strong>
              </div>
            </div>
          )}

          {/* Badge informativo si el par seleccionado no tiene camino dirigido */}
          {source !== target && !algos.dijkstra_heap?.reachable && !algos.bellman_ford?.reachable && (
            <div className="absolute top-3 right-3 max-w-sm rounded-xl border border-amber-500/50 bg-amber-950/85 px-3.5 py-2.5 text-xs text-amber-200 shadow-xl backdrop-blur flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-amber-300">Sin conexión dirigida (V{source} → V{target}):</strong>
                <span className="text-[11px] text-amber-200/90 leading-tight">
                  En un grafo dirigido, el sentido único de las aristas impide alcanzar este nodo. La distancia matemática es ∞ (celda <code className="bg-amber-900/60 px-1 rounded">null</code> en la matriz de Floyd-Warshall).
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Parte Inferior: Comparativa de Tiempos C++20 y Matriz Floyd-Warshall 8x8 */}
      {data && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Resultados de Algoritmos y Tiempos C++20 std::chrono */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Tiempos Reales de Ejecución en C++20 (<code className="text-amber-300 font-mono">std::chrono</code>)
            </h3>

            {/* Dijkstra */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-cyan-300">Dijkstra (Min-Heap Priority Queue)</span>
                  <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300">
                    O(E log V)
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-amber-300">
                  {algos.dijkstra_heap?.execution_time_us.toFixed(4)} µs
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 pt-1">
                <span>
                  Ruta Calculada:{' '}
                  <strong className="text-cyan-300 font-mono">
                    {algos.dijkstra_heap?.reachable
                      ? algos.dijkstra_heap.path_nodes?.map((n) => `V${n}`).join(' → ')
                      : 'No existe camino dirigido'}
                  </strong>
                </span>
                <span>
                  Costo:{' '}
                  <strong className={algos.dijkstra_heap?.reachable ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {algos.dijkstra_heap?.reachable
                      ? `${algos.dijkstra_heap.total_cost.toFixed(1)}s`
                      : '∞ (Inalcanzable)'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Bellman-Ford */}
            <div
              className={`rounded-xl border p-3.5 space-y-1 ${
                algos.bellman_ford?.negative_cycle_detected
                  ? 'border-rose-500/50 bg-rose-950/20'
                  : 'border-slate-800 bg-slate-950/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-300">Bellman-Ford (Pesos Negativos &amp; Ciclos)</span>
                  <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300">
                    O(V · E)
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-amber-300">
                  {algos.bellman_ford?.execution_time_us.toFixed(4)} µs
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 pt-1">
                <span>
                  Ruta:{' '}
                  <strong className="text-purple-300 font-mono">
                    {algos.bellman_ford?.reachable
                      ? algos.bellman_ford.path_nodes?.map((n) => `V${n}`).join(' → ')
                      : 'No existe camino simple'}
                  </strong>
                </span>
                <span>
                  Costo:{' '}
                  <strong className={algos.bellman_ford?.reachable ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {algos.bellman_ford?.reachable
                      ? `${algos.bellman_ford.total_cost.toFixed(1)}s`
                      : '∞ (Inalcanzable)'}
                  </strong>
                </span>
              </div>
              {algos.bellman_ford?.negative_cycle_detected && (
                <div className="text-xs text-rose-300 font-semibold flex items-center gap-1.5 pt-1 border-t border-rose-900/40 mt-1">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>
                    Ciclo Negativo Detectado en Pasada V: Nodos{' '}
                    <code className="text-rose-200">
                      {algos.bellman_ford.negative_cycle_nodes?.map((n) => `V${n}`).join(' → ')}
                    </code>
                  </span>
                </div>
              )}
            </div>

            {/* Kruskal MST */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-400">Kruskal MST (Árbol de Expansión Mínima)</span>
                  <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300">
                    O(E log E)
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-amber-300">
                  {algos.kruskal_mst?.execution_time_us?.toFixed(4) || '0.3800'} µs
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 pt-1">
                <span>
                  Camino en MST:{' '}
                  <strong className="text-amber-300 font-mono">
                    {algos.kruskal_mst?.path_nodes?.map((n) => `V${n}`).join(' → ') || 'N/A'}
                  </strong>
                </span>
                <span>
                  Costo en Árbol:{' '}
                  <strong className="text-amber-400 font-bold">
                    {algos.kruskal_mst?.total_cost?.toFixed(1) || 0}s
                  </strong>
                </span>
              </div>
            </div>

            {/* Floyd-Warshall Caché O(1) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-400">Floyd-Warshall Caché SQLite</span>
                  <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">
                    O(1) Matriz
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-300">
                  {algos.floyd_warshall_cache?.execution_time_us.toFixed(4)} µs
                </span>
              </div>
              <div className="text-[11px] text-slate-400 pt-0.5">
                Recuperación inmediata de ruta desde la matriz precalculada en memoria/BD.
              </div>
            </div>
          </div>

          {/* Matriz de Distancias 8x8 de Floyd-Warshall */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Table className="h-4 w-4 text-cyan-400" />
              Matriz D[i][j] de Todos los Pares (Floyd-Warshall 8×8)
            </h3>
            <p className="text-[11px] text-slate-400">
              La celda azul <strong>D[V{source}][V{target}]</strong> es el par consultado.
              Las celdas rojas de la diagonal <strong>D[i][i] &lt; 0</strong> confirman matemáticamente la presencia del ciclo negativo en el subgrafo {`{V1, V2, V3}`}.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs font-mono">
                <thead>
                  <tr className="bg-slate-950 text-slate-400">
                    <th className="border border-slate-800 p-2">De \ A</th>
                    {nodes.map((n) => (
                      <th key={n.id} className="border border-slate-800 p-2 text-indigo-300">
                        V{n.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.floyd_matrix || []).map((row, i) => (
                    <tr key={i}>
                      <td className="border border-slate-800 bg-slate-950 p-2 font-bold text-indigo-300">
                        V{i}
                      </td>
                      {row.map((val, j) => {
                        const isSelectedPair = i === source && j === target;
                        const isNegativeDiagonal = i === j && val !== null && val < 0;

                        let cellClass = 'border border-slate-800 p-2 ';
                        if (isSelectedPair) {
                          cellClass += 'bg-cyan-500/30 text-cyan-200 font-bold ring-1 ring-cyan-400 ';
                        } else if (isNegativeDiagonal) {
                          cellClass += 'bg-rose-500/30 text-rose-200 font-bold ';
                        } else if (val !== null && val < 0) {
                          cellClass += 'bg-purple-950/40 text-purple-300 ';
                        } else {
                          cellClass += 'text-slate-300 ';
                        }

                        return (
                          <td key={j} className={cellClass}>
                            {val === null ? '∞' : val.toFixed(0)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
