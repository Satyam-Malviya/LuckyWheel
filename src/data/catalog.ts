export type WheelMode = 'conversions' | 'tools' | 'actions' | 'combo';

export interface WheelPetalItem {
  id: string;
  label: string;       // Short uppercase label for petal (e.g. "PNG", "EXACT KB", "MERGE")
  fullName: string;    // Full title (e.g. "Convert to PNG", "Exact KB Compressor")
  description: string;
  icon: string;        // Icon identifier
  badge?: string;      // Optional badge (e.g. "AI", "MULTI", "PRO")
  needsConfig?: 'exactKb' | 'speed' | 'trim' | 'rename' | 'passportBg';
  presets?: { label: string; value: string | number }[];
}

export interface FeatureCardItem {
  id: string;
  toolId: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  badge?: string;
  multiFile?: boolean;
  motionType:
    | 'radial-bloom'
    | 'exact-kb'
    | 'bg-remove'
    | 'passport-photo'
    | 'doc-scanner'
    | 'video-trim'
    | 'video-speed'
    | 'video-join'
    | 'audio-waveform'
    | 'vocal-split'
    | 'pdf-merge'
    | 'pdf-organize'
    | 'combo-video-audio'
    | 'folder-organize'
    | 'wifi-qr'
    | 'bulk-rename'
    | 'collage-grid'
    | 'metadata-scrub'
    | 'link-download'
    | 'screen-capture';
}

export interface PluginItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: 'AI Vision' | 'Audio & Media' | 'Documents & Office' | 'Daily Utilities';
  size: string;
  installed: boolean;
  enabled: boolean;
  badge: string;
  accentColor: string;
  petalId: string;
  petalLabel: string;
  motionType: FeatureCardItem['motionType'];
  features: string[];
}

export interface WheelTheme {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  accentHex: string;
  petalFill: string;
  petalHoverFill: string;
  petalStroke: string;
  glowColor: string;
  centerBg: string;
}

export const WHEEL_THEMES: WheelTheme[] = [
  {
    id: 'tangerine-glass',
    name: 'Tangerine Frost',
    tagline: 'Original Reel Frosted Glass + Warm Tangerine Glow',
    accent: 'from-orange-500 to-amber-500',
    accentHex: '#fb724b',
    petalFill: 'rgba(255, 255, 255, 0.13)',
    petalHoverFill: 'rgba(251, 114, 75, 0.92)',
    petalStroke: 'rgba(255, 255, 255, 0.25)',
    glowColor: 'rgba(251, 114, 75, 0.55)',
    centerBg: 'rgba(18, 18, 24, 0.88)',
  },
  {
    id: 'cyber-neon',
    name: 'Cyberpunk Neon',
    tagline: 'Electric Cyan & Violet High-Contrast HUD',
    accent: 'from-cyan-400 to-fuchsia-500',
    accentHex: '#22d3ee',
    petalFill: 'rgba(15, 23, 42, 0.78)',
    petalHoverFill: 'rgba(34, 211, 238, 0.90)',
    petalStroke: 'rgba(34, 211, 238, 0.4)',
    glowColor: 'rgba(34, 211, 238, 0.6)',
    centerBg: 'rgba(9, 13, 26, 0.92)',
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Studio',
    tagline: 'Precision Mint & Deep Forest Glass',
    accent: 'from-emerald-400 to-teal-500',
    accentHex: '#10b981',
    petalFill: 'rgba(16, 36, 30, 0.72)',
    petalHoverFill: 'rgba(16, 185, 129, 0.92)',
    petalStroke: 'rgba(52, 211, 153, 0.35)',
    glowColor: 'rgba(16, 185, 129, 0.55)',
    centerBg: 'rgba(10, 22, 18, 0.92)',
  },
  {
    id: 'royal-amethyst',
    name: 'Royal Amethyst',
    tagline: 'Deep Violet Velvet & Rose Gold Highlights',
    accent: 'from-violet-500 to-pink-500',
    accentHex: '#8b5cf6',
    petalFill: 'rgba(30, 20, 48, 0.74)',
    petalHoverFill: 'rgba(139, 92, 246, 0.92)',
    petalStroke: 'rgba(196, 181, 253, 0.32)',
    glowColor: 'rgba(139, 92, 246, 0.6)',
    centerBg: 'rgba(17, 12, 28, 0.92)',
  },
];

