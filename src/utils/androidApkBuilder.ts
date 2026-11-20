import { Buffer } from 'buffer';

export interface AndroidApkOptions {
  targetUrl?: string;
  iconPng?: Buffer;
  appName?: string;
  packageName?: string;
}

export function buildCosmoChatAndroidApk(options: AndroidApkOptions = {}): Buffer {
  const targetUrl = options.targetUrl || 'https://cosmochat.ai.studio';
  const appName = options.appName || 'CosmoChat';
  const packageName = options.packageName || 'com.cosmochat.app';

  const files: Array<{ name: string; data: Buffer }> = [];

  // 1. AndroidManifest.xml
  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${packageName}"
    android:versionCode="1"
    android:versionName="2.1">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${appName}"
        android:roundIcon="@mipmap/ic_launcher"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:label="${appName}">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <meta-data android:name="app_target_url" android:value="${targetUrl}" />
        </activity>
    </application>
</manifest>`;
  files.push({ name: 'AndroidManifest.xml', data: Buffer.from(manifestXml, 'utf8') });

  // 2. classes.dex placeholder
  const dexHeader = Buffer.from([
    0x64, 0x65, 0x78, 0x03, 0x03, 0x35, 0x00, 0x00,
    0x78, 0x56, 0x34, 0x12, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x70, 0x00, 0x00, 0x00,
    0x70, 0x00, 0x00, 0x00, 0x12, 0x34, 0x56, 0x78,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
  ]);
  const dexData = Buffer.concat([dexHeader, Buffer.alloc(200, 0xee)]);
  files.push({ name: 'classes.dex', data: dexData });

  // 3. resources.arsc placeholder
  const arscHeader = Buffer.from([
    0x02, 0x00, 0x0c, 0x00, 0x34, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  files.push({ name: 'resources.arsc', data: arscHeader });

  // 4. Launcher icon
  const defaultIcon = options.iconPng || Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00,
    0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
  files.push({ name: 'res/mipmap-hdpi/ic_launcher.png', data: defaultIcon });

  // 5. META-INF/MANIFEST.MF
  const manifestMf = `Manifest-Version: 1.0
Created-By: CosmoChat Android APK Builder v2.1
X-Target-URL: ${targetUrl}
X-Package-Name: ${packageName}
`;
  files.push({ name: 'META-INF/MANIFEST.MF', data: Buffer.from(manifestMf, 'utf8') });

  // Build ZIP file buffer (Stored / uncompressed for maximum compatibility)
  const localFileHeaders: Buffer[] = [];
  const centralDirectoryHeaders: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.data);

    // Local file header (30 bytes + filename)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // Signature
    lfh.writeUInt16LE(20, 4); // Version needed
    lfh.writeUInt16LE(0x0800, 6); // Flags (UTF-8)
    lfh.writeUInt16LE(0, 8); // Compression method (0 = stored)
    lfh.writeUInt16LE(0, 10); // Mod time
    lfh.writeUInt16LE(0, 12); // Mod date
    lfh.writeUInt32LE(crc, 14); // CRC-32
    lfh.writeUInt32LE(file.data.length, 18); // Compressed size
    lfh.writeUInt32LE(file.data.length, 22); // Uncompressed size
    lfh.writeUInt16LE(nameBuffer.length, 26); // Filename length
    lfh.writeUInt16LE(0, 28); // Extra length

    localFileHeaders.push(Buffer.concat([lfh, nameBuffer, file.data]));

    // Central directory header (46 bytes + filename)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // Signature
    cdh.writeUInt16LE(20, 4); // Made by
    cdh.writeUInt16LE(20, 6); // Version needed
    cdh.writeUInt16LE(0x0800, 8); // Flags
    cdh.writeUInt16LE(0, 10); // Compression method (0 = stored)
    cdh.writeUInt16LE(0, 12); // Mod time
    cdh.writeUInt16LE(0, 14); // Mod date
    cdh.writeUInt32LE(crc, 16); // CRC-32
    cdh.writeUInt32LE(file.data.length, 20); // Compressed size
    cdh.writeUInt32LE(file.data.length, 24); // Uncompressed size
    cdh.writeUInt16LE(nameBuffer.length, 28); // Filename length
    cdh.writeUInt16LE(0, 30); // Extra length
    cdh.writeUInt16LE(0, 32); // Comment length
    cdh.writeUInt16LE(0, 34); // Disk start
    cdh.writeUInt16LE(0, 36); // Internal attrs
    cdh.writeUInt32LE(0, 38); // External attrs
    cdh.writeUInt32LE(offset, 42); // Relative offset

    centralDirectoryHeaders.push(Buffer.concat([cdh, nameBuffer]));

    offset += 30 + nameBuffer.length + file.data.length;
  }

  const centralDirBuffer = Buffer.concat(centralDirectoryHeaders);
  const localFileBuffer = Buffer.concat(localFileHeaders);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4); // Disk
  eocd.writeUInt16LE(0, 6); // Central dir disk
  eocd.writeUInt16LE(files.length, 8); // Records on disk
  eocd.writeUInt16LE(files.length, 10); // Total records
  eocd.writeUInt32LE(centralDirBuffer.length, 12); // Central dir size
  eocd.writeUInt32LE(localFileBuffer.length, 16); // Central dir offset
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([localFileBuffer, centralDirBuffer, eocd]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = (() => {
  let c: number;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();
