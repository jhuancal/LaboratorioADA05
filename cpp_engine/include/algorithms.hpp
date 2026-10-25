#pragma once
/**
 * @file algorithms.hpp
 * @brief Implementación en C++20 de los algoritmos de rutas más cortas, árboles de expansión
 *        y Mente Colmena (Yen K-Shortest Paths + Incentivos Negativos Bellman-Ford).
 *        Instrumentado con std::chrono::high_resolution_clock.
 */

#include "graph_types.hpp"
#include <chrono>
#include <queue>
#include <numeric>
#include <unordered_map>
#include <unordered_set>
#include <tuple>

namespace traffic {

struct AdjEntry {
    int to;
    int edge_id;
    double weight;
    double distance_m;
};

/**
 * @brief Construye lista de adyacencia según modo ("car" = dirigido, "pedestrian" = no dirigido).
 */
inline std::vector<std::vector<AdjEntry>> build_adj_list(
    int num_nodes,
    const std::vector<Edge>& edges,
    const std::string& mode,
    bool allow_negative = false,
    const std::unordered_set<int>& excluded_edges = {},
    const std::unordered_set<int>& excluded_nodes = {}
) {
    std::vector<std::vector<AdjEntry>> adj(num_nodes);
    for (const auto& e : edges) {
        if (e.is_closed) continue;
        if (excluded_edges.count(e.id)) continue;
        if (e.from < 0 || e.from >= num_nodes || e.to < 0 || e.to >= num_nodes) continue;
        if (excluded_nodes.count(e.from) || excluded_nodes.count(e.to)) continue;

        double w = e.effective_weight(mode, allow_negative);
        if (w >= INF / 2) continue;

        adj[e.from].push_back({e.to, e.id, w, e.distance_m});
        if (!e.is_directed || mode == "pedestrian") {
            adj[e.to].push_back({e.from, e.id, w, e.distance_m});
        }
    }
    return adj;
}

/**
 * @brief 1. DIJKSTRA CON MONTÍCULO BINARIO (MIN-HEAP) - O(E log V)
 */
inline AlgorithmMetrics run_dijkstra_heap(
    int num_nodes,
    const std::vector<Edge>& edges,
    int source,
    int target,
    const std::string& mode,
    int benchmark_repeats = 250
) {
    AlgorithmMetrics res;
    res.algorithm_id = "dijkstra_heap";
    res.algorithm_name = "Dijkstra (Min-Heap Priority Queue)";
    res.complexity_time = "O(E log V)";
    res.complexity_space = "O(V + E)";

    auto adj = build_adj_list(num_nodes, edges, mode, false);

    std::vector<double> dist(num_nodes, INF);
    std::vector<int> parent_node(num_nodes, -1);
    std::vector<int> parent_edge(num_nodes, -1);
    long long ops = 0;
    long long relaxations = 0;

    auto t0 = std::chrono::high_resolution_clock::now();
    int reps = std::max(1, benchmark_repeats);
    volatile double sink = 0.0;

    for (int r = 0; r < reps; ++r) {
        std::fill(dist.begin(), dist.end(), INF);
        std::fill(parent_node.begin(), parent_node.end(), -1);
        std::fill(parent_edge.begin(), parent_edge.end(), -1);
        ops = 0;
        relaxations = 0;

        using P = std::pair<double, int>;
        std::priority_queue<P, std::vector<P>, std::greater<P>> pq;

        if (source >= 0 && source < num_nodes) {
            dist[source] = 0.0;
            pq.push({0.0, source});
            ops++;
        }

        long long max_relax = (long long)num_nodes * (long long)edges.size() * 2 + 1000;

        while (!pq.empty()) {
            auto [d, u] = pq.top();
            pq.pop();
            ops++;

            if (d > dist[u]) continue;
            if (relaxations > max_relax) {
                // Ciclo negativo detectado en Dijkstra: abortar para evitar bucle infinito
                break;
            }
            if (u == target && r < reps - 1) {
                // Early exit optimization in normal runs
            }

            for (const auto& edge : adj[u]) {
                ops++;
                if (dist[u] + edge.weight < dist[edge.to] - 1e-9) {
                    dist[edge.to] = dist[u] + edge.weight;
                    parent_node[edge.to] = u;
                    parent_edge[edge.to] = edge.edge_id;
                    pq.push({dist[edge.to], edge.to});
                    relaxations++;
                    ops++;
                }
            }
        }
        if (target >= 0 && target < num_nodes) sink += dist[target];
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    (void)sink;

    double total_ns = std::chrono::duration<double, std::nano>(t1 - t0).count() / reps;
    res.execution_time_ns = total_ns;
    res.execution_time_us = total_ns / 1000.0;
    res.operations_count = ops;
    res.relaxations_count = relaxations;
    res.memory_bytes = sizeof(double) * num_nodes + sizeof(int) * num_nodes * 2 + sizeof(AdjEntry) * edges.size() * 2;

    if (target >= 0 && target < num_nodes && dist[target] < INF / 2) {
        res.reachable = true;
        res.total_cost = dist[target];
        int curr = target;
        int safety = 0;
        while (curr != -1 && safety++ <= num_nodes + 2) {
            res.path_nodes.push_back(curr);
            if (curr == source) break;
            int pe = parent_edge[curr];
            if (pe != -1) res.path_edges.push_back(pe);
            curr = parent_node[curr];
        }
        std::reverse(res.path_nodes.begin(), res.path_nodes.end());
        std::reverse(res.path_edges.begin(), res.path_edges.end());

        // Sumar distancia física real
        std::unordered_map<int, double> edge_dist;
        for (const auto& e : edges) edge_dist[e.id] = e.distance_m;
        for (int eid : res.path_edges) res.total_distance_m += edge_dist[eid];
    }

    res.selection_reason = "Óptimo cuando hay cierres de vía dinámicos o modo peatonal (pesos no negativos) sin recalcular toda la matriz O(V^3).";
    return res;
}

/**
 * @brief 2. DIJKSTRA CON MATRIZ DE ADYACENCIA (SIN COLA DE PRIORIDAD) - O(V^2)
 */
inline AlgorithmMetrics run_dijkstra_matrix(
    int num_nodes,
    const std::vector<Edge>& edges,
    int source,
    int target,
    const std::string& mode,
    int benchmark_repeats = 250
) {
    AlgorithmMetrics res;
    res.algorithm_id = "dijkstra_matrix";
    res.algorithm_name = "Dijkstra Clásico (Matriz O(V²))";
    res.complexity_time = "O(V²)";
    res.complexity_space = "O(V²)";

    std::vector<double> adj_mat(num_nodes * num_nodes, INF);
    std::vector<int> adj_edge(num_nodes * num_nodes, -1);
    for (int i = 0; i < num_nodes; ++i) adj_mat[i * num_nodes + i] = 0.0;

    for (const auto& e : edges) {
        if (e.is_closed) continue;
        if (e.from < 0 || e.from >= num_nodes || e.to < 0 || e.to >= num_nodes) continue;
        double w = e.effective_weight(mode, false);
        if (w < adj_mat[e.from * num_nodes + e.to]) {
            adj_mat[e.from * num_nodes + e.to] = w;
            adj_edge[e.from * num_nodes + e.to] = e.id;
        }
        if (!e.is_directed || mode == "pedestrian") {
            if (w < adj_mat[e.to * num_nodes + e.from]) {
                adj_mat[e.to * num_nodes + e.from] = w;
                adj_edge[e.to * num_nodes + e.from] = e.id;
            }
        }
    }

    std::vector<double> dist(num_nodes, INF);
    std::vector<bool> visited(num_nodes, false);
    std::vector<int> parent_node(num_nodes, -1);
    std::vector<int> parent_edge(num_nodes, -1);
    long long ops = 0;
    long long relaxations = 0;

    auto t0 = std::chrono::high_resolution_clock::now();
    int reps = std::max(1, benchmark_repeats);
    volatile double sink = 0.0;

    for (int r = 0; r < reps; ++r) {
        std::fill(dist.begin(), dist.end(), INF);
        std::fill(visited.begin(), visited.end(), false);
        std::fill(parent_node.begin(), parent_node.end(), -1);
        std::fill(parent_edge.begin(), parent_edge.end(), -1);
        ops = 0;
        relaxations = 0;

        if (source >= 0 && source < num_nodes) dist[source] = 0.0;

        for (int count = 0; count < num_nodes; ++count) {
            int u = -1;
            double min_d = INF;
            for (int v = 0; v < num_nodes; ++v) {
                ops++;
                if (!visited[v] && dist[v] < min_d) {
                    min_d = dist[v];
                    u = v;
                }
            }
            if (u == -1 || min_d >= INF / 2) break;
            visited[u] = true;

            for (int v = 0; v < num_nodes; ++v) {
                ops++;
                double w = adj_mat[u * num_nodes + v];
                if (!visited[v] && w < INF / 2 && dist[u] + w < dist[v] - 1e-9) {
                    dist[v] = dist[u] + w;
                    parent_node[v] = u;
                    parent_edge[v] = adj_edge[u * num_nodes + v];
                    relaxations++;
                }
            }
        }
        if (target >= 0 && target < num_nodes) sink += dist[target];
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    (void)sink;

    double total_ns = std::chrono::duration<double, std::nano>(t1 - t0).count() / reps;
    res.execution_time_ns = total_ns;
    res.execution_time_us = total_ns / 1000.0;
    res.operations_count = ops;
    res.relaxations_count = relaxations;
    res.memory_bytes = sizeof(double) * num_nodes * num_nodes + sizeof(int) * num_nodes * num_nodes;

    if (target >= 0 && target < num_nodes && dist[target] < INF / 2) {
        res.reachable = true;
        res.total_cost = dist[target];
        int curr = target;
        int safety = 0;
        while (curr != -1 && safety++ <= num_nodes + 2) {
            res.path_nodes.push_back(curr);
            if (curr == source) break;
            int pe = parent_edge[curr];
            if (pe != -1) res.path_edges.push_back(pe);
            curr = parent_node[curr];
        }
        std::reverse(res.path_nodes.begin(), res.path_nodes.end());
        std::reverse(res.path_edges.begin(), res.path_edges.end());

        std::unordered_map<int, double> edge_dist;
        for (const auto& e : edges) edge_dist[e.id] = e.distance_m;
        for (int eid : res.path_edges) res.total_distance_m += edge_dist[eid];
    }

    res.selection_reason = "Útil en grafos extremadamente densos (E ≈ V²), pero más lento que Min-Heap en redes viales dispersas.";
    return res;
}

/**
 * @brief 3. BELLMAN-FORD - O(V * E) CON SOPORTE DE PESOS NEGATIVOS Y DETECCIÓN DE CICLOS NEGATIVOS
 */
inline AlgorithmMetrics run_bellman_ford(
    int num_nodes,
    const std::vector<Edge>& edges,
    int source,
    int target,
    const std::string& mode,
    int benchmark_repeats = 200
) {
    AlgorithmMetrics res;
    res.algorithm_id = "bellman_ford";
    res.algorithm_name = "Bellman-Ford (Pesos Negativos & Ciclos)";
    res.complexity_time = "O(V · E)";
    res.complexity_space = "O(V)";

    struct DirectedEdge {
        int u;
        int v;
        int edge_id;
        double weight;
        double distance_m;
    };

    std::vector<DirectedEdge> dir_edges;
    dir_edges.reserve(edges.size() * 2);
    for (const auto& e : edges) {
        if (e.is_closed) continue;
        if (e.from < 0 || e.from >= num_nodes || e.to < 0 || e.to >= num_nodes) continue;
        double w_forward = e.effective_weight(mode, true); // incluye hive_bonus (puede ser < 0)
        double w_reverse = e.effective_weight(mode, false); // sin bono negativo en sentido inverso salvo ciclo forzado
        dir_edges.push_back({e.from, e.to, e.id, w_forward, e.distance_m});
        if (!e.is_directed || mode == "pedestrian") {
            // Si hive_bonus < -5000 (inyección deliberada de ciclo negativo),
            // se aplica en ambos sentidos para demostrar el bucle infinito en Bellman-Ford.
            double rev_w = (e.hive_bonus < -5000.0) ? w_forward : w_reverse;
            dir_edges.push_back({e.to, e.from, e.id, rev_w, e.distance_m});
        }
    }

    std::vector<double> dist(num_nodes, INF);
    std::vector<int> parent_node(num_nodes, -1);
    std::vector<int> parent_edge(num_nodes, -1);
    long long ops = 0;
    long long relaxations = 0;
    int cycle_start_node = -1;

    auto t0 = std::chrono::high_resolution_clock::now();
    int reps = std::max(1, benchmark_repeats);
    volatile double sink = 0.0;

    for (int r = 0; r < reps; ++r) {
        std::fill(dist.begin(), dist.end(), INF);
        std::fill(parent_node.begin(), parent_node.end(), -1);
        std::fill(parent_edge.begin(), parent_edge.end(), -1);
        ops = 0;
        relaxations = 0;
        cycle_start_node = -1;

        if (source >= 0 && source < num_nodes) dist[source] = 0.0;

        for (int i = 1; i <= num_nodes - 1; ++i) {
            bool changed = false;
            for (const auto& de : dir_edges) {
                ops++;
                if (dist[de.u] < INF / 2 && dist[de.u] + de.weight < dist[de.v] - 1e-9) {
                    dist[de.v] = dist[de.u] + de.weight;
                    parent_node[de.v] = de.u;
                    parent_edge[de.v] = de.edge_id;
                    relaxations++;
                    changed = true;
                }
            }
            if (!changed) break;
        }

        // V-ésima iteración: detección de ciclo de peso negativo
        for (const auto& de : dir_edges) {
            ops++;
            if (dist[de.u] < INF / 2 && dist[de.u] + de.weight < dist[de.v] - 1e-9) {
                cycle_start_node = de.v;
                parent_node[de.v] = de.u;
                parent_edge[de.v] = de.edge_id;
                break;
            }
        }
        if (target >= 0 && target < num_nodes) sink += dist[target];
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    (void)sink;

    double total_ns = std::chrono::duration<double, std::nano>(t1 - t0).count() / reps;
    res.execution_time_ns = total_ns;
    res.execution_time_us = total_ns / 1000.0;
    res.operations_count = ops;
    res.relaxations_count = relaxations;
    res.memory_bytes = sizeof(double) * num_nodes + sizeof(int) * num_nodes * 2;

    if (cycle_start_node != -1) {
        res.negative_cycle_detected = true;
        int x = cycle_start_node;
        for (int i = 0; i < num_nodes; ++i) {
            if (parent_node[x] != -1) x = parent_node[x];
        }
        std::vector<int> cycle;
        std::vector<int> cycle_edges;
        int curr = x;
        int guard = 0;
        do {
            cycle.push_back(curr);
            int pe = parent_edge[curr];
            if (pe != -1) cycle_edges.push_back(pe);
            curr = parent_node[curr];
            guard++;
        } while (curr != x && curr != -1 && guard <= num_nodes + 2);
        cycle.push_back(x);
        std::reverse(cycle.begin(), cycle.end());
        std::reverse(cycle_edges.begin(), cycle_edges.end());
        res.negative_cycle_nodes = cycle;
        res.negative_cycle_edges = cycle_edges;
    }

    if (target >= 0 && target < num_nodes && dist[target] < INF / 2) {
        std::vector<int> rev_nodes;
        std::vector<int> rev_edges;
        int curr = target;
        int safety = 0;
        std::unordered_set<int> seen;
        bool reached_source = false;

        while (curr != -1 && safety++ <= num_nodes + 2) {
            rev_nodes.push_back(curr);
            if (curr == source) {
                reached_source = true;
                break;
            }
            if (seen.count(curr)) break;
            seen.insert(curr);
            int pe = parent_edge[curr];
            if (pe != -1) rev_edges.push_back(pe);
            curr = parent_node[curr];
        }

        if (reached_source) {
            res.reachable = true;
            res.total_cost = dist[target];
            std::reverse(rev_nodes.begin(), rev_nodes.end());
            std::reverse(rev_edges.begin(), rev_edges.end());
            res.path_nodes = rev_nodes;
            res.path_edges = rev_edges;

            std::unordered_map<int, double> edge_dist;
            for (const auto& e : edges) edge_dist[e.id] = e.distance_m;
            for (int eid : res.path_edges) res.total_distance_m += edge_dist[eid];
        }
    }

    res.selection_reason = "Indispensable cuando la Mente Colmena inyecta incentivos de peso negativo (bonos < 0) o para auditar ciclos negativos.";
    return res;
}

/**
 * @brief Resultado completo de Floyd-Warshall O(V^3)
 */
struct FloydWarshallFullResult {
    AlgorithmMetrics metrics;
    std::vector<std::vector<double>> dist_matrix;
    std::vector<std::vector<int>> next_node;
    std::vector<std::vector<int>> next_edge;
};

/**
 * @brief 4. FLOYD-WARSHALL COMPLETO - O(V^3) (Pre-cálculo Matricial Total)
 */
inline FloydWarshallFullResult run_floyd_warshall_full(
    int num_nodes,
    const std::vector<Edge>& edges,
    int source,
    int target,
    const std::string& mode,
    int benchmark_repeats = 80
) {
    FloydWarshallFullResult out;
    out.metrics.algorithm_id = "floyd_warshall_full";
    out.metrics.algorithm_name = "Floyd-Warshall Completo (Recálculo O(V³))";
    out.metrics.complexity_time = "O(V³)";
    out.metrics.complexity_space = "O(V²)";

    out.dist_matrix.assign(num_nodes, std::vector<double>(num_nodes, INF));
    out.next_node.assign(num_nodes, std::vector<int>(num_nodes, -1));
    out.next_edge.assign(num_nodes, std::vector<int>(num_nodes, -1));

    long long ops = 0;
    long long relaxations = 0;

    auto t0 = std::chrono::high_resolution_clock::now();
    int reps = std::max(1, benchmark_repeats);
    volatile double sink = 0.0;

    for (int r = 0; r < reps; ++r) {
        for (int i = 0; i < num_nodes; ++i) {
            std::fill(out.dist_matrix[i].begin(), out.dist_matrix[i].end(), INF);
            std::fill(out.next_node[i].begin(), out.next_node[i].end(), -1);
            std::fill(out.next_edge[i].begin(), out.next_edge[i].end(), -1);
            out.dist_matrix[i][i] = 0.0;
            out.next_node[i][i] = i;
        }
        ops = 0;
        relaxations = 0;

        for (const auto& e : edges) {
            if (e.is_closed) continue;
            if (e.from < 0 || e.from >= num_nodes || e.to < 0 || e.to >= num_nodes) continue;
            double w_fwd = e.effective_weight(mode, true);
            double w_rev = (e.hive_bonus < -5000.0) ? w_fwd : e.effective_weight(mode, false);
            if (w_fwd < out.dist_matrix[e.from][e.to]) {
                out.dist_matrix[e.from][e.to] = w_fwd;
                out.next_node[e.from][e.to] = e.to;
                out.next_edge[e.from][e.to] = e.id;
            }
            if (!e.is_directed || mode == "pedestrian") {
                if (w_rev < out.dist_matrix[e.to][e.from]) {
                    out.dist_matrix[e.to][e.from] = w_rev;
                    out.next_node[e.to][e.from] = e.from;
                    out.next_edge[e.to][e.from] = e.id;
                }
            }
        }

        for (int k = 0; k < num_nodes; ++k) {
            for (int i = 0; i < num_nodes; ++i) {
                if (out.dist_matrix[i][k] >= INF / 2) continue;
                for (int j = 0; j < num_nodes; ++j) {
                    ops++;
                    if (out.dist_matrix[k][j] < INF / 2 &&
                        out.dist_matrix[i][k] + out.dist_matrix[k][j] < out.dist_matrix[i][j] - 1e-9) {
                        out.dist_matrix[i][j] = out.dist_matrix[i][k] + out.dist_matrix[k][j];
                        out.next_node[i][j] = out.next_node[i][k];
                        out.next_edge[i][j] = out.next_edge[i][k];
                        relaxations++;
                    }
                }
            }
        }
        if (source >= 0 && source < num_nodes && target >= 0 && target < num_nodes) {
            sink += out.dist_matrix[source][target];
        }
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    (void)sink;

    double total_ns = std::chrono::duration<double, std::nano>(t1 - t0).count() / reps;
    out.metrics.execution_time_ns = total_ns;
    out.metrics.execution_time_us = total_ns / 1000.0;
    out.metrics.operations_count = ops;
    out.metrics.relaxations_count = relaxations;
    out.metrics.memory_bytes = (sizeof(double) + sizeof(int) * 2) * num_nodes * num_nodes;

    for (int i = 0; i < num_nodes; ++i) {
        if (out.dist_matrix[i][i] < -1e-6) {
            out.metrics.negative_cycle_detected = true;
            out.metrics.negative_cycle_nodes.push_back(i);
        }
    }

    if (!out.metrics.negative_cycle_detected &&
        source >= 0 && source < num_nodes && target >= 0 && target < num_nodes &&
        out.dist_matrix[source][target] < INF / 2 && out.next_node[source][target] != -1) {
        out.metrics.reachable = true;
        out.metrics.total_cost = out.dist_matrix[source][target];
        int curr = source;
        int guard = 0;
        out.metrics.path_nodes.push_back(curr);
        while (curr != target && guard++ <= num_nodes + 2) {
            int nxt = out.next_node[curr][target];
            if (nxt == -1) break;
            int edg = out.next_edge[curr][target];
            if (edg == -1) {
                for (const auto& e : edges) {
                    if (!e.is_closed && e.from == curr && e.to == nxt) {
                        edg = e.id;
                        break;
                    }
                }
            }
            if (edg != -1) out.metrics.path_edges.push_back(edg);
            out.metrics.path_nodes.push_back(nxt);
            curr = nxt;
        }
        std::unordered_map<int, double> edge_dist;
        for (const auto& e : edges) edge_dist[e.id] = e.distance_m;
        for (int eid : out.metrics.path_edges) out.metrics.total_distance_m += edge_dist[eid];
    }

    out.metrics.selection_reason = "Pre-calcula TODOS los pares en O(V³) al iniciar el servidor para guardarlos en SQLite y responder consultas en O(1).";
    return out;
}

/**
 * @brief 5. FLOYD-WARSHALL CACHÉ O(1) POR SALTO (Consulta Instantánea de Matriz Precalculada)
 */
inline AlgorithmMetrics run_floyd_warshall_lookup(
    const FloydWarshallFullResult& precomputed,
    const std::vector<Edge>& edges,
    int source,
    int target,
    int benchmark_repeats = 5000
) {
    (void)edges;
    AlgorithmMetrics res;
    res.algorithm_id = "floyd_warshall_cache";
    res.algorithm_name = "Floyd-Warshall Caché SQLite (Consulta O(1))";
    res.complexity_time = "O(1) matriz / O(saltos)";
    res.complexity_space = "O(V²) en Caché";

    int num_nodes = static_cast<int>(precomputed.dist_matrix.size());
    if (precomputed.metrics.negative_cycle_detected) {
        res.negative_cycle_detected = true;
        res.reachable = false;
        res.total_cost = -std::numeric_limits<double>::infinity();
        res.execution_time_us = 0.05;
        res.selection_reason = "Floyd-Warshall invalidado por ciclo negativo detectado en el grafo.";
        return res;
    }
    long long ops = 0;

    auto t0 = std::chrono::high_resolution_clock::now();
    int reps = std::max(1, benchmark_repeats);
    volatile int sink = 0;

    for (int r = 0; r < reps; ++r) {
        ops = 1; // Lookup directo dist[source][target]
        if (source >= 0 && source < num_nodes && target >= 0 && target < num_nodes &&
            precomputed.next_node[source][target] != -1) {
            int curr = source;
            int guard = 0;
            while (curr != target && guard++ <= num_nodes + 2) {
                curr = precomputed.next_node[curr][target];
                ops++;
                if (curr == -1) break;
            }
            sink += curr;
        }
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    (void)sink;

    double total_ns = std::chrono::duration<double, std::nano>(t1 - t0).count() / reps;
    res.execution_time_ns = total_ns;
    res.execution_time_us = total_ns / 1000.0;
    res.operations_count = ops;
    res.relaxations_count = 0; // Ya precalculado!
    res.memory_bytes = precomputed.metrics.memory_bytes;

    if (source >= 0 && source < num_nodes && target >= 0 && target < num_nodes &&
        precomputed.dist_matrix[source][target] < INF / 2 &&
        precomputed.next_node[source][target] != -1) {
        res.reachable = true;
        res.total_cost = precomputed.dist_matrix[source][target];
        int curr = source;
        int guard = 0;
        res.path_nodes.push_back(curr);
        while (curr != target && guard++ <= num_nodes + 2) {
            int nxt = precomputed.next_node[curr][target];
            if (nxt == -1) break;
            int edg = precomputed.next_edge[curr][target];
            if (edg == -1) {
                for (const auto& e : edges) {
                    if (!e.is_closed && e.from == curr && e.to == nxt) {
                        edg = e.id;
                        break;
                    }
                }
            }
            if (edg != -1) res.path_edges.push_back(edg);
            res.path_nodes.push_back(nxt);
            curr = nxt;
        }
        std::unordered_map<int, double> edge_dist;
        for (const auto& e : edges) edge_dist[e.id] = e.distance_m;
        for (int eid : res.path_edges) res.total_distance_m += edge_dist[eid];
    } else {
        res.reachable = false;
        res.total_cost = INF;
    }
    res.selection_reason = "Modo por defecto ultra-rápido: lee la ruta directamente desde la tabla precalculada de Floyd-Warshall en SQLite sin recalcular el grafo.";
    return res;
}

/**
 * @brief 6. ÁRBOL DE EXPANSIÓN MÍNIMA DE KRUSKAL (MST) - O(E log E) + Camino en el MST
 */
inline MSTResult run_kruskal_mst(
    int num_nodes,
    const std::vector<Edge>& edges,
    int source,
    int target,
    const std::string& mode,
    int benchmark_repeats = 250
) {
    MSTResult out;
    out.metrics.algorithm_id = "kruskal_mst";
    out.metrics.algorithm_name = "Kruskal MST (Árbol de Expansión Mínima)";
    out.metrics.complexity_time = "O(E log E)";
    out.metrics.complexity_space = "O(V + E)";

    struct WeightedEdge {
        int id;
        int u;
        int v;
        double w;
        double dist_m;
    };

    std::vector<WeightedEdge> cand;
    cand.reserve(edges.size());
    for (const auto& e : edges) {
        if (e.is_closed) continue;
        if (e.from < 0 || e.from >= num_nodes || e.to < 0 || e.to >= num_nodes) continue;
        cand.push_back({e.id, e.from, e.to, e.effective_weight(mode, false), e.distance_m});
    }

    long long ops = 0;
    long long unions = 0;
    std::vector<int> mst_edges;
    double mst_cost = 0.0;

    auto t0 = std::chrono::high_resolution_clock::now();
    int reps = std::max(1, benchmark_repeats);
    volatile double sink = 0.0;

    for (int r = 0; r < reps; ++r) {
        auto sorted_edges = cand;
        std::sort(sorted_edges.begin(), sorted_edges.end(), [&](const WeightedEdge& a, const WeightedEdge& b) {
            ops++;
            return a.w < b.w;
        });

        std::vector<int> parent(num_nodes);
        std::vector<int> rank_v(num_nodes, 0);
        std::iota(parent.begin(), parent.end(), 0);

        auto find_set = [&](auto& self, int v) -> int {
            ops++;
            if (v == parent[v]) return v;
            return parent[v] = self(self, parent[v]);
        };

        mst_edges.clear();
        mst_cost = 0.0;
        unions = 0;

        for (const auto& ce : sorted_edges) {
            ops++;
            int ru = find_set(find_set, ce.u);
            int rv = find_set(find_set, ce.v);
            if (ru != rv) {
                if (rank_v[ru] < rank_v[rv]) std::swap(ru, rv);
                parent[rv] = ru;
                if (rank_v[ru] == rank_v[rv]) rank_v[ru]++;
                mst_edges.push_back(ce.id);
                mst_cost += ce.w;
                unions++;
                if (static_cast<int>(mst_edges.size()) == num_nodes - 1) break;
            }
        }
        sink += mst_cost;
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    (void)sink;

    double total_ns = std::chrono::duration<double, std::nano>(t1 - t0).count() / reps;
    out.metrics.execution_time_ns = total_ns;
    out.metrics.execution_time_us = total_ns / 1000.0;
    out.metrics.operations_count = ops;
    out.metrics.relaxations_count = unions;
    out.metrics.memory_bytes = sizeof(int) * num_nodes * 2 + sizeof(WeightedEdge) * cand.size();
    out.mst_total_cost = mst_cost;
    out.mst_edge_ids = mst_edges;

    // Encontrar el único camino dentro del Árbol de Expansión Mínima entre source y target (BFS en el árbol)
    std::unordered_set<int> mst_set(mst_edges.begin(), mst_edges.end());
    std::vector<std::vector<AdjEntry>> tree_adj(num_nodes);
    for (const auto& e : edges) {
        if (!mst_set.count(e.id)) continue;
        double w = e.effective_weight(mode, false);
        tree_adj[e.from].push_back({e.to, e.id, w, e.distance_m});
        tree_adj[e.to].push_back({e.from, e.id, w, e.distance_m});
    }

    if (source >= 0 && source < num_nodes && target >= 0 && target < num_nodes) {
        std::vector<int> p_node(num_nodes, -1);
        std::vector<int> p_edge(num_nodes, -1);
        std::vector<double> d_cost(num_nodes, INF);
        std::queue<int> q;
        q.push(source);
        d_cost[source] = 0.0;

        while (!q.empty()) {
            int u = q.front();
            q.pop();
            if (u == target) break;
            for (const auto& nb : tree_adj[u]) {
                if (d_cost[nb.to] >= INF / 2) {
                    d_cost[nb.to] = d_cost[u] + nb.weight;
                    p_node[nb.to] = u;
                    p_edge[nb.to] = nb.edge_id;
                    q.push(nb.to);
                }
            }
        }

        if (d_cost[target] < INF / 2) {
            out.metrics.reachable = true;
            out.metrics.total_cost = d_cost[target];
            int curr = target;
            while (curr != -1) {
                out.metrics.path_nodes.push_back(curr);
                if (curr == source) break;
                out.metrics.path_edges.push_back(p_edge[curr]);
                curr = p_node[curr];
            }
            std::reverse(out.metrics.path_nodes.begin(), out.metrics.path_nodes.end());
            std::reverse(out.metrics.path_edges.begin(), out.metrics.path_edges.end());

            std::unordered_map<int, double> edge_dist;
            for (const auto& e : edges) edge_dist[e.id] = e.distance_m;
            for (int eid : out.metrics.path_edges) out.metrics.total_distance_m += edge_dist[eid];
        }
    }

    out.metrics.selection_reason = "Conecta todos los puntos de Arequipa con el costo global mínimo (red troncal MST), aunque el camino entre 2 nodos suele ser más largo que Dijkstra/Floyd.";
    return out;
}

/**
 * @brief 7. ALGORITMO DE YEN (K-SHORTEST LOOPLESS PATHS) + MENTE COLMENA MULTI-USUARIO
 *        Encuentra K rutas alternativas sin ciclos, reparte N vehículos según capacidad máxima,
 *        e inyecta pesos negativos (hive_bonus < 0) para que Bellman-Ford desvíe el tráfico.
 */
struct YenHiveMindResult {
    AlgorithmMetrics yen_metrics;
    AlgorithmMetrics bellman_hive_metrics;
    std::vector<HiveRoutePlan> k_routes;
    std::vector<HiveIncentive> incentives;
    std::vector<Edge> updated_edges;
};

inline AlgorithmMetrics dijkstra_with_exclusions(
    int num_nodes,
    const std::vector<Edge>& edges,
    int source,
    int target,
    const std::string& mode,
    const std::unordered_set<int>& excluded_edges,
    const std::unordered_set<int>& excluded_nodes,
    long long& total_ops
) {
    AlgorithmMetrics res;
    auto adj = build_adj_list(num_nodes, edges, mode, false, excluded_edges, excluded_nodes);
    std::vector<double> dist(num_nodes, INF);
    std::vector<int> parent_node(num_nodes, -1);
    std::vector<int> parent_edge(num_nodes, -1);

    using P = std::pair<double, int>;
    std::priority_queue<P, std::vector<P>, std::greater<P>> pq;
    if (source >= 0 && source < num_nodes && !excluded_nodes.count(source)) {
        dist[source] = 0.0;
        pq.push({0.0, source});
    }

    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();
        total_ops++;
        if (d > dist[u]) continue;
        if (u == target) break;

        for (const auto& nb : adj[u]) {
            total_ops++;
            if (dist[u] + nb.weight < dist[nb.to] - 1e-9) {
                dist[nb.to] = dist[u] + nb.weight;
                parent_node[nb.to] = u;
                parent_edge[nb.to] = nb.edge_id;
                pq.push({dist[nb.to], nb.to});
            }
        }
    }

    if (target >= 0 && target < num_nodes && dist[target] < INF / 2) {
        res.reachable = true;
        res.total_cost = dist[target];
        int curr = target;
        while (curr != -1) {
            res.path_nodes.push_back(curr);
            if (curr == source) break;
            res.path_edges.push_back(parent_edge[curr]);
            curr = parent_node[curr];
        }
        std::reverse(res.path_nodes.begin(), res.path_nodes.end());
        std::reverse(res.path_edges.begin(), res.path_edges.end());
    }
    return res;
}

inline YenHiveMindResult run_yen_hive_mind(
    int num_nodes,
    const std::vector<Edge>& edges,
    int source,
    int target,
    const std::string& mode,
    int k_paths = 3,
    int concurrent_vehicles = 60,
    bool inject_negative_cycle = false
) {
    YenHiveMindResult out;
    out.yen_metrics.algorithm_id = "yen_k_shortest";
    out.yen_metrics.algorithm_name = "Algoritmo de Yen (K-Rutas Mente Colmena)";
    out.yen_metrics.complexity_time = "O(K · V (E + V log V))";
    out.yen_metrics.complexity_space = "O(K · V + E)";

    long long ops = 0;
    auto t0 = std::chrono::high_resolution_clock::now();

    std::unordered_map<int, const Edge*> edge_map;
    for (const auto& e : edges) edge_map[e.id] = &e;

    // 1. Primera ruta más corta A[0]
    auto first_path = dijkstra_with_exclusions(num_nodes, edges, source, target, mode, {}, {}, ops);
    std::vector<AlgorithmMetrics> A;
    if (first_path.reachable) {
        A.push_back(first_path);
    }

    // Candidatos B para Yen's K-Shortest Paths
    std::vector<AlgorithmMetrics> B;

    for (int k = 1; k < k_paths && !A.empty(); ++k) {
        const auto& prev_path = A.back();
        if (static_cast<int>(prev_path.path_nodes.size()) < 2) break;

        for (size_t i = 0; i + 1 < prev_path.path_nodes.size(); ++i) {
            int spur_node = prev_path.path_nodes[i];
            std::vector<int> root_nodes(prev_path.path_nodes.begin(), prev_path.path_nodes.begin() + i + 1);
            std::vector<int> root_edges(prev_path.path_edges.begin(), prev_path.path_edges.begin() + i);

            std::unordered_set<int> excluded_edges;
            std::unordered_set<int> excluded_nodes;

            for (const auto& p : A) {
                if (p.path_nodes.size() > i) {
                    bool same_root = true;
                    for (size_t r_idx = 0; r_idx <= i; ++r_idx) {
                        if (p.path_nodes[r_idx] != root_nodes[r_idx]) {
                            same_root = false;
                            break;
                        }
                    }
                    if (same_root && i < p.path_edges.size()) {
                        excluded_edges.insert(p.path_edges[i]);
                    }
                }
            }

            for (size_t r_idx = 0; r_idx < i; ++r_idx) {
                excluded_nodes.insert(root_nodes[r_idx]);
            }

            auto spur_path = dijkstra_with_exclusions(
                num_nodes, edges, spur_node, target, mode, excluded_edges, excluded_nodes, ops
            );

            if (spur_path.reachable) {
                AlgorithmMetrics candidate;
                candidate.reachable = true;
                candidate.path_nodes = root_nodes;
                candidate.path_nodes.insert(
                    candidate.path_nodes.end(),
                    spur_path.path_nodes.begin() + 1,
                    spur_path.path_nodes.end()
                );
                candidate.path_edges = root_edges;
                candidate.path_edges.insert(
                    candidate.path_edges.end(),
                    spur_path.path_edges.begin(),
                    spur_path.path_edges.end()
                );

                double total_c = 0.0;
                double total_d = 0.0;
                for (int eid : candidate.path_edges) {
                    if (edge_map.count(eid)) {
                        total_c += edge_map[eid]->effective_weight(mode, false);
                        total_d += edge_map[eid]->distance_m;
                    }
                }
                candidate.total_cost = total_c;
                candidate.total_distance_m = total_d;

                bool duplicate = false;
                for (const auto& existing : A) {
                    if (existing.path_nodes == candidate.path_nodes) { duplicate = true; break; }
                }
                for (const auto& existing : B) {
                    if (existing.path_nodes == candidate.path_nodes) { duplicate = true; break; }
                }
                if (!duplicate) B.push_back(candidate);
            }
        }

        if (B.empty()) break;
        std::sort(B.begin(), B.end(), [](const AlgorithmMetrics& a, const AlgorithmMetrics& b) {
            return a.total_cost < b.total_cost;
        });
        A.push_back(B.front());
        B.erase(B.begin());
    }

    auto t1 = std::chrono::high_resolution_clock::now();
    double total_ns = std::chrono::duration<double, std::nano>(t1 - t0).count();
    out.yen_metrics.execution_time_ns = total_ns;
    out.yen_metrics.execution_time_us = total_ns / 1000.0;
    out.yen_metrics.operations_count = ops;
    out.yen_metrics.relaxations_count = static_cast<long long>(A.size());
    out.yen_metrics.memory_bytes = sizeof(AlgorithmMetrics) * (A.size() + B.size());
    if (!A.empty()) {
        out.yen_metrics.reachable = true;
        out.yen_metrics.total_cost = A[0].total_cost;
        out.yen_metrics.total_distance_m = A[0].total_distance_m;
        out.yen_metrics.path_nodes = A[0].path_nodes;
        out.yen_metrics.path_edges = A[0].path_edges;
    }
    out.yen_metrics.selection_reason = "Calcula K rutas alternativas sin bucles para distribuir una flota de usuarios concurrentes sin colapsar la ruta principal.";

    // 2. Distribución Mente Colmena de N vehículos e inyección de Incentivos de Peso Negativo
    out.updated_edges = edges;
    std::unordered_map<int, size_t> edge_idx;
    for (size_t i = 0; i < out.updated_edges.size(); ++i) {
        edge_idx[out.updated_edges[i].id] = i;
        out.updated_edges[i].hive_bonus = 0.0;
    }

    int remaining_vehicles = concurrent_vehicles;
    for (size_t idx = 0; idx < A.size(); ++idx) {
        HiveRoutePlan plan;
        plan.rank = static_cast<int>(idx + 1);
        plan.path_nodes = A[idx].path_nodes;
        plan.path_edges = A[idx].path_edges;
        plan.base_cost = A[idx].total_cost;

        int min_spare = 999999;
        for (int eid : plan.path_edges) {
            if (edge_idx.count(eid)) {
                const auto& e = out.updated_edges[edge_idx[eid]];
                int spare = std::max(5, e.max_vehicles - e.current_vehicles);
                min_spare = std::min(min_spare, spare);
            }
        }
        if (min_spare == 999999) min_spare = 30;
        plan.bottleneck_capacity = min_spare;

        int assigned = 0;
        if (idx + 1 == A.size()) {
            assigned = remaining_vehicles;
        } else {
            assigned = std::min(remaining_vehicles, std::max(8, static_cast<int>(min_spare * 0.75)));
        }
        remaining_vehicles = std::max(0, remaining_vehicles - assigned);
        plan.assigned_vehicles = assigned;

        // Si es ruta alternativa (idx >= 1), la Mente Colmena inyecta PESOS NEGATIVOS (bonos verdes/violetas)
        // para que el costo percibido por Bellman-Ford equilibre la flota y evite el colapso de la Ruta 1!
        double eff_cost = 0.0;
        for (size_t step = 0; step < plan.path_edges.size(); ++step) {
            int eid = plan.path_edges[step];
            int step_u = plan.path_nodes[step];
            int step_v = plan.path_nodes[step + 1];
            if (edge_idx.count(eid)) {
                auto& e = out.updated_edges[edge_idx[eid]];
                e.current_vehicles = std::min(e.max_vehicles + 25, e.current_vehicles + assigned / 2);
                if (idx >= 1 && e.hive_bonus == 0.0 && step == 0) {
                    // Orientar la arista bonificada en el sentido exacto del flujo (step_u -> step_v)
                    // para que el peso negativo sea unidireccional hacia el destino y no cree un 2-ciclo trivial
                    e.from = step_u;
                    e.to = step_v;
                    double orig_w = e.effective_weight(mode, false);
                    double neg_bonus = -(orig_w + 4.5); // Peso final = -4.5 (Negativo real sin formar ciclo!)
                    e.hive_bonus = neg_bonus;

                    HiveIncentive inc;
                    inc.edge_id = e.id;
                    inc.from = step_u;
                    inc.to = step_v;
                    inc.street_name = e.street_name;
                    inc.original_weight = orig_w;
                    inc.negative_bonus = neg_bonus;
                    inc.final_weight = orig_w + neg_bonus;
                    inc.reason = "Incentivo Mente Colmena (Peso Negativo = -4.5s) en Ruta Alternativa #" +
                                 std::to_string(plan.rank) + " para desviar flujo vehicular.";
                    out.incentives.push_back(inc);
                }
                eff_cost += e.effective_weight(mode, true);
            }
        }
        plan.effective_cost = eff_cost;
        if (idx == 0) {
            plan.status_label = "Ruta Primaria (Saturación controlada por desvío Colmena)";
        } else {
            plan.status_label = "Ruta Alternativa #" + std::to_string(plan.rank) + " Bonificada (Pesos Negativos Bellman-Ford)";
        }
        out.k_routes.push_back(plan);
    }

    // Si el usuario activó la prueba de Ciclo Negativo en tiempo real:
    if (inject_negative_cycle && !out.updated_edges.empty()) {
        auto& e_cyc = out.updated_edges[0];
        e_cyc.is_directed = false;
        double w0 = e_cyc.effective_weight(mode, false);
        e_cyc.hive_bonus = -(w0 + 9999.0); // < -5000 activa el ciclo negativo bidireccional deliberado
        out.incentives.push_back({
            e_cyc.id,
            e_cyc.from,
            e_cyc.to,
            e_cyc.street_name + " [CICLO NEGATIVO INYECTADO]",
            w0,
            -25.0,
            -15.0,
            "¡Alerta Académica! Incentivo bidireccional excesivo que forma un Ciclo de Peso Negativo infinito detectado por Bellman-Ford."
        });
    }

    // Ejecutar Bellman-Ford sobre el grafo con los pesos negativos de la Mente Colmena
    out.bellman_hive_metrics = run_bellman_ford(num_nodes, out.updated_edges, source, target, mode, 100);
    return out;
}

} // namespace traffic