// Supported Format Conversion Map
export const FORMAT_CONVERSIONS: Record<string, string[]> = {
  jpg: ['png', 'webp', 'avif', 'pdf', 'tiff', 'bmp', 'ico'],
  jpeg: ['png', 'webp', 'avif', 'pdf', 'tiff', 'bmp', 'ico'],
  png: ['jpg', 'webp', 'avif', 'pdf', 'ico', 'tiff', 'bmp'],
  webp: ['png', 'jpg', 'avif', 'pdf', 'gif', 'tiff'],
  heic: ['jpg', 'png', 'webp', 'pdf', 'avif'],
  avif: ['png', 'jpg', 'webp', 'pdf'],
  svg: ['png', 'jpg', 'webp', 'pdf', 'ico'],
  gif: ['mp4', 'webm', 'webp', 'png'],
  mp4: ['gif', 'mp3', 'mov', 'mkv', 'webm', 'wav', 'avi'],
  mov: ['mp4', 'gif', 'mp3', 'mkv', 'webm', 'wav'],
  mkv: ['mp4', 'mov', 'mp3', 'webm', 'gif', 'wav'],
  webm: ['mp4', 'gif', 'mp3', 'mkv', 'mov'],
  avi: ['mp4', 'mkv', 'mov', 'gif', 'mp3'],
  mp3: ['wav', 'flac', 'm4a', 'ogg', 'opus', 'mp4'],
  wav: ['mp3', 'flac', 'm4a', 'ogg', 'opus'],
  flac: ['mp3', 'wav', 'm4a', 'ogg', 'opus'],
  m4a: ['mp3', 'wav', 'flac', 'ogg'],
  ogg: ['mp3', 'wav', 'flac', 'm4a'],
  pdf: ['docx', 'jpg', 'png', 'txt', 'md', 'pptx', 'xlsx', 'epub'],
  docx: ['pdf', 'txt', 'md', 'html', 'epub', 'png'],
  pptx: ['pdf', 'jpg', 'png'],
  xlsx: ['csv', 'json', 'pdf', 'ods', 'tsv'],
  csv: ['json', 'xlsx', 'tsv', 'pdf'],
  json: ['csv', 'xlsx', 'txt', 'md'],
  epub: ['pdf', 'docx', 'txt', 'md', 'html'],
  srt: ['vtt', 'txt'],
  vtt: ['srt', 'txt'],
  zip: ['tar', 'gz', '7z'],
  rar: ['zip', 'tar', 'gz'],
  folder: ['zip'],
};

