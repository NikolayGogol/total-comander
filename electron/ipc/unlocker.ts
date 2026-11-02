import { ipcMain, shell } from 'electron'
import { execFile } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { safeEnsureDir } from '../utils'

const PS_SCRIPT = `
param([string]$targetPath)

$source = @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class UnlockUtil {
    [StructLayout(LayoutKind.Sequential)]
    struct RM_UNIQUE_PROCESS {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }
    const int RmRebootReasonNone = 0;
    const int CCH_RM_MAX_APP_NAME = 255;
    const int CCH_RM_MAX_SVC_NAME = 63;
    enum RM_APP_TYPE { RmUnknownApp = 0, RmMainWindow = 1, RmOtherWindow = 2, RmService = 3, RmExplorer = 4, RmConsole = 5, RmCritical = 1000 }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_APP_NAME + 1)]
        public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_SVC_NAME + 1)]
        public string strServiceShortName;
        public RM_APP_TYPE ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)]
        public bool bRestartable;
    }
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Auto)]
    static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);
    [DllImport("rstrtmgr.dll")]
    static extern int RmEndSession(uint pSessionHandle);
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Auto)]
    static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames, uint nApplications, RM_UNIQUE_PROCESS[] rgApplications, uint nServices, string[] rgsServiceNames);
    [DllImport("rstrtmgr.dll")]
    static extern int RmGetList(uint pSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo, [In, Out] RM_PROCESS_INFO[] rgAffectedApps, out uint lpdwRebootReasons);

    public class LockInfo {
        public int pid;
        public string name;
        public string appName;
    }

    public static List<LockInfo> WhoIsLocking(string path) {
        uint handle;
        string key = Guid.NewGuid().ToString();
        List<LockInfo> list = new List<LockInfo>();
        int res = RmStartSession(out handle, 0, key);
        if (res != 0) return list;
        try {
            string[] resources = new string[] { path };
            res = RmRegisterResources(handle, (uint)resources.Length, resources, 0, null, 0, null);
            if (res != 0) return list;
            uint needed = 0, procCount = 0, reasons = 0;
            res = RmGetList(handle, out needed, ref procCount, null, out reasons);
            if (res == 234) {
                RM_PROCESS_INFO[] procs = new RM_PROCESS_INFO[needed];
                procCount = needed;
                res = RmGetList(handle, out needed, ref procCount, procs, out reasons);
                if (res == 0) {
                    for (int i = 0; i < procCount; i++) {
                        string pName = "";
                        try {
                            using (var p = Process.GetProcessById(procs[i].Process.dwProcessId)) {
                                pName = p.ProcessName;
                            }
                        } catch {}
                        list.Add(new LockInfo { pid = procs[i].Process.dwProcessId, name = pName, appName = procs[i].strAppName });
                    }
                }
            }
        } finally {
            RmEndSession(handle);
        }
        return list;
    }
}
"@
Add-Type -TypeDefinition $source -ErrorAction SilentlyContinue
if (-not $targetPath) {
    Write-Output "[]"
    exit 0
}
$procs = [UnlockUtil]::WhoIsLocking($targetPath)
if ($procs.Count -eq 0) {
    Write-Output "[]"
} else {
    @($procs) | ConvertTo-Json -Compress
}
`

function ensureScriptFile(): string {
  const scriptPath = path.join(os.tmpdir(), 'tc-unlocker.ps1')
  try {
    fs.writeFileSync(scriptPath, PS_SCRIPT, 'utf8')
  } catch {}
  return scriptPath
}

function getPowerShellExe(): string {
  const defaultPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  if (fs.existsSync(defaultPath)) return defaultPath
  return 'powershell.exe'
}

function killPid(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('taskkill', ['/F', '/PID', String(pid)], (err) => {
      resolve(!err)
    })
  })
}

