using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
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

    // Check if two bitmaps are nearly identical strictly in the center content area
    private static bool AreBitmapsIdentical(Bitmap b1, Bitmap b2) {
        if (b1.Width != b2.Width || b1.Height != b2.Height) return false;
        int w = b1.Width;
        int h = b1.Height;

        int minX = (int)(w * 0.25);
        int maxX = (int)(w * 0.80);
        int minY = (int)(h * 0.25);
        int maxY = (int)(h * 0.80);

        if (maxX <= minX || maxY <= minY) return false;

        int matchCount = 0;
        int totalSamples = 50;

        for (int i = 0; i < totalSamples; i++) {
            int sx = minX + ((maxX - minX) * (i % 10 + 1)) / 11;
            int sy = minY + ((maxY - minY) * (i / 10 + 1)) / 6;
            if (sx < w && sy < h) {
                Color c1 = b1.GetPixel(sx, sy);
                Color c2 = b2.GetPixel(sx, sy);
                int diff = Math.Abs(c1.R - c2.R) + Math.Abs(c1.G - c2.G) + Math.Abs(c1.B - c2.B);
                if (diff < 15) matchCount++;
            }
        }
        return matchCount >= (totalSamples - 2);
    }

    // Finds the exact vertical displacement deltaY (pixels scrolled down) between b1 and b2
    // and determines the optimal seam row in b1 to eliminate duplicate lines and black border lines.
    private static int FindVerticalDisplacement(Bitmap b1, Bitmap b2, out int bestSeamY) {
        int w = b1.Width;
        int h = b1.Height;
        int topMargin = Math.Min(140, (int)(h * 0.15));
        int bottomMargin = Math.Min(50, (int)(h * 0.06));

        int minX = (int)(w * 0.22);
        int maxX = (int)(w * 0.78);
        if (maxX <= minX) {
            minX = 10;
            maxX = w - 10;
        }

        int templateH = 48;
        bestSeamY = h - bottomMargin - templateH - 20;

        // Find an anchor strip in b1 with high texture/contrast (skip blank paragraphs or white gaps)
        int bestAnchorY = -1;
        long bestVariance = -1;

        for (int testY = h - bottomMargin - templateH - 20; testY >= topMargin + 100; testY -= 16) {
            long varSum = 0;
            int lastGray = -1;
            for (int x = minX; x < maxX; x += 12) {
                for (int dy = 0; dy < templateH; dy += 8) {
                    Color c = b1.GetPixel(x, testY + dy);
                    int gray = (c.R + c.G + c.B) / 3;
                    if (lastGray >= 0) varSum += Math.Abs(gray - lastGray);
                    lastGray = gray;
                }
            }
            if (varSum > bestVariance) {
                bestVariance = varSum;
                bestAnchorY = testY;
            }
            if (varSum > 3500) {
                bestAnchorY = testY;
                break;
            }
        }

        if (bestAnchorY < 0) bestAnchorY = h - bottomMargin - templateH - 30;
        bestSeamY = bestAnchorY + templateH / 2;

        // Search for bestAnchorY in b2 (content must have moved upwards: topMargin <= y2 <= bestAnchorY - 15)
        int bestY2 = -1;
        long minDiff = long.MaxValue;

        int minY2 = topMargin;
        int maxY2 = bestAnchorY - 15;

        for (int y2 = minY2; y2 <= maxY2; y2++) {
            long diff = 0;
            for (int x = minX; x < maxX; x += 8) {
                for (int dy = 0; dy < templateH; dy += 4) {
                    Color c1 = b1.GetPixel(x, bestAnchorY + dy);
                    Color c2 = b2.GetPixel(x, y2 + dy);
                    diff += Math.Abs(c1.R - c2.R) + Math.Abs(c1.G - c2.G) + Math.Abs(c1.B - c2.B);
                }
            }
            if (diff < minDiff) {
                minDiff = diff;
                bestY2 = y2;
            }
        }

        int numSamples = ((maxX - minX) / 8) * (templateH / 4);
        double avgDiff = numSamples > 0 ? (double)minDiff / (numSamples * 3) : 999;

        if (bestY2 >= 0 && avgDiff < 20.0) {
            int deltaY = bestAnchorY - bestY2;
            if (deltaY >= 15 && deltaY < h - 40) {
                return deltaY;
            }
        }

        // Fallback: standard 3-tick scroll ~320px
        return Math.Max(20, Math.Min(h - 100, 320));
    }

    private static int StitchFrames(List<Bitmap> frames, string outPath) {
        if (frames.Count == 0) return 1;
        int w = frames[0].Width;

        if (frames.Count == 1) {
            frames[0].Save(outPath, ImageFormat.Png);
            Console.WriteLine("SUCCESS:" + outPath + ":" + w + "x" + frames[0].Height);
            return 0;
        }

        List<int> seamYList = new List<int>();
        List<int> deltaYList = new List<int>();

        for (int i = 0; i < frames.Count - 1; i++) {
            int seamY;
            int deltaY = FindVerticalDisplacement(frames[i], frames[i + 1], out seamY);
            seamYList.Add(seamY);
            deltaYList.Add(deltaY);
        }

        // Calculate total canvas height
        int totalHeight = seamYList[0];
        for (int i = 1; i < frames.Count; i++) {
            int prevSeam = seamYList[i - 1];
            int prevDelta = deltaYList[i - 1];
            int sliceTop = prevSeam - prevDelta;
            int sliceBottom = (i < frames.Count - 1) ? seamYList[i] : frames[i].Height;
            int sliceH = Math.Max(0, sliceBottom - sliceTop);
            totalHeight += sliceH;
        }

        Bitmap stitched = new Bitmap(w, Math.Max(100, totalHeight), PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(stitched)) {
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;

            // Draw frame 0 from top 0 to seamYList[0]
            Rectangle srcRect0 = new Rectangle(0, 0, w, seamYList[0]);
            Rectangle destRect0 = new Rectangle(0, 0, w, seamYList[0]);
            g.DrawImage(frames[0], destRect0, srcRect0, GraphicsUnit.Pixel);

            int currentDestY = seamYList[0];

            for (int i = 1; i < frames.Count; i++) {
                int prevSeam = seamYList[i - 1];
                int prevDelta = deltaYList[i - 1];
                int sliceTop = Math.Max(0, prevSeam - prevDelta);
                int sliceBottom = (i < frames.Count - 1) ? seamYList[i] : frames[i].Height;
                int sliceH = Math.Max(0, sliceBottom - sliceTop);

                if (sliceH > 0) {
                    Rectangle srcRect = new Rectangle(0, sliceTop, w, sliceH);
                    Rectangle destRect = new Rectangle(0, currentDestY, w, sliceH);
                    g.DrawImage(frames[i], destRect, srcRect, GraphicsUnit.Pixel);
                    currentDestY += sliceH;
                }
            }
        }

        stitched.Save(outPath, ImageFormat.Png);
        Console.WriteLine("SUCCESS:" + outPath + ":" + w + "x" + totalHeight);
        stitched.Dispose();
        return 0;
    }

    public static int Main(string[] args) {
        try { SetProcessDPIAware(); } catch {}

        if (args.Length < 2) {
            Console.WriteLine("Usage: screencap.exe <screen|window|region|scroll|stitch> <outPath> [options...]");
            return 1;
        }

        string mode = args[0].ToLowerInvariant();
        string outPath = args[1];

        try {
            if (mode == "stitch") {
                List<Bitmap> frames = new List<Bitmap>();
                for (int i = 2; i < args.Length; i++) {
                    if (File.Exists(args[i])) {
                        try {
                            frames.Add(new Bitmap(args[i]));
                        } catch {}
                    }
                }
                int res = StitchFrames(frames, outPath);
                foreach (Bitmap b in frames) b.Dispose();
                return res;
            }

            if (mode == "scroll" || mode == "long") {
                int maxScrolls = 25;
                if (args.Length >= 3) {
                    int.TryParse(args[2], out maxScrolls);
                }
                if (maxScrolls <= 0) maxScrolls = 25;

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

                // Place cursor in center of window for wheel scrolling
                try {
                    SetForegroundWindow(fg);
                    Cursor.Position = new Point(x + w / 2, y + h / 2);
                } catch {}

                Thread.Sleep(120);

                List<Bitmap> frames = new List<Bitmap>();
                Bitmap initial = CaptureRect(x, y, w, h);
                frames.Add(initial);

                int consecutiveIdentical = 0;

                for (int s = 0; s < maxScrolls; s++) {
                    // Send 3 wheel ticks down
                    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, -360, 0);
                    Thread.Sleep(200);

                    Bitmap nextFrame = CaptureRect(x, y, w, h);
                    if (AreBitmapsIdentical(frames[frames.Count - 1], nextFrame)) {
                        consecutiveIdentical++;
                        nextFrame.Dispose();
                        if (consecutiveIdentical >= 2) {
                            break;
                        }
                        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, -480, 0);
                        Thread.Sleep(220);
                        continue;
                    }

                    consecutiveIdentical = 0;
                    frames.Add(nextFrame);
                }

                int stitchResult = StitchFrames(frames, outPath);
                foreach (Bitmap b in frames) b.Dispose();
                return stitchResult;
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
