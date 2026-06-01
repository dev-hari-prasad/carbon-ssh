; ============================================================================
; Carbon SSH — Inno Setup Installer Script
;
; Compile:  ISCC.exe /DAppVersion=0.1.0 installer\carbon-ssh.iss
; Output:   releases\{version}\CarbonSSH-Setup-{version}.exe
; ============================================================================

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

[Setup]
; --- App Identity ---
AppId={{B8A3F2E1-7C4D-4E9A-A5B6-1D2E3F4A5B6C}
AppName=Carbon SSH
AppVersion={#AppVersion}
AppVerName=Carbon SSH {#AppVersion}
AppPublisher=Carbon SSH
AppPublisherURL=https://github.com/carbon-ssh
AppSupportURL=https://github.com/carbon-ssh/issues
AppUpdatesURL=https://github.com/carbon-ssh/releases

; --- Install Locations ---
DefaultDirName={autopf}\Carbon SSH
DefaultGroupName=Carbon SSH
DisableProgramGroupPage=yes

; --- Privileges ---
; Per-user by default, user can choose "Install for all users"
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; --- Output ---
OutputDir=..\releases\{#AppVersion}
OutputBaseFilename=CarbonSSH-Setup-{#AppVersion}

; --- Appearance ---
SetupIconFile=..\build\icon.ico
UninstallDisplayIcon={app}\Carbon SSH.exe
WizardStyle=modern
WizardSizePercent=110,110

; --- Compression ---
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

; --- Installer Behavior ---
AllowNoIcons=yes
CloseApplications=yes
RestartApplications=no
CreateUninstallRegKey=yes
UninstallDisplayName=Carbon SSH

; --- Mutex (prevent running installer while app is open) ---
AppMutex=CarbonSSHMutex

; --- Version Info embedded in the .exe ---
VersionInfoVersion={#AppVersion}.0
VersionInfoCompany=Carbon SSH
VersionInfoDescription=Carbon SSH Installer
VersionInfoCopyright=Copyright © 2026 Carbon SSH
VersionInfoProductName=Carbon SSH
VersionInfoProductVersion={#AppVersion}

; --- Minimum OS ---
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon";  Description: "{cm:CreateDesktopIcon}";  GroupDescription: "{cm:AdditionalIcons}"; Flags: checked
Name: "startmenu";    Description: "Create a &Start Menu shortcut"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checked

[Files]
; Copy entire win-unpacked directory into {app}
Source: "..\dist-electron-out\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Desktop shortcut (optional per Tasks)
Name: "{autodesktop}\Carbon SSH"; Filename: "{app}\Carbon SSH.exe"; IconFilename: "{app}\Carbon SSH.exe"; Tasks: desktopicon

; Start Menu shortcut (optional per Tasks)
Name: "{autoprograms}\Carbon SSH\Carbon SSH";  Filename: "{app}\Carbon SSH.exe"; IconFilename: "{app}\Carbon SSH.exe"; Tasks: startmenu
Name: "{autoprograms}\Carbon SSH\Uninstall Carbon SSH"; Filename: "{uninstallexe}"; Tasks: startmenu

[Run]
; Option to launch app after install
Filename: "{app}\Carbon SSH.exe"; Description: "{cm:LaunchProgram,Carbon SSH}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up user data directory on uninstall (optional — remove these lines to preserve user data)
Type: filesandirs; Name: "{app}"

[Code]
// Close the running app before install/uninstall
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
end;
