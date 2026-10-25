import React, { useState } from 'react';
import {
  Network,
  Users,
  Sparkles,
  AlertOctagon,
  Play,
  ArrowRight,
  TrendingDown,
  ShieldAlert
} from 'lucide-react';

export default function HiveMindPanel({
  nodes,
  source,
  target,
  onRunHiveMind,
  hiveResult,
  loading
}) {
  const [concurrentVehicles, setConcurrentVehicles] = useState(85);
  const [kPaths, setKPaths] = useState(3);

  const nodeMap = new Map((nodes || []).map((n) => [n.id, n.name]));

  return (
    <div className="space-y-4">
      {/* Control Card */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30 p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
              <Network className="h-4 w-4 text-purple-400" />
              Mente Colmena Multi-Usuario (Algoritmo de Yen + Pesos Negativos Bellman-Ford)
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Cuando una flota de usuarios pide la misma ruta a la vez, la ruta óptima única colapsaría (&gt;100% capacidad).
              La <strong>Mente Colmena</strong> calcula las <strong>K mejores rutas sin bucles (Yen)</strong>, reparte los vehículos según el aforo máximo de cada calle, e inyecta{' '}
              <strong className="text-purple-300">Incentivos de Peso Negativo (&lt; 0)</strong> en vías alternas para que{' '}
              <strong className="text-cyan-300">Bellman-Ford</strong> desvíe el flujo automáticamente.
            </p>
          </div>
        </div>

        {/* Sliders & Triggers */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-cyan-400" />
                Usuarios / Vehículos Concurrentes:
              </span>
              <span className="text-cyan-300 font-bold">{concurrentVehicles} veh.</span>
            </div>
            <input
              type="range"
              min="20"
              max="180"
              step="5"
              value={concurrentVehicles}
              onChange={(e) => setConcurrentVehicles(Number(e.target.value))}
              className="mt-2 w-full accent-purple-500 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>20 (Baja demanda)</span>
              <span>100 (Hora punta)</span>
              <span>180 (Saturación extrema)</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex justify-between text-xs font-semibold text-slate-200">
              <span>K Rutas Alternativas (Algoritmo de Yen):</span>
              <span className="text-purple-300 font-bold">K = {kPaths} rutas</span>
            </div>
            <input
              type="range"
              min="2"
              max="4"
              step="1"
              value={kPaths}
              onChange={(e) => setKPaths(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-500 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>K=2</span>
              <span>K=3 (Óptimo)</span>
              <span>K=4</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                onRunHiveMind({
                  source,
                  target,
                  kPaths,
                  concurrentVehicles,
                  injectNegativeCycle: false
                })
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/25 hover:from-purple-500 hover:to-indigo-500 transition cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Ejecutar Mente Colmena (Yen + Bonos &lt; 0)
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                onRunHiveMind({
                  source,
                  target,
                  kPaths,
                  concurrentVehicles,
                  injectNegativeCycle: true
                })
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/50 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 transition cursor-pointer"
            >
              <AlertOctagon className="h-4 w-4 text-rose-400" />
              Inyectar Ciclo Negativo (Prueba Bellman-Ford)
            </button>
          </div>
        </div>
      </div>

      {/* Resultados de la Mente Colmena */}
      {hiveResult && (
        <div className="space-y-4">
          {/* Alerta si hay Ciclo Negativo Detectado */}
          {hiveResult.bellman_ford_hive?.negative_cycle_detected ? (
            <div className="rounded-2xl border border-rose-500 bg-rose-950/40 p-4 text-rose-200 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
                <ShieldAlert className="h-5 w-5 text-rose-400 animate-bounce" />
                ¡CICLO DE PESO NEGATIVO DETECTADO EN LA V-ÉSIMA ITERACIÓN DE BELLMAN-FORD!
              </div>
              <p className="mt-1 text-xs text-rose-200/90">
                El incentivo bidireccional excesivo provocó un bucle donde el costo disminuye infinitamente en cada vuelta.
                Bellman-Ford abortó el bucle infinito en{' '}
                <strong>{hiveResult.bellman_ford_hive.execution_time_us.toFixed(3)} µs</strong> e identificó exactamente el ciclo:
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(hiveResult.bellman_ford_hive.negative_cycle_nodes || []).map((nid, i) => (
                  <React.Fragment key={i}>
                    <span className="rounded-lg bg-rose-500/30 border border-rose-400 px-2.5 py-1 text-xs font-bold text-white">
                      V{nid}: {nodeMap.get(nid)}
                    </span>
                    {i < hiveResult.bellman_ford_hive.negative_cycle_nodes.length - 1 && (
                      <span className="font-bold text-rose-400">↻</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <div className="text-xs font-bold uppercase text-emerald-300">
                ✅ Re-enrutamiento con Pesos Negativos Exitoso (Sin Ciclos Negativos)
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Mientras <strong>Dijkstra</strong> mantiene a los vehículos en la ruta primaria{' '}
                <code className="text-amber-300">
                  [{hiveResult.dijkstra_baseline?.path_nodes?.map((n) => `V${n}`).join(' → ')}]
                </code>
                , <strong>Bellman-Ford O(V·E)</strong> aprovecha las aristas con peso negativo (<code className="text-purple-300">-4.5s</code>) y desvía automáticamente el siguiente grupo por{' '}
                <code className="text-cyan-300">
                  [{hiveResult.bellman_ford_hive?.path_nodes?.map((n) => `V${n}`).join(' → ')}]
                </code>{' '}
                en <strong>{hiveResult.bellman_ford_hive?.execution_time_us?.toFixed(3)} µs</strong>.
              </p>
            </div>
          )}

          {/* K Rutas de Yen y Distribución de Flota */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(hiveResult.k_routes || []).map((kr, idx) => {
              const badgeColors = [
                'border-sky-500/40 bg-sky-500/10 text-sky-300',
                'border-purple-500/40 bg-purple-500/10 text-purple-300',
                'border-pink-500/40 bg-pink-500/10 text-pink-300'
              ];
              return (
                <div
                  key={kr.rank}
                  className={`rounded-2xl border p-3.5 ${badgeColors[idx % badgeColors.length]}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase">
                      Ruta Colmena #{kr.rank}
                    </span>
                    <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
                      🚗 {kr.assigned_vehicles} vehículos asignados
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] opacity-85">{kr.status_label}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-200">
                    <span>Costo Base: <strong>{kr.base_cost.toFixed(1)}s</strong></span>
                    <span>•</span>
                    <span>Costo con Bono: <strong>{kr.effective_cost.toFixed(1)}s</strong></span>
                    <span>•</span>
                    <span>Holgura cuello botella: <strong>{kr.bottleneck_capacity} veh</strong></span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-300">
                    Nodos:{' '}
                    <span className="font-mono text-white">
                      {kr.path_nodes.map((nid) => `V${nid}`).join(' → ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabla de Incentivos de Peso Negativo Inyectados */}
          {hiveResult.incentives?.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-purple-300 mb-2.5">
                <TrendingDown className="h-4 w-4 text-purple-400" />
                Aristas con Peso Negativo (&lt; 0) Generadas por la Mente Colmena
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-1.5">Arista / Vía</th>
                      <th className="py-1.5">Dirección</th>
                      <th className="py-1.5">Peso Original</th>
                      <th className="py-1.5">Bono Colmena</th>
                      <th className="py-1.5">Peso Final (Bellman-Ford)</th>
                      <th className="py-1.5">Justificación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {hiveResult.incentives.map((inc, i) => (
                      <tr key={i} className="text-slate-200">
                        <td className="py-2 font-semibold text-white">{inc.street_name}</td>
                        <td className="py-2 font-mono text-xs text-indigo-300">
                          V{inc.from} → V{inc.to}
                        </td>
                        <td className="py-2 font-mono">{inc.original_weight.toFixed(1)} s</td>
                        <td className="py-2 font-mono text-purple-300 font-bold">
                          {inc.negative_bonus.toFixed(1)} s
                        </td>
                        <td className="py-2 font-mono">
                          <span className="rounded bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 font-bold text-purple-200">
                            {inc.final_weight.toFixed(1)} s (&lt; 0)
                          </span>
                        </td>
                        <td className="py-2 text-slate-400">{inc.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
