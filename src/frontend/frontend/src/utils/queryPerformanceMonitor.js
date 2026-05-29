/**
 * QueryPerformanceMonitor - мониторинг производительности GraphQL запросов
 * 
 * Отслеживает:
 * - Размер запросов/ответов
 * - Время выполнения
 * - Количество запросов
 * - Эффективность кэша
 */

class QueryPerformanceMonitor {
    constructor() {
        this.stats = {
            totalQueries: 0,
            totalSize: 0,
            cacheHits: 0,
            cacheMisses: 0,
            networkRequests: 0,
            averageLatency: 0,
            queries: {},
        };
        this.queryTimes = [];
    }

    /**
     * Записать выполненный запрос
     */
    recordQuery(queryName, sizeMB, latencyMs, fromCache = false) {
        this.stats.totalQueries++;
        this.stats.totalSize += sizeMB;
        
        if (fromCache) {
            this.stats.cacheHits++;
        } else {
            this.stats.cacheMisses++;
            this.stats.networkRequests++;
        }

        this.queryTimes.push(latencyMs);
        
        // Вычислить среднюю латенцию последних 20 запросов
        const recent = this.queryTimes.slice(-20);
        this.stats.averageLatency = 
            Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);

        // Группировать по типу запроса
        if (!this.stats.queries[queryName]) {
            this.stats.queries[queryName] = {
                count: 0,
                totalSize: 0,
                totalLatency: 0,
                cacheHits: 0,
            };
        }

        const queryStats = this.stats.queries[queryName];
        queryStats.count++;
        queryStats.totalSize += sizeMB;
        queryStats.totalLatency += latencyMs;
        if (fromCache) queryStats.cacheHits++;
    }

    /**
     * Получить статистику кэша
     */
    getCacheStats() {
        const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
        const hitRate = totalRequests > 0 
            ? Math.round((this.stats.cacheHits / totalRequests) * 100) 
            : 0;

        return {
            cacheHits: this.stats.cacheHits,
            cacheMisses: this.stats.cacheMisses,
            hitRate: `${hitRate}%`,
            totalRequests,
        };
    }

    /**
     * Получить худшие запросы (по латенции)
     */
    getSlowQueries(limit = 5) {
        return Object.entries(this.stats.queries)
            .map(([name, stats]) => ({
                name,
                avgLatency: Math.round(stats.totalLatency / stats.count),
                count: stats.count,
                totalSize: stats.totalSize.toFixed(2),
                cacheHitRate: stats.count > 0 
                    ? Math.round((stats.cacheHits / stats.count) * 100) 
                    : 0,
            }))
            .sort((a, b) => b.avgLatency - a.avgLatency)
            .slice(0, limit);
    }

    /**
     * Получить полную статистику
     */
    getReport() {
        return {
            summary: {
                totalQueries: this.stats.totalQueries,
                totalDataMB: this.stats.totalSize.toFixed(2),
                networkRequests: this.stats.networkRequests,
                averageLatency: `${this.stats.averageLatency}ms`,
                ...this.getCacheStats(),
            },
            slowQueries: this.getSlowQueries(),
            byQuery: Object.entries(this.stats.queries)
                .map(([name, stats]) => ({
                    name,
                    count: stats.count,
                    avgLatency: Math.round(stats.totalLatency / stats.count),
                    totalSize: stats.totalSize.toFixed(2),
                }))
                .sort((a, b) => b.count - a.count),
        };
    }

    /**
     * Вывести отчет в консоль (красиво)
     */
    printReport() {
        const report = this.getReport();
        
        console.group('📊 Query Performance Report');
        
        console.table(report.summary);
        
        console.group('🐌 Slow Queries');
        console.table(report.slowQueries);
        console.groupEnd();
        
        console.group('📈 By Query Type');
        console.table(report.byQuery);
        console.groupEnd();
        
        console.groupEnd();
    }

    /**
     * Сбросить статистику
     */
    reset() {
        this.stats = {
            totalQueries: 0,
            totalSize: 0,
            cacheHits: 0,
            cacheMisses: 0,
            networkRequests: 0,
            averageLatency: 0,
            queries: {},
        };
        this.queryTimes = [];
    }
}

export const queryMonitor = new QueryPerformanceMonitor();

/**
 * Apollo Link для автоматического мониторинга
 * 
 * Использование:
 * const client = new ApolloClient({
 *     link: from([monitoringLink, authLink, httpLink]),
 *     ...
 * });
 */
import { ApolloLink } from '@apollo/client';

export const createMonitoringLink = () => {
    return new ApolloLink((operation, forward) => {
        const startTime = performance.now();
        const operationName = operation.operationName || 'Unknown';

        return forward(operation).map(response => {
            const endTime = performance.now();
            const latency = endTime - startTime;

            // Вычислить размер ответа
            const responseSize = new Blob([JSON.stringify(response)]).size / 1024 / 1024;

            // Определить был ли это cache hit
            const fromCache = response.extensions?.fromCache || false;

            // Записать метрику
            queryMonitor.recordQuery(operationName, responseSize, latency, fromCache);

            // Логировать если медленно (> 1 сек)
            if (latency > 1000) {
                console.warn(
                    `⚠️ Slow query: ${operationName} took ${latency.toFixed(0)}ms, ` +
                    `Size: ${responseSize.toFixed(2)}MB, Cache: ${fromCache}`
                );
            }

            return response;
        });
    });
};

export default queryMonitor;
