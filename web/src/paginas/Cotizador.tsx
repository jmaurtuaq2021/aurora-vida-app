import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ErrorApi, type Cotizacion, type Plazo } from '../api';
import { enSoles, enSolesEnteros, fechaCorta, SUMAS_ASEGURADAS } from '../formato';

type Campo = 'fechaNacimiento' | 'fumador' | 'sumaAsegurada' | 'plazo';
type Errores = Partial<Record<Campo, string>>;

const CAMPOS: Campo[] = ['fechaNacimiento', 'fumador', 'sumaAsegurada', 'plazo'];

const OBLIGATORIO: Record<Campo, string> = {
  fechaNacimiento: 'Ingresa tu fecha de nacimiento.',
  fumador: 'Indica si fumas.',
  sumaAsegurada: 'Elige la suma asegurada.',
  plazo: 'Elige el plazo.',
};

// id del control que recibe el foco cuando su campo tiene error
const CONTROL: Record<Campo, string> = {
  fechaNacimiento: 'fecha-nacimiento',
  fumador: 'fumador-si',
  sumaAsegurada: 'suma-asegurada',
  plazo: 'plazo',
};

const hoy = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export function Cotizador() {
  const navigate = useNavigate();
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [fumador, setFumador] = useState<'' | 'si' | 'no'>('');
  const [sumaAsegurada, setSumaAsegurada] = useState('');
  const [plazo, setPlazo] = useState('');

  const [plazos, setPlazos] = useState<Plazo[]>([]);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);

  const tituloResultado = useRef<HTMLHeadingElement>(null);
  const alerta = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .plazos()
      .then(setPlazos)
      .catch(() => setErrorGeneral('No pudimos cargar los plazos disponibles. Recarga la página.'));
  }, []);

  useEffect(() => {
    if (cotizacion) tituloResultado.current?.focus();
  }, [cotizacion]);

  /** Al cambiar un dato, la cotización mostrada deja de corresponder y se quita. */
  const alCambiar = (campo: Campo) => {
    setErrores((e) => ({ ...e, [campo]: undefined }));
    setErrorGeneral(null);
    setCotizacion(null);
  };

  const enfocar = (campo: Campo) => document.getElementById(CONTROL[campo])?.focus();

  async function calcular(evento: FormEvent) {
    evento.preventDefault();
    setErrorGeneral(null);

    const faltantes: Errores = {};
    if (!fechaNacimiento) faltantes.fechaNacimiento = OBLIGATORIO.fechaNacimiento;
    if (!fumador) faltantes.fumador = OBLIGATORIO.fumador;
    if (!sumaAsegurada) faltantes.sumaAsegurada = OBLIGATORIO.sumaAsegurada;
    if (!plazo) faltantes.plazo = OBLIGATORIO.plazo;
    setErrores(faltantes);
    const primero = CAMPOS.find((c) => faltantes[c]);
    if (primero) {
      enfocar(primero);
      return;
    }

    setCargando(true);
    try {
      const resultado = await api.cotizar({
        fechaNacimiento,
        fumador: fumador === 'si',
        sumaAsegurada: Number(sumaAsegurada),
        plazo: Number(plazo),
      });
      setCotizacion(resultado);
    } catch (e) {
      const error = e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR_INESPERADO', 'No pudimos calcular tu prima.');
      const porCampo: Errores = {};
      for (const d of error.detalles) {
        if ((CAMPOS as string[]).includes(d.campo)) porCampo[d.campo as Campo] = d.mensaje;
      }
      if (Object.keys(porCampo).length) {
        setErrores(porCampo);
        enfocar(CAMPOS.find((c) => porCampo[c])!);
      } else {
        setErrorGeneral(error.message);
        requestAnimationFrame(() => alerta.current?.focus());
      }
    } finally {
      setCargando(false);
    }
  }

  function contratar() {
    if (!cotizacion) return;
    try {
      sessionStorage.setItem('aurora.cotizacionId', cotizacion.id);
    } catch {
      /* sin almacenamiento: la cotización viaja en la URL */
    }
    navigate(`/ingresar?cotizacion=${cotizacion.id}`);
  }

  const descripcion = (campo: Campo, ayuda?: string) =>
    [ayuda && `${CONTROL[campo]}-ayuda`, errores[campo] && `${CONTROL[campo]}-error`].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="cotizador">
      <section className="formulario-zona" aria-labelledby="titulo-cotizador">
        <h1 id="titulo-cotizador" className="titular">
          ¿Cuánto cuesta proteger a tu familia?
        </h1>
        <p className="entrada">Cotiza tu seguro de vida temporal en un minuto, sin registrarte.</p>

        <form className="formulario" onSubmit={calcular} noValidate data-testid="cotizador-formulario">
          {errorGeneral && (
            <div
              className="alerta"
              role="alert"
              tabIndex={-1}
              ref={alerta}
              data-testid="cotizador-error-msg"
            >
              {errorGeneral}
            </div>
          )}

          <div className={`campo ${errores.fechaNacimiento ? 'con-error' : ''}`}>
            <label htmlFor="fecha-nacimiento">Fecha de nacimiento</label>
            <input
              id="fecha-nacimiento"
              type="date"
              max={hoy()}
              value={fechaNacimiento}
              onChange={(e) => {
                setFechaNacimiento(e.target.value);
                alCambiar('fechaNacimiento');
              }}
              aria-invalid={!!errores.fechaNacimiento}
              aria-describedby={descripcion('fechaNacimiento')}
              data-testid="cotizador-fecha-nacimiento-input"
            />
            {errores.fechaNacimiento && (
              <p id="fecha-nacimiento-error" className="error-campo" data-testid="cotizador-fecha-nacimiento-error-msg">
                {errores.fechaNacimiento}
              </p>
            )}
          </div>

          <fieldset
            className={`campo opciones ${errores.fumador ? 'con-error' : ''}`}
            aria-describedby={errores.fumador ? 'fumador-si-error' : undefined}
          >
            <legend>¿Fumas?</legend>
            <div className="opciones-fila">
              <label className="opcion">
                <input
                  id="fumador-si"
                  type="radio"
                  name="fumador"
                  value="si"
                  checked={fumador === 'si'}
                  onChange={() => {
                    setFumador('si');
                    alCambiar('fumador');
                  }}
                  data-testid="cotizador-fumador-si-radio"
                />
                <span>Sí</span>
              </label>
              <label className="opcion">
                <input
                  id="fumador-no"
                  type="radio"
                  name="fumador"
                  value="no"
                  checked={fumador === 'no'}
                  onChange={() => {
                    setFumador('no');
                    alCambiar('fumador');
                  }}
                  data-testid="cotizador-fumador-no-radio"
                />
                <span>No</span>
              </label>
            </div>
            {errores.fumador && (
              <p id="fumador-si-error" className="error-campo" data-testid="cotizador-fumador-error-msg">
                {errores.fumador}
              </p>
            )}
          </fieldset>

          <div className={`campo ${errores.sumaAsegurada ? 'con-error' : ''}`}>
            <label htmlFor="suma-asegurada">Suma asegurada</label>
            <p id="suma-asegurada-ayuda" className="ayuda">
              Lo que recibirán tus beneficiarios.
            </p>
            <select
              id="suma-asegurada"
              value={sumaAsegurada}
              onChange={(e) => {
                setSumaAsegurada(e.target.value);
                alCambiar('sumaAsegurada');
              }}
              aria-invalid={!!errores.sumaAsegurada}
              aria-describedby={descripcion('sumaAsegurada', 'ayuda')}
              data-testid="cotizador-suma-asegurada-select"
            >
              <option value="">Elige un monto</option>
              {SUMAS_ASEGURADAS.map((monto) => (
                <option key={monto} value={monto}>
                  {enSolesEnteros(monto)}
                </option>
              ))}
            </select>
            {errores.sumaAsegurada && (
              <p id="suma-asegurada-error" className="error-campo" data-testid="cotizador-suma-asegurada-error-msg">
                {errores.sumaAsegurada}
              </p>
            )}
          </div>

          <div className={`campo ${errores.plazo ? 'con-error' : ''}`}>
            <label htmlFor="plazo">Plazo</label>
            <p id="plazo-ayuda" className="ayuda">
              Años que dura la cobertura.
            </p>
            <select
              id="plazo"
              value={plazo}
              onChange={(e) => {
                setPlazo(e.target.value);
                alCambiar('plazo');
              }}
              aria-invalid={!!errores.plazo}
              aria-describedby={descripcion('plazo', 'ayuda')}
              data-testid="cotizador-plazo-select"
            >
              <option value="">Elige un plazo</option>
              {plazos.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.descripcion}
                </option>
              ))}
            </select>
            {errores.plazo && (
              <p id="plazo-error" className="error-campo" data-testid="cotizador-plazo-error-msg">
                {errores.plazo}
              </p>
            )}
          </div>

          <button type="submit" className="boton boton-noche" disabled={cargando} data-testid="cotizador-calcular-btn">
            {cargando ? 'Calculando…' : 'Calcular prima'}
          </button>
        </form>
      </section>

      <section
        className={`resultado ${cotizacion ? 'con-cotizacion' : ''}`}
        aria-labelledby="titulo-resultado"
        aria-live="polite"
      >
        <h2 id="titulo-resultado" ref={tituloResultado} tabIndex={-1}>
          Tu cotización
        </h2>

        {!cotizacion ? (
          <div className="vacio">
            <svg className="horizonte" viewBox="0 0 120 60" aria-hidden="true">
              <path d="M10 56a50 50 0 0 1 100 0" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="0" y1="57" x2="120" y2="57" stroke="currentColor" strokeWidth="2" />
            </svg>
            <p data-testid="cotizador-vacio-msg">Completa tus datos y calcula para ver tu prima.</p>
          </div>
        ) : (
          <div className="detalle">
            <p className="prima">
              <span className="prima-monto" data-testid="cotizador-prima-mensual-text">
                {enSoles(cotizacion.primaMensual)}
              </span>
              <span className="prima-periodo">al mes</span>
            </p>
            <p className="prima-anual">
              o <span data-testid="cotizador-prima-anual-text">{enSoles(cotizacion.primaTotalAnual)}</span> al año
            </p>

            <dl className="resumen">
              <div>
                <dt>Edad</dt>
                <dd data-testid="cotizador-resumen-edad-text">{cotizacion.edadActuarial} años</dd>
              </div>
              <div>
                <dt>Fumador</dt>
                <dd data-testid="cotizador-resumen-fumador-text">{cotizacion.fumador ? 'Sí' : 'No'}</dd>
              </div>
              <div>
                <dt>Suma asegurada</dt>
                <dd data-testid="cotizador-resumen-suma-asegurada-text">{enSolesEnteros(cotizacion.sumaAsegurada)}</dd>
              </div>
              <div>
                <dt>Plazo</dt>
                <dd data-testid="cotizador-resumen-plazo-text">{cotizacion.plazo} años</dd>
              </div>
            </dl>

            <dl className="datos-cotizacion">
              <div>
                <dt>Cotización N.°</dt>
                <dd className="numero" data-testid="cotizador-numero-text">
                  {cotizacion.id}
                </dd>
              </div>
              <div>
                <dt>Fecha de cotización</dt>
                <dd data-testid="cotizador-fecha-cotizacion-text">{fechaCorta(cotizacion.fechaCotizacion)}</dd>
              </div>
              <div>
                <dt>Válida hasta</dt>
                <dd data-testid="cotizador-fecha-vencimiento-text">{fechaCorta(cotizacion.fechaVencimiento)}</dd>
              </div>
            </dl>

            <button type="button" className="boton boton-alba" onClick={contratar} data-testid="cotizador-contratar-btn">
              Contratar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
