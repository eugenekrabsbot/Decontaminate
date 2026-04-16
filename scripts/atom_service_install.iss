// Inno Setup Pascal script for manual Atom SDK service installation
// Use if Atom.SDK.Installer.exe is missing

[Code]
procedure CreateAtomService(ServiceName, ServicePath: string);
var
  ResultCode: Integer;
begin
  Log('Creating Windows service: ' + ServiceName);
  // Delete service if it exists (cleanup)
  Exec('sc', 'stop ' + ServiceName, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('sc', 'delete ' + ServiceName, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  // Create new service
  if not Exec('sc', 'create ' + ServiceName + ' binPath= "' + ServicePath + '" start= auto', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('Failed to create service: ' + IntToStr(ResultCode));
  end else begin
    Log('Service created successfully.');
    // Set description
    Exec('sc', 'description ' + ServiceName + ' "AhoyVPN Service"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

function InstallTapDriver(DriverInfPath: string): Boolean;
var
  ResultCode: Integer;
begin
  Log('Installing TAP driver from: ' + DriverInfPath);
  // Use pnputil to install driver (Windows 10+)
  if Exec('pnputil', '/add-driver "' + DriverInfPath + '" /install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('Driver installation succeeded.');
    Result := True;
  end else begin
    Log('Driver installation failed: ' + IntToStr(ResultCode));
    Result := False;
  end;
end;

function FindAtomServiceExe(AppPath: string): string;
var
  ServiceExePath: string;
begin
  ServiceExePath := ExpandConstant('{app}\Atom.Service.exe');
  if FileExists(ServiceExePath) then
    Result := ServiceExePath
  else
    Result := '';
end;

procedure ManualAtomInstall();
var
  ServiceExePath, DriverInfPath: string;
begin
  ServiceExePath := FindAtomServiceExe(ExpandConstant('{app}'));
  if ServiceExePath = '' then
  begin
    Log('Atom.Service.exe not found in installation directory. Manual installation may not be possible.');
    Exit;
  end;
  
  // Create service
  CreateAtomService('AHOYService', ServiceExePath);
  
  // Install TAP driver if present
  DriverInfPath := ExpandConstant('{app}\Drivers\tap0901.inf');
  if FileExists(DriverInfPath) then
    InstallTapDriver(DriverInfPath)
  else
    Log('TAP driver INF not found, skipping driver installation.');
end;