// Detailed Tools Catalog (Alt / Command Wheel)
export const TOOLS_CATALOG: Record<string, WheelPetalItem> = {
  compress: {
    id: 'compress',
    label: 'COMPRESS',
    fullName: 'Smart Compress',
    description: 'Shrink file size up to 80% while preserving visual clarity.',
    icon: 'Minimize2',
  },
  exactKb: {
    id: 'exactKb',
    label: 'EXACT KB',
    fullName: 'Target Exact KB Size',
    description: 'Hit exact KB limits (e.g., 20KB, 45KB, 100KB) for SSC/UPSC/Passport forms.',
    icon: 'Gauge',
    badge: 'PRO',
    needsConfig: 'exactKb',
    presets: [
      { label: '20 KB (Sign)', value: 20 },
      { label: '45 KB (Form)', value: 45 },
      { label: '100 KB (ID)', value: 100 },
      { label: '250 KB (HD)', value: 250 },
    ],
  },
  passportPhoto: {
    id: 'passportPhoto',
    label: 'PASSPORT',
    fullName: 'Passport Photo 3.5×4.5cm',
    description: 'Auto-crop to 300 DPI standard passport size with clean White or Blue background.',
    icon: 'UserCheck',
    badge: 'INDIA',
    needsConfig: 'passportBg',
    presets: [
      { label: 'White BG', value: '#ffffff' },
      { label: 'Studio Blue', value: '#dbeafe' },
      { label: 'Light Grey', value: '#f3f4f6' },
    ],
  },
  removeBg: {
    id: 'frameImage',
    label: 'BG STUDIO',
    fullName: 'AI Background & Frame Studio',
    description: 'Remove background or place photo on a studio backdrop with rounded corners.',
    icon: 'Sparkles',
    badge: 'AI',
  },
  docScanner: {
    id: 'docScanner',
    label: 'DOC SCAN',
    fullName: 'CamScanner Document Filter',
    description: 'Turn phone photos of pages/notes into crisp high-contrast B&W printable scans.',
    icon: 'ScanLine',
  },
  removeMetadata: {
    id: 'removeMetadata',
    label: 'PRIVACY',
    fullName: 'Scrub EXIF & GPS Metadata',
    description: 'Erase hidden GPS location, camera serial, and author tags before sharing online.',
    icon: 'ShieldCheck',
  },
  cropImage: {
    id: 'cropImage',
    label: 'CROP 1:1',
    fullName: 'Smart Square & Aspect Crop',
    description: 'Center-crop image to clean 1:1 square or custom social media ratio.',
    icon: 'Crop',
  },
  editImage: {
    id: 'editImage',
    label: 'ENHANCE',
    fullName: '1-Click Auto Enhance & HDR',
    description: 'Boost clarity, micro-contrast, and color vibrancy automatically.',
    icon: 'Sliders',
  },
  redactImage: {
    id: 'redactImage',
    label: 'REDACT',
    fullName: 'Privacy Blur & Redact',
    description: 'Blur sensitive text, faces, or ID numbers locally.',
    icon: 'EyeOff',
  },
  createPDF: {
    id: 'createPDF',
    label: 'TO PDF',
    fullName: 'Combine Images into PDF',
    description: 'Build a multi-page PDF document from one or more selected images.',
    icon: 'FileText',
    badge: 'MULTI',
  },
  createCollage: {
    id: 'createCollage',
    label: 'COLLAGE',
    fullName: 'Make Photo Grid Collage',
    description: 'Arrange selected photos into a high-resolution studio grid poster.',
    icon: 'LayoutGrid',
    badge: 'MULTI',
  },
  bulkRename: {
    id: 'bulkRename',
    label: 'RENAME',
    fullName: 'Smart Bulk Rename',
    description: 'Rename multiple files sequentially with custom prefix and numbering.',
    icon: 'Edit3',
    badge: 'MULTI',
    needsConfig: 'rename',
    presets: [
      { label: 'Photo_01, 02...', value: 'Photo_{n}' },
      { label: 'Doc_2026_01...', value: 'Doc_{date}_{n}' },
      { label: 'Slide_01, 02...', value: 'Slide_{n}' },
    ],
  },
  // Video Tools
  trimVideo: {
    id: 'trimVideo',
    label: 'TRIM',
    fullName: 'Lossless Timeline Trim',
    description: 'Cut start and end points without re-encoding quality loss.',
    icon: 'Scissors',
    needsConfig: 'trim',
    presets: [
      { label: 'First 5s', value: 5 },
      { label: 'First 15s (Reel)', value: 15 },
      { label: 'First 30s (Short)', value: 30 },
    ],
  },
  changeVideoSpeed: {
    id: 'changeVideoSpeed',
    label: 'SPEED',
    fullName: 'Change Playback Speed',
    description: 'Speed up to 1.5x/2x or slow-mo 0.5x while preserving audio pitch.',
    icon: 'Zap',
    needsConfig: 'speed',
    presets: [
      { label: '0.5× Slow-Mo', value: 0.5 },
      { label: '1.5× Fast', value: 1.5 },
      { label: '2.0× Turbo', value: 2.0 },
    ],
  },
  muteVideo: {
    id: 'muteVideo',
    label: 'MUTE',
    fullName: 'Strip Audio Track',
    description: 'Remove audio stream from video instantly without re-encoding video.',
    icon: 'VolumeX',
  },
  videoSnapshots: {
    id: 'videoSnapshots',
    label: 'SNAPSHOT',
    fullName: 'Extract Full-HD Frame PNG',
    description: 'Export crisp uncompressed PNG frame from video.',
    icon: 'Camera',
  },
  joinVideos: {
    id: 'joinVideos',
    label: 'JOIN CLIPS',
    fullName: 'Seamless Video Stitcher',
    description: 'Concatenate multiple video clips into a single continuous MP4.',
    icon: 'Film',
    badge: 'MULTI',
  },
  // Audio Tools
  normalizeAudio: {
    id: 'normalizeAudio',
    label: 'NORMALIZE',
    fullName: 'Broadcast Loudness Normalize',
    description: 'Balance quiet and loud audio to standard -16 LUFS studio level.',
    icon: 'Activity',
  },
  vocalSplitter: {
    id: 'vocalSplitter',
    label: 'VOCAL SPLIT',
    fullName: 'Karaoke / Instrumental Stem',
    description: 'Isolate instrumental music or vocals from any song offline.',
    icon: 'MicOff',
    badge: 'AI',
  },
  audioToVideo: {
    id: 'audioToVideo',
    label: 'VISUALIZER',
    fullName: 'Render Waveform MP4 Video',
    description: 'Generate an animated neon waveform video from your audio track.',
    icon: 'Radio',
  },
  trimAudio: {
    id: 'trimAudio',
    label: 'TRIM',
    fullName: 'Trim Audio & Silence',
    description: 'Cut audio clip length cleanly.',
    icon: 'Scissors',
  },
  audioChannels: {
    id: 'audioChannels',
    label: 'MONO/STEREO',
    fullName: 'Convert Audio Channels',
    description: 'Mix down stereo recording to clean mono or duplicate channels.',
    icon: 'Speaker',
  },
  // PDF Tools
  mergePDF: {
    id: 'mergePDF',
    label: 'MERGE PDF',
    fullName: 'Merge Multiple PDFs',
    description: 'Combine selected PDF files into a single document in order.',
    icon: 'Files',
    badge: 'MULTI',
  },
  splitPDF: {
    id: 'splitPDF',
    label: 'SPLIT PAGES',
    fullName: 'Split Every PDF Page',
    description: 'Extract all pages into individual PDF files inside a new folder.',
    icon: 'FileSpreadsheet',
  },
  organizePDF: {
    id: 'organizePDF',
    label: 'ROTATE 90°',
    fullName: 'Rotate & Organize Pages',
    description: 'Fix upside-down or sideways scanned PDF pages in 1 click.',
    icon: 'RotateCw',
  },
  unlockPDF: {
    id: 'unlockPDF',
    label: 'UNLOCK PDF',
    fullName: 'Remove PDF Restrictions',
    description: 'Save a clean, unlocked copy of your PDF without owner restrictions.',
    icon: 'Unlock',
  },
  // Archive & Folder Tools
  extractArchive: {
    id: 'extractArchive',
    label: 'EXTRACT',
    fullName: 'Unpack Archive to Folder',
    description: 'Extract ZIP/TAR/GZ contents neatly into a folder right beside the archive.',
    icon: 'PackageOpen',
  },
  packZip: {
    id: 'packZip',
    label: 'PACK ZIP',
    fullName: 'Compress Selection into ZIP',
    description: 'Bundle all selected files into a single compressed ZIP archive.',
    icon: 'Archive',
    badge: 'MULTI',
  },
  organizeFolder: {
    id: 'organizeFolder',
    label: 'AUTO SORT',
    fullName: 'Organize Folder by Type',
    description: 'Sort messy Downloads/Desktop folder into Images, Videos, PDFs, and Audio subfolders.',
    icon: 'FolderKanban',
    badge: 'FOLDER',
  },
  findDuplicates: {
    id: 'findDuplicates',
    label: 'DUPLICATES',
    fullName: 'SHA-256 Duplicate Scanner',
    description: 'Scan folder for identical duplicate files wasting disk space.',
    icon: 'CopyCheck',
    badge: 'FOLDER',
  },
    screenCapture: {
    id: 'screenCapture',
    label: 'SNIP / SS',
    fullName: 'Screen Capture & Snip Studio',
    description: 'Instant area snip, active window, or full-screen capture. Save PNG/JPG/WEBP/PDF to multiple folders at once.',
    icon: 'Camera',
    badge: 'ALT+S',
  },
  // Download from Link Tool
  downloadLink: {
    id: 'downloadLink',
    label: 'LINK DL',
    fullName: 'Download Media or Page from Link',
    description: 'Paste YouTube, Spotify, video, or article link to download MP4, MP3, WAV, or PDF in 1 click.',
    icon: 'Link',
    badge: 'ONLINE',
  },
  // Multi-File Mixed Combos
  comboVideoAudio: {
    id: 'comboVideoAudio',
    label: 'ADD AUDIO',
    fullName: 'Merge Video + Audio Track',
    description: 'Replace or mux the selected audio file directly into the selected video!',
    icon: 'Clapperboard',
    badge: 'COMBO',
  },
  comboAudioImage: {
    id: 'comboAudioImage',
    label: 'PODCAST MP4',
    fullName: 'Cover Photo + Audio → MP4',
    description: 'Combine cover image and audio file into a YouTube/Instagram-ready MP4 video!',
    icon: 'Video',
    badge: 'COMBO',
  },
};

