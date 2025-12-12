module.exports = {
  // Extensiones de módulos
  moduleFileExtensions: ['js', 'json', 'ts'],

  // 🔍 Encuentra archivos .spec.ts en src/
  testRegex: '.*\.spec\.ts$',

  // ⚙️ Transforma TypeScript con ts-jest
  transform: {
    '^.+\.(t|j)s$': 'ts-jest',
  },

  // 📊 Configuración de cobertura
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',           // Excluir tests
    '!src/**/*.interface.ts',       // Excluir interfaces
    '!src/**/*.dto.ts',             // Excluir DTOs
    '!src/main.ts',                 // Excluir entry point
    '!src/scripts/**',              // Excluir scripts
  ],

  // 📁 Directorio de reportes de cobertura
  coverageDirectory: './coverage',

  // 🎯 Umbrales de cobertura
  coverageThreshold: {
    global: {
      branches: 70,      // 70% de ramas cubiertas
      functions: 75,     // 75% de funciones cubiertas
      lines: 80,         // 80% de líneas cubiertas
      statements: 80,    // 80% de statements cubiertos
    },
    // Umbrales específicos por carpeta
    './src/ai/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // 🌍 Ambiente de ejecución
  testEnvironment: 'node',

  // 📂 Directorios raíz
  roots: ['<rootDir>/src', '<rootDir>/test'],

  // 🗺️ Mapeo de módulos
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/',
    '^test/(.*)$': '<rootDir>/test/',
  },

  // ⏱️ Timeout por defecto (5 segundos)
  testTimeout: 5000,

  // 🔧 Setup global
  setupFilesAfterEnv: ['<rootDir>/test/helpers/test-setup.ts'],

  // 📊 Reporteros
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Geronimo 2.0 - Test Report',
        outputPath: './coverage/test-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
        theme: 'darkTheme',
      },
    ],
  ],

  // 🔇 Silenciar deprecation warnings
  silent: false,

  // 📈 Mostrar progreso
  verbose: true,
};
