# Flujo de importacion Excel

Este documento explica como funciona el modulo de importacion de Excel del backend de MiFinanzas.

La idea principal es esta:

1. El usuario importa un archivo Excel de movimientos bancarios.
2. El backend lee cada fila del Excel.
3. Cada fila se guarda como un `MovimientoImportado`.
4. Un movimiento importado NO es un gasto todavia.
5. Luego el usuario decide si ese movimiento se ignora, se vincula con un gasto existente o crea un gasto nuevo.

Esto respeta la regla central del proyecto: no crear gastos duplicados automaticamente.

---

## Archivos que participan

### Ruta principal

Archivo:

`v1/1-routes/importacionExcel.routes.js`

Este archivo define los endpoints del modulo.

Rutas actuales:

```txt
POST  /v1/importaciones/cuentas/:cuentaId/excel
GET   /v1/importaciones/cuentas/:cuentaId/movimientos?estado=pendiente
PATCH /v1/importaciones/movimientos/:id/ignorar
PATCH /v1/importaciones/movimientos/:id/vincular-gasto
POST  /v1/importaciones/movimientos/:id/crear-gasto
```

Todas estas rutas estan protegidas porque en `v1.routes.js` se monta `authenticateToken` antes de `/importaciones`.

---

## Donde nace el flujo

El flujo nace cuando el frontend o Postman llama a:

```txt
POST /v1/importaciones/cuentas/:cuentaId/excel
```

Ejemplo:

```txt
POST http://localhost:2000/v1/importaciones/cuentas/ID_DE_CUENTA/excel
```

Body en Postman:

```txt
form-data
excel: archivo.xls
```

La key debe llamarse `excel` porque la ruta usa:

```js
uploadExcel.single("excel")
```

---

## Middleware uploadExcel

Archivo:

`v1/middlewares/uploadExcel.middleware.js`

Este middleware usa `multer` con memoria:

```js
const storage = multer.memoryStorage();
```

Eso significa que el archivo no se guarda en una carpeta del servidor. Queda disponible temporalmente en:

```js
req.file.buffer
```

Ese `buffer` es lo que despues lee la libreria `xlsx`.

Si el archivo no es Excel, el middleware lo rechaza.

---

## Controller de importacion

Archivo:

`v1/2-controllers/importacionExcel.controller.js`

Funcion:

```js
importarExcel
```

Esta funcion toma tres datos importantes:

```js
const usuarioId = req.user.id;
const { cuentaId } = req.params;
const file = req.file;
```

### Que significa cada dato

`usuarioId`:
Sale del token JWT. Nunca viene del frontend. Sirve para que un usuario no acceda a datos de otro.

`cuentaId`:
Sale de la URL. Indica en que cuenta se importan los movimientos.

`file`:
Es el archivo Excel que subio el usuario. Lo deja disponible `multer`.

Luego llama al service:

```js
const resultado = await importarExcelService({
  usuarioId,
  cuentaId,
  file,
});
```

El controller no sabe leer Excel. Solo recibe request, llama al service y responde.

---

## Service de importacion

Archivo:

`v1/3-services/importacionExcel.service.js`

Aca vive la logica importante.

Funcion principal:

```js
importarExcelService({ usuarioId, cuentaId, file })
```

### Paso 1: validar archivo

Si no hay archivo:

```js
throw new Error("No se recibio ningun archivo Excel");
```

### Paso 2: leer movimientos del Excel

```js
const movimientos = obtenerMovimientos(file.buffer);
```

Aca se manda el buffer del archivo a una funcion interna.

---

## Como se lee el Excel

Funcion:

```js
obtenerMovimientos(buffer)
```

Esta funcion usa `xlsx`:

```js
const workbook = XLSX.read(buffer, {
  type: "buffer",
  cellDates: false,
});
```

Despues toma la primera hoja:

```js
const primeraHoja = workbook.SheetNames[0];
const worksheet = workbook.Sheets[primeraHoja];
```

Luego convierte la hoja a filas simples:

```js
const filas = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  defval: null,
  raw: false,
});
```

Con `header: 1`, cada fila queda como un array.

Ejemplo aproximado:

```js
[
  null,
  "28/05/2026",
  "614817902675",
  "COMPRA CON TARJETA DEBITO...",
  null,
  null,
  "-20.00",
  null,
  null,
  "$43.55"
]
```

---

## Como encuentra la tabla dentro del Excel

El Excel puede tener filas vacias o datos arriba. Por eso el codigo busca la fila que contiene estos encabezados:

```js
fila.includes("Fecha") &&
fila.includes("Referencia") &&
fila.includes("Tipo Movimiento")
```

