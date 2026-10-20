using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class ScreenCap {
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public static int Main(string[] args) {
        if (args.Length < 2) {
            Console.WriteLine("Usage: screencap.exe <screen|window|region> <outPath> [x] [y] [w] [h]");
            return 1;
        }

        string mode = args[0].ToLowerInvariant();
        string outPath = args[1];

        int x = 0, y = 0, w = 0, h = 0;

        if (mode == "screen") {
            Rectangle bounds = Screen.PrimaryScreen.Bounds;
            x = bounds.X;
            y = bounds.Y;
            w = bounds.Width;
            h = bounds.Height;
        } else if (mode == "window") {
            IntPtr fg = GetForegroundWindow();
            if (fg != IntPtr.Zero) {
                RECT r;
                if (GetWindowRect(fg, out r)) {
                    x = r.Left;
                    y = r.Top;
                    w = Math.Max(1, r.Right - r.Left);
                    h = Math.Max(1, r.Bottom - r.Top);
                }
            }
            if (w <= 0 || h <= 0) {
                Rectangle bounds = Screen.PrimaryScreen.Bounds;
                x = bounds.X;
                y = bounds.Y;
                w = bounds.Width;
                h = bounds.Height;
            }
        } else if (mode == "region") {
            if (args.Length >= 6) {
                int.TryParse(args[2], out x);
                int.TryParse(args[3], out y);
                int.TryParse(args[4], out w);
                int.TryParse(args[5], out h);
            }
            if (w <= 0 || h <= 0) {
                w = 400;
                h = 300;
            }
        }

        try {
            using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                using (Graphics g = Graphics.FromImage(bmp)) {
                    g.CopyFromScreen(x, y, 0, 0, new Size(w, h), CopyPixelOperation.SourceCopy);
                }
                bmp.Save(outPath, ImageFormat.Png);
            }
            Console.WriteLine("SUCCESS:" + outPath + ":" + w + "x" + h);
            return 0;
        } catch (Exception ex) {
            Console.Error.WriteLine("ERROR:" + ex.Message);
            return 2;
        }
    }
}
