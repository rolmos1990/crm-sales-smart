Quiero actualizar el **sistema global de colores del Dark Mode de Karia CRM**.

El objetivo NO es rediseñar los componentes ni cambiar la estructura visual de la aplicación.

Quiero conservar:

* layouts;
* tamaños;
* cards;
* border radius;
* espaciados;
* iconografía;
* estructura del Pipeline;
* Drag & Drop;
* sticky headers;
* tablas;
* formularios;
* componentes existentes.

El cambio debe concentrarse en crear un **Dark Mode profesional, moderno y cómodo para uso prolongado**, evitando el aspecto actual excesivamente negro y los contrastes/agentes de color demasiado brillantes.

# PRINCIPIO VISUAL

No utilizar negro puro `#000000` como superficie principal.

El Dark Mode debe construirse utilizando una familia de **charcoal / slate con un ligero matiz azul**, generando profundidad mediante pequeñas diferencias de luminosidad entre superficies.

La jerarquía debe sentirse aproximadamente:

```text
App Background
    ↓
Sidebar / Navigation
    ↓
Containers / Columns
    ↓
Cards
    ↓
Elevated / Hover surfaces
```

Las diferencias deben ser sutiles.

No quiero un CRM negro con líneas neón.

Quiero una interfaz oscura suave similar al lenguaje visual utilizado actualmente por aplicaciones SaaS modernas de productividad.

---

# PALETA BASE DARK

Utilizar como referencia:

```css
--background:            #0F1720;
--background-deep:       #0C131B;

--sidebar:               #111B25;
--sidebar-elevated:      #16212C;

--surface-1:             #131E28;
--surface-2:             #17232E;
--surface-3:             #1B2834;
--surface-elevated:      #1E2C38;

--card:                  #17232D;
--card-hover:            #1B2935;
--card-selected:         #1E2E3A;

--popover:               #1B2834;
--dropdown:              #1B2834;
--modal:                 #17232E;
```

No necesariamente debes reemplazar los nombres de variables existentes.

Primero identifica el sistema actual de tokens CSS/Tailwind/theme y mapea estos valores a los tokens existentes.

Evitar duplicar variables innecesariamente.

---

# BORDES

Actualmente algunos bordes resultan demasiado visibles sobre fondo negro.

Quiero bordes suaves.

```css
--border-subtle:         #263440;
--border-default:        #2D3C48;
--border-strong:         #3A4A57;
```

Regla:

Cards normales:

`border-subtle`

Inputs:

`border-default`

Hover/focus:

usar el color correspondiente al estado, pero con intensidad controlada.

NO utilizar bordes blancos translúcidos demasiado fuertes.

NO utilizar líneas tipo neón.

---

# TEXTO

Evitar blanco puro para todo.

Utilizar jerarquía:

```css
--text-primary:          #E8EDF2;
--text-secondary:        #AAB5BF;
--text-tertiary:         #7F8B96;
--text-muted:            #66737F;
--text-disabled:         #53606B;
--text-inverse:          #111820;
```

Uso:

### Primary

Títulos, nombres de oportunidades, montos importantes:

`#E8EDF2`

### Secondary

Nombres de contactos, información secundaria:

`#AAB5BF`

### Tertiary

Fechas, porcentajes, metadatos:

`#7F8B96`

### Muted

Información poco relevante:

`#66737F`

Evitar:

`#FFFFFF`

como color general.

Puede utilizarse excepcionalmente cuando sea necesario dentro de un botón/acento que requiera máximo contraste.

---

# PRIMARY COLOR — KARIA GREEN

Karia utiliza verde como color de marca.

Actualmente el verde puede resultar demasiado brillante sobre Dark Mode.

Crear una versión más madura y controlada.

```css
--primary:               #78A83B;
--primary-hover:         #86B847;
--primary-active:        #6B9634;

--primary-muted:         #26371F;
--primary-subtle:        #1C2A19;
--primary-border:        #48662D;
```

El botón:

`+ Nueva oportunidad`

debe continuar destacándose como CTA principal.

Pero NO debe parecer fluorescente.

Normal:

