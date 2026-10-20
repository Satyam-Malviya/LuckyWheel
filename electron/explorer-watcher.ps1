# Stateless Native Windows File Explorer & Desktop Selection + Hotkey Watcher for LuckyWheel
# Emits edge-triggered keydown/keyup/mouseup events to stdout. Compatible with Windows PowerShell 5.1.

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("6d5140c1-7436-11ce-8034-00aa006009fa")]
public interface IServiceProvider {
    [PreserveSig]
    int QueryService(ref Guid guidService, ref Guid riid, out IntPtr ppvObject);
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("000214E2-0000-0000-C000-000000000046")]
public interface IShellBrowser {
    [PreserveSig] int GetWindow(out IntPtr phwnd);
}

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

    [DllImport("user32.dll")]
    public static extern bool IsChild(IntPtr hWndParent, IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    private static readonly Guid SID_STopLevelBrowser = new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837");
    private static readonly Guid IID_IShellBrowser = new Guid("000214E2-0000-0000-C000-000000000046");

    public static IntPtr GetTabHwnd(object webBrowserCom) {
        try {
            IServiceProvider sp = (IServiceProvider)webBrowserCom;
            Guid service = SID_STopLevelBrowser;
            Guid iid = IID_IShellBrowser;
            IntPtr pSb;
            int hr = sp.QueryService(ref service, ref iid, out pSb);
            if (hr == 0 && pSb != IntPtr.Zero) {
                IShellBrowser sb = (IShellBrowser)Marshal.GetObjectForIUnknown(pSb);
                IntPtr hwnd;
                sb.GetWindow(out hwnd);
                Marshal.Release(pSb);
                return hwnd;
            }
        } catch {}
        return IntPtr.Zero;
    }

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

    public static IntPtr GetFocusedHwnd(IntPtr fgHwnd) {
        if (fgHwnd == IntPtr.Zero) return IntPtr.Zero;
        uint pid;
        uint tid = GetWindowThreadProcessId(fgHwnd, out pid);
        GUITHREADINFO info = new GUITHREADINFO();
        info.cbSize = Marshal.SizeOf(info);
        if (GetGUIThreadInfo(tid, ref info)) {
            return info.hwndFocus;
        }
        return IntPtr.Zero;
    }

    public static string GetFocusedControlClass(IntPtr fgHwnd) {
        IntPtr f = GetFocusedHwnd(fgHwnd);
        return f != IntPtr.Zero ? GetWndClass(f) : "";
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

function Get-ExplorerFolderAndFiles([int64]$hwndInt, [string]$fgTitle, [IntPtr]$focusedHwnd) {
    # Query tabs belonging to this Explorer window
    $tabs = @()
    try {
        foreach ($win in $shell.Windows()) {
            try {
                if ([int64]$win.HWND -eq $hwndInt) { $tabs += $win }
            } catch {}
        }
    } catch {}

    # In Windows 11 multi-tab / XAML islands, win.HWND might be an inner ShellView. Fallback by LocationName / Title.
    if ($tabs.Count -eq 0) {
        try {
            foreach ($win in $shell.Windows()) {
                try {
                    $loc = [string]$win.LocationName
                    if ($loc -and $fgTitle -and ($fgTitle.StartsWith($loc) -or $fgTitle -match [regex]::Escape($loc))) {
                        $tabs += $win
                    }
                } catch {}
            }
        } catch {}
    }

    $fallbackFolder = ""
    if ($fgTitle) {
        $cleanTitle = $fgTitle -replace " - File Explorer$", "" -replace " - Windows Explorer$", ""
        if ($cleanTitle -eq "Downloads") { $fallbackFolder = [System.IO.Path]::Combine([Environment]::GetFolderPath('UserProfile'), 'Downloads') }
        elseif ($cleanTitle -eq "Documents") { $fallbackFolder = [Environment]::GetFolderPath('MyDocuments') }
        elseif ($cleanTitle -eq "Desktop") { $fallbackFolder = [Environment]::GetFolderPath('Desktop') }
        elseif ($cleanTitle -eq "Pictures") { $fallbackFolder = [Environment]::GetFolderPath('MyPictures') }
        elseif ($cleanTitle -eq "Videos") { $fallbackFolder = [Environment]::GetFolderPath('MyVideos') }
        elseif ($cleanTitle -eq "Music") { $fallbackFolder = [Environment]::GetFolderPath('MyMusic') }
        elseif ([System.IO.Directory]::Exists($cleanTitle)) { $fallbackFolder = $cleanTitle }
    }

    if ($tabs.Count -eq 0) {
        return @{
            folder = $fallbackFolder
            files  = @()
        }
    }

    $active = $null
    if ($tabs.Count -eq 1) {
        $active = $tabs[0]
    } else {
        # 1. Match active tab via focused control ancestry (Windows 11 multi-tab Explorer)
        if ($focusedHwnd -ne [IntPtr]::Zero) {
            foreach ($t in $tabs) {
                $tabHwnd = [Win32Watcher]::GetTabHwnd($t)
                if ($tabHwnd -ne [IntPtr]::Zero -and ([Win32Watcher]::IsChild($tabHwnd, $focusedHwnd) -or $tabHwnd -eq $focusedHwnd)) {
                    $active = $t
                    break
                }
            }
        }

        # 2. Match active tab via window visibility (inactive tabs are hidden)
        if ($null -eq $active) {
            foreach ($t in $tabs) {
                $tabHwnd = [Win32Watcher]::GetTabHwnd($t)
                if ($tabHwnd -ne [IntPtr]::Zero -and [Win32Watcher]::IsWindowVisible($tabHwnd)) {
                    $active = $t
                    break
                }
            }
        }

        # 3. Match active tab via LocationName and window title
        if ($null -eq $active) {
            foreach ($t in $tabs) {
                try {
                    $loc = [string]$t.LocationName
                    if ($loc -and $fgTitle -and $fgTitle.StartsWith($loc)) { $active = $t; break }
                } catch {}
            }
        }

        # 4. Fallback to tab 0
        if ($null -eq $active) { $active = $tabs[0] }
    }

    $folderPath = ""
    try {
        $folderPath = [string]$active.Document.Folder.Self.Path
    } catch {}

    if ([string]::IsNullOrEmpty($folderPath)) {
        try {
            $url = [string]$active.LocationURL
            if ($url -and $url.StartsWith("file:///")) {
                $folderPath = [System.Uri]::new($url).LocalPath
            }
        } catch {}
    }

    $res = @()
    try {
        foreach ($item in $active.Document.SelectedItems()) {
            if ($item.Path) { $res += [string]$item.Path }
        }
    } catch {}

    if ($res.Count -gt 0 -and [string]::IsNullOrEmpty($folderPath)) {
        try {
            $folderPath = [System.IO.Path]::GetDirectoryName($res[0])
        } catch {}
    }

    if ([string]::IsNullOrEmpty($folderPath)) {
        $folderPath = $fallbackFolder
    }

    return @{
        folder = $folderPath
        files  = @($res | Select-Object -Unique)
    }
}

function Get-BestFolderAndFiles([IntPtr]$fgHwnd, [string]$fgClass, [string]$fgTitle, [IntPtr]$focusedHwnd) {
    if ($fgClass -eq "Progman" -or $fgClass -eq "WorkerW") {
        return @{
            folder = [Environment]::GetFolderPath('Desktop')
            files  = @(Get-DesktopSelectedFiles)
        }
    }
    if ($fgClass -eq "CabinetWClass" -or $fgClass -eq "ExploreWClass") {
        return (Get-ExplorerFolderAndFiles ($fgHwnd.ToInt64()) $fgTitle $focusedHwnd)
    }
    return @{ folder = ""; files = @() }
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

        $focusedHwnd = [Win32Watcher]::GetFocusedHwnd($fgHwnd)
        $focusedCtrl = [Win32Watcher]::GetWndClass($focusedHwnd)

        $mode = if ($shiftDown) { "conversions" } elseif ($altDown) { "tools" } else { "actions" }
        $keyName = if ($shiftDown) { "Shift" } elseif ($altDown) { "Alt" } else { "Ctrl" }

        # Skip only if the main LuckyWheel studio dashboard window is actively focused
        $isMainDashboardFocused = ($fgTitle -match "Radial File Converter")

        $isExplorerOrDesktop = ($fgClass -eq "CabinetWClass" -or $fgClass -eq "ExploreWClass" -or $fgClass -eq "Progman" -or $fgClass -eq "WorkerW")

        # Never trigger in other apps, or while renaming / typing in the address/search box
        if ($isExplorerOrDesktop -and -not $isMainDashboardFocused -and ($focusedCtrl -notmatch "Edit")) {
            $folderData = Get-BestFolderAndFiles $fgHwnd $fgClass $fgTitle $focusedHwnd
            $files = if ($folderData -and $folderData.files) { @($folderData.files) } else { @() }
            $curDir = if ($folderData -and $folderData.folder) { [string]$folderData.folder } else { "" }

            if ([string]::IsNullOrEmpty($curDir) -and ($fgClass -eq "Progman" -or $fgClass -eq "WorkerW")) {
                $curDir = [Environment]::GetFolderPath('Desktop')
            }

            # STRICT: Only trigger file conversion wheel if user has actually selected file(s)!
            # Never trigger on empty folders or blank background.
            if ($files.Count -gt 0) {
                Emit-Json @{
                    type       = "keydown"
                    key        = $keyName
                    mode       = $mode
                    x          = $pt.X
                    y          = $pt.Y
                    files      = $files
                    currentDir = $curDir
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
