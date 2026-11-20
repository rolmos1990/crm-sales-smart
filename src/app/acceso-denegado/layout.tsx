// 044 — A esta pantalla SOLO se llega con sesión iniciada: todas las páginas
// hacen `requireSesion()` y recién después redirigen acá si el rol no alcanza.
// Sin este layout se renderizaba sin menú, dejando sin navegación a un usuario
// que sí está autenticado.
//
// La URL no se mueve a propósito: hay 40 archivos que hacen
// `redirect("/acceso-denegado")` y cambiarla obligaría a tocarlos todos.
export { LayoutAppServidor as default } from "@/shared/ui/layout-app-servidor";
