param(
  [switch]$SoloValidar
)

$ErrorActionPreference = "Stop"

function Obtener-MongoUri {
  param(
    [string]$ArchivoEnv,
    [string]$Descripcion
  )

  if (-not (Test-Path -LiteralPath $ArchivoEnv -PathType Leaf)) {
    throw "No se encontro $Descripcion en $ArchivoEnv."
  }

  $linea = Get-Content -LiteralPath $ArchivoEnv |
    Where-Object { $_ -match "^\s*MONGO_URI\s*=" } |
    Select-Object -First 1

  if (-not $linea) {
    throw "No se encontro MONGO_URI en $ArchivoEnv."
  }

  $valor = ($linea -replace "^\s*MONGO_URI\s*=\s*", "").Trim()
  $valor = $valor.Trim('"')
  return $valor.Trim("'")
}

function Obtener-HerramientaMongo {
  param(
    [string]$Nombre,
    [string]$RutaConocida
  )

  $comando = Get-Command $Nombre -ErrorAction SilentlyContinue
  if ($comando) {
    return $comando.Source
  }

  if (Test-Path -LiteralPath $RutaConocida -PathType Leaf) {
    return $RutaConocida
  }

  throw "No se encontro $Nombre. Instala MongoDB Database Tools."
}

function Invocar-MongoSinExponerConexion {
  param(
    [string]$Herramienta,
    [string[]]$Argumentos,
    [string]$MongoUri
  )

  $salida = @(& $Herramienta @Argumentos 2>&1)
  $codigoSalida = $LASTEXITCODE
  $credenciales = ""

  if ($MongoUri -match "^mongodb(?:\+srv)?://(?<credenciales>.+)@") {
    $credenciales = $Matches.credenciales
  }

  foreach ($lineaSalida in $salida) {
    $lineaSegura = $lineaSalida.ToString().Replace($MongoUri, "mongodb+srv://***@ATLAS/miFinanzas")
    if ($credenciales) {
      $lineaSegura = $lineaSegura.Replace($credenciales, "***")
    }
    Write-Host $lineaSegura
  }

  return $codigoSalida
}

