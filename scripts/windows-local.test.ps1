param([Parameter(Mandatory = $true)][string]$DiretorioEvidencias)
$ErrorActionPreference = 'Stop'
$tokens = $null
$erros = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'windows-local.ps1'), [ref]$tokens, [ref]$erros)
if ($erros.Count) { throw 'O iniciador contém erros de sintaxe.' }
foreach ($nome in @('Confirmar-Processo', 'Salvar-Estado', 'Iniciar-App')) {
    $funcao = $ast.Find({ param($no) $no -is [Management.Automation.Language.FunctionDefinitionAst] -and $no.Name -eq $nome }, $true)
    Invoke-Expression $funcao.Extent.Text
}
New-Item -ItemType Directory -Force -Path $DiretorioEvidencias | Out-Null
$logs = $DiretorioEvidencias
$estado = Join-Path $DiretorioEvidencias 'processos-teste.json'
$script:registros = @()
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$porta = $listener.LocalEndpoint.Port
try {
    $diagnostico = $null
    try { Iniciar-App $porta 'inexistente.exe' @() $PSScriptRoot 'teste' 'http://localhost' } catch { $diagnostico = $_.Exception.Message }
    if ($diagnostico -notlike '*Nenhum processo foi encerrado*') { throw 'Conflito de porta não diagnosticado.' }
    if (!$listener.Server.IsBound) { throw 'O ocupante da porta foi interrompido.' }
    Write-Host 'PASS: porta ocupada preservada e responsável identificado.'
} finally { $listener.Stop() }

function Aguardar-Saude($url) { throw 'Falha de saúde simulada após iniciar o processo.' }
$executavel = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
try {
    try { Iniciar-App $porta $executavel @('-NoProfile', '-Command', 'Start-Sleep 30') $DiretorioEvidencias 'parcial' 'http://localhost' } catch {
        if ($_.Exception.Message -notlike '*Falha de saúde simulada*') { throw }
    }
    $salvo = (Get-Content -LiteralPath $estado -Raw | ConvertFrom-Json)
    if ($salvo.Count -ne 1 -or !(Confirmar-Processo $salvo[0] $executavel '-NoProfile -Command Start-Sleep 30')) { throw 'Falha parcial perdeu o processo iniciado.' }
    $copia = $salvo[0] | Select-Object *
    $copia.inicio = [datetime]::UtcNow.AddDays(-1).ToString('o')
    if (Confirmar-Processo $copia $executavel '-NoProfile -Command Start-Sleep 30') { throw 'PID reutilizado foi aceito.' }
    Write-Host 'PASS: falha parcial mantém estado recuperável e rejeita PID reutilizado.'
} finally {
    foreach ($registro in $script:registros) {
        if (Confirmar-Processo $registro $executavel '-NoProfile -Command Start-Sleep 30') { Stop-Process -Id $registro.id }
    }
}
