const fs = require('fs');
const path = '/opt/geronimo-v2/backend/src/integrations/api/controllers/github-oauth.controller.ts';

let content = fs.readFileSync(path, 'utf8');

// Reemplazar la sección del redirect con una versión simplificada
const oldCode = ;

const newCode = ;

content = content.replace(oldCode, newCode);

// También reemplazar la parte del error
const oldError = ;

const newError = ;

content = content.replace(oldError, newError);

fs.writeFileSync(path, content, 'utf8');
console.log('Archivo actualizado correctamente');
