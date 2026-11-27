; Use the standard NSIS stub to install the bundled x64 runtime.
Target x86-unicode
Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "nsDialogs.nsh"
!include "x64.nsh"

!define APP_NAME "Productivity"
!define APP_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Productivity"
!define APP_VERSION "1.2.0"
!define WEBVIEW_KEY "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

Name "${APP_NAME}"
Caption "${APP_NAME} Setup"
UninstallCaption "Uninstall ${APP_NAME}"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\Productivity"
InstallDirRegKey HKCU "${APP_KEY}" "InstallLocation"
RequestExecutionLevel user
VIProductVersion "1.2.0.0"
VIAddVersionKey /LANG=1033 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=1033 "FileDescription" "Productivity"
VIAddVersionKey /LANG=1033 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Productivity contributors"

!define MUI_ABORTWARNING
!define MUI_ICON "${__FILEDIR__}\productivity.ico"
!define MUI_UNICON "${__FILEDIR__}\productivity.ico"
!define MUI_DIRECTORYPAGE_TEXT_TOP "Choose where to install Productivity. Select a new folder or the folder where Productivity is already installed."
!define MUI_UNCONFIRMPAGE_TEXT_TOP "Remove Productivity and its shortcuts from this computer. Your journal and tasks will stay in your user data folder."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open Productivity"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchProductivity

!insertmacro MUI_PAGE_WELCOME
Page custom MaintenancePage MaintenanceLeave
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

Var PreviousInstall
Var RemoveOption
Var MaintenanceDialog

Function .onInit
    ${IfNot} ${RunningX64}
        MessageBox MB_ICONSTOP|MB_OK "Productivity requires 64-bit Windows." /SD IDOK
        SetErrorLevel 1
        Abort
    ${EndIf}
    SetRegView 64
    ReadRegStr $PreviousInstall HKCU "${APP_KEY}" "InstallLocation"
    ${GetParameters} $0
    ${GetOptions} $0 "/UNINSTALL" $1
    IfErrors done
    Call RemoveProductivity
    Abort
done:
FunctionEnd

Function MaintenancePage
    ${If} $PreviousInstall == ""
        Abort
    ${EndIf}
    IfFileExists "$PreviousInstall\UninstallProductivity.exe" +2
    Abort
    !insertmacro MUI_HEADER_TEXT "Manage Productivity" "Choose how to maintain your current installation."
    nsDialogs::Create 1018
    Pop $MaintenanceDialog
    ${If} $MaintenanceDialog == error
        Abort
    ${EndIf}
    ${NSD_CreateRadioButton} 0 7u 100% 13u "&Update or repair Productivity"
    Pop $0
    ${NSD_Check} $0
    ${NSD_CreateLabel} 12u 23u 95% 22u "Install the files from this setup in your current Productivity folder."
    Pop $0
    ${NSD_CreateRadioButton} 0 57u 100% 13u "&Uninstall Productivity"
    Pop $RemoveOption
    ${NSD_CreateLabel} 12u 73u 95% 24u "Remove the application and shortcuts. Your journal and tasks are kept."
    Pop $0
    nsDialogs::Show
FunctionEnd

Function MaintenanceLeave
    ${NSD_GetState} $RemoveOption $0
    ${If} $0 == ${BST_CHECKED}
        Call RemoveProductivity
        Abort
    ${EndIf}
FunctionEnd

Function RemoveProductivity
    ${If} $PreviousInstall != ""
        IfFileExists "$PreviousInstall\UninstallProductivity.exe" launch
    ${EndIf}
    MessageBox MB_ICONINFORMATION|MB_OK "Setup could not find an installed copy of Productivity." /SD IDOK
    Return
launch:
    ClearErrors
    IfSilent silent_remove
    Exec '"$PreviousInstall\UninstallProductivity.exe"'
    IfErrors launch_error
    SetErrorLevel 0
    Quit
