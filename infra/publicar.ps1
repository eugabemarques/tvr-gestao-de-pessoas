<#
.SYNOPSIS
  Publica o TOVERI Gestão de Pessoas no Azure (app toveri-gestao-pessoas, plano B2 existente).

.DESCRIPTION
  1. Telas: npm ci, testes e build (frontend/dist).
  2. Copia as telas para backend/src/Toveri.Api/wwwroot.
  3. Back end: testes e dotnet publish.
  4. Gera o pacote .zip e envia com az webapp deploy.
  5. Confere /api/saude.

  Requisitos: Node.js, .NET SDK 10 e Azure CLI logado (az login) na assinatura da TOVERI.
  NÃO altere configurações do app (App Settings) enquanto a publicação estiver rodando: o reinício
  no meio da cópia deixa arquivos faltando e o site não sobe.

.EXAMPLE
  pwsh -File infra\publicar.ps1
#>
[CmdletBinding()]
param(
    [string] $App = 'toveri-gestao-pessoas',
    [string] $Grupo = 'rg-toveri-portal-prod',
    [switch] $PularTestes
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$api = Join-Path $raiz 'backend/src/Toveri.Api'
$saida = Join-Path ([IO.Path]::GetTempPath()) "toveri-publicacao"
$zip = "$saida.zip"

function Etapa($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Rodar($exe, [string[]] $argumentos) {
    & $exe @argumentos
    if ($LASTEXITCODE -ne 0) { throw "Falhou: $exe $($argumentos -join ' ')" }
}

$dotnet = (Get-Command dotnet -ErrorAction SilentlyContinue).Source
if (-not $dotnet) { $dotnet = Join-Path $env:LOCALAPPDATA 'Microsoft\dotnet\dotnet.exe' }
if (-not (Test-Path $dotnet)) { throw 'Instale o .NET SDK 10.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Instale o Node.js.' }
$conta = az account show --query user.name -o tsv
if (-not $conta) { throw 'Faça login no Azure: az login' }
Write-Host "Azure: $conta"

Etapa 'Telas (React)'
Push-Location (Join-Path $raiz 'frontend')
try {
    Rodar npm @('ci', '--no-audit', '--no-fund')
    if (-not $PularTestes) { Rodar npm @('test') }
    Rodar npm @('run', 'build')
} finally { Pop-Location }
$www = Join-Path $api 'wwwroot'
if (Test-Path $www) { Remove-Item $www -Recurse -Force }
Copy-Item (Join-Path $raiz 'frontend/dist') $www -Recurse

Etapa 'Back end (.NET)'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'; $env:DOTNET_NOLOGO = '1'
if (-not $PularTestes) { Rodar $dotnet @('test', (Join-Path $raiz 'backend/Toveri.slnx'), '-c', 'Release') }
if (Test-Path $saida) { Remove-Item $saida -Recurse -Force }
Rodar $dotnet @('publish', $api, '-c', 'Release', '-o', $saida)

Etapa 'Pacote'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $zip) { Remove-Item $zip -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($saida, $zip)
Write-Host "$zip ($([math]::Round((Get-Item $zip).Length / 1MB, 1)) MB)"

Etapa "Enviando para $App (2 a 5 minutos)"
Rodar az @('webapp', 'deploy', '-g', $Grupo, '-n', $App, '--type', 'zip', '--clean', 'true', '--restart', 'true', '--src-path', $zip)

Etapa 'Conferindo'
$url = "https://$App.azurewebsites.net"
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-RestMethod "$url/api/saude" -TimeoutSec 20
        if ($r.status -eq 'ok') { Write-Host "No ar: $url" -ForegroundColor Green; exit 0 }
    } catch { Start-Sleep -Seconds 10 }
}
throw "O site não respondeu em $url/api/saude. Veja os logs em Azure Portal > $App > Log stream."