// Quick File Actions (Control Wheel)
export const FILE_ACTIONS_LIST: WheelPetalItem[] = [
  {
    id: 'downloadLink',
    label: 'LINK DL',
    fullName: 'Download Media or Page from Link',
    description: 'Paste YouTube, Spotify, video, or article link to download MP4, MP3, WAV, or PDF in 1 click.',
    icon: 'Link',
    badge: 'NEW',
  },
  {
    id: 'wifiQrShare',
    label: 'PHONE QR',
    fullName: 'Share to Phone (Wi-Fi QR)',
    description: 'Scan QR code with your phone to download this file instantly over local Wi-Fi.',
    icon: 'QrCode',
    badge: 'LAN',
  },
  {
    id: 'floatShelf',
    label: 'FLOAT PIN',
    fullName: 'Pin to Floating Drop Shelf',
    description: 'Hold files in a magnetic floating shelf while you switch folders or apps.',
    icon: 'Pin',
  },
  {
    id: 'copyPath',
    label: 'COPY PATH',
    fullName: 'Copy Full File Path',
    description: 'Copy absolute file path(s) to clipboard, one per line.',
    icon: 'ClipboardCopy',
  },
  {
    id: 'openTerminal',
    label: 'TERMINAL',
    fullName: 'Open Folder in Terminal',
    description: 'Launch Command Prompt / PowerShell directly in this file’s directory.',
    icon: 'Terminal',
  },
  {
    id: 'revealExplorer',
    label: 'EXPLORER',
    fullName: 'Reveal in File Explorer',
    description: 'Highlight the file directly inside Windows File Explorer.',
    icon: 'FolderOpen',
  },
  {
    id: 'packZip',
    label: 'QUICK ZIP',
    fullName: 'Instant ZIP Backup',
    description: 'Create a compressed ZIP backup right next to the original file.',
    icon: 'Archive',
  },
];