silent_remove:
    ; Run the installed uninstaller in place so the exit code reflects removal.
    ExecWait '"$PreviousInstall\UninstallProductivity.exe" /S _?=$PreviousInstall' $0
    IfErrors launch_error
    ${If} $0 == 0
        Delete "$PreviousInstall\UninstallProductivity.exe"
        RMDir "$PreviousInstall"
    ${EndIf}
    SetErrorLevel $0
    Quit
launch_error:
    MessageBox MB_ICONEXCLAMATION|MB_OK "Setup could not start the uninstaller. Open Settings, then Installed apps, to remove Productivity." /SD IDOK
FunctionEnd

Function .onVerifyInstDir
    ${If} $INSTDIR == "$LOCALAPPDATA\Productivity"
        Abort
    ${EndIf}
    IfFileExists "$INSTDIR\UninstallProductivity.exe" valid
    FindFirst $0 $1 "$INSTDIR\*"
find_next:
    ${If} $1 == ""
        FindClose $0
        Goto valid
    ${EndIf}
    ${If} $1 != "."
    ${AndIf} $1 != ".."
        FindClose $0
        Abort
    ${EndIf}
    FindNext $0 $1
    IfErrors close_search find_next
close_search:
    FindClose $0
valid:
FunctionEnd

Function LaunchProductivity
    Exec '"$INSTDIR\runtime\pythonw.exe" "$INSTDIR\windows_launcher.py"'
FunctionEnd

Function EnsureWebView
    ; Managed deployments can install WebView2 ahead of a silent installation.
    IfSilent done
    SetRegView 32
    ReadRegStr $0 HKLM "${WEBVIEW_KEY}" "pv"
    SetRegView 64
    ${If} $0 != ""
    ${AndIf} $0 != "0.0.0.0"
        Return
    ${EndIf}
    ReadRegStr $0 HKCU "${WEBVIEW_KEY}" "pv"
    ${If} $0 != ""
    ${AndIf} $0 != "0.0.0.0"
        Return
    ${EndIf}
    InitPluginsDir
    SetOutPath "$PLUGINSDIR"
    File "${PAYLOAD}\MicrosoftEdgeWebview2Setup.exe"
    DetailPrint "Installing the Microsoft Edge WebView2 Runtime"
    ClearErrors
    ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $0
    ${If} ${Errors}
    ${OrIf} $0 != 0
        MessageBox MB_ICONINFORMATION|MB_OK "Productivity needs the Microsoft Edge WebView2 Runtime for its desktop window. If the window cannot open, install WebView2 from Microsoft." /SD IDOK
    ${EndIf}
done:
FunctionEnd

Section "Productivity (required)" MainSection
    SectionIn RO
    Call .onVerifyInstDir
    ReadRegStr $0 HKCU "${APP_KEY}" "InstallLocation"
    ${If} $0 != ""
    ${AndIf} $0 != $INSTDIR
        IfFileExists "$0\UninstallProductivity.exe" 0 proceed
        MessageBox MB_ICONEXCLAMATION|MB_OK "Uninstall the existing copy of Productivity before installing to a new folder." /SD IDOK
        Abort
    ${EndIf}
proceed:
    IfFileExists "$INSTDIR\runtime\pythonw.exe" 0 install_files
    ExecWait '"$INSTDIR\runtime\pythonw.exe" "$INSTDIR\windows_launcher.py" --stop' $0
    ${If} $0 != 0
        MessageBox MB_ICONEXCLAMATION|MB_OK "Close Productivity before updating it." /SD IDOK
        Abort
    ${EndIf}
