#pragma once
/**
 * @file exercises_7_8.hpp
 * @brief Módulos especializados para el Ejercicio 7 (Red de Transporte de 8 Vértices)
 *        y Ejercicio 8 (Selector Inteligente de Algoritmos + Benchmark Escalable V variable)
 *        UNSA - Análisis y Diseño de Algoritmos - Laboratorio 05
 */

#include "algorithms.hpp"
#include <random>

namespace traffic {

/**
 * @brief Ejecuta el experimento completo del Ejercicio 7 sobre un grafo dirigido de 8 vértices
 *        representando los nodos troncales de Arequipa, con opción de pesos negativos y ciclo negativo.
 */
inline std::string run_exercise_7_json(int source, int target, const std::string& scenario) {
    // 8 vértices clásicos del corredor troncal de Arequipa
    std::vector<Node> nodes = {
        {0, "V0: Plaza de Armas", "Centro Histórico", "hub", -16.3989, -71.5369},
        {1, "V1: Puente Grau", "Cercado Norte", "bridge", -16.3928, -71.5388},
        {2, "V2: Mirador de Yanahuara", "Yanahuara", "landmark", -16.3874, -71.5417},
        {3, "V3: Mall Plaza Cayma (Av. Ejército)", "Cayma", "commercial", -16.3905, -71.5478},
        {4, "V4: Puente Chilina", "Alto Selva Alegre", "bridge", -16.3821, -71.5325},
        {5, "V5: UNSA Área Ingenierías", "Cercado Este", "university", -16.4040, -71.5245},
        {6, "V6: Hospital Honorio Delgado", "Av. Alcides Carrión", "hospital", -16.4125, -71.5315},
        {7, "V7: Terminal Terrestre Arequipa", "Hunter / JLBYR", "terminal", -16.4252, -71.5438}
    };

    // 16 aristas dirigidas con sentidos viales claros (incluye doble sentido donde corresponde)
    std::vector<Edge> edges = {
        {0, 0, 1, "Calle Santa Catalina -> Puente Grau", 850, 12.0, 80, 20, true, false, 0.0},
        {1, 0, 5, "Av. Independencia -> UNSA Ingenierías", 1450, 18.0, 120, 35, true, false, 0.0},
        {2, 0, 6, "Av. Goyeneche -> Hosp. Honorio Delgado", 1600, 22.0, 90, 25, true, false, 0.0},
        {3, 1, 2, "Av. Cortaderas -> Mirador Yanahuara", 920, 10.0, 60, 15, true, false, 0.0},
        {4, 1, 4, "Av. Bolognesi -> Puente Chilina", 1300, 14.0, 110, 20, true, false, 0.0},
        {5, 2, 3, "Av. Ejército -> Mall Plaza Cayma", 780, 9.0, 100, 30, true, false, 0.0},
        {6, 3, 2, "Retorno Cayma -> Mirador Yanahuara", 800, 10.0, 100, 25, true, false, -24.0},
        {7, 3, 7, "Vía Metropolitana Cayma -> Terminal", 3800, 34.0, 140, 40, true, false, 0.0},
        {8, 4, 5, "Av. Progreso -> UNSA Ingenierías", 2100, 16.0, 100, 20, true, false, 0.0},
        {9, 5, 6, "Av. Venezuela -> Hosp. Honorio Delgado", 1100, 11.0, 120, 30, true, false, 0.0},
        {10, 5, 0, "Calle San Agustín -> Plaza de Armas", 1400, 19.0, 70, 20, true, false, 0.0},
        {11, 6, 7, "Av. Andrés Avelino Cáceres -> Terminal", 1900, 17.0, 130, 30, true, false, 0.0},
        {12, 4, 2, "Conexión Chilina -> Yanahuara", 1250, 13.0, 90, 15, true, false, 0.0},
        {13, 6, 3, "Av. Parra / Variante -> Cayma", 3200, 28.0, 110, 25, true, false, 0.0},
        {14, 7, 0, "Av. Parra Expresa -> Centro Histórico", 3100, 26.0, 110, 25, true, false, 0.0},
        {15, 7, 3, "Variante Uchumayo Terminal -> Cayma", 3800, 34.0, 140, 40, true, false, 0.0}
    };

    // Ajustar pesos limpios (sin penalización cuadrática para que la matriz académica sea exacta y verificable a mano)
    for (auto& e : edges) {
        e.current_vehicles = 0; // Así effective_weight == base_time_sec + hive_bonus
    }

    // Grafo Unificado Académico para Ejercicio 7 (UN SOLO GRAFO INTEGRAL):
    // 1. Caminos 100% Positivos (demostración de Dijkstra óptimo):
    //    V0 -> V6 -> V7 (22s + 17s = 39.0s) y V0 -> V5 -> V6 -> V7 (18s + 11s + 17s = 46.0s)
    // 2. Tramos con Pesos Negativos (demostración de Bellman-Ford con subsidios):
    //    V1 -> V4 (14s base - 19s bono = -5.0s)
    //    V4 -> V5 (16s base - 20s bono = -4.0s)
    //    Ruta Bellman: V0 -> V1 -> V4 -> V5 -> V6 -> V7 (12 - 5 - 4 + 11 + 17 = 31.0s)
    // 3. Ciclo Negativo Localizado (demostración de detección de ciclo negativo en Bellman-Ford y Floyd):
    //    V2 -> V3 (9.0s) -> V2 (10s base - 24s bono = -14.0s) => Suma = 9 - 14 = -5.0s < 0!
    edges[4].hive_bonus = -19.0; // V1 -> V4: 14 - 19 = -5.0s
    edges[8].hive_bonus = -20.0; // V4 -> V5: 16 - 20 = -4.0s
    edges[6].hive_bonus = -24.0; // V3 -> V2: 10 - 24 = -14.0s (Ciclo negativo localizado V2<->V3)

    int N = static_cast<int>(nodes.size());
    source = std::clamp(source, 0, N - 1);
    target = std::clamp(target, 0, N - 1);

    auto dijkstra_res = run_dijkstra_heap(N, edges, source, target, "car", 500);
    auto bellman_res = run_bellman_ford(N, edges, source, target, "car", 500);
    auto floyd_res = run_floyd_warshall_full(N, edges, source, target, "car", 500);
    auto floyd_lookup = run_floyd_warshall_lookup(floyd_res, edges, source, target, 5000);
    auto kruskal_res = run_kruskal_mst(N, edges, source, target, "car", 500);

    std::ostringstream o;
    o << std::fixed << std::setprecision(4);
    o << "{";
    o << "\"scenario\":\"unified\",";
    o << "\"source\":" << source << ",";
    o << "\"target\":" << target << ",";
    o << "\"nodes\":[";
    for (size_t i = 0; i < nodes.size(); ++i) {
        if (i > 0) o << ",";
        o << "{\"id\":" << nodes[i].id << ",\"name\":\"" << json_escape(nodes[i].name)
          << "\",\"zone\":\"" << json_escape(nodes[i].zone)
          << "\",\"lat\":" << nodes[i].lat << ",\"lng\":" << nodes[i].lng << "}";
    }
    o << "],";
    o << "\"edges\":[";
    for (size_t i = 0; i < edges.size(); ++i) {
        if (i > 0) o << ",";
        double w = edges[i].effective_weight("car", true);
        o << "{\"id\":" << edges[i].id << ",\"from\":" << edges[i].from << ",\"to\":" << edges[i].to
          << ",\"street_name\":\"" << json_escape(edges[i].street_name) << "\""
          << ",\"base_weight\":" << edges[i].base_time_sec
          << ",\"hive_bonus\":" << edges[i].hive_bonus
          << ",\"effective_weight\":" << w << "}";
    }
    o << "],";
    o << "\"algorithms\":{";
    o << "\"dijkstra_heap\":" << metrics_to_json(dijkstra_res) << ",";
    o << "\"bellman_ford\":" << metrics_to_json(bellman_res) << ",";
    o << "\"floyd_warshall_full\":" << metrics_to_json(floyd_res.metrics) << ",";
    o << "\"floyd_warshall_cache\":" << metrics_to_json(floyd_lookup) << ",";
    o << "\"kruskal_mst\":" << metrics_to_json(kruskal_res.metrics);
    o << "},";
    o << "\"mst_edges\":[";
    for (size_t i = 0; i < kruskal_res.mst_edge_ids.size(); ++i) {
        if (i > 0) o << ",";
        o << kruskal_res.mst_edge_ids[i];
    }
    o << "],";
    o << "\"mst_path_nodes\":[";
    for (size_t i = 0; i < kruskal_res.metrics.path_nodes.size(); ++i) {
        if (i > 0) o << ",";
        o << kruskal_res.metrics.path_nodes[i];
    }
    o << "],";
    o << "\"negative_cycle_nodes\":[2,3,2],";
    o << "\"positive_corridor_nodes\":[0,5,6,7],";

    // Matriz de distancias de Floyd-Warshall 8x8 para visualización académica
    o << "\"floyd_matrix\":[";
    for (int i = 0; i < N; ++i) {
        if (i > 0) o << ",";
        o << "[";
        for (int j = 0; j < N; ++j) {
            if (j > 0) o << ",";
            double d = floyd_res.dist_matrix[i][j];
            if (d >= INF / 2) o << "null";
            else o << d;
        }
        o << "]";
    }
    o << "]";
    o << "}";
    return o.str();
}

/**
 * @brief Ejecuta el experimento completo del Ejercicio 8:
 *        1. Selector Inteligente de Algoritmo según propiedades del grafo
 *        2. Generación de grafo sintético reproducible por seed
 *        3. Modos: 'Generar Nuevo Grafo' vs 'Consultar Otro Par (O(1) Caché)'
 *        4. Curva de escalabilidad (std::chrono) para V en {8, 16, 32, 64, 100, 150}
 *        5. Cálculo exacto de memoria (Lista de Adyacencia vs Matriz)
 */
inline std::string run_exercise_8_json(
    int custom_v,
    double density,
    int negative_mode, // 0 = none, 1 = acyclic negative weights, 2 = force controlled negative cycle
    bool all_pairs_query,
    bool road_closure_event,
    int source = 0,
    int target = -1,
    int seed = 42,
    bool cached_query = false
) {
    custom_v = std::clamp(custom_v, 6, 220);
    density = std::clamp(density, 0.12, 0.95);
    source = std::clamp(source, 0, custom_v - 1);
    if (target < 0 || target >= custom_v) target = custom_v - 1;
    if (source == target) target = (source + 1) % custom_v;

    auto generate_graph = [](int V, double dens, int neg_mode, int s_val) -> std::vector<Edge> {
        std::mt19937 rng(s_val + V * 31);
        std::uniform_real_distribution<double> w_dist(8.0, 35.0);
        std::uniform_real_distribution<double> prob(0.0, 1.0);

        std::vector<Edge> gen_edges;
        int eid = 0;
        // 1. Conectividad base: Ciclo hamiltoniano dirigido con pesos positivos estrictos
        for (int i = 0; i < V; ++i) {
            int nxt = (i + 1) % V;
            double w = w_dist(rng);
            gen_edges.push_back({eid++, i, nxt, "Via_" + std::to_string(i) + "_" + std::to_string(nxt), w * 35.0, w, 100, 0, true, false, 0.0});
        }
        // 2. Malla aleatoria según densidad
        for (int i = 0; i < V; ++i) {
            for (int j = 0; j < V; ++j) {
                if (i == j || (j == (i + 1) % V)) continue;
                if (prob(rng) < dens) {
                    double w = w_dist(rng);
                    gen_edges.push_back({eid++, i, j, "Calle_" + std::to_string(eid), w * 35.0, w, 100, 0, true, false, 0.0});
                }
            }
        }

        // 3. INYECCIÓN SEGÚN MODO DE PESOS NEGATIVOS:
        if (neg_mode == 1) {
            // MODO 1: PESOS NEGATIVOS ACÍCLICOS (Garantiza CERO ciclos negativos)
            // Inyectamos pesos negativos SOLO en aristas donde from < to (hacia adelante).
            // Para cerrar un ciclo dirigido se requeriría una arista de retorno (to < from), pero TODAS
            // las aristas de retorno tienen pesos positivos >= 8.0s, garantizando cero ciclos negativos.
            int injected = 0;
            for (auto& edge : gen_edges) {
                if (edge.from < edge.to && prob(rng) < 0.28) {
                    // Bonificación vial negativa: costo efectivo = 8s - 14s = -6.0s
                    edge.hive_bonus = -(edge.base_time_sec + 6.0);
                    injected++;
                    if (injected >= std::min(5, V / 4)) break;
                }
            }
        } else if (neg_mode == 2) {
            // MODO 2: CICLO NEGATIVO CONTROLADO Y LOCALIZADO (Auditoría Bellman-Ford)
            // Se crea exactamente UN ciclo cerrado entre 2 vértices adyacentes u y v con suma negativa neta.
            // El resto de la red vial se mantiene 100% limpia y positiva.
            int u = V / 3;
            int v = (u + 1) % V;

            int e_uv = -1, e_vu = -1;
            for (size_t k = 0; k < gen_edges.size(); ++k) {
                if (gen_edges[k].from == u && gen_edges[k].to == v) e_uv = (int)k;
                if (gen_edges[k].from == v && gen_edges[k].to == u) e_vu = (int)k;
            }
            if (e_uv == -1) {
                e_uv = (int)gen_edges.size();
                gen_edges.push_back({eid++, u, v, "Via_Ciclo_" + std::to_string(u) + "_" + std::to_string(v), 300.0, 8.0, 100, 0, true, false, 0.0});
            }
            if (e_vu == -1) {
                e_vu = (int)gen_edges.size();
                gen_edges.push_back({eid++, v, u, "Via_Ciclo_" + std::to_string(v) + "_" + std::to_string(u), 300.0, 8.0, 100, 0, true, false, 0.0});
            }

            gen_edges[e_uv].base_time_sec = 6.0;
            gen_edges[e_uv].hive_bonus = 0.0; // +6.0s

            gen_edges[e_vu].base_time_sec = 6.0;
            gen_edges[e_vu].hive_bonus = -20.0; // 6.0 - 20.0 = -14.0s
            // Suma del ciclo u -> v -> u: 6 + (-14) = -8.0s < 0! (Absorbente)
        }

        return gen_edges;
    };

    bool has_negative_weights = (negative_mode > 0);
    // Generar el grafo actual con la semilla solicitada
    auto custom_edges = generate_graph(custom_v, density, negative_mode, seed);

    int reps = (custom_v <= 30) ? 150 : (custom_v <= 80 ? 35 : 8);
    auto d_heap = run_dijkstra_heap(custom_v, custom_edges, source, target, "car", reps);
    auto d_mat  = run_dijkstra_matrix(custom_v, custom_edges, source, target, "car", reps);
    auto bf     = run_bellman_ford(custom_v, custom_edges, source, target, "car", reps);
    auto fw     = run_floyd_warshall_full(custom_v, custom_edges, source, target, "car", std::max(2, reps / 4));
    auto fw_lkp = run_floyd_warshall_lookup(fw, custom_edges, source, target, 2500);
    auto mst    = run_kruskal_mst(custom_v, custom_edges, source, target, "car", reps);

    // Árbol de Decisión del Selector Automático (Ejercicio 8)
    std::string chosen_id;
    std::string chosen_name;
    std::string decision_explanation;

    if (negative_mode == 2 || bf.negative_cycle_detected) {
        chosen_id = "bellman_ford";
        chosen_name = "Bellman-Ford O(V · E) [Auditoría Ciclo Negativo]";
        decision_explanation = "⚠️ ¡Ciclo Negativo Absorbente detectado! Bellman-Ford auditó el grafo y localizó el bucle infinito (" + std::to_string(bf.negative_cycle_nodes.size() > 1 ? bf.negative_cycle_nodes.size() - 1 : 0) + " vértices). Dijkstra falla ante ciclos negativos; Bellman-Ford previene bucles infinitos y reporta la anomalía.";
    } else if (negative_mode == 1) {
        chosen_id = "bellman_ford";
        chosen_name = "Bellman-Ford O(V · E) [Pesos Negativos Acíclicos]";
        decision_explanation = "Se inyectaron bonificaciones viales negativas (ahorros de tiempo) garantizando la ausencia de ciclos negativos. Dijkstra no es confiable con pesos negativos debido a su selección voraz; Bellman-Ford garantiza hallar la ruta de costo mínimo global.";
    } else if (cached_query) {
        chosen_id = "floyd_warshall_cache";
        chosen_name = "Floyd-Warshall Caché O(1) Precalculado";
        decision_explanation = "El grafo permanece idéntico en memoria y la matriz de todos los pares ya fue precalculada en la generación inicial. Se consulta la ruta de V" + std::to_string(source) + " a V" + std::to_string(target) + " en O(saltos) ≈ O(1) directamente desde la matriz sin recalcular el grafo.";
    } else if (road_closure_event) {
        chosen_id = (density > 0.65) ? "dijkstra_matrix" : "dijkstra_heap";
        chosen_name = (density > 0.65) ? "Dijkstra Matriz O(V²)" : "Dijkstra Min-Heap O(E log V)";
        decision_explanation = "Cierre de vía dinámico detectado: la matriz precalculada queda invalidada. Recalcular todo en O(V³) sería muy lento, por lo que se conmuta a Dijkstra puntual de origen único.";
    } else {
        // Grafo recién generado con régimen de pesos normales w >= 0:
        // Consulta puntual de origen a destino en red nueva -> Dijkstra es el óptimo
        if (density > 0.65) {
            chosen_id = "dijkstra_matrix";
            chosen_name = "Dijkstra Clásico (Matriz O(V²))";
            decision_explanation = "Nuevo grafo generado con alta densidad (" + std::to_string((int)std::round(density * 100)) + "%, E ≈ V²) y pesos positivos: la representación matricial y el arreglo contiguo superan la sobrecarga del montículo binario y evitan el costo O(V³) de Floyd-Warshall.";
        } else {
            chosen_id = "dijkstra_heap";
            chosen_name = "Dijkstra Min-Heap O(E log V)";
            decision_explanation = "Nuevo grafo generado (" + std::to_string((int)std::round(density * 100)) + "% densidad) con pesos positivos: para responder la ruta puntual de V" + std::to_string(source) + " a V" + std::to_string(target) + ", la cola de prioridad binaria en O(E log V) es drásticamente más rápida que recalcular toda la matriz con Floyd-Warshall en O(V³).";
        }
    }

    // Cálculo analítico de consumo de memoria real en bytes
    size_t adj_list_bytes = custom_v * sizeof(std::vector<Edge>) + custom_edges.size() * sizeof(Edge);
    size_t matrix_bytes = (size_t)custom_v * (size_t)custom_v * sizeof(double);
    double mem_ratio = (double)matrix_bytes / (double)(adj_list_bytes > 0 ? adj_list_bytes : 1);

    // Serie de escalabilidad para gráficas comparativas (V = 8, 16, 32, 64, 100, 150)
    std::vector<int> sizes = {8, 16, 32, 64, 100, 150};
    std::ostringstream series_json;
    series_json << std::fixed << std::setprecision(3) << "[";
    for (size_t idx = 0; idx < sizes.size(); ++idx) {
        int v_sz = sizes[idx];
        auto g_edges = generate_graph(v_sz, std::min(0.35, density), false, 42 + (int)idx);
        int r_cnt = (v_sz <= 32) ? 80 : (v_sz <= 64 ? 20 : 4);
        auto m_dh = run_dijkstra_heap(v_sz, g_edges, 0, v_sz - 1, "car", r_cnt);
        auto m_dm = run_dijkstra_matrix(v_sz, g_edges, 0, v_sz - 1, "car", r_cnt);
        auto m_bf = run_bellman_ford(v_sz, g_edges, 0, v_sz - 1, "car", r_cnt);
        auto m_fw = run_floyd_warshall_full(v_sz, g_edges, 0, v_sz - 1, "car", std::max(1, r_cnt / 4));
        auto m_fl = run_floyd_warshall_lookup(m_fw, g_edges, 0, v_sz - 1, 1000);
        auto m_kr = run_kruskal_mst(v_sz, g_edges, 0, v_sz - 1, "car", r_cnt);

        if (idx > 0) series_json << ",";
        series_json << "{"
                    << "\"V\":" << v_sz << ","
                    << "\"E\":" << g_edges.size() << ","
                    << "\"floyd_cache_us\":" << m_fl.execution_time_us << ","
                    << "\"dijkstra_heap_us\":" << m_dh.execution_time_us << ","
                    << "\"dijkstra_matrix_us\":" << m_dm.execution_time_us << ","
                    << "\"bellman_ford_us\":" << m_bf.execution_time_us << ","
                    << "\"kruskal_mst_us\":" << m_kr.metrics.execution_time_us << ","
                    << "\"floyd_full_us\":" << m_fw.metrics.execution_time_us
                    << "}";
    }
    series_json << "]";

    std::ostringstream o;
    o << std::fixed << std::setprecision(4);
    o << "{"
      << "\"custom_graph\":{"
      << "\"V\":" << custom_v << ","
      << "\"E\":" << custom_edges.size() << ","
      << "\"density\":" << density << ","
      << "\"negative_mode\":" << negative_mode << ","
      << "\"has_negative_weights\":" << (has_negative_weights ? "true" : "false") << ","
      << "\"all_pairs_query\":" << (all_pairs_query ? "true" : "false") << ","
      << "\"road_closure_event\":" << (road_closure_event ? "true" : "false") << ","
      << "\"source\":" << source << ","
      << "\"target\":" << target << ","
      << "\"seed\":" << seed << ","
      << "\"cached_query\":" << (cached_query ? "true" : "false")
      << "},"
      << "\"memory\":{"
      << "\"adj_list_bytes\":" << adj_list_bytes << ","
      << "\"matrix_bytes\":" << matrix_bytes << ","
      << "\"ratio\":" << mem_ratio
      << "},"
      << "\"selector\":{"
      << "\"chosen_algorithm_id\":\"" << json_escape(chosen_id) << "\","
      << "\"chosen_algorithm_name\":\"" << json_escape(chosen_name) << "\","
      << "\"explanation\":\"" << json_escape(decision_explanation) << "\""
      << "},"
      << "\"benchmarks\":{"
      << "\"floyd_warshall_cache\":" << metrics_to_json(fw_lkp) << ","
      << "\"dijkstra_heap\":" << metrics_to_json(d_heap) << ","
      << "\"dijkstra_matrix\":" << metrics_to_json(d_mat) << ","
      << "\"bellman_ford\":" << metrics_to_json(bf) << ","
      << "\"kruskal_mst\":" << metrics_to_json(mst.metrics) << ","
      << "\"floyd_warshall_full\":" << metrics_to_json(fw.metrics)
      << "},";

    // Serializar aristas de muestra para renderizado dinámico en el lienzo SVG si V <= 65
    o << "\"render_edges\":[";
    if (custom_v <= 65) {
        for (size_t i = 0; i < custom_edges.size(); ++i) {
            if (i > 0) o << ",";
            o << "{\"id\":" << custom_edges[i].id
              << ",\"from\":" << custom_edges[i].from
              << ",\"to\":" << custom_edges[i].to
              << ",\"weight\":" << custom_edges[i].effective_weight("car", true) << "}";
        }
    }
    o << "],";

    o << "\"scaling_series\":" << series_json.str()
      << "}";
    return o.str();
}

} // namespace traffic
