import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad — Vento",
  description:
    "Cómo Karia App (Vento) recopila, usa y protege los datos de contactos y conversaciones, incluyendo los obtenidos a través de la integración con las plataformas de Meta (Instagram y WhatsApp).",
};

const ACTUALIZADO = "14 de agosto de 2026";
const EMAIL_CONTACTO = "ramon.olmos90@gmail.com";

const SECCIONES = [
  { id: "quienes-somos", titulo: "1. Quiénes somos" },
  { id: "alcance", titulo: "2. Alcance de esta política" },
  { id: "datos-que-recopilamos", titulo: "3. Datos que recopilamos" },
  { id: "datos-de-meta", titulo: "4. Datos obtenidos a través de Meta (Instagram / WhatsApp)" },
  { id: "para-que-usamos", titulo: "5. Para qué usamos los datos" },
  { id: "con-quien-compartimos", titulo: "6. Con quién compartimos los datos" },
  { id: "conservacion", titulo: "7. Conservación de los datos" },
  { id: "eliminacion", titulo: "8. Cómo solicitar la eliminación de tus datos" },
  { id: "seguridad", titulo: "9. Seguridad" },
  { id: "derechos", titulo: "10. Tus derechos" },
  { id: "menores", titulo: "11. Menores de edad" },
  { id: "cambios", titulo: "12. Cambios a esta política" },
  { id: "contacto", titulo: "13. Contacto" },
];

