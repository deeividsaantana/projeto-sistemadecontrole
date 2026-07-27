@echo off
setlocal
chcp 65001 >nul
set "NO_PAUSE="
for %%A in (%*) do if /I "%%~A"=="--no-pause" set "NO_PAUSE=1"

rem O Explorador pode executar apenas este CMD de dentro do ZIP em uma pasta
rem temporaria. Nesse caso, redirecionamos para a copia completa ja extraida.
if exist "%~dp0scripts\publicar-tudo.mjs" goto publisher_ready

set "PUBLISHER_HOME="
if defined OneDriveCommercial if exist "%OneDriveCommercial%\Área de Trabalho\SISTEMA_RENEA_PRONTO_PARA_USAR\scripts\publicar-tudo.mjs" set "PUBLISHER_HOME=%OneDriveCommercial%\Área de Trabalho\SISTEMA_RENEA_PRONTO_PARA_USAR"
if not defined PUBLISHER_HOME if defined OneDriveCommercial if exist "%OneDriveCommercial%\Desktop\SISTEMA_RENEA_PRONTO_PARA_USAR\scripts\publicar-tudo.mjs" set "PUBLISHER_HOME=%OneDriveCommercial%\Desktop\SISTEMA_RENEA_PRONTO_PARA_USAR"
if not defined PUBLISHER_HOME if defined OneDrive if exist "%OneDrive%\Área de Trabalho\SISTEMA_RENEA_PRONTO_PARA_USAR\scripts\publicar-tudo.mjs" set "PUBLISHER_HOME=%OneDrive%\Área de Trabalho\SISTEMA_RENEA_PRONTO_PARA_USAR"
if not defined PUBLISHER_HOME if defined OneDrive if exist "%OneDrive%\Desktop\SISTEMA_RENEA_PRONTO_PARA_USAR\scripts\publicar-tudo.mjs" set "PUBLISHER_HOME=%OneDrive%\Desktop\SISTEMA_RENEA_PRONTO_PARA_USAR"
if not defined PUBLISHER_HOME if exist "%USERPROFILE%\Desktop\SISTEMA_RENEA_PRONTO_PARA_USAR\scripts\publicar-tudo.mjs" set "PUBLISHER_HOME=%USERPROFILE%\Desktop\SISTEMA_RENEA_PRONTO_PARA_USAR"
if not defined PUBLISHER_HOME if exist "%USERPROFILE%\Área de Trabalho\SISTEMA_RENEA_PRONTO_PARA_USAR\scripts\publicar-tudo.mjs" set "PUBLISHER_HOME=%USERPROFILE%\Área de Trabalho\SISTEMA_RENEA_PRONTO_PARA_USAR"

if defined PUBLISHER_HOME goto redirect_to_complete_copy

echo.
echo ERRO: este arquivo foi aberto de dentro do ZIP e a pasta completa nao foi encontrada.
echo Extraia o ZIP inteiro antes de executar ou use o atalho PUBLICAR_SISTEMA_RENEA da sua Area de Trabalho.
echo.
if not defined NO_PAUSE pause
exit /b 1

:redirect_to_complete_copy
echo.
echo [RENEA] Abrindo automaticamente a copia completa do sistema...
call "%PUBLISHER_HOME%\PUBLICAR_TUDO.cmd" %*
exit /b %ERRORLEVEL%

:publisher_ready
cd /d "%~dp0"

set "NODE_EXECUTABLE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "NODE_EXECUTABLE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)

if not exist "%NODE_EXECUTABLE%" (
  if "%NODE_EXECUTABLE%"=="node" goto run_publisher
  echo.
  echo ERRO: Node.js nao foi encontrado.
  echo Instale a versao LTS em https://nodejs.org/ e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

:run_publisher
"%NODE_EXECUTABLE%" scripts\publicar-tudo.mjs %*
set "PUBLISH_EXIT=%ERRORLEVEL%"

echo.
if "%PUBLISH_EXIT%"=="0" (
  echo Processo finalizado com sucesso.
) else (
  echo O publicador parou com erro. Nada posterior a falha foi publicado.
)
echo.
if not defined NO_PAUSE pause
exit /b %PUBLISH_EXIT%