install_files:
    SetOutPath "$INSTDIR"
    File "${PAYLOAD}\app.py"
    File "${PAYLOAD}\desktop_server.py"
    File "${PAYLOAD}\desktop_accounts.py"
    File "${PAYLOAD}\account-service.json"
    File "${PAYLOAD}\ACCOUNTS.md"
    File "${PAYLOAD}\windows_launcher.py"
    File "${PAYLOAD}\import_browser_data.py"
    File "${PAYLOAD}\README.md"
    File "${PAYLOAD}\LICENSE"
    File "${__FILEDIR__}\productivity.ico"
    SetOutPath "$INSTDIR\static"
    File /r "${PAYLOAD}\static\*"
    SetOutPath "$INSTDIR\runtime"
    File /r "${PAYLOAD}\runtime\*"
    Call EnsureWebView
    SetOutPath "$INSTDIR"
    WriteUninstaller "$INSTDIR\UninstallProductivity.exe"
    CreateDirectory "$SMPROGRAMS\Productivity"
    CreateShortCut "$SMPROGRAMS\Productivity\Productivity.lnk" "$INSTDIR\runtime\pythonw.exe" '"$INSTDIR\windows_launcher.py"' "$INSTDIR\productivity.ico"
    Delete "$SMPROGRAMS\Productivity\Productivity in browser.lnk"
    CreateShortCut "$SMPROGRAMS\Productivity\Exit Productivity.lnk" "$INSTDIR\runtime\pythonw.exe" '"$INSTDIR\windows_launcher.py" --stop' "$INSTDIR\productivity.ico"
    WriteRegStr HKCU "${APP_KEY}" "DisplayName" "${APP_NAME}"
    WriteRegStr HKCU "${APP_KEY}" "DisplayVersion" "${APP_VERSION}"
    WriteRegStr HKCU "${APP_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "${APP_KEY}" "DisplayIcon" '"$INSTDIR\productivity.ico"'
    WriteRegStr HKCU "${APP_KEY}" "UninstallString" '"$INSTDIR\UninstallProductivity.exe"'
    WriteRegDWORD HKCU "${APP_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${APP_KEY}" "NoRepair" 1
SectionEnd

Section /o "Desktop shortcut" DesktopSection
    CreateShortCut "$DESKTOP\Productivity.lnk" "$INSTDIR\runtime\pythonw.exe" '"$INSTDIR\windows_launcher.py"' "$INSTDIR\productivity.ico"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${MainSection} "Installs Productivity and the Python runtime it uses."
    !insertmacro MUI_DESCRIPTION_TEXT ${DesktopSection} "Adds a Productivity shortcut to your desktop."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function un.onInit
    SetRegView 64
FunctionEnd

Section "Uninstall"
    IfFileExists "$INSTDIR\runtime\pythonw.exe" 0 remove_files
    ExecWait '"$INSTDIR\runtime\pythonw.exe" "$INSTDIR\windows_launcher.py" --stop' $0
    ${If} $0 != 0
        MessageBox MB_ICONEXCLAMATION|MB_OK "Close Productivity before uninstalling it." /SD IDOK
        Abort
    ${EndIf}
remove_files:
    Delete "$SMPROGRAMS\Productivity\Productivity.lnk"
    Delete "$SMPROGRAMS\Productivity\Productivity in browser.lnk"
    Delete "$SMPROGRAMS\Productivity\Exit Productivity.lnk"
    Delete "$DESKTOP\Productivity.lnk"
    RMDir "$SMPROGRAMS\Productivity"
    Delete "$INSTDIR\app.py"
    Delete "$INSTDIR\desktop_server.py"
    Delete "$INSTDIR\desktop_accounts.py"
    Delete "$INSTDIR\account-service.json"
    Delete "$INSTDIR\ACCOUNTS.md"
    Delete "$INSTDIR\windows_launcher.py"
    Delete "$INSTDIR\import_browser_data.py"
    Delete "$INSTDIR\README.md"
    Delete "$INSTDIR\LICENSE"
    Delete "$INSTDIR\productivity.ico"
    RMDir /r "$INSTDIR\runtime"
    RMDir /r "$INSTDIR\static"
    RMDir /r "$INSTDIR\__pycache__"
    Delete "$INSTDIR\UninstallProductivity.exe"
    RMDir "$INSTDIR"
    DeleteRegKey HKCU "${APP_KEY}"
SectionEnd
