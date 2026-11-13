<#
.SYNOPSIS
  Libera o TOVERI Gestão de Pessoas no Microsoft 365 da TOVERI (Entra ID + SharePoint).

.DESCRIPTION
  Faz, de forma automática, os 4 passos do documento "TOVERI Gestão de Pessoas: liberação no Microsoft 365":
    1. Registra a API e as telas (Web) no Entra ID, com o escopo acesso_usuario e os perfis AdminRH e RH.
    2. Cria os grupos TOVERI - Admin RH e TOVERI - RH, liga cada um ao seu perfil e exige atribuição para entrar.
    3. Concede à API a permissão Sites.Selected do Microsoft Graph (sozinha, não dá acesso a nenhum site).
    4. Cria o site privado "TOVERI RH - Testes" e dá à API permissão de gravação só nele.
  Pode ser rodado mais de uma vez: o que já existe é reaproveitado.

  Precisa de um Administrador Global (ou Administrador de Aplicativos de Nuvem + Administrador de Funções com
  Privilégios + Administrador do SharePoint). Não altera nada fora do que está listado acima.

.EXAMPLE
  .\configurar-microsoft365.ps1 -Proprietario gabriel@toveri.com.br -AdminRH mariana@toveri.com.br -RH anaclara@toveri.com.br
#>
[CmdletBinding()]
param(
    # Conta que será proprietária dos registros e entra no grupo Admin RH (quem vai desenvolver e testar).
    [Parameter(Mandatory)] [string] $Proprietario,
    [string[]] $AdminRH = @(),
    [string[]] $RH = @(),
    # Locatário da TOVERI. Não altere: o sistema é sempre da TOVERI.
    [string] $TenantId = '874641cf-fce4-4923-b71f-a1d725541626',
    # Site de testes já existente (opcional). Vazio = o script cria "TOVERI RH - Testes".
    [string] $SiteTestesUrl = ''
)

$ErrorActionPreference = 'Stop'
$nomeApi = 'TOVERI Gestão de Pessoas - API'
$nomeWeb = 'TOVERI Gestão de Pessoas - Web'
$graphAppId = '00000003-0000-0000-c000-000000000000'
$papelPadrao = [guid]'00000000-0000-0000-0000-000000000000'

function Etapa($texto) { Write-Host "`n== $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "   $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "   $texto" -ForegroundColor Yellow }

# ---------------------------------------------------------------- módulos e login
Etapa 'Preparando o módulo Microsoft Graph (só para este usuário)'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$modulos = 'Microsoft.Graph.Authentication', 'Microsoft.Graph.Applications', 'Microsoft.Graph.Groups',
           'Microsoft.Graph.Users', 'Microsoft.Graph.Sites', 'Microsoft.Graph.Identity.SignIns'
foreach ($m in $modulos) {
    if (-not (Get-Module -ListAvailable -Name $m)) {
        Install-Module $m -Scope CurrentUser -Force -AllowClobber
    }
}
Import-Module $modulos

Connect-MgGraph -TenantId $TenantId -NoWelcome -Scopes @(
    'Application.ReadWrite.All', 'AppRoleAssignment.ReadWrite.All', 'DelegatedPermissionGrant.ReadWrite.All',
    'Group.ReadWrite.All', 'User.Read.All', 'Sites.FullControl.All')
$ctx = Get-MgContext
if ($ctx.TenantId -ne $TenantId) { throw "Conectado ao locatário $($ctx.TenantId), e não ao da TOVERI ($TenantId)." }
Ok "Conectado como $($ctx.Account) no locatário da TOVERI"

$dono = Get-MgUser -UserId $Proprietario
$graphSp = Get-MgServicePrincipal -Filter "appId eq '$graphAppId'"

function Garantir-Sp($appId) {
    $sp = Get-MgServicePrincipal -Filter "appId eq '$appId'"
    if (-not $sp) { $sp = New-MgServicePrincipal -AppId $appId }
    Update-MgServicePrincipal -ServicePrincipalId $sp.Id -AppRoleAssignmentRequired:$true
    return Get-MgServicePrincipal -ServicePrincipalId $sp.Id
}

function Garantir-Dono($applicationId) {
    $donos = Get-MgApplicationOwner -ApplicationId $applicationId
    if ($donos.Id -notcontains $dono.Id) {
        New-MgApplicationOwnerByRef -ApplicationId $applicationId -BodyParameter @{
            '@odata.id' = "https://graph.microsoft.com/v1.0/directoryObjects/$($dono.Id)" }
    }
}

