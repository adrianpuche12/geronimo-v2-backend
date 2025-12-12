/**
 * Setup global para todos los tests
 * Este archivo se ejecuta antes de cada test suite
 */

// Extender timeout para tests que llaman APIs externas
jest.setTimeout(10000);

// Mock console.log para tests más limpios (opcional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };

// Variables globales para tests
global.testTimeout = 5000;

// Setup antes de todos los tests
beforeAll(() => {
  console.log('🧪 Iniciando suite de tests de Geronimo 2.0');
});

// Cleanup después de todos los tests
afterAll(() => {
  console.log('✅ Suite de tests completada');
});

// Cleanup después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