/**
 * Determine which petals to display on the Radial Wheel based on:
 * - selected file formats
 * - count of selected files (Single vs Multi-File vs Mixed Combo vs Folder)
 * - active wheel mode ('conversions' | 'tools' | 'actions' | 'combo')
 * - custom user plugins enabled on Home Screen
 */
export function getWheelPetals(
  formats: string[],
  mode: WheelMode,
  customPetals: WheelPetalItem[] = []
): WheelPetalItem[] {
  if (!formats.length) return FILE_ACTIONS_LIST;

  const uniqueFormats = Array.from(new Set(formats.map((f) => f.toLowerCase())));
  const count = formats.length;
  const primary = uniqueFormats[0];

  const isImg = (f: string) => ['jpg', 'jpeg', 'png', 'webp', 'heic', 'avif', 'svg', 'bmp', 'tiff'].includes(f);
  const isVid = (f: string) => ['mp4', 'mov', 'mkv', 'webm', 'avi'].includes(f);
  const isAud = (f: string) => ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus'].includes(f);

  // Check for Mixed-Type Multi-File Combos!
  const hasVideo = uniqueFormats.some(isVid);
  const hasAudio = uniqueFormats.some(isAud);
  const hasImage = uniqueFormats.some(isImg);

  if (mode === 'actions') {
    return [...FILE_ACTIONS_LIST, ...customPetals];
  }

  // Folder selected
  if (primary === 'folder') {
    if (mode === 'conversions') {
      return [
        {
          id: 'zip',
          label: 'ZIP',
          fullName: 'Convert Folder to ZIP',
          description: 'Pack entire folder into a standard ZIP archive.',
          icon: 'Archive',
        },
        TOOLS_CATALOG.organizeFolder,
        TOOLS_CATALOG.findDuplicates,
      ];
    }
    return [TOOLS_CATALOG.organizeFolder, TOOLS_CATALOG.findDuplicates, ...FILE_ACTIONS_LIST.slice(0, 3)];
  }

  // Mixed File Selection (e.g., Video + Audio or Audio + Image)
  if (uniqueFormats.length > 1) {
    const comboItems: WheelPetalItem[] = [];
    if (hasVideo && hasAudio) comboItems.push(TOOLS_CATALOG.comboVideoAudio);
    if (hasAudio && hasImage) comboItems.push(TOOLS_CATALOG.comboAudioImage);
    if (uniqueFormats.every(isImg)) {
      comboItems.push(TOOLS_CATALOG.createPDF, TOOLS_CATALOG.createCollage, TOOLS_CATALOG.exactKb);
    }
    comboItems.push(TOOLS_CATALOG.bulkRename, TOOLS_CATALOG.packZip, TOOLS_CATALOG.removeMetadata);
    return comboItems;
  }

  // Mode: CONVERSIONS (Shift)
  if (mode === 'conversions') {
    const targets = FORMAT_CONVERSIONS[primary] || ['zip'];
    return targets.map((ext) => ({
      id: ext,
      label: ext.toUpperCase(),
      fullName: `Convert to ${ext.toUpperCase()}`,
      description:
        count > 1
          ? `Batch convert ${count} ${primary.toUpperCase()} files to ${ext.toUpperCase()}`
          : `Save converted ${ext.toUpperCase()} copy right beside original`,
      icon: 'RefreshCw',
    }));
  }

  // Mode: TOOLS (Alt / Command)
  const toolIds: string[] = [];
  if (isImg(primary)) {
    if (count > 1) {
      toolIds.push('createPDF', 'createCollage', 'exactKb', 'bulkRename', 'compress', 'removeMetadata', 'packZip');
    } else {
      toolIds.push(
        'exactKb',
        'passportPhoto',
        'removeBg',
        'docScanner',
        'compress',
        'cropImage',
        'editImage',
        'removeMetadata',
        'redactImage',
        'createPDF'
      );
    }
  } else if (isVid(primary)) {
    if (count > 1) {
      toolIds.push('joinVideos', 'compress', 'muteVideo', 'bulkRename', 'packZip');
    } else {
      toolIds.push('compress', 'trimVideo', 'changeVideoSpeed', 'downloadLink', 'muteVideo', 'videoSnapshots', 'removeMetadata');
    }
  } else if (isAud(primary)) {
    toolIds.push('normalizeAudio', 'vocalSplitter', 'downloadLink', 'audioToVideo', 'trimAudio', 'audioChannels', 'compress');
  } else if (primary === 'pdf') {
    if (count > 1) {
      toolIds.push('mergePDF', 'compress', 'unlockPDF', 'bulkRename', 'packZip');
    } else {
      toolIds.push('compress', 'splitPDF', 'organizePDF', 'unlockPDF', 'removeMetadata', 'mergePDF');
    }
  } else if (['zip', 'rar', 'tar', 'gz'].includes(primary)) {
    toolIds.push('extractArchive', 'packZip');
  } else {
    toolIds.push('packZip', 'bulkRename');
  }

  const baseTools = toolIds.map((id) => TOOLS_CATALOG[id]).filter(Boolean);
  return [...baseTools, ...customPetals];
}

