#requires -Version 5.1
<#
  setup-android-toolchain.ps1
  在「能正常访问外网」的 Windows 上一键部署 Capacitor/Android 打包所需工具链：
    - JDK 17 (Temurin)
    - Android SDK cmdline-tools + platform-tools + platforms;android-34 + build-tools;34.0.0
    - 设置用户环境变量 JAVA_HOME / ANDROID_HOME / ANDROID_SDK_ROOT / GRADLE_USER_HOME
    - 写入 Gradle 阿里云 Maven 镜像 init.gradle（缓解 dl.google.com 被墙）

  用法（普通 PowerShell 即可，无需管理员；会写用户级环境变量）：
    Set-ExecutionPolicy -Scope Process Bypass
    .\scripts\setup-android-toolchain.ps1 -Root "D:\dev\android-toolchain"

  说明：脚本不负责编译，跑完重开终端后：
    cd <repo>\android ; .\gradlew.bat assembleDebug

  重要：本仓库所在的这台机器若无法访问外网，本脚本的下载会失败；
  请在联网电脑运行，或改用 GitHub Actions 打包。
#>
param(
  [string]$Root = 'D:\dev\android-toolchain'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$jdkDir  = Join-Path $Root 'jdk-17'
$sdkDir  = Join-Path $Root 'android-sdk'
$dlDir   = Join-Path $Root 'downloads'
$gradleHome = Join-Path $Root 'gradle-home'
New-Item -ItemType Directory -Force -Path $Root, $sdkDir, $dlDir, $gradleHome | Out-Null

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

function Get-Url($urls, $dest, $label) {
  foreach ($u in $urls) {
    try {
      Write-Host "下载($label): $u"
      Invoke-WebRequest -Uri $u -OutFile $dest -UseBasicParsing -TimeoutSec 900
      if ((Test-Path $dest) -and (Get-Item $dest).Length -gt 1024) { return $true }
    } catch {
      Write-Warning ("失败: " + $_.Exception.Message)
    }
  }
  return $false
}

# ---------------- 1) JDK 17 ----------------
Write-Step "1/4 JDK 17 (Temurin)"
if (Test-Path (Join-Path $jdkDir 'bin\java.exe')) {
  Write-Host "已存在，跳过: $jdkDir"
} else {
  $jdkZip = Join-Path $dlDir 'jdk17.zip'
  $ok = Get-Url @(
    'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse'
  ) $jdkZip 'JDK17'
  if (-not $ok) { throw "JDK 下载失败。请手动从 https://adoptium.net/temurin/releases/?version=17 下载 Windows x64 JDK 17 并解压到 $jdkDir（确保 bin\java.exe 存在）。" }
  $tmp = Join-Path $dlDir 'jdk-extract'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $jdkZip -DestinationPath $tmp -Force
  $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
  if (-not $inner) { throw "JDK 解压异常" }
  if (Test-Path $jdkDir) { Remove-Item -Recurse -Force $jdkDir }
  Move-Item $inner.FullName $jdkDir
  Write-Host "JDK 安装到: $jdkDir"
}

# ---------------- 2) Android cmdline-tools ----------------
Write-Step "2/4 Android SDK cmdline-tools"
$sm = Join-Path $sdkDir 'cmdline-tools\latest\bin\sdkmanager.bat'
if (Test-Path $sm) {
  Write-Host "已存在，跳过: $sm"
} else {
  $zip = Join-Path $dlDir 'cmdline-tools.zip'
  $ok = Get-Url @(
    'https://mirrors.cloud.tencent.com/AndroidSDK/commandlinetools-win-11076708_latest.zip',
    'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'
  ) $zip 'cmdline-tools'
  if (-not $ok) { throw "cmdline-tools 下载失败。请手动从腾讯镜像 https://mirrors.cloud.tencent.com/AndroidSDK/ 下载 commandlinetools-win-*.zip 解压，整理为 $sdkDir\cmdline-tools\latest\bin\sdkmanager.bat" }
  $tmp = Join-Path $dlDir 'clt-extract'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $ct = Join-Path $tmp 'cmdline-tools'
  if (-not (Test-Path $ct)) {
    # 有的包解压出来直接是 bin/lib
    $ct = $tmp
  }
  $latest = Join-Path $sdkDir 'cmdline-tools\latest'
  if (Test-Path $latest) { Remove-Item -Recurse -Force $latest }
  New-Item -ItemType Directory -Force -Path $latest | Out-Null
  Copy-Item (Join-Path $ct '*') $latest -Recurse -Force
  Write-Host "cmdline-tools 安装到: $latest"
}

# ---------------- 3) 接受许可 + 安装 SDK 组件 ----------------
Write-Step "3/4 安装 SDK 组件 (platform-tools / android-34 / build-tools 34.0.0)"
$env:JAVA_HOME = $jdkDir
$env:ANDROID_HOME = $sdkDir
$env:ANDROID_SDK_ROOT = $sdkDir
$env:Path = (Join-Path $jdkDir 'bin') + ';' + $env:Path

if (-not (Test-Path $sm)) { throw "找不到 sdkmanager: $sm" }
Write-Host "接受许可证..."
(1..60 | ForEach-Object { 'y' }) | & $sm --sdk_root="$sdkDir" --licenses | Out-Null
Write-Host "安装组件..."
& $sm --sdk_root="$sdkDir" "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# ---------------- 4) 环境变量 + Gradle 镜像 ----------------
Write-Step "4/4 写入用户环境变量与 Gradle 镜像"
[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdkDir, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdkDir, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $sdkDir, 'User')
[Environment]::SetEnvironmentVariable('GRADLE_USER_HOME', $gradleHome, 'User')

# 追加 PATH（避免重复）
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $userPath) { $userPath = '' }
$toAdd = @(
  (Join-Path $jdkDir 'bin'),
  (Join-Path $sdkDir 'cmdline-tools\latest\bin'),
  (Join-Path $sdkDir 'platform-tools')
)
$parts = $userPath -split ';' | Where-Object { $_ -ne '' }
foreach ($p in $toAdd) { if ($parts -notcontains $p) { $parts += $p } }
[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')

# Gradle 阿里云镜像
$gradleDir = Join-Path $env:USERPROFILE '.gradle'
New-Item -ItemType Directory -Force -Path $gradleDir | Out-Null
$initGradle = @'
// 由 setup-android-toolchain.ps1 生成：国内 Maven 镜像，缓解 dl.google.com 访问问题
allprojects {
    repositories {
        maven { url 'https://maven.aliyun.com/repository/google' }
        maven { url 'https://maven.aliyun.com/repository/public' }
        maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
        google()
        mavenCentral()
    }
}
settingsEvaluated { settings ->
    settings.pluginManagement {
        repositories {
            maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
            maven { url 'https://maven.aliyun.com/repository/google' }
            maven { url 'https://maven.aliyun.com/repository/public' }
            gradlePluginPortal()
            google()
        }
    }
}
'@
[IO.File]::WriteAllText((Join-Path $gradleDir 'init.gradle'), $initGradle, (New-Object System.Text.UTF8Encoding($false)))

Write-Step "完成"
Write-Host "JDK:        $jdkDir"
Write-Host "Android SDK: $sdkDir"
Write-Host "Gradle home: $gradleHome"
Write-Host ""
Write-Host "请【重开一个终端】让环境变量生效，然后编译：" -ForegroundColor Yellow
Write-Host "  cd D:\Mossy-Dawn-main"
Write-Host "  npm ci ; npm run build ; npx cap sync android"
Write-Host "  cd android ; .\gradlew.bat assembleDebug"
Write-Host "产物: android\app\build\outputs\apk\debug\app-debug.apk"
Write-Host ""
Write-Host "如 Gradle 发行包下载慢，可把 android\gradle\wrapper\gradle-wrapper.properties 的 distributionUrl 改为：" -ForegroundColor Yellow
Write-Host "  https\://mirrors.cloud.tencent.com/gradle/gradle-8.2.1-all.zip"