export function registerUnlockerIpc(): void {
  // Find processes that are locking a target file or folder
  ipcMain.handle('unlocker:findLockingProcesses', async (_, targetPath: string) => {
    if (!targetPath) {
      return { success: false, error: 'Path is required', processes: [] }
    }

    try {
      const scriptPath = ensureScriptFile()
      const psExe = getPowerShellExe()

      const processes = await new Promise<Array<{ pid: number; name: string; appName: string }>>((resolve) => {
        execFile(
          psExe,
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, targetPath],
          { timeout: 8000 },
          (err, stdout) => {
            if (err) {
              resolve([])
              return
            }

            try {
              const text = (stdout || '').trim()
              if (!text || text === '[]') {
                resolve([])
                return
              }
              const parsed = JSON.parse(text)
              if (Array.isArray(parsed)) {
                resolve(parsed)
              } else if (parsed && typeof parsed === 'object') {
                resolve([parsed])
              } else {
                resolve([])
              }
            } catch {
              resolve([])
            }
          }
        )
      })

      return { success: true, processes }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to detect locking processes', processes: [] }
    }
  })

  // Kill specific PIDs
  ipcMain.handle('unlocker:killProcesses', async (_, pids: number[]) => {
    if (!Array.isArray(pids) || pids.length === 0) {
      return { success: true, killedCount: 0 }
    }

    let count = 0
    const errors: string[] = []

    for (const pid of pids) {
      const ok = await killPid(pid)
      if (ok) {
        count++
      } else {
        errors.push(`Could not terminate process PID ${pid}`)
      }
    }

    return { success: true, killedCount: count, errors: errors.length > 0 ? errors : undefined }
  })

  // Unlock and perform action (delete, move, copy, or unlock)
  ipcMain.handle(
    'unlocker:unlockAndExecute',
    async (
      _,
      options: {
        targetPath: string
        action: 'delete' | 'move' | 'copy' | 'unlock'
        pidsToKill?: number[]
        destinationDir?: string
        permanentDelete?: boolean
      }
    ) => {
      const { targetPath, action, pidsToKill = [], destinationDir, permanentDelete } = options

      if (!targetPath) {
        return { success: false, error: 'Target path is required' }
      }

      // Step 1: Terminate locking processes if requested
      if (Array.isArray(pidsToKill) && pidsToKill.length > 0) {
        for (const pid of pidsToKill) {
          await killPid(pid)
        }
        // Brief delay for Windows to release file handles
        await new Promise((r) => setTimeout(r, 300))
      }

      // Step 2: Execute chosen file action
      try {
        if (action === 'unlock') {
          return { success: true, killedCount: pidsToKill.length, actionExecuted: 'unlock' }
        }

        if (action === 'delete') {
          if (permanentDelete) {
            await fsPromises.rm(targetPath, { recursive: true, force: true })
          } else {
            try {
              await shell.trashItem(targetPath)
            } catch {
              // Fallback to permanent rm if trash fails on locked/system media
              await fsPromises.rm(targetPath, { recursive: true, force: true })
            }
          }
          return { success: true, killedCount: pidsToKill.length, actionExecuted: 'delete' }
        }

        if (action === 'move') {
          if (!destinationDir) {
            return { success: false, error: 'Destination directory is required for move' }
          }
          await safeEnsureDir(destinationDir)
          const baseName = path.basename(targetPath)
          const dest = path.join(destinationDir, baseName)

          try {
            await fsPromises.rename(targetPath, dest)
          } catch (renameErr: any) {
            if (renameErr.code === 'EXDEV') {
              await fsPromises.cp(targetPath, dest, { recursive: true })
              await fsPromises.rm(targetPath, { recursive: true, force: true })
            } else {
              throw renameErr
            }
          }
          return { success: true, killedCount: pidsToKill.length, actionExecuted: 'move' }
        }

        if (action === 'copy') {
          if (!destinationDir) {
            return { success: false, error: 'Destination directory is required for copy' }
          }
          await safeEnsureDir(destinationDir)
          const baseName = path.basename(targetPath)
          const dest = path.join(destinationDir, baseName)
          await fsPromises.cp(targetPath, dest, { recursive: true })
          return { success: true, killedCount: pidsToKill.length, actionExecuted: 'copy' }
        }

        return { success: false, error: `Unknown action: ${action}` }
      } catch (err: any) {
        return { success: false, error: err.message || 'Operation failed' }
      }
    }
  )
}

