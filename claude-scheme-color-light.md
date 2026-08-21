Quiero ajustar el **Light Mode global de Karia CRM** para que tenga la misma identidad visual profesional del nuevo Dark Mode.

IMPORTANTE:

No quiero simplemente invertir los colores del Dark Mode.

Light y Dark deben ser dos interpretaciones del mismo Design System.

Mantener:

* estructura;
* layouts;
* cards;
* componentes;
* tamaños;
* border radius;
* spacing;
* comportamiento;
* Drag & Drop;
* sticky headers.

Modificar únicamente el sistema cromático donde sea necesario.

# FILOSOFÍA

El Light Mode debe sentirse:

* limpio;
* profesional;
* moderno;
* suave;
* poco agresivo;
* adecuado para uso prolongado.

Evitar una interfaz completamente:

`#FFFFFF`

con:

`#000000`

y colores extremadamente saturados.

Utilizar blancos ligeramente fríos y grises suaves.

---

# BASE LIGHT

```css
--background:            #F5F7F9;
--background-subtle:     #F8FAFB;

--sidebar:               #FAFBFC;
--sidebar-elevated:      #FFFFFF;

--surface-1:             #FFFFFF;
--surface-2:             #F8FAFB;
--surface-3:             #F2F5F7;
--surface-elevated:      #FFFFFF;

--card:                  #FFFFFF;
--card-hover:            #FAFBFC;
--card-selected:         #F5F8FA;

--popover:               #FFFFFF;
--dropdown:              #FFFFFF;
--modal:                 #FFFFFF;
```

La diferencia entre superficies debe ser sutil.

---

# BORDES

```css
--border-subtle:         #E5E9ED;
--border-default:        #D9E0E5;
--border-strong:         #C7D0D7;
```

No utilizar bordes oscuros alrededor de todas las cards.

La separación debe ser delicada.

---

# TEXTO

No utilizar negro puro como texto general.

```css
--text-primary:          #202830;
--text-secondary:        #56616B;
--text-tertiary:         #7A858F;
--text-muted:            #98A1A9;
--text-disabled:         #B3BBC2;
--text-inverse:          #F5F8FA;
```

Títulos:

`#202830`

Texto normal:

`#56616B`

Metadata:

`#7A858F`

Información secundaria:

`#98A1A9`

Esto reduce el contraste excesivamente duro del negro sobre blanco.

---

# KARIA GREEN

Mantener la identidad verde de Karia pero evitar verde fluorescente.

```css
--primary:               #6F9F32;
--primary-hover:         #638F2C;
--primary-active:        #587F28;

--primary-muted:         #EDF5E3;
--primary-subtle:        #F4F8EF;
--primary-border:        #C8DBAE;
```

Botón principal:

`+ Nueva oportunidad`

```text
background: #6F9F32
text: #FFFFFF
```

Debe ser claramente el CTA principal sin parecer fluorescente.

No agregar glow.

---

# SIDEBAR ACTIVO

```css
--nav-active-bg:         #EEF5E5;
--nav-active-border:     #CADDAE;
--nav-active-text:       #557D25;
--nav-active-icon:       #67962D;
```

Debe ser similar al estilo actual de Karia, pero ligeramente más sofisticado y menos brillante.

---

# PIPELINE STAGES

Los colores deben corresponder conceptualmente con Dark Mode.

## Prospecto

```css
--stage-purple:          #8075CF;
--stage-purple-muted:    #F1EFFB;
--stage-purple-border:   #D9D5F3;
--stage-purple-text:     #665CB6;
```

## Contactado

```css
--stage-cyan:            #43AAB2;
--stage-cyan-muted:      #EAF7F7;
--stage-cyan-border:     #C7E9EB;
--stage-cyan-text:       #32858C;
```

## Seguimiento

```css
--stage-amber:           #C89A2F;
--stage-amber-muted:     #FBF6E7;
--stage-amber-border:    #EDDFB7;
--stage-amber-text:      #9B7521;
```

## Cliente Potencial

```css
--stage-orange:          #CB7140;
--stage-orange-muted:    #FAEEE8;
--stage-orange-border:   #EDD3C5;
--stage-orange-text:     #A7562D;
```

## Reservado

```css
--stage-lavender:        #7F7CCC;
--stage-lavender-muted:  #F0F0FA;
--stage-lavender-border: #D8D7F0;
--stage-lavender-text:   #6562AF;
```

## Ganado

```css
--success:               #529568;
--success-muted:         #EAF5EE;
--success-border:        #C9E4D1;
--success-text:          #3E7951;
```

## Perdido / Cancelado

```css
--danger:                #BD6268;
--danger-muted:          #FAECEE;
--danger-border:         #EDCDD0;
--danger-text:           #9D484E;
```

---

# OPPORTUNITY CARDS

```css
--card:                  #FFFFFF;
--card-hover:            #FAFBFC;
--card-border:           #DFE5E9;
--card-divider:          #EDF0F2;
```

La card debe sentirse limpia y elevada muy ligeramente respecto al Pipeline.

