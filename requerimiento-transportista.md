Para Karia App, la forma más sencilla sería permitir que cada empresa cargue una “Matriz de tarifas” por transportista, organizada por país y zonas de entrega. El usuario podría hacerlo manualmente, pegando una tabla o importando Excel/CSV.

La IA serviría para interpretar cómo el cliente escribe su ubicación, pero Karia debe calcular el costo y recomendar el transportista mediante reglas determinísticas.

1. Experiencia sencilla para cargar tarifas

Dentro de cada transportista:

Configuración → Envíos → Transportistas → Matriz de tarifas

El usuario selecciona:

País.
Moneda.
Tipo de servicio: domicilio, sucursal, express, etc.
Método de carga:
Importar Excel/CSV.
Pegar una tabla.
Agregar destinos manualmente.
Duplicar una matriz existente.

Una tabla fácil de administrar podría verse así:

Provincia	Zona o destino	Alias	Tipo de entrega	Costo transportista	Precio al cliente	Ganancia
Panamá Oeste	La Chorrera	Chorrera, La Chorrera	Sucursal	$4.50	$6.50	$2.00
Chiriquí	David	David, David Centro	Sucursal	$4.50	$6.50	$2.00
Chiriquí	Boquete	Bajo Boquete, Alto Boquete	Domicilio	$5.50	$7.50	$2.00
Bocas del Toro	Changuinola	Changuinola, Changuinola Centro	Sucursal	$5.50	$7.50	$2.00

La ganancia puede calcularse automáticamente:

$$ \text{Ganancia} = \text{Precio al cliente} - \text{Costo del transportista} $$

Conviene permitir tres modalidades comerciales:

Precio fijo: cobrar siempre un valor definido.
Margen fijo: costo del transportista + $2.00.
Margen porcentual: costo + 20%.
Sin ganancia: cobrar exactamente el costo.
2. Estructura recomendada

No conviene guardar todo como texto libre. La estructura debería separar la geografía, los alias y las tarifas.

Ubicación geográfica
País
└── Provincia
    └── Distrito o ciudad
        └── Zona o destino

Ejemplo:

Panamá
└── Chiriquí
    └── David
        ├── David Centro
        ├── San Mateo
        ├── Terronal
        └── Obaldía

No todos los transportistas utilizarán la división política oficial. Por eso hace falta una entidad adicional llamada, por ejemplo, ZonaTransportista.

Un transportista podría tener:

Zona: “David”.
Destinos: David Centro, San Mateo, Terronal y Obaldía.
Una sola tarifa para toda la zona.
3. Modelo funcional
Transportista
Transportista
- Id
- EmpresaId
- Nombre
- Países habilitados
- Moneda
- Estado
Servicio del transportista
ServicioTransportista
- Id
- TransportistaId
- Nombre: Sucursal / Domicilio / Express
- Tiempo mínimo
- Tiempo máximo
- Unidad: horas o días
Zona del transportista
ZonaTransportista
- Id
- ServicioTransportistaId
- PaísId
- ProvinciaId
- Nombre
- Código interno
- Estado
Destino
DestinoTransportista
- Id
- ZonaTransportistaId
- CiudadId o DistritoId
- Nombre mostrado
- Dirección o sucursal opcional
- Alias
- Palabras relacionadas
Tarifa
TarifaEnvio
- Id
- ZonaTransportistaId o DestinoTransportistaId
- CostoTransportista
- PrecioCliente
- TipoMargen
- ValorMargen
- PesoMáximo
- FechaInicio
- FechaFin
- Estado

Es importante conservar por separado:

Costo transportista: lo que paga la empresa.
Precio al cliente: lo que se cobra.
Ganancia estimada: diferencia calculada.

Así Karia podrá mostrar rentabilidad sin revelar el costo interno al cliente.

4. Alias preparados para IA

Cada destino debe aceptar múltiples maneras de escribirlo:

Destino oficial: La Chorrera

Alias:
- Chorrera
- La Chorrera
- Chorrera centro
- Panamá Oeste Chorrera
- Oeste Chorrera

También conviene normalizar automáticamente:

Mayúsculas y minúsculas.
Acentos.
Abreviaturas.
Espacios repetidos.
Errores ortográficos frecuentes.

Por ejemplo, estas entradas deberían poder coincidir:

chorrera
La Chorrera
la chorera
Chorrera, Panamá Oeste

Karia puede sugerir los alias durante la importación, pero el usuario debe poder revisarlos.

Datos adicionales para mejorar las coincidencias

Cada destino podría contener:

Nombre oficial.
Alias.
Provincia.
Distrito o ciudad.
Corregimiento.
Código postal, si aplica.
Coordenadas opcionales.
Cobertura: total, parcial o bajo consulta.
Notas para la IA.
Pregunta de aclaración.

