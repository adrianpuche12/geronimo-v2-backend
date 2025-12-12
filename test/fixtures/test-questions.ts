/**
 * Preguntas de prueba para tests de AI
 */

export const testQuestions = {
  // Preguntas simples
  simple: 'How does authentication work?',
  simpleJWT: 'What are the JWT token validity periods?',
  simpleLogin: 'What is the login endpoint?',

  // Preguntas complejas
  complex: 'Explain the multi-tenant architecture and its benefits',
  complexSecurity: 'Analyze the security measures in the authentication system',
  complexScaling: 'How does the system handle scaling for multiple tenants?',

  // Preguntas técnicas
  technical: 'What database is used and how is data isolated per tenant?',
  technicalAPI: 'List all the API endpoints for project management',
  technicalBackup: 'What is the backup strategy for the database?',

  // Preguntas de análisis
  analysis: 'What are the strengths and weaknesses of this authentication approach?',
  analysisPerformance: 'Identify potential performance bottlenecks in this architecture',
  analysisImprovements: 'Suggest improvements for the tenant isolation strategy',

  // Preguntas específicas
  specific: 'How long do access tokens last?',
  specificEndpoint: 'What endpoint is used for refreshing tokens?',
  specificStorage: 'Where are JWT tokens stored?',

  // Preguntas ambiguas
  ambiguous: 'Tell me about the system',
  ambiguousGeneral: 'How does it work?',

  // Preguntas fuera de contexto
  outOfContext: 'What is machine learning?',
  outOfContextPython: 'How do I write a for loop in Python?',

  // Preguntas vacías/edge cases
  empty: '',
  whitespace: '   ',
  veryLong: 'This is a very long question that contains many words and goes on and on to test how the system handles extremely long input. '.repeat(50),

  // Preguntas multi-proyecto
  multiProject: 'Compare the authentication approaches across all projects',
  multiProjectDatabase: 'What databases are used in different projects?',
};

export default testQuestions;
