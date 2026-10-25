import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin,
  Cpu,
  Car,
  Footprints,
  Zap,
  Network,
  Globe,
  Layers,
  Activity,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export default function Navbar({
  compareAllAlgorithms,
  setCompareAllAlgorithms,
  transportMode,
  setTransportMode,
  mapViewMode,
  setMapViewMode,
  googleApiStatus,
  floydCacheValid
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      path: '/ejercicio07',
      label: 'Ejercicio 07: Red de Transporte (8 Vértices)',
      badge: 'Dijkstra • Bellman-Ford • Floyd-Warshall',
      icon: Layers
    },
    {
      path: '/ejercicio08',
      label: 'Ejercicio 08: Selector Automático & Escalabilidad',
      badge: 'V Variable • std::chrono C++20',
      icon: Activity
    },
    {
      path: '/ejercicio09',
      label: 'Ejercicio 09: Google Maps + Mente Colmena',
      badge: 'Arequipa O(1) + Yen K-Rutas + Bellman-Ford <0',
      icon: MapPin
    }
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
      {/* Top Bar */}
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/20">
            <Cpu className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                UNSA ADA Lab 05 — Smart Traffic &amp; Hive Mind Arequipa
              </h1>
              <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 md:inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                C++20 std::chrono + SQLite Nativo
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Floyd-Warshall Caché O(1) • Dijkstra Min-Heap • Bellman-Ford (Pesos Negativos) • Kruskal MST • Algoritmo de Yen
            </p>
          </div>
        </div>

        {/* Global Switches */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Master Toggle: Ejecutar todos los algoritmos a la vez */}
          <button
            type="button"
            onClick={() => setCompareAllAlgorithms(!compareAllAlgorithms)}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
              compareAllAlgorithms
                ? 'border-amber-400/60 bg-gradient-to-r from-amber-500/25 to-orange-500/20 text-amber-200 shadow-lg shadow-amber-500/15'
                : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:border-slate-600'
            }`}
            title="Activa la ejecución simultánea de los 7 algoritmos en C++20 para comparar tiempos reales con std::chrono"
          >
            <Zap className={`h-4 w-4 ${compareAllAlgorithms ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <div className="text-left">
              <div className="leading-none">
                {compareAllAlgorithms
                  ? '⚡ MODO BENCHMARK TOTAL: 7 Algoritmos a la vez'
                  : '🧠 MODO INTELIGENTE: Selección Automática'}
              </div>
              <div className="mt-0.5 text-[10px] opacity-80">
                {compareAllAlgorithms
                  ? 'Comparando Floyd O(1), Floyd O(V³), Dijkstra, Bellman-Ford, Kruskal y Yen'
                  : floydCacheValid
                  ? 'Usando Caché SQLite O(1) (Clic para comparar todos)'
                  : 'Conmutación dinámica activa (Clic para comparar todos)'}
              </div>
            </div>
          </button>

          {/* Transport Mode Switch: Car vs Pedestrian */}
          <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setTransportMode('car')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                transportMode === 'car'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Car className="h-3.5 w-3.5" />
              <span>Automóvil (Dirigido)</span>
            </button>
            <button
              type="button"
              onClick={() => setTransportMode('pedestrian')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                transportMode === 'pedestrian'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Footprints className="h-3.5 w-3.5" />
              <span>A Pie (No Dirigido)</span>
            </button>
          </div>

          {/* Map View Mode Switch */}
          <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setMapViewMode('google')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                mapViewMode === 'google'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Google Maps Real</span>
            </button>
            <button
              type="button"
              onClick={() => setMapViewMode('schema')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                mapViewMode === 'schema'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              <span>Grafo Didáctico</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="border-t border-slate-800/80 bg-slate-900/50">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between overflow-x-auto px-4">
          <div className="flex space-x-2 py-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                location.pathname === tab.path ||
                (tab.path === '/ejercicio09' && (location.pathname === '/' || location.pathname === '/ejercicio09'));
              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => navigate(tab.path)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 text-white border border-indigo-500/50 shadow-md shadow-indigo-500/10'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      isActive ? 'bg-indigo-500/40 text-cyan-200 border border-indigo-400/30' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {googleApiStatus && (
            <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>
                Google Maps JS &amp; Places API v1: <strong className="text-emerald-300">ACTIVO ({googleApiStatus.key_preview})</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
