@echo off
echo Creating backup of Sparky Screen Recorder...

REM Create backup directory with timestamp
set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%
set timestamp=%timestamp: =0%
set backupdir=backup_%timestamp%

mkdir %backupdir%

REM Copy all important files
xcopy *.* %backupdir%\ /E /I /H /Y
echo Backup created in %backupdir%

REM Also create a zip if possible
if exist "C:\Program Files\7-Zip\7z.exe" (
    "C:\Program Files\7-Zip\7z.exe" a -tzip "%backupdir%.zip" "*" -x!node_modules -x!.git -x!temp_video.webm
    echo Zip backup created: %backupdir%.zip
)

echo.
echo Backup complete! 
echo Directory: %backupdir%
pause