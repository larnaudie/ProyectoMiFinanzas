param(
  [switch]$SoloValidar
)

$ErrorActionPreference = "Stop"

function Obtener-MongoUri {
  param([string]$ArchivoEnv)

  if (-not (Test-Path -LiteralPath $ArchivoEnv -PathType Leaf)) {
    throw "No se encontro backend/.env."
  }

  $linea = Get-Content -LiteralPath $ArchivoEnv |
    Where-Object { $_ -match "^\s*MONGO_URI\s*=" } |
    Select-Object -First 1

  if (-not $linea) {
    throw "No se encontro MONGO_URI en backend/.env."
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

function Probar-Backup {
  param(
    [string]$MongoRestore,
    [string]$MongoUri,
    [string]$Archivo
  )

  Write-Host "Verificando $([System.IO.Path]::GetFileName($Archivo))..." -ForegroundColor Cyan
  & $MongoRestore "--uri=$MongoUri" "--archive=$Archivo" --gzip --dryRun
  if ($LASTEXITCODE -ne 0) {
    throw "El respaldo seleccionado no supero la verificacion."
  }
}

try {
  $raizProyecto = Split-Path -Parent $PSScriptRoot
  $carpetaBackups = Join-Path $raizProyecto "backups"
  $archivoEnv = Join-Path $raizProyecto "backend\.env"
  $scriptCrearBackup = Join-Path $PSScriptRoot "CrearBackup.ps1"
  $mongoUri = Obtener-MongoUri -ArchivoEnv $archivoEnv
  $mongorestore = Obtener-HerramientaMongo `
    -Nombre "mongorestore.exe" `
    -RutaConocida "C:\Program Files\MongoDB\mongodb-database-tools-windows-x86_64-100.17.0\bin\mongorestore.exe"

  $backups = @(
    Get-ChildItem -LiteralPath $carpetaBackups -Filter "*.archive.gz" -File |
      Sort-Object LastWriteTime -Descending
  )

  if ($backups.Count -eq 0) {
    throw "No hay respaldos .archive.gz en la carpeta backups."
  }

  if ($SoloValidar) {
    Probar-Backup `
      -MongoRestore $mongorestore `
      -MongoUri $mongoUri `
      -Archivo $backups[0].FullName
    Write-Host "Validacion completada sin restaurar datos." -ForegroundColor Green
    return
  }

  Write-Host ""
  Write-Host "RESPALDOS DISPONIBLES" -ForegroundColor Cyan
  Write-Host ""
  for ($indice = 0; $indice -lt $backups.Count; $indice++) {
    $numero = $indice + 1
    $tamanoKb = [Math]::Round($backups[$indice].Length / 1KB, 1)
    Write-Host "[$numero] $($backups[$indice].Name) - $tamanoKb KB"
  }
  Write-Host "[0] Cancelar"
  Write-Host ""

  $seleccionTexto = Read-Host "Elegi el numero del respaldo"
  $seleccion = 0
  if (-not [int]::TryParse($seleccionTexto, [ref]$seleccion)) {
    throw "La seleccion no es valida."
  }
  if ($seleccion -eq 0) {
    Write-Host "Operacion cancelada. No se modifico ningun dato." -ForegroundColor Yellow
    return
  }
  if ($seleccion -lt 1 -or $seleccion -gt $backups.Count) {
    throw "La seleccion esta fuera de rango."
  }

  $backupElegido = $backups[$seleccion - 1]
  Probar-Backup `
    -MongoRestore $mongorestore `
    -MongoUri $mongoUri `
    -Archivo $backupElegido.FullName

  Write-Host ""
  Write-Host "DESTINO DE LA RESTAURACION" -ForegroundColor Cyan
  Write-Host "[1] Crear una base de prueba separada (recomendado)"
  Write-Host "[2] Reemplazar la base miFinanzas actual"
  Write-Host "[0] Cancelar"
  Write-Host ""

  $modo = Read-Host "Elegi una opcion"
  if ($modo -eq "0") {
    Write-Host "Operacion cancelada. No se modifico ningun dato." -ForegroundColor Yellow
    return
  }

  if ($modo -eq "1") {
    $basePrueba = "miFinanzas_restaurada_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

    Write-Host ""
    Write-Host "Restaurando una copia segura en $basePrueba..." -ForegroundColor Cyan
    & $mongorestore `
      "--uri=$mongoUri" `
      "--archive=$($backupElegido.FullName)" `
      --gzip `
      "--nsFrom=miFinanzas.*" `
      "--nsTo=$basePrueba.*"

    if ($LASTEXITCODE -ne 0) {
      throw "La restauracion finalizo con codigo $LASTEXITCODE."
    }

    Write-Host ""
    Write-Host "COPIA DE PRUEBA RESTAURADA" -ForegroundColor Green
    Write-Host "Base creada: $basePrueba"
    Write-Host "La base miFinanzas actual no fue modificada."
    Write-Host "Consulta el manual para conectar temporalmente la aplicacion."
    return
  }

  if ($modo -ne "2") {
    throw "La opcion seleccionada no es valida."
  }

  Write-Host ""
  Write-Host "ATENCION: se reemplazaran las colecciones actuales de miFinanzas." -ForegroundColor Red
  Write-Host "Antes de continuar, cerra el servidor backend para evitar escrituras." -ForegroundColor Yellow
  $confirmacion = Read-Host "Escribi RESTAURAR para confirmar"

  if ($confirmacion -cne "RESTAURAR") {
    Write-Host "Confirmacion incorrecta. No se modifico ningun dato." -ForegroundColor Yellow
    return
  }

  Write-Host ""
  Write-Host "Creando respaldo automatico del estado actual..." -ForegroundColor Cyan
  & $scriptCrearBackup -Automatico

  Write-Host ""
  Write-Host "Restaurando el punto seleccionado..." -ForegroundColor Cyan
  & $mongorestore `
    "--uri=$mongoUri" `
    "--archive=$($backupElegido.FullName)" `
    --gzip `
    --drop `
    "--nsInclude=miFinanzas.*"

  if ($LASTEXITCODE -ne 0) {
    throw "La restauracion finalizo con codigo $LASTEXITCODE."
  }

  Write-Host ""
  Write-Host "BASE RESTAURADA CORRECTAMENTE" -ForegroundColor Green
  Write-Host "Reinicia el backend y actualiza la pagina."
} catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
