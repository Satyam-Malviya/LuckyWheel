using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public class ScreenCap {
    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

    private const uint MOUSEEVENTF_WHEEL = 0x0800;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private static Bitmap CaptureRect(int x, int y, int w, int h) {
        Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp)) {
            g.CopyFromScreen(x, y, 0, 0, new Size(w, h), CopyPixelOperation.SourceCopy);
        }
        return bmp;
    }

    // Check if two bitmaps are nearly identical (meaning scroll reached bottom)
    private static bool AreBitmapsIdentical(Bitmap b1, Bitmap b2) {
        if (b1.Width != b2.Width || b1.Height != b2.Height) return false;
        int w = b1.Width;
        int h = b1.Height;
        int matchCount = 0;
        int totalSamples = 40;

        for (int i = 0; i < totalSamples; i++) {
            int sx = (w * (i % 8 + 1)) / 10;
            int sy = (h * (i / 8 + 1)) / 6;
            if (sx < w && sy < h) {
                Color c1 = b1.GetPixel(sx, sy);
                Color c2 = b2.GetPixel(sx, sy);
                int diff = Math.Abs(c1.R - c2.R) + Math.Abs(c1.G - c2.G) + Math.Abs(c1.B - c2.B);
                if (diff < 15) matchCount++;
            }
        }
        return matchCount >= (totalSamples - 2);
    }

    // Find vertical offset overlap between previous frame and next frame
    private static int FindVerticalOverlap(Bitmap b1, Bitmap b2) {
        int w = b1.Width;
        int h = b1.Height;
        int sampleStripH = 24;
        int startY1 = h - sampleStripH - 10;
        if (startY1 < 0) return 0;

        int bestY2 = -1;
        long minDiff = long.MaxValue;

        // Search in b2 between 0 and h - sampleStripH
        for (int y2 = 0; y2 < h - sampleStripH; y2 += 2) {
            long diff = 0;
            for (int sx = 20; sx < w - 20; sx += 8) {
                for (int dy = 0; dy < sampleStripH; dy += 4) {
                    Color c1 = b1.GetPixel(sx, startY1 + dy);
                    Color c2 = b2.GetPixel(sx, y2 + dy);
                    diff += Math.Abs(c1.R - c2.R) + Math.Abs(c1.G - c2.G) + Math.Abs(c1.B - c2.B);
                }
            }
            if (diff < minDiff) {
                minDiff = diff;
                bestY2 = y2;
            }
        }

        // If high confidence match found
        if (bestY2 >= 0 && minDiff < (sampleStripH * w * 15)) {
            int overlap = (startY1 + sampleStripH) - bestY2;
            return Math.Max(0, Math.Min(h - 10, overlap));
        }

        // Fallback: estimate ~300px scroll per wheel burst
        return Math.Max(0, h - 320);
    }

    public static int Main(string[] args) {
        try { SetProcessDPIAware(); } catch {}

        if (args.Length < 2) {
            Console.WriteLine("Usage: screencap.exe <screen|window|region|scroll> <outPath> [x] [y] [w] [h]");
            return 1;
        }

        string mode = args[0].ToLowerInvariant();
        string outPath = args[1];

        try {
            if (mode == "scroll" || mode == "long") {
                IntPtr fg = GetForegroundWindow();
                RECT r = new RECT();
                int x = 0, y = 0, w = 0, h = 0;
                if (fg != IntPtr.Zero && GetWindowRect(fg, out r)) {
                    x = r.Left;
                    y = r.Top;
                    w = Math.Max(200, r.Right - r.Left);
                    h = Math.Max(200, r.Bottom - r.Top);
                } else {
                    Rectangle b = Screen.PrimaryScreen.Bounds;
                    x = b.X; y = b.Y; w = b.Width; h = b.Height;
                }

                // Focus window and move mouse inside for wheel scrolling
                try {
                    SetForegroundWindow(fg);
                    Cursor.Position = new Point(x + w / 2, y + h / 2);
                } catch {}

                Thread.Sleep(80);

                List<Bitmap> frames = new List<Bitmap>();
                List<int> sliceOffsets = new List<int>();

                // Capture initial frame
                Bitmap initial = CaptureRect(x, y, w, h);
                frames.Add(initial);
                sliceOffsets.Add(0);

                int maxScrolls = 6;
                for (int s = 0; s < maxScrolls; s++) {
                    // Send 3 mouse wheel scrolls down (-360)
                    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, -360, 0);
                    Thread.Sleep(140);

                    Bitmap nextFrame = CaptureRect(x, y, w, h);
                    if (AreBitmapsIdentical(frames[frames.Count - 1], nextFrame)) {
                        // Reached end of scroll
                        break;
                    }

                    int overlap = FindVerticalOverlap(frames[frames.Count - 1], nextFrame);
                    int newContentTop = Math.Max(10, Math.Min(h - 50, h - overlap));
                    sliceOffsets.Add(newContentTop);
                    frames.Add(nextFrame);
                }

                // Calculate total stitched height
                int totalHeight = frames[0].Height;
                for (int i = 1; i < frames.Count; i++) {
                    totalHeight += (frames[i].Height - sliceOffsets[i]);
                }

                Bitmap stitched = new Bitmap(w, totalHeight, PixelFormat.Format32bppArgb);
                using (Graphics g = Graphics.FromImage(stitched)) {
                    // Draw first frame
                    g.DrawImage(frames[0], 0, 0);
                    int currentY = frames[0].Height;

                    for (int i = 1; i < frames.Count; i++) {
                        int sliceTop = sliceOffsets[i];
                        int sliceH = frames[i].Height - sliceTop;
                        Rectangle srcRect = new Rectangle(0, sliceTop, w, sliceH);
                        Rectangle destRect = new Rectangle(0, currentY, w, sliceH);
                        g.DrawImage(frames[i], destRect, srcRect, GraphicsUnit.Pixel);
                        currentY += sliceH;
                    }
                }

                stitched.Save(outPath, ImageFormat.Png);
                Console.WriteLine("SUCCESS:" + outPath + ":" + w + "x" + totalHeight);

                // Clean up bitmaps
                foreach (Bitmap b in frames) b.Dispose();
                stitched.Dispose();
                return 0;
            }

            int sx = 0, sy = 0, sw = 0, sh = 0;

            if (mode == "screen") {
                Rectangle bounds = Screen.PrimaryScreen.Bounds;
                sx = bounds.X;
                sy = bounds.Y;
                sw = bounds.Width;
                sh = bounds.Height;
            } else if (mode == "window") {
                IntPtr fg = GetForegroundWindow();
                if (fg != IntPtr.Zero) {
                    RECT r;
                    if (GetWindowRect(fg, out r)) {
                        sx = r.Left;
                        sy = r.Top;
                        sw = Math.Max(1, r.Right - r.Left);
                        sh = Math.Max(1, r.Bottom - r.Top);
                    }
                }
                if (sw <= 0 || sh <= 0) {
                    Rectangle bounds = Screen.PrimaryScreen.Bounds;
                    sx = bounds.X;
                    sy = bounds.Y;
                    sw = bounds.Width;
                    sh = bounds.Height;
                }
            } else if (mode == "region") {
                if (args.Length >= 6) {
                    int.TryParse(args[2], out sx);
                    int.TryParse(args[3], out sy);
                    int.TryParse(args[4], out sw);
                    int.TryParse(args[5], out sh);
                }
                if (sw <= 0 || sh <= 0) {
                    sw = 400;
                    sh = 300;
                }
            }

            using (Bitmap bmp = CaptureRect(sx, sy, sw, sh)) {
                bmp.Save(outPath, ImageFormat.Png);
            }
            Console.WriteLine("SUCCESS:" + outPath + ":" + sw + "x" + sh);
            return 0;
        } catch (Exception ex) {
            Console.Error.WriteLine("ERROR:" + ex.Message);
            return 2;
        }
    }
}
