const modo = process.env.MONGO_MIGRATION_MODE;
const localUri = process.env.MONGO_LOCAL_MIGRATION_URI;
const atlasUri = process.env.MONGO_ATLAS_MIGRATION_URI;

if (!new Set(["validar", "migrar"]).has(modo)) {
  throw new Error("Modo de migracion invalido");
}
if (!localUri || !atlasUri) {
  throw new Error("Faltan las conexiones privadas para la migracion");
}

const origen = new Mongo(localUri).getDB("miFinanzas");
const destino = new Mongo(atlasUri).getDB("miFinanzas");
const nombresColecciones = (base) => base.getCollectionNames()
  .filter((nombre) => !nombre.startsWith("system."))
  .sort();

const coleccionesOrigen = nombresColecciones(origen);
const coleccionesDestino = nombresColecciones(destino);
const cantidadesOrigen = new Map();

let documentosOrigen = 0;
for (const nombre of coleccionesOrigen) {
  const cantidad = origen.getCollection(nombre).countDocuments({});
  cantidadesOrigen.set(nombre, cantidad);
  documentosOrigen += cantidad;
}

let documentosDestino = 0;
for (const nombre of coleccionesDestino) {
  documentosDestino += destino.getCollection(nombre).countDocuments({});
}

print(`Origen local: ${coleccionesOrigen.length} colecciones, ${documentosOrigen} documentos`);
print(`Destino Atlas: ${coleccionesDestino.length} colecciones, ${documentosDestino} documentos`);

if (modo === "validar") {
  print("Conexion validada. No se modificaron datos.");
} else {
  for (const nombre of coleccionesDestino.filter((item) => !coleccionesOrigen.includes(item))) {
    destino.getCollection(nombre).drop();
  }

  for (const nombre of coleccionesOrigen) {
    const coleccionOrigen = origen.getCollection(nombre);
    const coleccionDestino = destino.getCollection(nombre);
    const indices = coleccionOrigen.getIndexes();

    if (coleccionesDestino.includes(nombre)) {
      coleccionDestino.drop();
    }
    destino.createCollection(nombre);

    const documentos = coleccionOrigen.find({}).toArray();
    for (let inicio = 0; inicio < documentos.length; inicio += 500) {
      coleccionDestino.insertMany(documentos.slice(inicio, inicio + 500), { ordered: true });
    }

    for (const indice of indices.filter(({ name }) => name !== "_id_")) {
      const opciones = { ...indice };
      delete opciones.key;
      delete opciones.v;
      delete opciones.ns;
      delete opciones.buildUUID;
      coleccionDestino.createIndex(indice.key, opciones);
    }

    const cantidadEsperada = cantidadesOrigen.get(nombre);
    const cantidadCopiada = coleccionDestino.countDocuments({});
    if (cantidadCopiada !== cantidadEsperada) {
      throw new Error(
        `La coleccion ${nombre} tiene ${cantidadCopiada} documentos; se esperaban ${cantidadEsperada}`,
      );
    }

    print(`${nombre}: ${cantidadCopiada} documentos e indices copiados`);
  }

  const coleccionesFinales = nombresColecciones(destino);
  let documentosFinales = 0;
  for (const nombre of coleccionesFinales) {
    documentosFinales += destino.getCollection(nombre).countDocuments({});
  }

  if (documentosFinales !== documentosOrigen) {
    throw new Error(
      `Atlas tiene ${documentosFinales} documentos; se esperaban ${documentosOrigen}`,
    );
  }

  print(`Migracion verificada: ${documentosFinales} documentos en Atlas`);
}