Ejemplo:

Destino: David
Alias: David, David Centro
Provincia: Chiriquí
Cobertura: parcial
Pregunta: ¿En qué sector de David se encuentra?
5. Importación rápida de una matriz

El flujo ideal sería:

Paso 1: cargar información

El usuario sube Excel/CSV o pega algo como:

Chorrera - $6.50
Penonomé - $6.50
David San Mateo - $6.50
Boquete - $7.50
Changuinola - $7.50
Paso 2: interpretación asistida

Karia propone:

Texto original	País	Provincia	Destino	Precio
Chorrera	Panamá	Panamá Oeste	La Chorrera	$6.50
Penonomé	Panamá	Coclé	Penonomé	$6.50
David San Mateo	Panamá	Chiriquí	San Mateo	$6.50
Boquete	Panamá	Chiriquí	Boquete	$7.50
Paso 3: revisar conflictos

Karia marca:

Destinos no reconocidos.
Posibles duplicados.
Provincias dudosas.
Tarifas ausentes.
Alias que coinciden con más de un destino.
Valores con moneda inválida.
Destinos previamente configurados.
Paso 4: definir costos y margen

Si la lista solamente contiene el costo del transportista, el usuario puede aplicar una regla masiva:

Costo importado: tarifa del transportista
Precio al cliente: costo + $2.00

O:

Precio importado: tarifa al cliente
Costo interno: completar manualmente

Esto es importante porque algunas listas recibidas del courier pueden representar su costo y otras el precio recomendado.

Paso 5: confirmar

Antes de importar:

35 destinos válidos
3 destinos requieren revisión
2 posibles duplicados
Ganancia promedio estimada: $1.85
6. Cómo consultaría la IA

Cuando un cliente escriba:

¿Hacen envíos a San Mateo en David?

La IA debería ejecutar una búsqueda estructurada:

{
  "pais": "Panamá",
  "provincia": "Chiriquí",
  "ubicacion": "San Mateo",
  "tipoEntrega": "cualquiera"
}

El motor de Karia:

Normaliza “San Mateo”.
Busca coincidencias exactas y alias.
Identifica que pertenece a David, Chiriquí.
Obtiene transportistas activos.
Aplica peso, tipo de entrega y condiciones.
Calcula el precio al cliente.
Ordena las opciones según una estrategia.

Respuesta posible:

Sí, tenemos envío a San Mateo, David. La opción más económica cuesta $6.50 y normalmente tarda entre 1 y 2 días hábiles. ¿Prefieres entrega a domicilio o retiro en sucursal?

La IA redacta la respuesta, pero el sistema devuelve los datos calculados:

{
  "coincidencia": "exacta",
  "destino": "San Mateo",
  "provincia": "Chiriquí",
  "opciones": [
    {
      "transportista": "UnoExpress",
      "servicio": "Sucursal",
      "precioCliente": 6.50,
      "costoInterno": 4.50,
      "ganancia": 2.00,
      "tiempoEstimado": "1-2 días"
    }
  ]
}

El costoInterno y la ganancia nunca deben enviarse en la respuesta dirigida al cliente.

7. Recomendaciones automáticas

Cada empresa debería poder elegir su estrategia:

Estrategia	Comportamiento
Más económico para el cliente	Menor precio de venta
Mayor ganancia	Mayor margen para la empresa
Entrega más rápida	Menor tiempo estimado
Transportista preferido	Prioriza uno configurado
Mejor balance	Combina precio, tiempo y margen
Selección manual	Presenta opciones sin decidir

También pueden agregarse reglas:

No recomendar opciones inactivas.
No recomendar si se supera el peso máximo.
Ocultar transportistas, mostrando solamente el tipo de envío.
Solicitar dirección si la coincidencia es ambigua.
No inventar tarifas cuando no existe cobertura.
Indicar “requiere cotización” cuando no exista una tarifa fija.
8. Coincidencias con niveles de confianza

La API debería informar qué tan segura es la ubicación:

Nivel	Acción
Exacta	Cotizar directamente
Alias confirmado	Cotizar directamente
Probable	Confirmar ubicación con el cliente
Ambigua	Mostrar alternativas o preguntar provincia
Sin coincidencia	Informar que debe verificarse cobertura

Ejemplo ambiguo:

Encontré más de una ubicación llamada San José. ¿Te refieres a San José en San Miguelito o en David?

Esto evitará que la IA recomiende un envío incorrecto.

9. Pantallas recomendadas

La configuración podría dividirse en cuatro pestañas:

Información: nombre, país, moneda, contacto y estado.
Servicios: domicilio, sucursal, express y tiempos.
Matriz de tarifas: destinos, costos, precios y márgenes.
Condiciones: peso, dimensiones, cobertura, recargos y restricciones.

