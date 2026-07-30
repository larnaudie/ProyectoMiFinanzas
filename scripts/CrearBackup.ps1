param(
  [switch]$Automatico
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

try {
  $raizProyecto = Split-Path -Parent $PSScriptRoot
  $carpetaBackups = Join-Path $raizProyecto "backups"
  $archivoEnv = Join-Path $raizProyecto "backend\.env"
  $mongoUri = Obtener-MongoUri -ArchivoEnv $archivoEnv

  $mongodump = Obtener-HerramientaMongo `
    -Nombre "mongodump.exe" `
    -RutaConocida "C:\Program Files\MongoDB\mongodb-database-tools-windows-x86_64-100.17.0\bin\mongodump.exe"
  $mongorestore = Obtener-HerramientaMongo `
    -Nombre "mongorestore.exe" `
    -RutaConocida "C:\Program Files\MongoDB\mongodb-database-tools-windows-x86_64-100.17.0\bin\mongorestore.exe"

  New-Item -ItemType Directory -Path $carpetaBackups -Force | Out-Null

  $marcaTiempo = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
  $archivoBackup = Join-Path $carpetaBackups "mifinanzas_$marcaTiempo.archive.gz"

  Write-Host ""
  Write-Host "Creando respaldo de MiFinanzas..." -ForegroundColor Cyan

  & $mongodump "--uri=$mongoUri" "--archive=$archivoBackup" --gzip
  if ($LASTEXITCODE -ne 0) {
    throw "mongodump finalizo con codigo $LASTEXITCODE."
  }

  $backup = Get-Item -LiteralPath $archivoBackup
  if ($backup.Length -le 0) {
    throw "El archivo generado esta vacio."
  }

  Write-Host "Verificando que el respaldo pueda restaurarse..." -ForegroundColor Cyan
  & $mongorestore "--uri=$mongoUri" "--archive=$archivoBackup" --gzip --dryRun
  if ($LASTEXITCODE -ne 0) {
    throw "La verificacion del respaldo finalizo con codigo $LASTEXITCODE."
  }

  $hash = Get-FileHash -LiteralPath $archivoBackup -Algorithm SHA256
  $archivoHash = "$archivoBackup.sha256.txt"
  @(
    "Archivo: $($backup.Name)"
    "Creado: $($backup.CreationTime.ToString('yyyy-MM-dd HH:mm:ss'))"
    "Bytes: $($backup.Length)"
    "SHA-256: $($hash.Hash)"
    "Verificacion: mongorestore --dryRun completado correctamente"
  ) | Set-Content -LiteralPath $archivoHash -Encoding UTF8

  Write-Host ""
  Write-Host "RESPALDO CREADO Y VERIFICADO" -ForegroundColor Green
  Write-Host "Archivo: $archivoBackup"
  Write-Host "Tamano:  $($backup.Length) bytes"
  Write-Host "SHA-256: $($hash.Hash)"

  if ($Automatico) {
    Write-Host "Este respaldo se creo automaticamente antes de restaurar." -ForegroundColor Yellow
  }
} catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
