import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCosmoChatAndroidApk } from './androidApkBuilder';

test('buildCosmoChatAndroidApk produces valid APK zip structure with manifest and dex', () => {
  const apk = buildCosmoChatAndroidApk({ targetUrl: 'https://cosmochat.ai.studio' });
  assert.ok(Buffer.isBuffer(apk));
  assert.ok(apk.length > 100);
  // Check ZIP local file header signature
  assert.equal(apk.readUInt32LE(0), 0x04034b50);
  // Check manifest presence in buffer
  assert.ok(apk.includes(Buffer.from('AndroidManifest.xml')));
  assert.ok(apk.includes(Buffer.from('classes.dex')));
  assert.ok(apk.includes(Buffer.from('com.cosmochat.app')));
});
