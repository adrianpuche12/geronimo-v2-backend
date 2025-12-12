import { Injectable } from '@nestjs/common';

export interface SecretMatch {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface SecretDetectionResult {
  hasSecrets: boolean;
  secrets: SecretMatch[];
  censoredContent: string;
  originalContent: string;
}

@Injectable()
export class SecretsDetectorService {
  // Patrones de detección de secretos
  private readonly patterns = [
    {
      name: 'API Key',
      regex: /(?:api[_-]?key|apikey|api[_-]?token)[\s:=]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
      confidence: 'high' as const,
    },
    {
      name: 'AWS Key',
      regex: /AKIA[0-9A-Z]{16}/g,
      confidence: 'high' as const,
    },
    {
      name: 'Private Key',
      regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
      confidence: 'high' as const,
    },
    {
      name: 'Password',
      regex: /(?:password|passwd|pwd)[\s:=]+['"]?([^\s'"]{6,})['"]?/gi,
      confidence: 'medium' as const,
    },
    {
      name: 'Password',
      // Detecta passwords en tablas markdown
      // Patrones comunes: T9#xL4@mP6!wN8vQ2, R4&tY6!bG3%hJ9sM1, Jorge123!
      // Contiene mix de letras+números+especiales, NO es email ni separador
      regex: /\|\s*([A-Za-z0-9]+[!@#$%^&*()_+=\[\]{};':"\\<>\/?]+[A-Za-z0-9!@#$%^&*()_+=\[\]{};':"\\<>\/?]*)\s*\|/g,
      confidence: 'medium' as const,
    },
    {
      name: 'JWT Token',
      regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
      confidence: 'high' as const,
    },
    {
      name: 'Bearer Token',
      regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
      confidence: 'high' as const,
    },
    {
      name: 'Database URL',
      regex: /(?:mongodb|mysql|postgresql|postgres):\/\/[^\s'"]+/gi,
      confidence: 'high' as const,
    },
    {
      name: 'Email Password',
      regex: /(?:smtp|email)[_-]?(?:password|passwd)[\s:=]+['"]?([^\s'"]{6,})['"]?/gi,
      confidence: 'high' as const,
    },
    {
      name: 'Generic Secret',
      regex: /(?:secret|token|credentials?)[\s:=]+['"]?([a-zA-Z0-9_\-]{16,})['"]?/gi,
      confidence: 'medium' as const,
    },
  ];

  /**
   * Detecta secretos en un texto
   */
  detectSecrets(content: string): SecretDetectionResult {
    const secrets: SecretMatch[] = [];
    let censoredContent = content;

    for (const pattern of this.patterns) {
      const matches = content.matchAll(pattern.regex);
      
      for (const match of matches) {
        const fullMatch = match[0];
        const startIndex = match.index || 0;
        const endIndex = startIndex + fullMatch.length;

        secrets.push({
          type: pattern.name,
          value: fullMatch,
          startIndex,
          endIndex,
          confidence: pattern.confidence,
        });

        // Censurar el contenido
        const censorText = `[*** ${pattern.name.toUpperCase()} REDACTED ***]`;
        censoredContent = censoredContent.replace(fullMatch, censorText);
      }
    }

    return {
      hasSecrets: secrets.length > 0,
      secrets,
      censoredContent,
      originalContent: content,
    };
  }

  /**
   * Censura selectivamente según confianza
   */
  censorByConfidence(
    content: string,
    minConfidence: 'low' | 'medium' | 'high' = 'medium',
  ): string {
    const result = this.detectSecrets(content);
    
    if (!result.hasSecrets) {
      return content;
    }

    let censored = content;
    const confidenceLevels = { low: 1, medium: 2, high: 3 };
    const minLevel = confidenceLevels[minConfidence];

    for (const secret of result.secrets) {
      const secretLevel = confidenceLevels[secret.confidence];
      
      if (secretLevel >= minLevel) {
        const censorText = `[*** ${secret.type.toUpperCase()} REDACTED ***]`;
        censored = censored.replace(secret.value, censorText);
      }
    }

    return censored;
  }

  /**
   * Obtiene estadísticas de secretos detectados
   */
  getSecretStats(content: string): {
    total: number;
    byType: Record<string, number>;
    byConfidence: Record<string, number>;
  } {
    const result = this.detectSecrets(content);
    
    const byType: Record<string, number> = {};
    const byConfidence: Record<string, number> = { low: 0, medium: 0, high: 0 };

    for (const secret of result.secrets) {
      byType[secret.type] = (byType[secret.type] || 0) + 1;
      byConfidence[secret.confidence]++;
    }

    return {
      total: result.secrets.length,
      byType,
      byConfidence,
    };
  }
}
