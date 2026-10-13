import { crearApp, VERSION } from './app';
import { leerConfig } from './comun/config';

const config = leerConfig();
const { app } = crearApp(config);

app.listen(config.puerto, () => {
  const lista = (s: Set<string>, vacio: string) => (s.has('*') ? 'todas' : s.size ? [...s].join(',') : vacio);
  console.log(
    `Aurora Vida API ${VERSION} | ambiente=${config.ambiente} | modo=${config.modo}` +
      ` | historias=${lista(config.funcionalidades, 'ninguna')} | bugs=${lista(config.bugs, 'ninguno')}`,
  );
  console.log(`API:      http://localhost:${config.puerto}/api/v1`);
  console.log(`Swagger:  http://localhost:${config.puerto}/api-docs`);
});
