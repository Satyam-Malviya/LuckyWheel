# Stateless Native Windows File Explorer & Desktop Selection + Hotkey Watcher for LuckyWheel
# Emits edge-triggered keydown/keyup/mouseup events to stdout. Compatible with Windows PowerShell 5.1.

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class Win32Watcher {
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct GUITHREADINFO {
        public int cbSize;
        public int flags;
        public IntPtr hwndActive;
        public IntPtr hwndFocus;
        public IntPtr hwndCapture;
        public IntPtr hwndMenuOwner;
        public IntPtr hwndMoveSize;
        public IntPtr hwndCaret;
        public RECT rcCaret;
    }

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern IntPtr WindowFromPoint(POINT Point);

    [DllImport("user32.dll")]
    public static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool GetGUIThreadInfo(uint idThread, ref GUITHREADINFO lpgui);

    public static string GetWndClass(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return "";
        StringBuilder sb = new StringBuilder(128);
        GetClassName(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }

    public static string GetWndTitle(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return "";
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }

    public static string GetFocusedControlClass(IntPtr fgHwnd) {
        if (fgHwnd == IntPtr.Zero) return "";
        uint pid;
        uint tid = GetWindowThreadProcessId(fgHwnd, out pid);
        GUITHREADINFO info = new GUITHREADINFO();
        info.cbSize = Marshal.SizeOf(info);
        if (GetGUIThreadInfo(tid, ref info) && info.hwndFocus != IntPtr.Zero) {
            return GetWndClass(info.hwndFocus);
        }
        return "";
    }

    public static bool IsKeyDown(int vKey) {
        return (GetAsyncKeyState(vKey) & 0x8000) != 0;
    }
}
"@

$shell = New-Object -ComObject Shell.Application

function Get-DesktopSelectedFiles {
    $res = @()
    try {
        $deskHwnd = 0
        $desktop = $shell.Windows().FindWindowSW(0, 0, 8, [ref]$deskHwnd, 1)
        if ($null -ne $desktop) {
            foreach ($item in $desktop.Document.SelectedItems()) {
                if ($item.Path) { $res += [string]$item.Path }
            }
        }
    } catch {}
    return ($res | Select-Object -Unique)
}

function Get-ExplorerSelectedFilesByHwnd([int64]$hwndInt, [string]$fgTitle) {
    # Windows 11 tabs share one HWND. Prefer the tab whose folder name matches the window title
    # (= the active tab). Never look at any other Explorer window.
    $tabs = @()
    try {
        foreach ($win in $shell.Windows()) {
            try {
                if ([int64]$win.HWND -eq $hwndInt) { $tabs += $win }
            } catch {}
        }
    } catch {}
    if ($tabs.Count -eq 0) { return @() }

    $active = $null
    if ($tabs.Count -eq 1) {
        $active = $tabs[0]
    } else {
        foreach ($t in $tabs) {
            try {
                $loc = [string]$t.LocationName
                if ($loc -and $fgTitle -and $fgTitle.StartsWith($loc)) { $active = $t; break }
            } catch {}
        }
        # Can't tell which tab is active -> safest is to do nothing
        if ($null -eq $active) { return @() }
    }

    $res = @()
    try {
        foreach ($item in $active.Document.SelectedItems()) {
            if ($item.Path) { $res += [string]$item.Path }
        }
    } catch {}
    return ($res | Select-Object -Unique)
}

function Get-BestSelectedFiles([IntPtr]$fgHwnd, [string]$fgClass, [string]$fgTitle) {
    # STRICT: only the foreground window counts. No fallback to other windows.
    if ($fgClass -eq "Progman" -or $fgClass -eq "WorkerW") {
        return @(Get-DesktopSelectedFiles)
    }
    if ($fgClass -eq "CabinetWClass" -or $fgClass -eq "ExploreWClass") {
        return @(Get-ExplorerSelectedFilesByHwnd ($fgHwnd.ToInt64()) $fgTitle)
    }
    return @()
}

function Emit-Json($hashtable) {
    $json = $hashtable | ConvertTo-Json -Compress -Depth 4
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
}

$wasShift = $false
$wasAlt = $false
$wasCtrl = $false
$wasEsc = $false
$wasLButton = $false

Emit-Json @{ type = "ready" }

while ($true) {
    Start-Sleep -Milliseconds 16

    $pt = New-Object Win32Watcher+POINT
    [void][Win32Watcher]::GetCursorPos([ref]$pt)

    $isShift = [Win32Watcher]::IsKeyDown(0x10)
    $isAlt   = [Win32Watcher]::IsKeyDown(0x12)
    $isCtrl  = [Win32Watcher]::IsKeyDown(0x11)
    $isEsc   = [Win32Watcher]::IsKeyDown(0x1B)
    $isLBtn  = [Win32Watcher]::IsKeyDown(0x01)

    if ($isEsc -and -not $wasEsc) {
        Emit-Json @{ type = "escape" }
    }

    # Edge-triggered Shift / Alt / Ctrl keydown (fires ONCE per press, never repeats while held)
    $shiftDown = ($isShift -and -not $wasShift -and -not $isCtrl -and -not $isAlt)
    $altDown   = ($isAlt   -and -not $wasAlt   -and -not $isCtrl -and -not $isShift)
    $ctrlDown  = ($isCtrl  -and -not $wasCtrl  -and -not $isShift -and -not $isAlt)

    if ($shiftDown -or $altDown -or $ctrlDown) {
        $fgHwnd = [Win32Watcher]::GetForegroundWindow()
        $fgClass = [Win32Watcher]::GetWndClass($fgHwnd)
        $fgTitle = [Win32Watcher]::GetWndTitle($fgHwnd)

        $hoverChild = [Win32Watcher]::WindowFromPoint($pt)
        $hoverRoot  = [Win32Watcher]::GetAncestor($hoverChild, 2)
        $hoverClass = [Win32Watcher]::GetWndClass($hoverRoot)

        $focusedCtrl = [Win32Watcher]::GetFocusedControlClass($fgHwnd)
        $mode = if ($shiftDown) { "conversions" } elseif ($altDown) { "tools" } else { "actions" }
        $keyName = if ($shiftDown) { "Shift" } elseif ($altDown) { "Alt" } else { "Ctrl" }

        # Skip only if the main LuckyWheel studio dashboard window is actively focused
        $isMainDashboardFocused = ($fgTitle -match "Radial File Converter")

        $isExplorerOrDesktop = ($fgClass -eq "CabinetWClass" -or $fgClass -eq "ExploreWClass" -or $fgClass -eq "Progman" -or $fgClass -eq "WorkerW")

        # Never trigger in other apps, or while renaming / typing in the address/search box
        if ($isExplorerOrDesktop -and -not $isMainDashboardFocused -and ($focusedCtrl -notmatch "Edit")) {
            $files = @(Get-BestSelectedFiles $fgHwnd $fgClass $fgTitle)
            if ($files.Count -gt 0) {
                Emit-Json @{
                    type       = "keydown"
                    key        = $keyName
                    mode       = $mode
                    x          = $pt.X
                    y          = $pt.Y
                    files      = $files
                    isDragging = $isLBtn
                    fgClass    = $fgClass
                    hoverClass = $hoverClass
                }
            }
        }
    }

    if (-not $isShift -and $wasShift) {
        Emit-Json @{ type = "keyup"; key = "Shift"; x = $pt.X; y = $pt.Y }
    }
    if (-not $isAlt -and $wasAlt) {
        Emit-Json @{ type = "keyup"; key = "Alt"; x = $pt.X; y = $pt.Y }
    }
    if (-not $isCtrl -and $wasCtrl) {
        Emit-Json @{ type = "keyup"; key = "Ctrl"; x = $pt.X; y = $pt.Y }
    }

    if (-not $isLBtn -and $wasLButton) {
        Emit-Json @{ type = "mouseup"; x = $pt.X; y = $pt.Y }
    }

    if ($isLBtn -and -not $wasLButton) {
        Emit-Json @{ type = "mousedown"; x = $pt.X; y = $pt.Y }
    }

    $wasShift   = $isShift
    $wasAlt     = $isAlt
    $wasCtrl    = $isCtrl
    $wasEsc     = $isEsc
    $wasLButton = $isLBtn
}