function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
        {titulo}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
        {/* Encabezado */}
        <header className="mb-10 space-y-2">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-widest text-lime-600 dark:text-lime-400"
          >
            Vento
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Política de Privacidad
          </h1>
          <p className="text-sm text-muted-foreground">
            Última actualización: {ACTUALIZADO}
          </p>
        </header>

        {/* Índice */}
        <nav className="mb-12 rounded-xl border border-border bg-card p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Contenido
          </p>
          <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-stone-600 hover:text-lime-600 dark:text-stone-400 dark:hover:text-lime-400"
                >
                  {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          <Seccion id="quienes-somos" titulo="1. Quiénes somos">
            <p>
              Esta Política de Privacidad aplica a <strong>Vento</strong>, un software de
              gestión de clientes y ventas (CRM) operado por{" "}
              <strong>Karia App</strong> (en adelante, &quot;nosotros&quot;,
              &quot;la aplicación&quot; o &quot;el responsable del tratamiento&quot;). Vento permite a un
              negocio gestionar sus contactos, oportunidades comerciales y conversaciones con
              clientes, incluyendo las que se originan en canales de mensajería como WhatsApp e
              Instagram a través de las plataformas de Meta.
            </p>
            <p>
              Si tienes preguntas sobre esta política o sobre cómo tratamos tus datos, puedes
              escribirnos a{" "}
              <a href={`mailto:${EMAIL_CONTACTO}`} className="text-lime-600 hover:underline dark:text-lime-400">
                {EMAIL_CONTACTO}
              </a>
              .
            </p>
          </Seccion>

          <Seccion id="alcance" titulo="2. Alcance de esta política">
            <p>
              Vento es utilizado por negocios (&quot;el cliente&quot;) para administrar su propia
              relación con sus clientes finales (&quot;contactos&quot;). El cliente que usa Vento es
              responsable de la información que ingresa o conecta al sistema (por ejemplo, sus
              contactos, empresas y cuentas de mensajería). Esta política describe cómo
              Vento, como proveedor de la plataforma, recopila, procesa, almacena y protege esa
              información en su infraestructura, incluyendo los datos obtenidos mediante la
              integración con la Plataforma de Meta (Instagram y WhatsApp Business).
            </p>
          </Seccion>

          <Seccion id="datos-que-recopilamos" titulo="3. Datos que recopilamos">
            <p>Dependiendo de cómo se use Vento, podemos tratar los siguientes datos:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Datos de cuenta:</strong> nombre, correo electrónico y rol de los
                usuarios que acceden al CRM.
              </li>
              <li>
                <strong>Datos de contactos y empresas:</strong> nombre, apellido, correo,
                teléfono, cargo y notas que el negocio registra sobre sus propios clientes.
              </li>
              <li>
                <strong>Datos comerciales:</strong> oportunidades de venta, cotizaciones,
                pedidos y productos asociados a cada contacto.
              </li>
              <li>
                <strong>Conversaciones:</strong> el contenido de los mensajes de texto,
                imágenes, audios o documentos intercambiados entre el negocio y sus contactos a
                través de los canales conectados (WhatsApp, Instagram), junto con metadatos como
                fecha, hora y estado de entrega/lectura.
              </li>
            </ul>
          </Seccion>

          <Seccion id="datos-de-meta" titulo="4. Datos obtenidos a través de Meta (Instagram / WhatsApp)">
            <p>
              Cuando un negocio conecta su cuenta de Instagram o WhatsApp Business a Vento
              mediante el inicio de sesión de Meta, solicitamos únicamente los permisos
              necesarios para ofrecer la función de bandeja de conversaciones, entre ellos:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_basic</code>,{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">instagram_manage_messages</code>,{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pages_show_list</code>,{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pages_manage_metadata</code>,{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pages_messaging</code> y{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">business_management</code>.
            </p>
            <p>Con estos permisos podemos recibir y almacenar, en representación del negocio:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>El identificador y nombre público del perfil de Instagram/Facebook que escribe al negocio.</li>
              <li>El contenido de los mensajes directos enviados y recibidos, y su estado de entrega.</li>
              <li>Metadatos básicos de la página/cuenta de negocio conectada (nombre, identificador).</li>
            </ul>
            <p>
              No solicitamos ni accedemos a datos de Meta más allá de lo necesario para mostrar y
              gestionar esas conversaciones dentro del CRM. No usamos los datos obtenidos de la
              Plataforma de Meta para publicidad, y no los vendemos ni los cedemos a terceros para
              fines distintos a los descritos en esta política, en línea con la{" "}
              <a
                href="https://developers.facebook.com/devpolicy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-600 hover:underline dark:text-lime-400"
              >
                Política de la Plataforma de Meta
              </a>
              .
            </p>
          </Seccion>

          <Seccion id="para-que-usamos" titulo="5. Para qué usamos los datos">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Mostrar la bandeja de conversaciones y el historial de mensajes dentro del CRM del negocio.</li>
              <li>Vincular conversaciones con contactos, empresas y oportunidades comerciales.</li>
              <li>Permitir que los agentes del negocio respondan mensajes desde Vento.</li>
              <li>
                Cuando el negocio activa funciones de inteligencia artificial (respuestas
                automáticas, resúmenes o clasificación de conversaciones), el contenido relevante
                de la conversación puede enviarse a un proveedor de IA (por ejemplo, Anthropic u
                OpenAI) únicamente para generar esa respuesta o análisis; el proveedor no utiliza
                esos datos para entrenar sus modelos por defecto.
              </li>
              <li>Operar, mantener y mejorar la seguridad y el funcionamiento de la plataforma.</li>
            </ul>
            <p>No usamos los datos de contactos ni el contenido de las conversaciones con fines publicitarios propios ni de terceros.</p>
          </Seccion>

          <Seccion id="con-quien-compartimos" titulo="6. Con quién compartimos los datos">
            <p>No vendemos datos personales. Solo compartimos información con:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Proveedores de infraestructura:</strong> alojamos la base de datos y los
                archivos en proveedores de nube (por ejemplo, Supabase), quienes procesan los
                datos únicamente para prestarnos el servicio de hosting.
              </li>
              <li>
                <strong>Proveedores de IA</strong> (opcional, solo si el negocio activa esa
                función), como se describe en la sección 5.
              </li>
              <li>
                <strong>Meta Platforms, Inc.</strong>, como origen de los datos de Instagram/WhatsApp
                cuando el negocio conecta esas cuentas.
              </li>
              <li>Autoridades, cuando la ley lo exija.</li>
            </ul>
          </Seccion>

          <Seccion id="conservacion" titulo="7. Conservación de los datos">
            <p>
              Conservamos los datos de contactos, oportunidades y conversaciones mientras el
              negocio mantenga una cuenta activa en Vento, o hasta que solicite su eliminación.
              Al eliminar una cuenta, la conversación y los datos personales asociados se borran
              de forma definitiva de nuestra base de datos en un plazo razonable, salvo que
              debamos conservar cierta información por obligación legal.
            </p>
          </Seccion>

          <Seccion id="eliminacion" titulo="8. Cómo solicitar la eliminación de tus datos">
            <p>Puedes solicitar la eliminación de tus datos de dos formas:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Si eres cliente final</strong> (escribiste a un negocio que usa Vento por
                WhatsApp o Instagram) y quieres que borremos tu conversación e información de
                contacto: escríbenos a{" "}
                <a href={`mailto:${EMAIL_CONTACTO}`} className="text-lime-600 hover:underline dark:text-lime-400">
                  {EMAIL_CONTACTO}
                </a>{" "}
                indicando el negocio, el canal (WhatsApp/Instagram) y el número o usuario desde el
                que escribiste. Verificaremos la solicitud y eliminaremos los datos correspondientes
                en un plazo máximo de 30 días.
              </li>
              <li>
                <strong>Si eres el negocio</strong> que usa Vento, puedes eliminar contactos,
                conversaciones u otros registros directamente desde el CRM, o solicitar el borrado
                completo de tu cuenta escribiendo al mismo correo.
              </li>
              <li>
                También puedes revocar el acceso de Vento a tu cuenta de Instagram/Facebook en
                cualquier momento desde{" "}
                <a
                  href="https://www.facebook.com/settings?tab=business_tools"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lime-600 hover:underline dark:text-lime-400"
                >
                  Configuración de Meta → Aplicaciones y sitios web
                </a>
                . Al revocar el acceso, dejaremos de recibir nuevos mensajes de esa cuenta.
              </li>
            </ul>
          </Seccion>

          <Seccion id="seguridad" titulo="9. Seguridad">
            <p>
              Aplicamos medidas técnicas y organizativas razonables para proteger los datos:
              conexiones cifradas (HTTPS/TLS) entre el navegador y nuestros servidores, control de
              acceso por usuario y rol dentro de cada cuenta, y credenciales de integración
              almacenadas de forma segura en el servidor. Ningún sistema es 100% infalible, pero
              trabajamos para mantener estos estándares actualizados.
            </p>
          </Seccion>

          <Seccion id="derechos" titulo="10. Tus derechos">
            <p>
              Dependiendo de tu ubicación, puedes tener derecho a acceder, rectificar, portar u
              oponerte al tratamiento de tus datos, y a solicitar su eliminación, tal como se
              describe en la sección 8. Para ejercer cualquiera de estos derechos, escríbenos a{" "}
              <a href={`mailto:${EMAIL_CONTACTO}`} className="text-lime-600 hover:underline dark:text-lime-400">
                {EMAIL_CONTACTO}
              </a>
              .
            </p>
          </Seccion>

          <Seccion id="menores" titulo="11. Menores de edad">
            <p>
              Vento está dirigido a negocios y a los usuarios que administran sus operaciones
              comerciales; no está diseñado para ser usado por menores de edad, y no recopilamos
              intencionalmente datos de menores para fines propios de la plataforma.
            </p>
          </Seccion>

          <Seccion id="cambios" titulo="12. Cambios a esta política">
            <p>
              Podemos actualizar esta Política de Privacidad ocasionalmente para reflejar cambios
              en el producto o en requisitos legales. Publicaremos cualquier cambio en esta misma
              página junto con la fecha de la última actualización.
            </p>
          </Seccion>

          <Seccion id="contacto" titulo="13. Contacto">
            <p>
              Para cualquier consulta sobre esta política o sobre el tratamiento de tus datos,
              contáctanos en{" "}
              <a href={`mailto:${EMAIL_CONTACTO}`} className="text-lime-600 hover:underline dark:text-lime-400">
                {EMAIL_CONTACTO}
              </a>
              .
            </p>
          </Seccion>
        </div>

        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Karia App · Vento CRM
        </footer>
      </div>
    </main>
  );
}
