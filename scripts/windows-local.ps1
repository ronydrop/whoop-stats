param([ValidateSet('iniciar', 'parar', 'conectar')][string]$Acao = 'iniciar')
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$config = @{}
foreach ($linha in Get-Content -LiteralPath '.env' -Encoding UTF8) {
    if ($linha -match '^([A-Z_]+)=(.*)$') { $config[$Matches[1]] = $Matches[2].Trim('"') }
}
$pgBin = $config['POSTGRES_BIN']
$pgData = Join-Path $raiz 'data\postgres'
$estado = Join-Path $raiz 'data\processos.json'
if ($Acao -eq 'parar') {
    if (Test-Path -LiteralPath $estado) {
        $apps = Get-Content -LiteralPath $estado -Raw | ConvertFrom-Json
        foreach ($app in $apps) {
            $processo = Get-CimInstance Win32_Process -Filter "ProcessId=$($app.id)"
            if ($processo -and $processo.CreationDate.ToUniversalTime().ToString('o') -eq $app.inicio) {
                Stop-Process -Id $app.id
            }
        }
        Remove-Item -LiteralPath $estado
    }
    & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData status | Out-Null
    if ($LASTEXITCODE -eq 0) { & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -m fast -w stop }
    exit 0
}
if ($Acao -eq 'conectar') {
    foreach ($chave in $config.Keys) { [Environment]::SetEnvironmentVariable($chave, $config[$chave], 'Process') }
    & '.\bin\whoop-auth.exe'
    exit $LASTEXITCODE
}
& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData status | Out-Null
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -l (Join-Path $raiz 'data\postgres.log') -w start
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível iniciar o banco de dados local.' }
}
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
$registros = @()
if (Test-Path -LiteralPath $estado) { $registros = Get-Content -LiteralPath $estado -Raw | ConvertFrom-Json }
function Iniciar-App($porta, $arquivo, $argumentos, $pasta, $nome) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $porta -ErrorAction SilentlyContinue
    if ($listener) {
        $registrado = $registros | Where-Object { $_.id -eq $listener[0].OwningProcess }
        if (!$registrado) { throw "A porta $porta está sendo usada por outro programa." }
        return $registrado
    }
    $novo = Start-Process -FilePath $arquivo -ArgumentList $argumentos -WorkingDirectory $pasta -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $raiz "data\$nome.log") -RedirectStandardError (Join-Path $raiz "data\$nome-erros.log")
    $info = Get-CimInstance Win32_Process -Filter "ProcessId=$($novo.Id)"
    return @{ id = $novo.Id; inicio = $info.CreationDate.ToUniversalTime().ToString('o') }
}
$servidor = Iniciar-App 8085 (Join-Path $raiz 'bin\whoop-stats.exe') @('--mode=poll', "--user=$($config['WHOOP_USER_ID'])") $raiz 'servidor'
$painel = Iniciar-App 3032 $config['NODE_EXE'] @('node_modules\next\dist\bin\next', 'start', '-H', '127.0.0.1', '-p', '3032') (Join-Path $raiz 'web') 'painel'
ConvertTo-Json -InputObject @($servidor, $painel) | Set-Content -LiteralPath $estado -Encoding UTF8
for ($tentativa = 0; $tentativa -lt 30; $tentativa++) {
    try {
        $resposta = Invoke-WebRequest -Uri 'http://localhost:3032' -UseBasicParsing -TimeoutSec 5
        if ($resposta.StatusCode -eq 200) {
            Start-Process 'http://localhost:3032'
            Write-Host 'WHOOP em Português disponível em http://localhost:3032'
            exit 0
        }
    } catch { Start-Sleep -Seconds 2 }
}
throw 'O painel não respondeu. Verifique os registros na pasta data.'
