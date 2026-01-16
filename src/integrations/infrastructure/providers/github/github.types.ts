/**
 * Configuración del GitHub Provider
 */
export interface GitHubConfig {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;

  // Configuración de sincronización
  repos: string[];  // Array de repos en formato 'owner/repo'
  syncReadme?: boolean;  // Sincronizar README (default: true)
  syncDocs?: boolean;  // Sincronizar carpeta docs/ (default: true)
  syncCommits?: boolean;  // Sincronizar commits (default: true)
  syncIssues?: boolean;  // Sincronizar issues (default: true)
  syncPullRequests?: boolean;  // Sincronizar PRs (default: true)
  maxCommits?: number;  // Máximo commits por repo (default: 100)
  maxIssues?: number;  // Máximo issues por repo (default: 100)
  maxPRs?: number;  // Máximo PRs por repo (default: 50)
}

/**
 * Metadata de GitHub almacenada en integration_items
 */
export interface GitHubItemMetadata {
  owner: string;  // Propietario del repo
  repo: string;   // Nombre del repo
  type: 'readme' | 'doc' | 'commit' | 'issue' | 'pull_request';  // Tipo de item
  path?: string;  // Path del archivo (para readme/docs)
  sha?: string;   // SHA del commit/archivo
  number?: number;  // Número de issue/PR
  state?: string;  // Estado (open, closed, merged)
  author?: {
    login: string;
    avatarUrl?: string;
  };
  labels?: string[];  // Labels de issue/PR
  htmlUrl?: string;  // URL pública del item
  createdAt?: string;  // Fecha de creación en GitHub
  updatedAt?: string;  // Última actualización en GitHub
}

/**
 * Respuesta de la API de GitHub (README)
 */
export interface GitHubReadmeResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;  // Base64 encoded
  encoding: string;
  download_url: string;
  html_url: string;
}

/**
 * Respuesta de la API de GitHub (Commit)
 */
export interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
}

/**
 * Respuesta de la API de GitHub (Issue)
 */
export interface GitHubIssueResponse {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
  html_url: string;
}

/**
 * Respuesta de la API de GitHub (Pull Request)
 */
export interface GitHubPullRequestResponse {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
}

/**
 * Respuesta de la API de GitHub (Contents)
 */
export interface GitHubContentResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string;  // Base64 encoded (solo para files)
  encoding?: string;
  download_url?: string;
  html_url: string;
}
