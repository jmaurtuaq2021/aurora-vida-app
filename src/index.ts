import { crearApp, VERSION } from './app';
import { leerConfig } from './comun/config';

const config = leerConfig();
const { app } = crearApp(config);

app.listen(config.puerto, () => {
  const bugs = config.bugs.size ? [...config.bugs].join(',') : 'ninguno';
  console.log(`Aurora Vida API ${VERSION} | modo=${config.modo} | bugs=${bugs}`);
  console.log(`API:      http://localhost:${config.puerto}/api/v1`);
  console.log(`Swagger:  http://localhost:${config.puerto}/api-docs`);
});
