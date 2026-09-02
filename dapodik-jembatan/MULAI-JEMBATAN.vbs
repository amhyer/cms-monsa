Option Explicit
On Error Resume Next

Dim shell, fso, folder, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

If Err.Number <> 0 Then
  MsgBox "Windows tidak dapat membuka launcher Jembatan Dapodik. Error: " & Err.Description, 16, "Jembatan Dapodik"
  WScript.Quit 1
End If

folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder

command = "cmd.exe /k ""title Jembatan Dapodik - CMS MONSA & echo Menjalankan Jembatan Dapodik... & echo Jendela ini jangan ditutup. & echo. & node --version & echo. & node jembatan.mjs"""
Err.Clear
shell.Run command, 1, False

If Err.Number <> 0 Then
  MsgBox "Jembatan gagal dijalankan. Error: " & Err.Description, 16, "Jembatan Dapodik"
  WScript.Quit 1
End If