# ---------------------------------------------------------------- passo 1: API e Web
Etapa "Passo 1: registrando '$nomeApi'"
$api = Get-MgApplication -Filter "displayName eq '$nomeApi'" | Select-Object -First 1
if (-not $api) {
    $papeis = @(
        @{ id = [guid]::NewGuid(); displayName = 'Admin RH'; value = 'AdminRH'; isEnabled = $true
           description = 'Acesso total, regras de escala e auditoria'; allowedMemberTypes = @('User') },
        @{ id = [guid]::NewGuid(); displayName = 'RH'; value = 'RH'; isEnabled = $true
           description = 'Cadastros, embarques, cursos e documentos'; allowedMemberTypes = @('User') })
    $escopo = @{ id = [guid]::NewGuid(); value = 'acesso_usuario'; type = 'Admin'; isEnabled = $true
                 adminConsentDisplayName = 'Acessar o TOVERI em nome do usuário'
                 adminConsentDescription = 'Permite que as telas do TOVERI chamem a API em nome do usuário conectado.' }
    $api = New-MgApplication -DisplayName $nomeApi -SignInAudience 'AzureADMyOrg' -AppRoles $papeis `
        -Api @{ requestedAccessTokenVersion = 2; oauth2PermissionScopes = @($escopo) }
    Update-MgApplication -ApplicationId $api.Id -IdentifierUris @("api://$($api.AppId)")
    Ok 'API registrada'
} else { Ok 'API já existia, reaproveitada' }
$api = Get-MgApplication -ApplicationId $api.Id
$apiSp = Garantir-Sp $api.AppId
Garantir-Dono $api.Id
$escopoApi = $api.Api.Oauth2PermissionScopes | Where-Object Value -eq 'acesso_usuario'

Etapa "Passo 1: registrando '$nomeWeb'"
$escoposGraph = 'openid', 'profile', 'offline_access', 'User.Read'
$idsGraph = $graphSp.Oauth2PermissionScopes | Where-Object { $escoposGraph -contains $_.Value }
$web = Get-MgApplication -Filter "displayName eq '$nomeWeb'" | Select-Object -First 1
if (-not $web) {
    $web = New-MgApplication -DisplayName $nomeWeb -SignInAudience 'AzureADMyOrg' `
        -Spa @{ redirectUris = @('http://localhost:5173') } `
        -RequiredResourceAccess @(
            @{ resourceAppId = $api.AppId; resourceAccess = @(@{ id = $escopoApi.Id; type = 'Scope' }) },
            @{ resourceAppId = $graphAppId; resourceAccess = @($idsGraph | ForEach-Object { @{ id = $_.Id; type = 'Scope' } }) })
    Ok 'Web registrada'
} else { Ok 'Web já existia, reaproveitada' }
$webSp = Garantir-Sp $web.AppId
Garantir-Dono $web.Id

# Consentimento do administrador: Web -> API (acesso_usuario) e Web -> Graph (login básico).
foreach ($c in @(@{ recurso = $apiSp.Id; escopo = 'acesso_usuario' },
                 @{ recurso = $graphSp.Id; escopo = ($escoposGraph -join ' ') })) {
    $g = Get-MgOauth2PermissionGrant -Filter "clientId eq '$($webSp.Id)'" -All |
        Where-Object { $_.ResourceId -eq $c.recurso -and $_.ConsentType -eq 'AllPrincipals' }
    if (-not $g) {
        New-MgOauth2PermissionGrant -ClientId $webSp.Id -ConsentType 'AllPrincipals' -ResourceId $c.recurso -Scope $c.escopo | Out-Null
    }
}
Ok 'Consentimento do administrador concedido às telas'

# ---------------------------------------------------------------- passo 2: grupos e perfis
Etapa 'Passo 2: grupos e perfis'
$atribuidosApi = Get-MgServicePrincipalAppRoleAssignedTo -ServicePrincipalId $apiSp.Id -All
$atribuidosWeb = Get-MgServicePrincipalAppRoleAssignedTo -ServicePrincipalId $webSp.Id -All
$avisoLicenca = $false

function Atribuir($sp, $existentes, $principalId, $papelId) {
    if ($existentes | Where-Object { $_.PrincipalId -eq $principalId -and $_.AppRoleId -eq $papelId }) { return }
    New-MgServicePrincipalAppRoleAssignedTo -ServicePrincipalId $sp.Id -BodyParameter @{
        principalId = $principalId; resourceId = $sp.Id; appRoleId = $papelId } | Out-Null
}

$definicoes = @(
    @{ nome = 'TOVERI - Admin RH'; papel = 'AdminRH'; membros = @($Proprietario) + $AdminRH },
    @{ nome = 'TOVERI - RH'; papel = 'RH'; membros = $RH })
$grupos = @{}
foreach ($d in $definicoes) {
    $grupo = Get-MgGroup -Filter "displayName eq '$($d.nome)'" | Select-Object -First 1
    if (-not $grupo) {
        $grupo = New-MgGroup -DisplayName $d.nome -Description "Perfil $($d.papel) do TOVERI Gestão de Pessoas" `
            -MailEnabled:$false -MailNickname ($d.nome -replace '[^A-Za-z0-9]', '') -SecurityEnabled:$true
    }
    $atuais = (Get-MgGroupMember -GroupId $grupo.Id -All).Id
    $usuarios = @($d.membros | Where-Object { $_ } | Select-Object -Unique | ForEach-Object { Get-MgUser -UserId $_ })
    foreach ($u in $usuarios) {
        if ($atuais -notcontains $u.Id) { New-MgGroupMember -GroupId $grupo.Id -DirectoryObjectId $u.Id }
    }
    $papelId = ($api.AppRoles | Where-Object Value -eq $d.papel).Id
    try {
        Atribuir $apiSp $atribuidosApi $grupo.Id $papelId
        Atribuir $webSp $atribuidosWeb $grupo.Id $papelPadrao
    } catch {
        # Sem Entra ID P1 não é possível atribuir grupos: atribui cada pessoa diretamente.
        Aviso "Não foi possível atribuir o grupo ($($_.Exception.Message)). Atribuindo as pessoas uma a uma."
        $avisoLicenca = $true
        foreach ($u in $usuarios) {
            Atribuir $apiSp $atribuidosApi $u.Id $papelId
            Atribuir $webSp $atribuidosWeb $u.Id $papelPadrao
        }
    }
    $grupos[$d.papel] = $grupo.Id
    Ok "$($d.nome): $($usuarios.Count) pessoa(s)"
}
if ($avisoLicenca) {
    Aviso 'Sem Entra ID P1: as pessoas foram atribuídas uma a uma. Quem entrar depois num grupo precisa ser atribuído também (rode o script de novo).'
}

