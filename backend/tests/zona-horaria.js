// Zona horaria de las pruebas (regla 8 del plan). Se fija en el código porque el
// prefijo TZ=... de npm no funciona en Windows. Lo carga Jest antes de cada suite
// (jest.setupFiles en package.json).
process.env.TZ = 'America/Argentina/Buenos_Aires';