En la matriz deberían existir:

Edición tipo hoja de cálculo.
Filtros por país, provincia y servicio.
Acciones masivas para establecer margen.
Importación y exportación Excel.
Duplicación de tarifas.
Historial de cambios.
Simulador de cotización.
Botón “Probar cómo lo encontraría la IA”.
10. Recomendación final para Karia

La primera versión puede mantenerse sencilla:

País.
Provincia.
Zona o destino.
Alias.
Tipo de entrega.
Costo del transportista.
Precio al cliente.
Tiempo estimado.
Estado.
Importación Excel/CSV con revisión previa.

Luego se pueden agregar peso, dimensiones, coordenadas, recargos y fórmulas avanzadas.

La clave es que la IA solamente resuelva expresiones humanas como “Chorrera”, “por David” o “cerca de Boquete”. La disponibilidad, el precio, el margen y la recomendación final deben provenir del motor de tarifas de Karia. Así será más confiable, auditable y económico en consumo de tokens.


Sí. Lo recomendable es guardar un valor normalizado en minúsculas y aplicar exactamente el mismo proceso al texto utilizado en cada búsqueda.

No reemplazaría el nombre original. Guardaría ambos:

Nombre:       La Chorrera
Normalizado:  la chorrera

Esto permite mostrar correctamente el destino en la interfaz y usar una versión uniforme para buscar.

Regla de normalización

Tanto al guardar como al consultar:

Convertir a minúsculas.
Eliminar espacios iniciales y finales.
Reemplazar espacios consecutivos por uno.
Eliminar tildes.
Normalizar caracteres especiales.
Opcionalmente, eliminar puntuación irrelevante.

Ejemplos:

Texto recibido	Texto normalizado
La Chorrera	la chorrera
LA CHORRERA	la chorrera
Chiriquí Grande	chiriqui grande
David, San Mateo	david san mateo
Panamá-Oeste	panama oeste

La función debe producir siempre el mismo resultado:

Normalizar("CHIRIQUÍ Grande")
Normalizar("Chiriqui   Grande")
Normalizar("chiriquí-grande")

Resultado:

chiriqui grande
Alias

Aplicaría la misma regla a cada alias:

{
  "nombre": "La Chorrera",
  "nombreNormalizado": "la chorrera",
  "alias": [
    {
      "valor": "Chorrera",
      "valorNormalizado": "chorrera"
    },
    {
      "valor": "Panamá Oeste Chorrera",
      "valorNormalizado": "panama oeste chorrera"
    }
  ]
}

Para PostgreSQL, los campos normalizados pueden tener índices:

CREATE INDEX ix_destino_nombre_normalizado
ON destinos_transportista (nombre_normalizado);

CREATE INDEX ix_alias_valor_normalizado
ON destino_alias (valor_normalizado);
Flujo de búsqueda

Si el cliente escribe:

¿Tienen envíos para CHIRIQUÍ Grande?

Karia extraería la ubicación y la normalizaría:

Entrada:      CHIRIQUÍ Grande
Normalizada:  chiriqui grande

Luego buscaría por este orden:

Nombre normalizado exacto.
Alias normalizado exacto.
Coincidencia por provincia y destino.
Coincidencia aproximada para errores ortográficos.
Pregunta de aclaración si existen varias opciones.

La búsqueda exacta puede ser:

WHERE nombre_normalizado = @ubicacionNormalizada

No recomiendo usar directamente:

LOWER(nombre) = LOWER(@ubicacion)

Aunque funciona inicialmente, normalizar previamente permite índices más eficientes, elimina diferencias por tildes y garantiza el mismo comportamiento en todas las consultas.

Restricción importante

La combinación debería ser única dentro del contexto correspondiente:

Empresa + Transportista + País + Provincia + Servicio + Destino normalizado

Porque pueden existir nombres repetidos en diferentes provincias o transportistas.

En PostgreSQL:

CREATE UNIQUE INDEX ux_destino_transportista
ON destinos_transportista (
    empresa_id,
    transportista_id,
    pais_id,
    provincia_id,
    servicio_id,
    nombre_normalizado
);
Recomendación para IA

La IA no debería ser responsable de convertir manualmente la ubicación a minúsculas. Karia debe normalizar siempre el valor recibido, aunque provenga de:

La conversación.
Un formulario.
Una importación Excel.
Una llamada API.
Una acción de IA.
Una edición manual.

Por tanto, el contrato puede recibir el texto original:

{
  "ubicacion": "Chiriquí Grande",
  "pais": "Panamá"
}

Y el backend genera internamente:

{
  "ubicacionNormalizada": "chiriqui grande",
  "paisNormalizado": "panama"
}

Así se aplica una sola política en todo el sistema y no se depende del modelo de IA para mantener consistencia.