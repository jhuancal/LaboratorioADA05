# Sistema Inteligente de Rutas, Tráfico y Mente Colmena — Provincia de Arequipa
**Universidad Nacional de San Agustín de Arequipa (UNSA)**  
**Facultad de Ingeniería de Producción y Servicios — Escuela Profesional de Ingeniería de Sistemas**  
**Curso:** Análisis y Diseño de Algoritmos (ADA) — **Laboratorio 05 (Ejercicios 7, 8 y 9)**  
**Autor / Maintainer:** `jhuancal` (`jhuancal@unsa.edu.pe`)

---

## ⚡ Inicio Rápido en 1 Clic (Para Integrantes del Equipo)

Para ejecutar toda la plataforma (Motor C++20 + Backend Node.js + Base de Datos SQLite + Frontend React):

1. **Doble clic en `start_app.bat`**  
   - Si es la primera vez, el script instalará automáticamente las dependencias de `backend/` y `frontend/`.
   - Verificará / compilará el motor nativo C++20 en `cpp_engine/bin/engine.exe`.
   - Levantará el **Backend en el puerto 3001** (`http://localhost:3001/api/health`).
   - Levantará el **Frontend en el puerto 5173** y abrirá automáticamente tu navegador en `http://localhost:5173`.

---

## 🔄 Sincronización Colaborativa de la Base de Datos (Nodos y Aristas del Ejercicio 09)

La aplicación almacena el grafo real de Arequipa (152 nodos, 278 aristas, capacidades y flujos) en una base de datos **SQLite local persistida** ubicada en:
```text
backend/data/arequipa_traffic.db
```

### ¿Verán mis compañeros los mismos nodos y aristas que yo coloqué?
**SÍ.** La base de datos `backend/data/arequipa_traffic.db` está versionada en este repositorio con todos los lugares de Arequipa, calles y esquinas personalizadas. Al clonar el repositorio, tendrán exactamente la misma red vial.

### ¿Cómo compartir modificaciones de nodos y aristas entre compañeros vía Git?
Cuando tú o tus compañeros agreguen nuevos nodos o modifiquen aristas en la interfaz:
1. **Cerrar o detener la aplicación** (para que SQLite guarde y cierre las transacciones temporales).
2. **Subir los cambios a GitHub:**
   ```bash
   git add backend/data/arequipa_traffic.db
   git commit -m "Actualizados nuevos nodos y aristas en Arequipa"
   git push origin main
   ```
3. **El resto del equipo para recibir los cambios:**
   ```bash
   git pull origin main
   ```
   Al reiniciar `start_app.bat` o recargar la página web, visualizarán inmediatamente los nodos modificados.

> 💡 **Nota de Buenas Prácticas:** Como `arequipa_traffic.db` es un archivo binario de SQLite, se recomienda que un solo compañero a la vez suba modificaciones a la red vial para evitar conflictos binarios (`merge conflicts`) en Git. También se incluye un respaldo legible en texto en `backend/data/user_custom_nodes_edges.json`.

---

## 🏗️ Arquitectura Limpia y Modular (3 Capas)

El proyecto está organizado en **3 capas desacopladas** para garantizar máxima claridad académica y medición real de tiempos en **C++20 (`std::chrono::high_resolution_clock`)**:

```text
aplicacion_trafico_ejercicio7_8_9/
├── .env                                 # Clave de Google Maps JavaScript API & Places API (New) v1
├── start_app.bat                        # Script de inicio automático en 1 clic
├── cpp_engine/                          # 1. MOTOR ALGORÍTMICO NATIVO EN C++20
│   ├── include/
│   │   ├── graph_types.hpp              # Estructuras Node, Edge, AlgorithmMetrics y función de retardo BPR
│   │   ├── algorithms.hpp               # Implementación de los 7 algoritmos con std::chrono
│   │   └── exercises_7_8.hpp            # Suites académicas dedicadas para los Ejercicios 7 y 8
│   ├── src/
│   │   └── cli_engine.cpp               # Punto de entrada CLI de alto rendimiento
│   └── bin/
│       └── engine.exe                   # Binario compilado nativo (g++ -O3 -std=c++20)
├── backend/                             # 2. BACKEND CLEAN ARCHITECTURE (Node.js v22 + SQLite Nativo)
│   ├── data/
│   │   ├── arequipa_traffic.db          # Base de datos SQLite (nodes, edges, floyd_cache, places_cache)
│   │   └── user_custom_nodes_edges.json # Respaldo JSON de nodos y aristas personalizados
│   └── src/
│       ├── config/env.js                # Configuración centralizada
│       ├── database/seedData.js         # Lugares y aristas base de Arequipa
│       ├── database/sqliteConnection.js # Conexión nativa con node:sqlite (DatabaseSync)
│       ├── repositories/graphRepository.js # Consultas O(1) a floyd_cache, cierres de vía y tráfico
│       ├── services/cppEngineService.js # Puente hacia cpp_engine/bin/engine.exe
│       ├── services/googleMapsService.js# Integración en vivo con Google Places API (New) v1
│       ├── controllers/trafficController.js
│       ├── routes/apiRoutes.js
│       └── server.js
└── frontend/                            # 3. FRONTEND INTERACTIVO (React 19 + Vite + Tailwind CSS + Google Maps)
    └── src/
        ├── services/api.js
        ├── components/
        │   ├── Navbar.jsx               # Switch Maestro "Ejecutar TODOS los algoritmos a la vez" + Modos
        │   ├── ArequipaMapView.jsx      # Mapa Google Maps JS API Real + Vista Esquema de Grafo SVG
        │   ├── TelemetryPanel.jsx       # Gráficos y tabla comparativa std::chrono (µs / ns)
        │   ├── HiveMindPanel.jsx        # Mente Colmena Multi-Usuario (Algoritmo de Yen + Bellman-Ford < 0)
        │   ├── Exercise7Tab.jsx         # Laboratorio Ejercicio 7 (8 vértices, matrices y ciclos negativos)
        │   ├── Exercise8Tab.jsx         # Laboratorio Ejercicio 8 (Selector inteligente y curvas V variable)
        │   └── Exercise9View.jsx        # Vista principal del problema real
        └── App.jsx
```

---

## 🔬 Algoritmos Implementados y Casos de Uso

1. **Pre-cálculo Matricial con Floyd-Warshall en SQLite ($\Theta(V^3) \to \text{Consulta } \mathcal{O}(1)$):**
   - El backend ejecuta Floyd-Warshall y guarda los pares en `floyd_cache` de SQLite. Las consultas estándar se resuelven en ~12 nanosegundos sin volver a recorrer el grafo.
2. **Interferencias y Cierres de Vía en Tiempo Real ($\to$ Conmutación a Dijkstra $\mathcal{O}(E \log V)$):**
   - Al cerrar una calle en el mapa, el sistema invalida la caché matricial y conmuta inmediatamente a Dijkstra con Min-Heap para recalcular solo la ruta afectada.
3. **Mente Colmena Multi-Usuario (Yen $K$-Caminos + Bellman-Ford con Pesos Negativos):**
   - Distribuye flotas concurrentes en $K$ rutas alternativas libres de bucles. Inyecta incentivos viales negativos (`hive_bonus < 0`, $-4.5\text{ s}$) en accesos secundarios para que Bellman-Ford canalice el flujo y evite el colapso de las avenidas principales.
4. **Selector Inteligente de Algoritmos (Ejercicio 8):**
   - Árbol de decisión dinámico que analiza la topología y régimen de pesos del grafo para elegir automáticamente entre Dijkstra, Bellman-Ford y Floyd-Warshall.