```text
background #78A83B
```

Hover:

```text
background #86B847
```

Pressed:

```text
background #6B9634
```

Texto:

```text
#F5F8F2
```

No utilizar glow.

No utilizar box-shadow verde brillante.

---

# NAVEGACIÓN ACTIVA

El elemento activo del sidebar debe utilizar el verde de Karia de forma mucho más sutil.

Ejemplo:

```css
--nav-active-bg:         #1D2B1C;
--nav-active-border:     #3D5729;
--nav-active-text:       #A8CC72;
--nav-active-icon:       #8FB94F;
```

Evitar un bloque verde brillante.

Debe identificarse inmediatamente como activo sin dominar visualmente toda la pantalla.

---

# COLORES DE ETAPAS DEL PIPELINE

MUY IMPORTANTE:

Las etapas deben continuar teniendo identidad cromática.

Pero los colores en Dark Mode deben estar **desaturados ligeramente**.

No utilizar colores neon.

## Prospecto — Purple

```css
--stage-purple:          #9185D9;
--stage-purple-muted:    #292641;
--stage-purple-border:   #4A456F;
--stage-purple-text:     #AFA5EB;
```

## Contactado — Cyan/Teal

```css
--stage-cyan:            #55B8BE;
--stage-cyan-muted:      #173338;
--stage-cyan-border:     #285C61;
--stage-cyan-text:       #72CBD0;
```

## Seguimiento — Amber

```css
--stage-amber:           #D5A83F;
--stage-amber-muted:     #352C17;
--stage-amber-border:    #685527;
--stage-amber-text:      #E0B955;
```

## Cliente Potencial — Orange

```css
--stage-orange:          #D77B43;
--stage-orange-muted:    #392419;
--stage-orange-border:   #6B4129;
--stage-orange-text:     #E79560;
```

## Reservado — Lavender

```css
--stage-lavender:        #8988D8;
--stage-lavender-muted:  #282840;
--stage-lavender-border: #484873;
--stage-lavender-text:   #AAA8EA;
```

## Success / Ganado

```css
--success:               #62AE78;
--success-muted:         #193125;
--success-border:        #315D41;
--success-text:          #82C895;
```

## Danger / Perdido / Cancelar

```css
--danger:                #C96B70;
--danger-muted:          #351E22;
--danger-border:         #63383D;
--danger-text:           #DD898D;
```

Los colores de etapa NO deben rellenar completamente las columnas.

Utilizarlos principalmente en:

* línea superior;
* badge de etapa;
* progress;
* pequeños indicadores;
* selected/drag state;
* highlights extremadamente sutiles.

La superficie de las cards debe continuar perteneciendo a la paleta neutral.

---

# CARDS

Las Opportunity Cards deben sentirse claramente separadas del background sin necesitar bordes brillantes.

Base:

```css
--card:                  #17232D;
--card-hover:            #1B2935;
--card-border:           #2B3945;
--card-divider:          #26333E;
```

Card normal:

```text
background: #17232D
border: #2B3945
```

Hover:

```text
background: #1B2935
```

No aumentar exageradamente el contraste.

La línea superior de la card puede continuar utilizando el color correspondiente a la etapa, pero desaturado.

---

# PIPELINE COLUMNS

```css
--pipeline-bg:           #0F1720;
--column-bg:             #121C26;
--column-header-bg:      #151F29;
--column-border:         #263440;
--column-empty-bg:       #111B24;
```

Los Stage Headers sticky deben utilizar:

```text
background sólido
```

para impedir que las cards sean visibles detrás mientras hacemos scroll.

No utilizar transparencias excesivas.

Puede existir un blur muy ligero si actualmente está implementado, pero no depender del blur para garantizar legibilidad.

---

# STICKY HEADERS

Los headers sticky deben integrarse naturalmente.

Normal:

```css
background: #151F29;
border-bottom: #263440;
```

Durante scroll puede aparecer una sombra extremadamente sutil:

```css
box-shadow:
0 4px 12px rgba(0,0,0,0.16);
```

No utilizar sombras grandes.

No cambiar los colores propios de cada etapa.