No utilizar bordes de etapa saturados alrededor de toda la card.

La etapa puede identificarse mediante:

* línea superior;
* progress bar;
* badge;
* pequeños detalles.

---

# PIPELINE

```css
--pipeline-bg:           #F5F7F9;
--column-bg:             #F8FAFB;
--column-header-bg:      #FAFBFC;
--column-border:         #E1E6EA;
--column-empty-bg:       #F8FAFB;
```

Debe existir diferencia entre:

```text
Página
↓
Columna
↓
Card
```

pero muy sutil.

---

# STICKY HEADERS

Los Stage Headers implementados anteriormente deben conservar su comportamiento.

Light:

```css
background: #FAFBFC;
border-bottom: #E1E6EA;
```

Cuando estén sticky durante scroll:

```css
box-shadow:
0 4px 12px rgba(31,42,51,0.06);
```

Muy sutil.

No modificar los colores de etapa.

---

# BOTONES SECUNDARIOS

```css
--button-secondary-bg:       #FFFFFF;
--button-secondary-hover:    #F4F6F8;
--button-secondary-border:   #DDE3E7;
--button-secondary-text:     #46515B;
```

Ejemplos:

* Filtros
* Ver ocultos
* Refresh
* acciones secundarias

El botón verde sigue siendo el elemento de mayor prioridad visual.

---

# INPUTS

```css
--input-bg:              #FFFFFF;
--input-border:          #D7DEE3;
--input-hover:           #C9D2D9;
--input-focus:           #789E4A;
--input-placeholder:     #9BA4AC;
```

Focus debe ser visible pero discreto.

---

# BADGES

Neutral:

```css
--badge-bg:              #F1F4F6;
--badge-border:          #DDE3E7;
--badge-text:            #626D76;
```

Los badges de colores deben utilizar principalmente:

`stage-*-muted`

como fondo y:

`stage-*-text`

como texto.

Evitar fondos saturados.

---

# SCROLLBAR

```css
--scrollbar-thumb:       #C4CBD1;
--scrollbar-thumb-hover: #AEB7BF;
--scrollbar-track:       transparent;
```

Mantener autohide definido para el Pipeline.

---

# ESTADOS SEMÁNTICOS

```css
--success:       #529568;
--warning:       #C89A38;
--danger:        #BD6268;
--info:          #528CA9;
```

Usarlos con moderación.

---

# SOMBRAS

```css
--shadow-sm:
0 1px 2px rgba(31,42,51,0.05);

--shadow-md:
0 4px 12px rgba(31,42,51,0.07);

--shadow-lg:
0 12px 30px rgba(31,42,51,0.10);
```

No convertir todas las cards en elementos flotantes.

Utilizar border + diferencias de surface como principal separación.

---

# CONSISTENCIA LIGHT ↔ DARK

Quiero que exista equivalencia semántica.

Por ejemplo:

```text
LIGHT                   DARK

background              background
surface-1               surface-1
surface-2               surface-2
card                    card
border                  border
text-primary            text-primary
text-secondary          text-secondary
primary                 primary
stage-purple            stage-purple
stage-cyan              stage-cyan
stage-amber             stage-amber
stage-orange            stage-orange
success                 success
danger                  danger
```

Los componentes NO deberían saber qué HEX utilizar.

Deben consumir tokens semánticos.

Ejemplo correcto:

```css
background: var(--card);
color: var(--text-primary);
border-color: var(--border-subtle);
```

NO:

```css
background: #ffffff;
```

dentro del componente.

---

# REGLA IMPORTANTE PARA AMBOS THEMES

Quiero establecer una regla de Design System para Karia:

**Los colores intensos representan significado, no superficies.**

Por lo tanto, purple/cyan/amber/orange/green/red deben utilizarse principalmente para:

* estados;
* etapas;
* indicadores;
* progress bars;
* iconos;
* badges;
* CTA;
* selección;
* feedback.

Las grandes superficies deben permanecer neutrales.

Esto aplica tanto a Light como Dark.

---

# IMPLEMENTACIÓN

Primero identifica dónde vive actualmente el Theme System.

No empieces modificando componentes individualmente.

Orden:

1. Global color tokens.
2. Semantic tokens.
3. Tailwind/theme mapping.
4. Shared components.
5. Feature-specific components.
6. Hardcoded colors restantes.

Busca explícitamente colores hardcodeados que puedan impedir que Light/Dark funcionen correctamente.

Especialmente:

* `bg-black`
* `bg-white`
* `text-black`
* `text-white`
* HEX directos
* RGB directos
* borders hardcodeados
* shadows hardcodeadas.

NO reemplazarlos indiscriminadamente.

Determina primero su intención semántica y reemplázalos por el token correspondiente.

## IMPORTANTE

No modificar funcionalidad.

No modificar estructura.

No modificar Drag & Drop.

No modificar Sticky Headers.

No modificar alturas de Pipeline.

No modificar comportamiento de scroll.

No modificar componentes innecesariamente.

Este cambio debe ser principalmente una evolución del **Design System / Theme System de Karia CRM**.