// Home Screen Power-Up Plugins Store (Displayed directly on Home Screen!)
export const INITIAL_PLUGINS: PluginItem[] = [
  {
    id: 'plugin-exact-kb',
    name: 'Exam & Passport Exact-KB Engine',
    tagline: 'Lock photo size to exact KB (20KB, 45KB, 50KB) + 3.5×4.5cm crop',
    description:
      'Never visit online resizers for SSC, UPSC, Banking, PAN, or Passport forms again. Binary-search mozjpeg engine hits your exact KB target offline.',
    category: 'Daily Utilities',
    size: 'Built-in (2.1 MB)',
    installed: true,
    enabled: true,
    badge: 'MOST POPULAR',
    accentColor: '#fb724b',
    petalId: 'exactKb',
    petalLabel: 'EXACT KB',
    motionType: 'exact-kb',
    features: ['Exact KB Slider (10KB–500KB)', '3.5×4.5cm 300DPI Auto-Crop', 'White/Blue Studio Background'],
  },
  {
    id: 'plugin-bg-studio',
    name: 'AI Background & Studio Frame',
    tagline: '1-Click transparent cutouts, studio backdrops & rounded frames',
    description:
      'Drop any product photo or portrait onto the BG Studio petal to isolate subjects or wrap screenshots in macOS-style gradients and shadows.',
    category: 'AI Vision',
    size: '14.8 MB (Local ONNX)',
    installed: true,
    enabled: true,
    badge: 'LOCAL AI',
    accentColor: '#a855f7',
    petalId: 'frameImage',
    petalLabel: 'BG STUDIO',
    motionType: 'bg-remove',
    features: ['100% Offline Subject Cutout', 'Gradient & Blur Backdrops', 'Auto Shadow & Corner Radius'],
  },
  {
    id: 'plugin-vocal-splitter',
    name: 'Karaoke Vocal & Stem Splitter',
    tagline: 'Separate vocals and instrumental music from any MP3/WAV',
    description:
      'Drag any song and drop on Vocal Split to extract clean instrumental backing tracks or acapella vocals using phase & spectral isolation.',
    category: 'Audio & Media',
    size: '18.4 MB (FFmpeg DSP)',
    installed: true,
    enabled: true,
    badge: 'CREATOR PRO',
    accentColor: '#ec4899',
    petalId: 'vocalSplitter',
    petalLabel: 'VOCAL SPLIT',
    motionType: 'vocal-split',
    features: ['Instant Instrumental MP3', 'Zero Cloud Upload Delay', 'Batch Song Processing'],
  },
  {
    id: 'plugin-wifi-qr',
    name: 'AirDrop for PC (Wi-Fi QR Share)',
    tagline: 'Instant PC-to-Phone file transfer via local LAN QR code',
    description:
      'Drop any file or video onto Phone QR. A local encrypted LAN link & QR code pops up—scan with iPhone or Android camera to download at full Wi-Fi speed.',
    category: 'Daily Utilities',
    size: 'Built-in (0.8 MB)',
    installed: true,
    enabled: true,
    badge: 'AIRDROP PC',
    accentColor: '#06b6d4',
    petalId: 'wifiQrShare',
    petalLabel: 'PHONE QR',
    motionType: 'wifi-qr',
    features: ['Works on iOS & Android', 'No App Needed on Phone', 'Full Local Wi-Fi Speed'],
  },
  {
    id: 'plugin-doc-scanner',
    name: 'CamScanner Document & OCR Pro',
    tagline: 'Perspective correction, B&W ink boost & PDF text extraction',
    description:
      'Turn shadowy phone photos of handwritten notes, bills, or receipts into crisp printable PDFs and extract selectable text offline.',
    category: 'Documents & Office',
    size: '9.2 MB',
    installed: true,
    enabled: true,
    badge: 'OFFICE',
    accentColor: '#10b981',
    petalId: 'docScanner',
    petalLabel: 'DOC SCAN',
    motionType: 'doc-scanner',
    features: ['Shadow Removal Filter', 'High-Contrast B&W Ink', 'Multi-Page PDF Builder'],
  },
  {
    id: 'plugin-ytdlp-media',
    name: 'Universal Reel & Video Grabber',
    tagline: 'Clipboard URL → 4K MP4 or 320kbps MP3 directly from wheel',
    description:
      'Copy any YouTube, Instagram Reel, or X video link and open the Clipboard Wheel to save clean MP4 video or MP3 audio without ad-filled websites.',
    category: 'Audio & Media',
    size: '11.5 MB (yt-dlp)',
    installed: false,
    enabled: false,
    badge: '1-CLICK INSTALL',
    accentColor: '#f59e0b',
    petalId: 'urlDownload',
    petalLabel: 'GRAB VIDEO',
    motionType: 'video-trim',
    features: ['Instagram Reels & Shorts', '4K MP4 & 320kbps MP3', 'Auto Thumbnail Extractor'],
  },
];

