# Geronimo V2 - Backend

Backend de Geronimo V2 construido con Clean Architecture y NestJS.

## 🚀 Estado del Proyecto

- ✅ CAPA 1 (AI Engine) - Implementada
- ✅ CAPA 2 (Persistencia Multi-Tenant) - Implementada
- ⏳ CAPA 3-7 - Pendientes

## 🧪 Tests

- **8 tests** pasando (4 unit + 3 integration + 1 controller)
- **Cobertura:** CAPA 1 y CAPA 2 completamente testeadas

## 🛠️ Stack Tecnológico

- **Framework:** NestJS + TypeScript
- **AI Providers:** OpenAI, Groq, Ollama
- **Database:** PostgreSQL (multi-tenant con schema-per-tenant)
- **Cache:** Redis (Upstash)
- **Storage:** Backblaze B2
- **CI/CD:** GitHub Actions

## 📦 Instalación

```bash
npm install
npm run build
npm test
```

## 🔧 Variables de Entorno

Ver archivo `.env` para la configuración completa.

## 📊 CI/CD Pipeline

El proyecto incluye un pipeline de GitHub Actions que:
- ✅ Ejecuta tests automáticamente
- ✅ Valida compilación TypeScript
- ✅ Genera reportes de cobertura
- ✅ Deploy automático a desarrollo (rama develop)

---

**Generado con Claude Code** 🤖
