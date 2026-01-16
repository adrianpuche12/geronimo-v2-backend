/**
 * CAPA 4: Prompt Engine - ResponseFormatter
 * 
 * Extrae datos estructurados de las respuestas de la IA según el modo.
 * Permite al frontend renderizar gráficos, tablas y recomendaciones.
 */

import { AnalysisMode } from '../prompt.builder';

export interface ChartData {
  type: 'bar' | 'pie' | 'line';
  data: Record<string, number>;
  unit?: string;
  title: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  title?: string;
}

export interface Metric {
  name: string;
  value: string;
  benchmark?: string;
  status: 'good' | 'warning' | 'critical';
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  timeframe: 'short' | 'medium' | 'long';
  description: string;
  cost?: string;
  benefit?: string;
  effort?: string;
}

export interface FormattedResponse {
  mode: AnalysisMode;
  content: string;
  charts?: ChartData[];
  tables?: TableData[];
  metrics?: Metric[];
  recommendations?: Recommendation[];
}

export class ResponseFormatter {
  /**
   * Formatea la respuesta según el modo
   */
  static format(
    rawResponse: string,
    mode: AnalysisMode
  ): FormattedResponse {
    
    const formatted: FormattedResponse = {
      mode,
      content: rawResponse
    };

    switch (mode) {
      case 'stats':
        formatted.charts = this.extractCharts(rawResponse);
        formatted.tables = this.extractTables(rawResponse);
        formatted.metrics = this.extractMetrics(rawResponse);
        break;

      case 'business':
        formatted.recommendations = this.extractRecommendations(rawResponse);
        formatted.tables = this.extractTables(rawResponse);
        break;

      case 'general':
      default:
        // Modo general: solo contenido limpio
        break;
    }

    return formatted;
  }

  /**
   * Extrae bloques JSON de gráficos del texto
   */
  private static extractCharts(text: string): ChartData[] {
    const charts: ChartData[] = [];

    // Buscar bloques ```json
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
    let match;

    while ((match = jsonBlockRegex.exec(text)) !== null) {
      try {
        const jsonData = JSON.parse(match[1]);

        // Validar que sea un gráfico válido
        if (jsonData.type && jsonData.data) {
          charts.push({
            type: jsonData.type,
            data: jsonData.data,
            unit: jsonData.unit,
            title: jsonData.title || 'Chart'
          });
        }
      } catch (error) {
        console.error('Error parsing chart JSON:', error);
      }
    }

    return charts;
  }

  /**
   * Extrae tablas markdown del texto
   */
  private static extractTables(text: string): TableData[] {
    const tables: TableData[] = [];

    // Regex para tablas markdown
    const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
    let match;

    while ((match = tableRegex.exec(text)) !== null) {
      const headers = match[1].split('|')
        .map(h => h.trim())
        .filter(h => h.length > 0);

      const rowsText = match[2];
      const rows = rowsText.split('\n')
        .filter(r => r.trim().length > 0)
        .map(row =>
          row.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0)
        );

      if (headers.length > 0 && rows.length > 0) {
        tables.push({ headers, rows });
      }
    }

    return tables;
  }

  /**
   * Extrae métricas del texto (modo stats)
   */
  private static extractMetrics(text: string): Metric[] {
    const metrics: Metric[] = [];

    // Buscar tabla de "Métricas Clave"
    const metricsSection = text.match(/### Métricas Clave\s*\n\n([\s\S]*?)(?=\n#|$)/);

    if (metricsSection) {
      const tableData = this.extractTables(metricsSection[1]);

      if (tableData.length > 0) {
        const table = tableData[0];

        table.rows.forEach(row => {
          if (row.length >= 3) {
            let status: 'good' | 'warning' | 'critical' = 'good';
            const lastCell = row[row.length - 1];

            if (lastCell.includes('✅')) status = 'good';
            else if (lastCell.includes('⚠️')) status = 'warning';
            else if (lastCell.includes('❌')) status = 'critical';

            metrics.push({
              name: row[0],
              value: row[1],
              benchmark: row[2],
              status
            });
          }
        });
      }
    }

    return metrics;
  }

  /**
   * Extrae recomendaciones del texto (modo business)
   */
  private static extractRecommendations(text: string): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Buscar secciones de recomendaciones
    const timeframes = [
      { key: 'short', regex: /#### 🎯 Corto Plazo.*?\n\n([\s\S]*?)(?=####|###|$)/ },
      { key: 'medium', regex: /#### 🎯 Mediano Plazo.*?\n\n([\s\S]*?)(?=####|###|$)/ },
      { key: 'long', regex: /#### 🎯 Largo Plazo.*?\n\n([\s\S]*?)(?=####|###|$)/ }
    ];

    timeframes.forEach(({ key, regex }) => {
      const match = text.match(regex);
      if (match) {
        const section = match[1];

        // Extraer items numerados
        const itemRegex = /\d+\.\s+\*\*(.*?)\*\*\s+\[Prioridad:\s+(ALTA|MEDIA|BAJA)\]([\s\S]*?)(?=\n\d+\.|$)/g;
        let itemMatch;

        while ((itemMatch = itemRegex.exec(section)) !== null) {
          const description = itemMatch[1].trim();
          const priorityText = itemMatch[2];
          const priority = priorityText === 'ALTA' ? 'high' : 
                          priorityText === 'MEDIA' ? 'medium' : 'low';
          const details = itemMatch[3];

          // Extraer costo y beneficio
          const costMatch = details.match(/Costo:\s+([\$\w\s,.-]+)/);
          const benefitMatch = details.match(/Beneficio:\s+([\w\s%$,.-]+)/);
          const effortMatch = details.match(/Tiempo:\s+([\w\s]+)/);

          recommendations.push({
            priority,
            timeframe: key as 'short' | 'medium' | 'long',
            description,
            cost: costMatch ? costMatch[1].trim() : undefined,
            benefit: benefitMatch ? benefitMatch[1].trim() : undefined,
            effort: effortMatch ? effortMatch[1].trim() : undefined
          });
        }
      }
    });

    return recommendations;
  }

  /**
   * Validar que la respuesta tiene el formato esperado según el modo
   */
  static validate(formatted: FormattedResponse): boolean {
    switch (formatted.mode) {
      case 'stats':
        // Debe tener al menos 1 tabla o 1 gráfico
        return (formatted.tables && formatted.tables.length > 0) ||
               (formatted.charts && formatted.charts.length > 0);

      case 'business':
        // Debe tener al menos 1 tabla (ROI)
        return (formatted.tables && formatted.tables.length > 0);

      case 'general':
      default:
        // Solo debe tener contenido
        return formatted.content && formatted.content.length > 0;
    }
  }
}
