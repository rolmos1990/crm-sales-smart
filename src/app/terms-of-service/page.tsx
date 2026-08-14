import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condiciones de Servicio — KariaApp",
  description:
    "Condiciones de uso de Karia App, el CRM que gestiona contactos, oportunidades y conversaciones, incluyendo las integraciones con las plataformas de Meta (Instagram y WhatsApp).",
};

const ACTUALIZADO = "14 de agosto de 2026";
const EMAIL_CONTACTO = "kariacrmmanager@gmail.com";

const SECCIONES = [
  { id: "aceptacion", titulo: "1. Aceptación de las condiciones" },
  { id: "el-servicio", titulo: "2. Descripción del servicio" },
  { id: "cuentas", titulo: "3. Cuentas y responsabilidades del usuario" },
  { id: "integraciones-meta", titulo: "4. Integraciones con Meta (Instagram / WhatsApp)" },
  { id: "uso-aceptable", titulo: "5. Uso aceptable" },
  { id: "contenido-y-datos", titulo: "6. Contenido y datos" },
  { id: "propiedad-intelectual", titulo: "7. Propiedad intelectual" },
  { id: "disponibilidad", titulo: "8. Disponibilidad y cambios del servicio" },
  { id: "terminacion", titulo: "9. Suspensión y terminación" },
  { id: "garantias", titulo: "10. Garantías y limitación de responsabilidad" },
  { id: "ley-aplicable", titulo: "11. Ley aplicable" },
  { id: "cambios", titulo: "12. Cambios a estas condiciones" },
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

export default function TermsOfServicePage() {
  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
        {/* Encabezado */}
        <header className="mb-10 space-y-2">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-widest text-lime-600 dark:text-lime-400"
          >
            KariaApp
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Condiciones de Servicio
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
          <Seccion id="aceptacion" titulo="1. Aceptación de las condiciones">
            <p>
              Estas Condiciones de Servicio (&quot;Condiciones&quot;) regulan el uso de{" "}
              <strong>Karia App</strong>, un software de gestión de clientes y ventas (CRM). Al
              crear una cuenta o usar Karia App aceptas estas Condiciones y nuestra{" "}
              <Link href="/privacy-policy" className="text-lime-600 hover:underline dark:text-lime-400">
                Política de Privacidad
              </Link>
              . Si no estás de acuerdo, no debes usar el servicio.
            </p>
          </Seccion>

          <Seccion id="el-servicio" titulo="2. Descripción del servicio">
            <p>
              Karia App permite a un negocio (&quot;el cliente&quot;, &quot;tú&quot;) gestionar contactos,
              empresas, oportunidades comerciales, cotizaciones, pedidos y conversaciones con sus
              propios clientes finales, incluyendo conversaciones originadas en canales de
              mensajería conectados como WhatsApp e Instagram a través de las plataformas de Meta.
            </p>
          </Seccion>

          <Seccion id="cuentas" titulo="3. Cuentas y responsabilidades del usuario">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Eres responsable de mantener la confidencialidad de tus credenciales de acceso.</li>
              <li>Eres responsable de la exactitud y legalidad de los datos que ingresas o conectas al sistema (contactos, empresas, cuentas de mensajería).</li>
              <li>Debes tener autorización para conectar las cuentas de WhatsApp/Instagram que vincules a tu cuenta.</li>
              <li>Nos avisarás si detectas un uso no autorizado de tu cuenta.</li>
            </ul>
          </Seccion>

          <Seccion id="integraciones-meta" titulo="4. Integraciones con Meta (Instagram / WhatsApp)">
            <p>
              Al conectar tu cuenta de Instagram o WhatsApp Business, autorizas a Karia App a
              recibir y enviar mensajes en tu nombre a través de la API de Meta, con los permisos
              que apruebas durante el inicio de sesión de Meta. El uso de estas integraciones está
              además sujeto a las políticas de la plataforma de Meta, incluyendo su{" "}
              <a
                href="https://developers.facebook.com/devpolicy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-600 hover:underline dark:text-lime-400"
              >
                Política de la Plataforma
              </a>{" "}
              y las políticas comerciales de WhatsApp Business. Eres responsable de cumplir esas
              políticas al enviar mensajes a tus contactos (por ejemplo, evitar mensajes no
              solicitados o spam).
            </p>
          </Seccion>

          <Seccion id="uso-aceptable" titulo="5. Uso aceptable">
            <p>No puedes usar Karia App para:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Enviar spam, contenido engañoso, fraudulento o ilegal.</li>
              <li>Vulnerar la privacidad de terceros o recopilar datos sin base legal.</li>
              <li>Intentar acceder sin autorización a cuentas o datos de otros clientes de la plataforma.</li>
              <li>Sobrecargar, interferir o intentar comprometer la seguridad del servicio.</li>
              <li>Infringir las políticas de Meta u otros proveedores de canal integrados.</li>
            </ul>
          </Seccion>

          <Seccion id="contenido-y-datos" titulo="6. Contenido y datos">
            <p>
              Tú conservas la propiedad de los datos que ingresas o que se generan a través de tus
              conversaciones (contactos, mensajes, oportunidades). Nos otorgas una licencia
              limitada para almacenar, procesar y mostrar esos datos únicamente con el fin de
              prestarte el servicio, tal como se describe en nuestra{" "}
              <Link href="/privacy-policy" className="text-lime-600 hover:underline dark:text-lime-400">
                Política de Privacidad
              </Link>
              .
            </p>
          </Seccion>

          <Seccion id="propiedad-intelectual" titulo="7. Propiedad intelectual">
            <p>
              El software, marca, diseño y demás elementos de Karia App son propiedad de Karia App
              o de sus licenciantes. No se te otorga ningún derecho de propiedad sobre el software
              por el solo hecho de usarlo.
            </p>
          </Seccion>

          <Seccion id="disponibilidad" titulo="8. Disponibilidad y cambios del servicio">
            <p>
              Trabajamos para mantener el servicio disponible, pero no garantizamos que esté libre
              de interrupciones o errores. Podemos modificar, agregar o discontinuar funciones del
              producto en cualquier momento, procurando avisar con antelación razonable los cambios
              que afecten significativamente el servicio.
            </p>
          </Seccion>

          <Seccion id="terminacion" titulo="9. Suspensión y terminación">
            <p>
              Puedes dejar de usar Karia App y solicitar el cierre de tu cuenta en cualquier
              momento. Podemos suspender o cerrar cuentas que incumplan estas Condiciones, que
              infrinjan las políticas de Meta, o que representen un riesgo de seguridad para la
              plataforma o para otros usuarios.
            </p>
          </Seccion>

          <Seccion id="garantias" titulo="10. Garantías y limitación de responsabilidad">
            <p>
              El servicio se ofrece &quot;tal cual&quot; y &quot;según disponibilidad&quot;. En la
              medida permitida por la ley, no seremos responsables por daños indirectos,
              incidentales o consecuentes derivados del uso del servicio, incluyendo pérdidas de
              datos, ingresos u oportunidades comerciales.
            </p>
          </Seccion>

          <Seccion id="ley-aplicable" titulo="11. Ley aplicable">
            <p>
              Estas Condiciones se rigen por las leyes aplicables en la jurisdicción donde opera
              Karia App, sin perjuicio de las normas de protección al consumidor que puedan
              aplicarte según tu ubicación.
            </p>
          </Seccion>

          <Seccion id="cambios" titulo="12. Cambios a estas condiciones">
            <p>
              Podemos actualizar estas Condiciones ocasionalmente. Publicaremos cualquier cambio en
              esta misma página junto con la fecha de la última actualización. El uso continuado
              del servicio después de un cambio implica tu aceptación de las nuevas Condiciones.
            </p>
          </Seccion>

          <Seccion id="contacto" titulo="13. Contacto">
            <p>
              Para cualquier consulta sobre estas Condiciones, contáctanos en{" "}
              <a href={`mailto:${EMAIL_CONTACTO}`} className="text-lime-600 hover:underline dark:text-lime-400">
                {EMAIL_CONTACTO}
              </a>
              .
            </p>
          </Seccion>
        </div>

        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Karia App
        </footer>
      </div>
    </main>
  );
}