# ---------------------------------------------------------------- passo 3: Sites.Selected
Etapa 'Passo 3: permissão Sites.Selected do Microsoft Graph'
$papelSites = $graphSp.AppRoles | Where-Object Value -eq 'Sites.Selected'
$temSites = Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $apiSp.Id -All |
    Where-Object { $_.AppRoleId -eq $papelSites.Id }
if (-not $temSites) {
    New-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $apiSp.Id -PrincipalId $apiSp.Id `
        -ResourceId $graphSp.Id -AppRoleId $papelSites.Id | Out-Null
}
$acessos = @($api.RequiredResourceAccess | Where-Object { $_.ResourceAppId -ne $graphAppId })
Update-MgApplication -ApplicationId $api.Id -RequiredResourceAccess (@($acessos) + @(
    @{ resourceAppId = $graphAppId; resourceAccess = @(@{ id = $papelSites.Id; type = 'Role' }) }))
Ok 'Sites.Selected concedida (ainda sem acesso a nenhum site)'

# ---------------------------------------------------------------- passo 4: site de testes
Etapa 'Passo 4: site do SharePoint de testes'
if ($SiteTestesUrl) {
    $u = [uri]$SiteTestesUrl
    $site = Get-MgSite -SiteId "$($u.Host):$($u.AbsolutePath)"
} else {
    $nomeSite = 'TOVERI RH - Testes'
    $grupoSite = Get-MgGroup -Filter "displayName eq '$nomeSite'" | Select-Object -First 1
    if (-not $grupoSite) {
        $grupoSite = New-MgGroup -BodyParameter @{
            displayName          = $nomeSite
            description          = 'Documentos fictícios para testes do TOVERI Gestão de Pessoas'
            groupTypes           = @('Unified')
            mailEnabled          = $true
            mailNickname         = 'TOVERIRH-Testes'
            securityEnabled      = $false
            visibility           = 'Private'
            'owners@odata.bind'  = @("https://graph.microsoft.com/v1.0/users/$($dono.Id)")
            'members@odata.bind' = @("https://graph.microsoft.com/v1.0/users/$($dono.Id)") }
        Ok 'Grupo do site criado; aguardando o SharePoint preparar o site (pode levar alguns minutos)'
    }
    $site = $null
    for ($i = 0; $i -lt 40 -and -not $site; $i++) {
        try { $site = Get-MgGroupSite -GroupId $grupoSite.Id -SiteId 'root' } catch { Start-Sleep -Seconds 15 }
    }
    if (-not $site) { throw 'O site ainda não ficou pronto. Rode o script de novo daqui a alguns minutos.' }
}
$perms = Get-MgSitePermission -SiteId $site.Id -All
$jaTem = $perms | Where-Object { $_.GrantedToIdentitiesV2.Application.Id -contains $api.AppId -or $_.GrantedToIdentities.Application.Id -contains $api.AppId }
if (-not $jaTem) {
    New-MgSitePermission -SiteId $site.Id -BodyParameter @{
        roles = @('write')
        grantedToIdentities = @(@{ application = @{ id = $api.AppId; displayName = $nomeApi } }) } | Out-Null
}
Ok "API com permissão de gravação só em $($site.WebUrl)"

# ---------------------------------------------------------------- resultado
Etapa 'Resultado (nada aqui é senha; pode ser enviado ao Gabriel)'
$resultado = [ordered]@{
    TenantId          = $TenantId
    ApiClientId       = $api.AppId
    ApiUri            = "api://$($api.AppId)"
    Escopo            = "api://$($api.AppId)/acesso_usuario"
    WebClientId       = $web.AppId
    SiteTestesUrl     = $site.WebUrl
    GrupoAdminRH      = $grupos['AdminRH']
    GrupoRH           = $grupos['RH']
    GruposPorPessoa   = $avisoLicenca
}
$resultado | ConvertTo-Json | Tee-Object -FilePath (Join-Path (Get-Location) 'toveri-microsoft365.json')
Ok "Também salvo em $(Join-Path (Get-Location) 'toveri-microsoft365.json')"
Disconnect-MgGraph | Out-Null
