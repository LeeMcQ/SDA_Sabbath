; SDA Sabbath Translator: Windows installer (Inno Setup 6). Built by .github/workflows/translator-exe.yml.
; Installs for this user only (no administrator needed) into %LOCALAPPDATA%\Programs, so the program can keep its
; models and settings next to itself. Models are downloaded on the first start.
#define AppName "SDA Sabbath Translator"
#ifndef AppVersion
  #define AppVersion "1.1.0"
#endif

[Setup]
AppId={{6C1E6F3A-5B2D-4E0B-9C1F-5DA5ABBA7790}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=SDA Sabbath
AppPublisherURL=https://leemcq.github.io/SDA_Sabbath/
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=SDA-Sabbath-Translator-Setup
SetupIconFile=app.ico
UninstallDisplayIcon={app}\{#AppName}.exe
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Tasks]
Name: "desktopicon"; Description: "Put a shortcut on the desktop"; GroupDescription: "Shortcuts:"
Name: "startup"; Description: "Start the translator by itself when Windows starts (minimised)"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "dist\{#AppName}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppName}.exe"; WorkingDir: "{app}"
Name: "{group}\Check each part of the translator"; Filename: "{app}\{#AppName}.exe"; Parameters: "check"; WorkingDir: "{app}"
Name: "{group}\Run the setup again"; Filename: "{app}\{#AppName}.exe"; Parameters: "setup"; WorkingDir: "{app}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\{#AppName}.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\{#AppName}"; Filename: "{app}\{#AppName}.exe"; WorkingDir: "{app}"; Tasks: startup; Flags: runminimized

[Run]
Filename: "{app}\{#AppName}.exe"; Description: "Start the translator now (the first time it sets itself up: about 15 minutes, with internet)"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\models"
Type: files; Name: "{app}\config.json"