---

# INPUTS / SELECTS / SEARCH

```css
--input-bg:              #131E28;
--input-border:          #30404D;
--input-hover:           #354754;
--input-focus:           #688C42;
--input-placeholder:     #687580;
```

Focus ring:

Debe existir por accesibilidad, pero ser discreto.

Evitar glow verde.

---

# BOTONES SECUNDARIOS

Ejemplo:

* Filtros
* Ver ocultos
* Refresh
* Opciones

```css
--button-secondary-bg:       #151F29;
--button-secondary-hover:    #1C2934;
--button-secondary-border:   #2D3B47;
--button-secondary-text:     #C8D0D7;
```

No deben competir visualmente con:

`+ Nueva oportunidad`

---

# BADGES / TAGS

Los tags deben tener fondos oscuros y colores suaves.

Neutral:

```css
--badge-bg:              #202C36;
--badge-border:          #34434F;
--badge-text:            #B8C1C9;
```

Los tags con color deben utilizar:

```text
color suave
+
background muy oscuro derivado del color
```

Nunca:

```text
background saturado + texto blanco
```

para etiquetas pequeñas salvo estados realmente críticos.

---

# SCROLLBAR

Quiero scrollbar extremadamente discreto.

```css
--scrollbar-thumb:       #45515A;
--scrollbar-thumb-hover: #596771;
--scrollbar-track:       transparent;
```

Además mantener el comportamiento definido anteriormente:

* oculta cuando no se utiliza;
* aparece durante scroll;
* desaparece nuevamente;
* no afecta wheel/trackpad;
* no afecta Drag & Drop/autoscroll.

---

# ESTADOS SEMÁNTICOS

Utilizar colores controlados:

```css
--success:       #62AE78;
--warning:       #D5A84A;
--danger:        #C96B70;
--info:          #609DBD;
```

Nunca convertir grandes superficies a estos colores.

Utilizar principalmente en:

* iconos;
* dots;
* badges;
* bordes;
* mensajes;
* pequeños indicadores.

---

# SOMBRAS

Dark Mode necesita muy pocas sombras.

```css
--shadow-sm:
0 1px 2px rgba(0,0,0,0.18);

--shadow-md:
0 4px 12px rgba(0,0,0,0.20);

--shadow-lg:
0 10px 28px rgba(0,0,0,0.24);
```

Preferir separación mediante superficies y borders antes que sombras.

---

# REGLA FUNDAMENTAL DE CONTRASTE

NO interpretar Dark Mode como:

```text
NEGRO
+
BLANCO
+
COLORES BRILLANTES
```

Debe interpretarse como:

```text
Dark blue-charcoal
+
slate surfaces
+
soft off-white typography
+
muted accents
+
Karia green controlado
```

El usuario puede mantener Karia abierto durante muchas horas.

La interfaz debe sentirse tranquila, profesional y legible.

---

# IMPLEMENTACIÓN

Antes de modificar:

1. Localiza el sistema global de theme.
2. Identifica variables CSS.
3. Identifica configuración Tailwind.
4. Identifica tokens semánticos existentes.
5. Identifica colores hardcodeados.
6. Identifica componentes que no utilizan tokens.
7. Identifica estilos Light/Dark actuales.

Centraliza los cambios.

NO quiero que cada componente tenga nuevos HEX hardcodeados.

Preferir:

```css
var(--background)
var(--card)
var(--border)
var(--muted)
var(--primary)
```

o el sistema equivalente existente.

## IMPORTANTE

NO modificar todavía Light Mode.

Este cambio corresponde exclusivamente a:

`Dark Mode`

Mantener la funcionalidad y estructura actual de todos los componentes.

Al finalizar, verifica especialmente:

* Pipeline
* Inbox
* Contactos
* Empresas
* Oportunidades
* Actividades
* Cotizaciones
* Pedidos
* Productos
* Configuración
* Modales
* Dropdowns
* Inputs
* Tables
* Tooltips
* Toasts

para comprobar que ningún componente quede utilizando un color del antiguo Dark Mode que rompa la nueva paleta.