Eso devuelve el indice de la fila de encabezados:

```js
const filaEncabezadosIndex = filas.findIndex(...);
```

Despues toma todo lo que viene debajo:

```js
const filasMovimientos = filas.slice(filaEncabezadosIndex + 1);
```

---

## Como convierte una fila en movimiento

Cada fila se transforma en un objeto simple:

```js
return {
  fechaBanco: parsearFecha(fila[1]),
  referenciaBanco: String(fila[2]),
  detalleOriginal: String(fila[3]),
  montoBancario,
  moneda: "UYU",
};
```

### Columnas usadas

En el Excel actual:

```txt
fila[1] = Fecha
fila[2] = Referencia
fila[3] = Tipo Movimiento / detalle
fila[6] = Debito
fila[8] = Credito
```

### Monto bancario

El codigo lee debito y credito:

```js
const debito = parsearMonto(fila[6]);
const credito = parsearMonto(fila[8]);
const montoBancario = debito !== 0 ? debito : credito;
```

Si hay debito, usa debito. Si no hay debito, usa credito.

En gastos normalmente el monto viene negativo. En ingresos puede venir positivo.

---

## Normalizacion del detalle

Antes de guardar, el detalle se normaliza:

```js
const detalleNormalizado = normalizarTexto(movimiento.detalleOriginal);
```

La funcion:

```js
normalizarTexto(texto)
```

Hace esto:

1. Convierte a minusculas.
2. Quita tildes.
3. Quita simbolos raros.
4. Reemplaza espacios multiples por un solo espacio.
5. Hace trim.

Ejemplo:

```txt
"COMPRA CON TARJETA DEBITO DLO.UBER.RIDES"
```

Pasa a algo parecido a:

```txt
"compra con tarjeta debito dlo uber rides"
```

Esto sirve para comparar textos y buscar posibles duplicados.

---

## Hash banco

Por cada movimiento se crea un `hashBanco`.

Funcion:

```js
crearHashBanco({
  usuarioId,
  cuentaId,
  referenciaBanco,
  fechaBanco,
  montoBancario,
  detalleNormalizado,
})
```

El hash se arma asi:

```js
[
  usuarioId,
  cuentaId,
  referenciaBanco,
  fecha,
  montoBancario,
  detalleNormalizado,
].join("|")
```

### Por que no usamos solo referenciaBanco

Porque en el Excel real vimos referencias repetidas.

Entonces el identificador seguro combina:

```txt
usuario + cuenta + referencia + fecha + monto + detalle
```

Esto permite detectar si el mismo movimiento ya fue importado antes.

---

## Movimiento existente

Antes de crear un movimiento nuevo, el service busca si ya existe:

```js
const movimientoExistente = await MovimientoImportado.findOne({
  usuarioId,
  cuentaId,
  hashBanco,
});
```

Si ya existe, no lo vuelve a crear.

Lo devuelve con estado:

```js
estado: "duplicado_importacion"
```

Esto significa:

> Esta fila del Excel ya habia sido importada antes.

---

## Posibles duplicados contra gastos manuales

Aunque el movimiento no haya sido importado antes, puede parecerse a un gasto que el usuario creo manualmente.

Por eso el service llama:

```js
buscarPosiblesDuplicados({
  usuarioId,
  cuentaId,
  fechaBanco,
  montoBancario,
  detalleNormalizado,
});
```

Esta funcion busca gastos del mismo usuario y misma cuenta, con:

1. Mismo monto bancario.
2. Fecha cercana: 7 dias antes o 7 dias despues.
3. Detalle parecido.

La ventana de fechas existe porque los bancos pueden cambiar la fecha real del movimiento.

Si encuentra gastos parecidos, devuelve el movimiento con estado:

```js
estado: "posible_duplicado"
```

Esto no significa duplicado seguro. Significa:

> El usuario deberia revisar antes de crear un gasto nuevo.

---

## Creacion del MovimientoImportado

Si no existe ya importado, se crea:

```js
const movimientoCreado = await MovimientoImportado.create({
  usuarioId,
  cuentaId,
  referenciaBanco: movimiento.referenciaBanco,
  fechaBanco: movimiento.fechaBanco,
  detalleOriginal: movimiento.detalleOriginal,
  detalleNormalizado,
  montoBancario: movimiento.montoBancario,
  moneda: movimiento.moneda,
  hashBanco,
  archivoNombre: file.originalname,
});
```

Por defecto queda con:

```js
estadoImportacion: "pendiente"
```

Ese default esta definido en el modelo.

---

## Modelo MovimientoImportado

Archivo:

`v1/0.1-models/movimientoImportado.model.js`

Campos importantes:

```js
usuarioId
cuentaId
gastoId
referenciaBanco
fechaBanco
detalleOriginal
detalleNormalizado
montoBancario
moneda
hashBanco
estadoImportacion
archivoNombre
```

### estadoImportacion

Puede ser:

```txt
pendiente
vinculado
ignorado
```

`pendiente`:
El movimiento se importo, pero el usuario aun no decidio que hacer.

`vinculado`:
El movimiento ya fue conectado con un gasto existente o con un gasto creado desde ese movimiento.

`ignorado`:
El usuario decidio no usar ese movimiento.

---

## Respuesta al importar Excel

El endpoint devuelve algo asi:

```json
{
  "message": "Excel importado correctamente",
  "totalLeidos": 54,
  "totalProcesados": 54,
  "movimientos": [
    {
      "estado": "nuevo",
      "movimiento": {
        "_id": "...",
        "estadoImportacion": "pendiente"
      },
      "posiblesDuplicados": []
    }
  ]
}
```

### Diferencia entre estado y estadoImportacion

`estado`:
Es un estado de respuesta para la vista previa.

Puede ser:

```txt
nuevo
duplicado_importacion
posible_duplicado
```

`estadoImportacion`:
Es el estado guardado en MongoDB.

Puede ser:

```txt
pendiente
vinculado
ignorado
```

---

# Bandeja de revision

Despues de importar, los movimientos quedan pendientes.

La bandeja permite decidir que hacer con cada movimiento.

---

## Listar movimientos importados

Endpoint:

```txt
GET /v1/importaciones/cuentas/:cuentaId/movimientos?estado=pendiente
```

Controller:

```js
obtenerMovimientosImportados
```

Service:

```js
obtenerMovimientosImportadosService
```

Busca movimientos por:

```js
usuarioId
cuentaId
estadoImportacion opcional
```

Si se manda:

```txt
?estado=pendiente
```

Solo devuelve pendientes.

---

## Ignorar movimiento

Endpoint:

```txt
PATCH /v1/importaciones/movimientos/:id/ignorar
```

No necesita body.

Service:

```js
ignorarMovimientoImportadoService
```

Hace esto:

```js
estadoImportacion: "ignorado"
gastoId: null
```

Sirve cuando el usuario decide que ese movimiento no debe convertirse en gasto.

---

## Vincular movimiento a gasto existente

Endpoint:

```txt
PATCH /v1/importaciones/movimientos/:id/vincular-gasto
```

Body:

```json
{
  "gastoId": "ID_DEL_GASTO"
}
```

Service:

```js
vincularMovimientoAGastoService
```

Flujo:

1. Busca el movimiento por `_id` y `usuarioId`.
2. Busca el gasto por `_id`, `usuarioId` y `cuentaId`.
3. Si el gasto no pertenece a la misma cuenta, no lo permite.
4. Guarda el `gastoId` en el movimiento.
5. Cambia `estadoImportacion` a `vinculado`.

Esto evita que un usuario vincule movimientos con gastos de otra cuenta o de otro usuario.

---

## Crear gasto desde movimiento importado

Endpoint:

```txt
POST /v1/importaciones/movimientos/:id/crear-gasto
```

Body posible:

```json
{
  "porcentaje": 100,
  "incluirMontoReal": true,
  "categoriaId": "ID_CATEGORIA",
  "subcategoriaId": "ID_SUBCATEGORIA",
  "cambiarEstado": true
}
```

Service:

```js
crearGastoDesdeMovimientoImportadoService
```

Flujo:

1. Busca el movimiento importado.
2. Verifica que no este ya vinculado.
3. Crea un gasto usando `crearGastoService`.
4. Usa datos del movimiento:
   - detalle
   - cuentaId
   - fecha
   - montoBancario
5. Usa datos del body si el usuario completo informacion:
   - porcentaje
   - incluirMontoReal
   - categoriaId
   - subcategoriaId
   - cambiarEstado
6. Guarda en el gasto:

```js
origen: {
  tipo: "excel",
  referenciaId: movimiento._id,
}
```

7. Marca el movimiento como vinculado.

---

## Relacion entre MovimientoImportado y Gasto

Un movimiento importado puede terminar en:

```txt
ignorado
vinculado a gasto existente
vinculado a gasto nuevo
```

Cuando se crea un gasto desde un movimiento, el gasto queda conectado asi:

```js
gasto.origen.tipo = "excel"
gasto.origen.referenciaId = movimiento._id
```

Y el movimiento queda conectado asi:

```js
movimiento.gastoId = gasto._id
movimiento.estadoImportacion = "vinculado"
```

Eso permite ir desde el movimiento al gasto y desde el gasto al movimiento.

---

# Flujo completo resumido

## Caso 1: importar Excel por primera vez

1. Usuario sube Excel.
2. Backend lee filas.
3. Crea movimientos importados.
4. Todos quedan `pendiente`.
5. Frontend muestra vista previa.

## Caso 2: importar el mismo Excel otra vez

1. Usuario sube Excel.
2. Backend calcula `hashBanco`.
3. Si ya existe, no crea duplicado.
4. Devuelve `duplicado_importacion`.

## Caso 3: movimiento parecido a gasto manual

1. Usuario sube Excel.
2. Backend compara contra gastos existentes.
3. Si encuentra coincidencias cercanas, devuelve `posible_duplicado`.
4. Frontend deberia mostrar opciones para vincular.

## Caso 4: ignorar movimiento

1. Usuario decide ignorar.
2. Backend cambia estado a `ignorado`.
3. No se crea gasto.

## Caso 5: vincular a gasto existente

1. Usuario selecciona gasto existente.
2. Backend verifica mismo usuario y misma cuenta.
3. Movimiento queda `vinculado`.
4. No se crea gasto nuevo.

## Caso 6: crear gasto desde movimiento

1. Usuario decide crear gasto.
2. Backend toma datos del movimiento.
3. Crea gasto con origen `excel`.
4. Movimiento queda `vinculado`.

---

# Donde nace y donde muere cada flujo

## Importar Excel

Nace en:

```txt
POST /v1/importaciones/cuentas/:cuentaId/excel
```

Pasa por:

```txt
routes -> uploadExcel -> controller -> service -> obtenerMovimientos -> MovimientoImportado.create
```

Muere en:

```txt
Respuesta JSON con movimientos procesados
```

## Ignorar movimiento

Nace en:

```txt
PATCH /v1/importaciones/movimientos/:id/ignorar
```

Pasa por:

```txt
routes -> controller -> service -> MovimientoImportado.findOneAndUpdate
```

Muere en:

```txt
Movimiento con estadoImportacion = ignorado
```

## Vincular movimiento

Nace en:

```txt
PATCH /v1/importaciones/movimientos/:id/vincular-gasto
```

Pasa por:

```txt
routes -> controller -> service -> busca MovimientoImportado -> busca Gasto -> movimiento.save
```

Muere en:

```txt
Movimiento con estadoImportacion = vinculado y gastoId asignado
```

## Crear gasto desde movimiento

Nace en:

```txt
POST /v1/importaciones/movimientos/:id/crear-gasto
```

Pasa por:

```txt
routes -> controller -> service -> crearGastoService -> movimiento.save
```

Muere en:

```txt
Gasto creado + MovimientoImportado vinculado
```

---

# Ideas importantes para recordar

- Importar Excel no crea gastos automaticamente.
- Cada fila del Excel se guarda primero como MovimientoImportado.
- El usuario decide que hacer con cada movimiento.
- `hashBanco` evita importar dos veces el mismo movimiento.
- `posible_duplicado` ayuda a detectar gastos manuales similares.
- `usuarioId` siempre sale del token.
- `cuentaId` siempre define el contexto de trabajo.
- Un gasto creado desde Excel queda con `origen.tipo = "excel"`.
- Un movimiento vinculado ya no deberia tratarse como pendiente.

---

# Endpoints para probar en Postman

## Importar Excel

```txt
POST {{baseUrl}}/importaciones/cuentas/{{cuentaId}}/excel
```

Body:

```txt
form-data
excel: archivo.xls
```

## Listar pendientes

```txt
GET {{baseUrl}}/importaciones/cuentas/{{cuentaId}}/movimientos?estado=pendiente
```

## Ignorar

```txt
PATCH {{baseUrl}}/importaciones/movimientos/{{movimientoId}}/ignorar
```

Sin body.

## Vincular gasto existente

```txt
PATCH {{baseUrl}}/importaciones/movimientos/{{movimientoId}}/vincular-gasto
```

Body:

```json
{
  "gastoId": "{{gastoId}}"
}
```

## Crear gasto desde movimiento

```txt
POST {{baseUrl}}/importaciones/movimientos/{{movimientoId}}/crear-gasto
```

Body minimo:

```json
{}
```

Body completo:

```json
{
  "porcentaje": 100,
  "incluirMontoReal": true,
  "categoriaId": "{{categoriaId}}",
  "subcategoriaId": "{{subcategoriaId}}",
  "cambiarEstado": true
}
```