// Feature Showcase Cards with Live Motion Graphics Video Previews
export const FEATURE_SHOWCASE: FeatureCardItem[] = [
  {
    id: 'feat-link-dl',
    toolId: 'downloadLink',
    title: 'Universal Download from Link',
    subtitle: 'Media & Web · YouTube, Spotify, Articles',
    description: 'Paste any YouTube video, Spotify track, or article URL. Download high-speed MP4, 320k MP3, WAV, or 300 DPI PDF in 1 click.',
    category: 'Online & Media',
    badge: 'ONLINE DL',
    motionType: 'link-download',
  },
  {
    id: 'feat-screen-snip',
    toolId: 'screenCapture',
    title: 'Screen Capture & Snip Studio (Alt+S)',
    subtitle: 'Display · Area Snip, Window, Fullscreen',
    description: 'Instant screenshot capture with Alt+S. Export to PNG, JPG, WEBP, or PDF and save to multiple destination folders simultaneously.',
    category: 'Screen & Capture',
    badge: 'ALT+S',
    motionType: 'screen-capture',
  },

  {
    id: 'feat-exact-kb',
    toolId: 'exactKb',
    title: 'Exact-KB Photo Compressor',
    subtitle: 'Images · Single or Batch',
    description: 'Need a photo strictly under 20KB or 50KB for an exam or government portal? Set your exact KB target and LuckyWheel tunes quality automatically.',
    category: 'Images',
    badge: 'WEBSITE KILLER',
    motionType: 'exact-kb',
  },
  {
    id: 'feat-passport',
    toolId: 'passportPhoto',
    title: 'Passport & ID Studio (3.5×4.5cm)',
    subtitle: 'Images · 300 DPI Print Ready',
    description: 'Automatically centers face, crops to official 35×45mm aspect ratio, and applies studio White or Blue background in one drop.',
    category: 'Images',
    badge: 'INDIA SPECIAL',
    motionType: 'passport-photo',
  },
  {
    id: 'feat-bg-remove',
    toolId: 'frameImage',
    title: 'AI Background & Frame Studio',
    subtitle: 'Images · 100% Local Processing',
    description: 'Cut out subjects or wrap screenshots in beautiful gradients with rounded corners and studio drop shadows.',
    category: 'Images',
    badge: 'AI STUDIO',
    motionType: 'bg-remove',
  },
  {
    id: 'feat-collage',
    toolId: 'createCollage',
    title: 'Multi-Photo Grid Collage & PDF',
    subtitle: 'Multiple Images · Drag 2+ Photos',
    description: 'Select multiple images and drop to combine them into a single multi-page PDF or a high-res masonry grid collage.',
    category: 'Images',
    multiFile: true,
    badge: 'MULTI-FILE',
    motionType: 'collage-grid',
  },
  {
    id: 'feat-video-trim',
    toolId: 'trimVideo',
    title: 'Lossless Video Trim & Split',
    subtitle: 'Video · Instant Keyframe Cut',
    description: 'Trim start/end handles or split long recordings into clips without waiting for slow re-encoding.',
    category: 'Video',
    motionType: 'video-trim',
  },
  {
    id: 'feat-video-speed',
    toolId: 'changeVideoSpeed',
    title: 'Playback Speed & Pitch Lock',
    subtitle: 'Video · 0.5× to 2.0×',
    description: 'Create smooth 0.5× slow-motion or 2× timelapse videos while keeping voice pitch natural.',
    category: 'Video',
    motionType: 'video-speed',
  },
  {
    id: 'feat-video-join',
    toolId: 'joinVideos',
    title: 'Seamless Multi-Clip Joiner',
    subtitle: 'Multiple Videos · MP4 / MOV / MKV',
    description: 'Select 2 or more video clips and drop onto Join Clips to stitch them into one continuous MP4 movie.',
    category: 'Video',
    multiFile: true,
    badge: 'MULTI-FILE',
    motionType: 'video-join',
  },
  {
    id: 'feat-vocal-split',
    toolId: 'vocalSplitter',
    title: 'Vocal & Instrumental Stem Splitter',
    subtitle: 'Audio · Offline DSP Isolation',
    description: 'Extract karaoke instrumentals or isolate vocals from any MP3/WAV song right on your desktop.',
    category: 'Audio',
    badge: 'AI AUDIO',
    motionType: 'vocal-split',
  },
  {
    id: 'feat-audio-viz',
    toolId: 'audioToVideo',
    title: 'Audio Waveform Video Generator',
    subtitle: 'Audio → MP4 Social Video',
    description: 'Turn any voice note, podcast clip, or beat into an animated 1080p MP4 video with a reactive neon waveform.',
    category: 'Audio',
    motionType: 'audio-waveform',
  },
  {
    id: 'feat-pdf-merge',
    toolId: 'mergePDF',
    title: 'Instant PDF Merger & Splitter',
    subtitle: 'PDF · Zero Upload Privacy',
    description: 'Combine multiple PDFs into one file or split a 100-page PDF into separate pages inside a new folder.',
    category: 'PDF',
    multiFile: true,
    badge: 'PRIVACY FIRST',
    motionType: 'pdf-merge',
  },
  {
    id: 'feat-pdf-organize',
    toolId: 'organizePDF',
    title: 'Rotate, Unlock & Clean PDFs',
    subtitle: 'PDF · Fix Scanned Pages',
    description: 'Rotate sideways pages 90°, strip owner passwords, and scrub hidden document metadata in one gesture.',
    category: 'PDF',
    motionType: 'pdf-organize',
  },
  {
    id: 'feat-combo-mux',
    toolId: 'comboVideoAudio',
    title: 'Mixed-File Combo: Video + Audio Mux',
    subtitle: 'Smart Combo · Drag 1 Video + 1 Audio',
    description: 'Select a video file AND an MP3 file together! The wheel automatically detects the combo and offers 1-click Audio Replacement or Podcast rendering.',
    category: 'Multi-File Combos',
    multiFile: true,
    badge: 'SMART COMBO',
    motionType: 'combo-video-audio',
  },
  {
    id: 'feat-bulk-rename',
    toolId: 'bulkRename',
    title: 'Smart Batch File Renamer',
    subtitle: 'Multi-File · Sequential & Date Patterns',
    description: 'Select 50 messy files and rename them cleanly to Vacation_01.jpg, Vacation_02.jpg with live pattern preview.',
    category: 'Multi-File Combos',
    multiFile: true,
    badge: 'BATCH PRO',
    motionType: 'bulk-rename',
  },
  {
    id: 'feat-folder-sort',
    toolId: 'organizeFolder',
    title: 'Folder Auto-Organizer & Duplicate Finder',
    subtitle: 'Folders · Drag Any Messy Folder',
    description: 'Drag your entire Downloads folder and press Shift! Automatically sorts files into Images, Videos, PDFs, Archives, and scans for SHA-256 duplicates.',
    category: 'Folders & Actions',
    badge: 'CLEANUP',
    motionType: 'folder-organize',
  },
  {
    id: 'feat-wifi-qr',
    toolId: 'wifiQrShare',
    title: 'Wi-Fi QR Share to Phone',
    subtitle: 'Quick Action · Local LAN Transfer',
    description: 'Hold Ctrl while dragging any file and drop on Phone QR. Scan with your phone camera to download immediately without cables or cloud login.',
    category: 'Folders & Actions',
    badge: 'LAN SHARE',
    motionType: 'wifi-qr',
  },
];
