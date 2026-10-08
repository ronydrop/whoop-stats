param([ValidateSet('iniciar', 'parar', 'conectar')][string]$Acao = 'iniciar', [switch]$SemAbrir)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$hash = [System.Security.Cryptography.SHA256]::Create()
$identificador = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($raiz.ToLowerInvariant()))).Replace('-', '')
$hash.Dispose()
$mutex = New-Object Threading.Mutex($false, "Local\WhoopStats-$identificador")
$adquirido = $false
try {
    try { $adquirido = $mutex.WaitOne(60000) } catch [Threading.AbandonedMutexException] { $adquirido = $true }
    if (!$adquirido) { throw 'Outra inicialização do WHOOP ainda está em andamento.' }
$config = @{}
foreach ($linha in Get-Content -LiteralPath '.env' -Encoding UTF8) {
    if ($linha -match '^([A-Z_]+)=(.*)$') { $config[$Matches[1]] = $Matches[2].Trim('"') }
}
$pgBin = $config['POSTGRES_BIN']
$pgData = Join-Path $raiz 'data\postgres'
$estado = Join-Path $raiz 'data\processos.json'
$registros = @()
if (Test-Path -LiteralPath $estado) { $registros = (Get-Content -LiteralPath $estado -Raw | ConvertFrom-Json) }
function Confirmar-Processo($registro, $arquivo, $argumentos) {
    if (!$registro.id -or !$registro.inicio -or !$registro.arquivo) { return $false }
    $processo = Get-CimInstance Win32_Process -Filter "ProcessId=$($registro.id)"
    return $processo -and $processo.CreationDate.ToUniversalTime() -eq ([datetime]$registro.inicio).ToUniversalTime() -and ([IO.Path]::GetFullPath($processo.ExecutablePath) -eq [IO.Path]::GetFullPath($arquivo)) -and $processo.CommandLine -like "*$argumentos*"
}
function Salvar-Estado {
    $temporario = "$estado.tmp"
    ConvertTo-Json -InputObject @($script:registros) | Set-Content -LiteralPath $temporario -Encoding UTF8
    Move-Item -LiteralPath $temporario -Destination $estado -Force
}
$script:registros = @($registros | Where-Object { $_.id -and $_.inicio -and $_.arquivo -and $_.porta })
Salvar-Estado
if ($Acao -eq 'parar') {
    foreach ($app in $registros) {
        if ($app.arquivo -and (Confirmar-Processo $app $app.arquivo $app.argumentos)) { Stop-Process -Id $app.id }
    }
    $script:registros = @()
    Salvar-Estado
    & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData status | Out-Null
    if ($LASTEXITCODE -eq 0) { & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -m fast -w stop }
    exit 0
}
if ($Acao -eq 'conectar') {
    foreach ($chave in $config.Keys) { [Environment]::SetEnvironmentVariable($chave, $config[$chave], 'Process') }
    & '.\bin\whoop-auth.exe'
    exit $LASTEXITCODE
}
$logs = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Codex\whoop-stats\execucao-local'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData status | Out-Null
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -l (Join-Path $logs 'postgres.log') -w start
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível iniciar o banco de dados local.' }
}
$env:PGPASSWORD = $config['POSTGRES_PASSWORD']
try {
    & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p 55439 -U $config['POSTGRES_USER'] -d whoop_stats -v ON_ERROR_STOP=1 -f (Join-Path $raiz 'migrations\000002_sync_status.up.sql') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível aplicar a migração de estado da sincronização.' }
    & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p 55439 -U $config['POSTGRES_USER'] -d whoop_stats -v ON_ERROR_STOP=1 -f (Join-Path $raiz 'migrations\000003_cycle_steps.up.sql') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível aplicar a migração de passos.' }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
$env:WHOOP_STATS_DATABASE_URL = "postgres://$($config['POSTGRES_USER']):$($config['POSTGRES_PASSWORD'])@127.0.0.1:55439/whoop_stats?sslmode=disable"
$env:WHOOP_STATS_SERVER_PORT = '8085'
$env:WHOOP_STATS_ENCRYPTION_KEY = $config['ENCRYPTION_KEY']
$env:WHOOP_STATS_WHOOP_CLIENT_ID = $config['WHOOP_CLIENT_ID']
$env:WHOOP_STATS_WHOOP_CLIENT_SECRET = $config['WHOOP_CLIENT_SECRET']
$env:WHOOP_STATS_CORS_ALLOWED_ORIGINS = 'http://localhost:3032'
$env:WHOOP_STATS_LOG_LEVEL = 'info'
$env:GOMAXPROCS = '2'
$env:WHOOP_STATS_WHOOP_USER_ID = $config['WHOOP_USER_ID']
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8085'
$env:NODE_ENV = 'production'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:TZ = 'America/Sao_Paulo'
function Aguardar-Saude($url) {
    for ($tentativa = 0; $tentativa -lt 30; $tentativa++) {
        try { if ((Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { return } } catch { }
        Start-Sleep -Seconds 1
    }
    throw "O serviço $url não respondeu. Consulte $logs."
}
function Iniciar-App($porta, $arquivo, $argumentos, $pasta, $nome, $url) {
    $listener = @(Get-NetTCPConnection -State Listen -LocalPort $porta -ErrorAction SilentlyContinue)
    if ($listener.Count) {
        $registrado = $script:registros | Where-Object { $_.id -eq $listener[0].OwningProcess } | Select-Object -First 1
        if (!$registrado -or !(Confirmar-Processo $registrado $arquivo ($argumentos -join ' '))) {
            $ocupante = Get-Process -Id $listener[0].OwningProcess -ErrorAction SilentlyContinue
            throw "A porta $porta pertence ao processo $($listener[0].OwningProcess) ($($ocupante.ProcessName)). Nenhum processo foi encerrado."
        }
        Aguardar-Saude $url
        return
    }
    $novo = Start-Process -FilePath $arquivo -ArgumentList $argumentos -WorkingDirectory $pasta -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "$nome.log") -RedirectStandardError (Join-Path $logs "$nome-erros.log")
    $info = Get-CimInstance Win32_Process -Filter "ProcessId=$($novo.Id)"
    if (!$info) { throw "O serviço $nome encerrou durante a inicialização. Consulte $logs." }
    $script:registros = @($script:registros | Where-Object { $_.porta -ne $porta }) + @{ id = $novo.Id; inicio = $info.CreationDate.ToUniversalTime().ToString('o'); arquivo = $arquivo; argumentos = ($argumentos -join ' '); porta = $porta }
    Salvar-Estado
    Aguardar-Saude $url
}
Iniciar-App 8085 (Join-Path $raiz 'bin\whoop-stats.exe') @('--mode=poll', "--user=$($config['WHOOP_USER_ID'])") $raiz 'servidor' 'http://127.0.0.1:8085/healthz'
Iniciar-App 3032 $config['NODE_EXE'] @('node_modules\next\dist\bin\next', 'start', '-H', '127.0.0.1', '-p', '3032') (Join-Path $raiz 'web') 'painel' 'http://localhost:3032'
if (!$SemAbrir) { Start-Process 'http://localhost:3032' }
Write-Host 'WHOOP Metrics disponível em http://localhost:3032'

} finally {
    if ($adquirido) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