try {
  $raizProyecto = Split-Path -Parent $PSScriptRoot
  $archivoEnvLocal = Join-Path $raizProyecto "backend\.env"
  $archivoEnvAtlas = Join-Path $raizProyecto "backend\.env.atlas"
  $carpetaBackups = Join-Path $raizProyecto "backups"
  $scriptCrearBackup = Join-Path $PSScriptRoot "CrearBackup.ps1"
  $scriptMigracion = Join-Path $raizProyecto "backend\scripts\migrarMongoAtlas.mongosh.js"

  $mongoLocalUri = Obtener-MongoUri `
    -ArchivoEnv $archivoEnvLocal `
    -Descripcion "la configuracion local"
  $mongoAtlasUri = Obtener-MongoUri `
    -ArchivoEnv $archivoEnvAtlas `
    -Descripcion "la configuracion privada de Atlas"

  if ($mongoLocalUri -eq $mongoAtlasUri) {
    throw "La base de origen y la de destino no pueden ser la misma."
  }
  if ($mongoAtlasUri -notmatch "^mongodb\+srv://") {
    throw "La URI de destino no parece pertenecer a MongoDB Atlas."
  }

  $mongodump = Obtener-HerramientaMongo `
    -Nombre "mongodump.exe" `
    -RutaConocida "C:\Program Files\MongoDB\mongodb-database-tools-windows-x86_64-100.17.0\bin\mongodump.exe"
  $mongosh = Obtener-HerramientaMongo `
    -Nombre "mongosh.exe" `
    -RutaConocida "C:\Program Files\MongoDB\mongosh-2.7.0-win32-x64\bin\mongosh.exe"
  Write-Host "Creando un respaldo nuevo de la base local..." -ForegroundColor Cyan
  & $scriptCrearBackup -Automatico
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo crear el respaldo local."
  }

  $backupLocal = Get-ChildItem -LiteralPath $carpetaBackups -Filter "mifinanzas_*.archive.gz" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $backupLocal) {
    throw "No se encontro el respaldo local recien creado."
  }

  Write-Host "Comprobando la conexion y comparando las bases..." -ForegroundColor Cyan
  $env:MONGO_LOCAL_MIGRATION_URI = $mongoLocalUri
  $env:MONGO_ATLAS_MIGRATION_URI = $mongoAtlasUri
  $env:MONGO_MIGRATION_MODE = "validar"
  try {
    $codigoValidacion = Invocar-MongoSinExponerConexion `
      -Herramienta $mongosh `
      -Argumentos @("--nodb", "--quiet", "--file", $scriptMigracion) `
      -MongoUri $mongoAtlasUri
    if ($codigoValidacion -ne 0) {
      throw "Atlas rechazo la conexion o el respaldo no pudo validarse."
    }
  } finally {
    Remove-Item Env:MONGO_LOCAL_MIGRATION_URI -ErrorAction SilentlyContinue
    Remove-Item Env:MONGO_ATLAS_MIGRATION_URI -ErrorAction SilentlyContinue
    Remove-Item Env:MONGO_MIGRATION_MODE -ErrorAction SilentlyContinue
  }

  if ($SoloValidar) {
    Write-Host "Conexion con Atlas y respaldo validados. No se importaron datos." -ForegroundColor Green
    return
  }

  Write-Host ""
  Write-Host "La importacion copiara usuarios, bancos, cuentas, categorias y movimientos." -ForegroundColor Yellow
  Write-Host "Si Atlas ya contiene colecciones llamadas miFinanzas, se reemplazaran." -ForegroundColor Yellow
  $confirmacion = Read-Host "Escribi MIGRAR para confirmar"

  if ($confirmacion -cne "MIGRAR") {
    Write-Host "Operacion cancelada. Atlas no fue modificado." -ForegroundColor Yellow
    return
  }

  $marcaTiempo = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
  $backupAtlas = Join-Path $carpetaBackups "atlas_antes_de_migrar_$marcaTiempo.archive.gz"

  Write-Host "Respaldando primero el estado actual de Atlas..." -ForegroundColor Cyan
  $codigoBackupAtlas = Invocar-MongoSinExponerConexion `
    -Herramienta $mongodump `
    -Argumentos @("--uri=$mongoAtlasUri", "--archive=$backupAtlas", "--gzip") `
    -MongoUri $mongoAtlasUri
  if ($codigoBackupAtlas -ne 0) {
    throw "No se pudo respaldar Atlas; la importacion fue cancelada."
  }

  Write-Host "Importando documentos e indices en Atlas..." -ForegroundColor Cyan
  $env:MONGO_LOCAL_MIGRATION_URI = $mongoLocalUri
  $env:MONGO_ATLAS_MIGRATION_URI = $mongoAtlasUri
  $env:MONGO_MIGRATION_MODE = "migrar"
  try {
    $codigoImportacion = Invocar-MongoSinExponerConexion `
      -Herramienta $mongosh `
      -Argumentos @("--nodb", "--quiet", "--file", $scriptMigracion) `
      -MongoUri $mongoAtlasUri
    if ($codigoImportacion -ne 0) {
      throw "La importacion a Atlas finalizo con codigo $codigoImportacion."
    }
  } finally {
    Remove-Item Env:MONGO_LOCAL_MIGRATION_URI -ErrorAction SilentlyContinue
    Remove-Item Env:MONGO_ATLAS_MIGRATION_URI -ErrorAction SilentlyContinue
    Remove-Item Env:MONGO_MIGRATION_MODE -ErrorAction SilentlyContinue
  }

  Write-Host ""
  Write-Host "DATOS IMPORTADOS CORRECTAMENTE EN MONGODB ATLAS" -ForegroundColor Green
  Write-Host "Respaldo local utilizado: $($backupLocal.Name)"
  Write-Host "Respaldo previo de Atlas: $([System.IO.Path]::GetFileName($backupAtlas))"
} catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
