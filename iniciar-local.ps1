[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Puerto = 3000,
    [switch]$ConEjemplos
)

$ErrorActionPreference = 'Stop'
$exitCode = 1
$previousPreview = $env:ENABLE_UI_PREVIEWS
$previousTelemetry = $env:NEXT_TELEMETRY_DISABLED
$previousPath = $env:PATH

try {
    # Funciona aunque se invoque desde una carpeta diferente.
    Push-Location -LiteralPath $PSScriptRoot
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }

    if (-not $nodePath) {
        $standardNode = Join-Path $env:ProgramFiles 'nodejs\node.exe'
        if (Test-Path -LiteralPath $standardNode) { $nodePath = $standardNode }
    }
    if (-not $nodePath -and (Get-Command Get-AppxPackage -ErrorAction SilentlyContinue)) {
        # Alternativa para equipos que solo tienen el runtime incluido con Codex.
        $runtimes = Get-AppxPackage -Name '*CodexPrimaryRuntime*' -ErrorAction SilentlyContinue |
            Sort-Object Version -Descending
        foreach ($runtime in $runtimes) {
            $candidate = Join-Path $runtime.InstallLocation 'dependencies\node\bin\node.exe'
            if (Test-Path -LiteralPath $candidate) { $nodePath = $candidate; break }
        }
    }
    if (-not $nodePath) { throw 'No se encuentra Node.js. Instala Node.js 20.19 o superior y vuelve a ejecutar este archivo.' }

    $version = & $nodePath -p 'process.versions.node'
    if ($LASTEXITCODE -ne 0 -or [version]$version -lt [version]'20.19.0') {
        throw 'Se necesita Node.js 20.19 o superior.'
    }
    $nextCli = Join-Path $PSScriptRoot 'node_modules\next\dist\bin\next'
    if (-not (Test-Path -LiteralPath $nextCli)) {
        throw 'Faltan las dependencias. Ejecuta pnpm install --frozen-lockfile en la carpeta del proyecto y vuelve a intentarlo.'
    }

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Puerto)
    try { $listener.Start() }
    catch { throw "El puerto $Puerto no esta disponible. Usa otro, por ejemplo: .\iniciar-local.ps1 -Puerto 3001" }
    finally { $listener.Stop() }

    # Variables solo para este proceso; .env.local lo carga Next.js automaticamente.
    $env:PATH = (Split-Path -Parent $nodePath) + [IO.Path]::PathSeparator + $previousPath
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $env:ENABLE_UI_PREVIEWS = if ($ConEjemplos) { 'true' } else { 'false' }

    Write-Host ''
    Write-Host 'Ahora que escucho - entorno local' -ForegroundColor DarkYellow
    Write-Host "Aplicacion: http://127.0.0.1:$Puerto" -ForegroundColor Green
    if ($ConEjemplos) {
        Write-Host "Resultado de ejemplo: http://127.0.0.1:$Puerto/dev/resultado"
        Write-Host 'Los ejemplos usan resenas ficticias y tienen las mutaciones desactivadas.'
    }
    Write-Host 'Espera al mensaje Ready. Para detener el servidor: Ctrl+C.'
    Write-Host 'Manten esta ventana abierta mientras pruebas la aplicacion.'
    Write-Host ''
    & $nodePath $nextCli dev --hostname 127.0.0.1 --port $Puerto
    $exitCode = $LASTEXITCODE
}
catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
    $env:ENABLE_UI_PREVIEWS = $previousPreview
    $env:NEXT_TELEMETRY_DISABLED = $previousTelemetry
    $env:PATH = $previousPath
    Pop-Location
}
exit $exitCode
