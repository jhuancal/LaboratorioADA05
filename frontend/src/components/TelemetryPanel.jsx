import React from 'react';
import {
  Clock,
  Cpu,
  Database,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Eye,
  GitBranch
} from 'lucide-react';

export default function TelemetryPanel({
  routeResponse,
  nodes,
  inspectedAlgoId,
  setInspectedAlgoId,
  showMstOverlay,
  setShowMstOverlay
}) {
  if (!routeResponse) return null;

  const nodeMap = new Map((nodes || []).map((n) => [n.id, n.name]));
  const primary = routeResponse.primary_result;
  const allAlgosObj = routeResponse.all_algorithms || {
    [primary.algorithm_id]: primary
  };
  const algoList = Object.values(allAlgosObj);

  const maxTimeUs = Math.max(
    0.001,
    ...algoList.map((a) => Number(a.execution_time_us || 0))
  );

  const activeMetrics =
    (inspectedAlgoId && allAlgosObj[inspectedAlgoId]) || primary;

  return (
    <div className="space-y-4">
      {/* Banner de Decisión del Selector Automático */}
      <div
        className={`rounded-2xl border p-4 shadow-lg ${
          routeResponse.has_negative_weights
            ? 'border-purple-500/40 bg-purple-950/30'
            : routeResponse.has_closed_edges
            ? 'border-amber-500/40 bg-amber-950/30'
            : 'border-emerald-500/40 bg-emerald-950/25'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
              <Cpu className="h-4 w-4 text-cyan-400" />
              Decisión Algorítmica Inteligente (C++20 std::chrono + SQLite)
            </div>
            <p className="text-sm font-semibold text-white">
              {routeResponse.smart_banner}
            </p>
            <p className="text-xs text-slate-300">
              Algoritmo Óptimo Seleccionado:{' '}
              <strong className="text-cyan-300">{primary.algorithm_name}</strong>{' '}
              ({primary.complexity_time}) — Tiempo C++20:{' '}
              <strong className="text-emerald-300">
                {primary.execution_time_us.toFixed(4)} µs ({Math.round(primary.execution_time_ns)} ns)
              </strong>
            </p>
          </div>

          {routeResponse.mst_backbone_edges && (
            <button
              type="button"
              onClick={() => setShowMstOverlay(!showMstOverlay)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                showMstOverlay
                  ? 'border-yellow-400 bg-yellow-500/20 text-yellow-200'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              {showMstOverlay ? 'Ocultar Red Troncal Kruskal MST' : 'Ver Red Troncal Kruskal MST en Mapa'}
            </button>
          )}
        </div>
      </div>

      {/* Detalle de la Ruta Actualmente Inspeccionada */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Ruta Visualizada en el Mapa
            </span>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              {activeMetrics.algorithm_name}
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
                {activeMetrics.complexity_time}
              </span>
            </h3>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="rounded-lg bg-slate-800/90 px-3 py-1.5">
              <span className="text-slate-400">Costo / Tiempo: </span>
              <strong className="text-cyan-300">
                {activeMetrics.reachable
                  ? `${activeMetrics.total_cost.toFixed(1)} s (${(activeMetrics.total_cost / 60).toFixed(1)} min)`
                  : 'Inalcanzable'}
              </strong>
            </div>
            <div className="rounded-lg bg-slate-800/90 px-3 py-1.5">
              <span className="text-slate-400">Distancia Física: </span>
              <strong className="text-emerald-300">
                {(activeMetrics.total_distance_m / 1000).toFixed(2)} km ({Math.round(activeMetrics.total_distance_m)} m)
              </strong>
            </div>
            <div className="rounded-lg bg-slate-800/90 px-3 py-1.5">
              <span className="text-slate-400">Tiempo C++20: </span>
              <strong className="text-amber-300">
                {activeMetrics.execution_time_us.toFixed(4)} µs
              </strong>
            </div>
          </div>
        </div>

        {/* Secuencia Paso a Paso de Nodos */}
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-400 mb-1.5">
            Secuencia de Nodos Recorridos ({activeMetrics.path_nodes?.length || 0} paradas):
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(activeMetrics.path_nodes || []).map((nid, idx) => (
              <React.Fragment key={`${nid}-${idx}`}>
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    idx === 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : idx === activeMetrics.path_nodes.length - 1
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  <strong>V{nid}:</strong> {nodeMap.get(nid) || `Nodo ${nid}`}
                </span>
                {idx < activeMetrics.path_nodes.length - 1 && (
                  <span className="text-slate-500 font-bold">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla & Gráfico Comparativo Multi-Algoritmo (cuando compareAllAlgorithms está activo o disponible) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Telemetría C++20 <code className="text-amber-300">std::chrono::high_resolution_clock</code>
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Haz clic en cualquier algoritmo para trazar y comparar su camino en el mapa
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3">Algoritmo</th>
                <th className="py-2 px-2">Complejidad</th>
                <th className="py-2 px-2">Tiempo (µs / ns)</th>
                <th className="py-2 px-2 w-44">Barra Comparativa</th>
                <th className="py-2 px-2">Operaciones</th>
                <th className="py-2 px-2">Relajaciones</th>
                <th className="py-2 px-2">Costo Ruta</th>
                <th className="py-2 pl-2 text-right">Ver en Mapa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {algoList.map((algo) => {
                const isSelectedPrimary =
                  algo.algorithm_id === routeResponse.selected_algorithm_id;
                const isInspected =
                  (inspectedAlgoId || routeResponse.selected_algorithm_id) ===
                  algo.algorithm_id;
                const widthPct = Math.max(
                  4,
                  Math.min(100, (algo.execution_time_us / maxTimeUs) * 100)
                );

                return (
                  <tr
                    key={algo.algorithm_id}
                    onClick={() => setInspectedAlgoId(algo.algorithm_id)}
                    className={`cursor-pointer transition ${
                      isInspected
                        ? 'bg-indigo-600/15 text-white'
                        : 'hover:bg-slate-800/50 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 pr-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{algo.algorithm_name}</span>
                        {isSelectedPrimary && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            ÓPTIMO ELEGIDO
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-indigo-300">
                      {algo.complexity_time}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-amber-300">
                      {algo.execution_time_us.toFixed(4)} µs{' '}
                      <span className="text-slate-500">
                        ({Math.round(algo.execution_time_ns)} ns)
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isSelectedPrimary
                              ? 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                              : 'bg-gradient-to-r from-indigo-500 to-amber-500'
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono">{algo.operations_count}</td>
                    <td className="py-2.5 px-2 font-mono">{algo.relaxations_count}</td>
                    <td className="py-2.5 px-2 font-semibold text-cyan-300">
                      {algo.reachable ? `${algo.total_cost.toFixed(1)} s` : 'N/A'}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedAlgoId(algo.algorithm_id);
                        }}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                          isInspected
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <Eye className="h-3 w-3" />
                        {isInspected ? 'Activo' : 'Trazar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
