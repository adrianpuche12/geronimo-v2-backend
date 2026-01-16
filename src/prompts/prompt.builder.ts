/**
 * CAPA 4: Prompt Engine - PromptBuilder
 * 
 * Clase principal que orquesta la construcción de prompts según el modo de análisis.
 * Centraliza la lógica de selección de templates y configuración de parámetros.
 */

import { buildGeneralPrompt } from './templates/general.template';
import { buildStatsPrompt } from './templates/stats.template';
import { buildBusinessPrompt } from './templates/business.template';

export type AnalysisMode = 'general' | 'stats' | 'business';

export interface PromptConfig {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}

export class PromptBuilder {
  /**
   * Construye el prompt completo según el modo seleccionado
   * 
   * @param question - Pregunta del usuario
   * @param context - Contexto documental recuperado
   * @param mode - Modo de análisis (general, stats, business)
   * @param isMultiProject - Si el contexto proviene de múltiples proyectos
   * @returns Configuración completa del prompt
   */
  static buildPrompt(
    question: string,
    context: string,
    mode: AnalysisMode = 'general',
    isMultiProject: boolean = false
  ): PromptConfig {
    
    let config: PromptConfig;

    // Seleccionar template según modo
    switch (mode) {
      case 'general':
        config = buildGeneralPrompt(question, context);
        break;

      case 'stats':
        config = buildStatsPrompt(question, context);
        break;

      case 'business':
        config = buildBusinessPrompt(question, context);
        break;

      default:
        // Fallback a general si el modo no es reconocido
        console.warn(`Modo desconocido: ${mode}. Usando modo 'general' por defecto.`);
        config = buildGeneralPrompt(question, context);
    }

    // Si es multi-proyecto, agregar contexto adicional al system prompt
    if (isMultiProject) {
      config.systemPrompt += `\n\nNOTA IMPORTANTE: El contexto proporcionado proviene de MÚLTIPLES PROYECTOS.
Asegúrate de mencionar de qué proyecto proviene cada insight cuando sea relevante
para evitar confusión. Si un dato o información específica pertenece a un proyecto
particular, indícalo claramente.`;
    }

    return config;
  }

  /**
   * Obtener configuración de temperatura según modo
   * 
   * La temperatura controla la aleatoriedad de las respuestas:
   * - 0.0 = Determinístico (siempre la misma respuesta)
   * - 1.0 = Muy creativo (respuestas variadas)
   * 
   * @param mode - Modo de análisis
   * @returns Valor de temperatura (0.0 - 1.0)
   */
  static getTemperatureForMode(mode: AnalysisMode): number {
    switch (mode) {
      case 'general':
        return 0.7;  // Balance creatividad/precisión
      case 'stats':
        return 0.3;  // Más determinístico (datos precisos)
      case 'business':
        return 0.5;  // Balance con sesgo a precisión
      default:
        return 0.7;
    }
  }

  /**
   * Obtener max tokens según modo
   * 
   * Max tokens limita la longitud de la respuesta:
   * - general: 2000 tokens (~1500 palabras)
   * - stats: 3000 tokens (~2250 palabras, incluye tablas/gráficos)
   * - business: 4000 tokens (~3000 palabras, análisis completo)
   * 
   * @param mode - Modo de análisis
   * @returns Número máximo de tokens
   */
  static getMaxTokensForMode(mode: AnalysisMode): number {
    switch (mode) {
      case 'general':
        return 2000;  // Respuesta narrativa media
      case 'stats':
        return 3000;  // Tablas + gráficos requieren más tokens
      case 'business':
        return 4000;  // Análisis completo más extenso
      default:
        return 2000;
    }
  }

  /**
   * Validar que el modo es válido
   * 
   * @param mode - Modo a validar
   * @returns true si el modo es válido
   */
  static isValidMode(mode: string): mode is AnalysisMode {
    return ['general', 'stats', 'business'].includes(mode);
  }

  /**
   * Obtener descripción del modo
   * 
   * @param mode - Modo de análisis
   * @returns Descripción legible del modo
   */
  static getModeDescription(mode: AnalysisMode): string {
    switch (mode) {
      case 'general':
        return 'Análisis general narrativo y explicativo';
      case 'stats':
        return 'Análisis cuantitativo con métricas y gráficos';
      case 'business':
        return 'Análisis estratégico orientado a decisiones de negocio';
      default:
        return 'Modo desconocido';
    }
  }
}
