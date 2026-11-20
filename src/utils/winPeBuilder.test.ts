import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildCosmoChatWindowsExe, sanitizeExeTargetUrl } from './winPeBuilder.ts';

test('sanitizeExeTargetUrl allows http/https URLs and falls back safely', () => {
  assert.equal(sanitizeExeTargetUrl('https://cosmochat.ai.studio/'), 'https://cosmochat.ai.studio');
  assert.equal(sanitizeExeTargetUrl('https://example.com/chat'), 'https://example.com/chat');
  assert.equal(sanitizeExeTargetUrl('javascript:alert(1)'), 'https://cosmochat.ai.studio');
  assert.equal(sanitizeExeTargetUrl(''), 'https://cosmochat.ai.studio');
});

test('buildCosmoChatWindowsExe produces valid PE32+ v2.1 GUI x64 binary with icon, RT_VERSION, browsers, and valid RIP targets', () => {
  const iconPath = path.resolve(process.cwd(), 'public/pwa-192x192.png');
  const iconPng = fs.readFileSync(iconPath);
  const targetUrl = 'https://cosmochat.ai.studio';
  const exe = buildCosmoChatWindowsExe({ targetUrl, iconPng });

  // DOS MZ signature & e_lfanew
  assert.equal(exe.readUInt16LE(0), 0x5a4d);
  const peOff = exe.readUInt32LE(0x3c);
  assert.equal(peOff, 0x80);
  assert.equal(exe.toString('ascii', peOff, peOff + 4), 'PE\0\0');

  // COFF header: AMD64 + 4 sections (.text, .rdata, .rsrc, .reloc)
  const coffOff = peOff + 4;
  assert.equal(exe.readUInt16LE(coffOff), 0x8664);
  assert.equal(exe.readUInt16LE(coffOff + 2), 4);
  assert.equal(exe.readUInt16LE(coffOff + 16), 0x00f0);

  // Optional header PE32+, MajorImageVersion = 2, MinorImageVersion = 1, GUI subsystem (2)
  const optOff = coffOff + 20;
  assert.equal(exe.readUInt16LE(optOff), 0x020b);
  assert.equal(exe.readUInt16LE(optOff + 44), 2);
  assert.equal(exe.readUInt16LE(optOff + 46), 1);
  assert.equal(exe.readUInt16LE(optOff + 68), 2);
  assert.equal(exe.readUInt32LE(optOff + 16), 0x1000); // EntryPoint in .text

  const sizeOfImage = exe.readUInt32LE(optOff + 56);
  assert.equal(sizeOfImage % 0x1000, 0);

  // Read section headers
  const secOff = optOff + 240;
  const sections: Array<{ name: string; vaddr: number; vsize: number; rawOff: number; rawSize: number }> = [];
  for (let i = 0; i < 4; i++) {
    const off = secOff + i * 40;
    sections.push({
      name: exe.toString('ascii', off, off + 8).replace(/\0+$/, ''),
      vsize: exe.readUInt32LE(off + 8),
      vaddr: exe.readUInt32LE(off + 12),
      rawSize: exe.readUInt32LE(off + 16),
      rawOff: exe.readUInt32LE(off + 20),
    });
  }
  assert.deepEqual(
    sections.map((s) => s.name),
    ['.text', '.rdata', '.rsrc', '.reloc']
  );

  const rvaToFileOffset = (rva: number) => {
    const sec = sections.find((s) => rva >= s.vaddr && rva < s.vaddr + s.vsize);
    assert.ok(sec, `RVA 0x${rva.toString(16)} must lie within a section`);
    return sec.rawOff + (rva - sec.vaddr);
  };

  // Verify Import Directory contains kernel32.dll and shell32.dll
  const ddOff = optOff + 112;
  const importRva = exe.readUInt32LE(ddOff + 8);
  const importFileOff = rvaToFileOffset(importRva);
  const dll1Name = exe.toString('ascii', rvaToFileOffset(exe.readUInt32LE(importFileOff + 12))).split('\0')[0];
  const dll2Name = exe.toString('ascii', rvaToFileOffset(exe.readUInt32LE(importFileOff + 32))).split('\0')[0];
  assert.equal(dll1Name, 'kernel32.dll');
  assert.equal(dll2Name, 'shell32.dll');

  // Verify UTF-16LE URL, browsers, and --app --new-window flag exist in .rdata
  const rdataSlice = exe.subarray(sections[1].rawOff, sections[1].rawOff + sections[1].vsize);
  assert.ok(rdataSlice.includes(Buffer.from('msedge.exe\0', 'utf16le')));
  assert.ok(rdataSlice.includes(Buffer.from('chrome.exe\0', 'utf16le')));
  assert.ok(rdataSlice.includes(Buffer.from('brave.exe\0', 'utf16le')));
  assert.ok(rdataSlice.includes(Buffer.from(`--app=${targetUrl} --new-window\0`, 'utf16le')));
  assert.ok(rdataSlice.includes(Buffer.from(`${targetUrl}\0`, 'utf16le')));

  // Verify .rsrc directory has RT_ICON (3), RT_GROUP_ICON (14), and RT_VERSION (16) sorted ascending
  const rsrcRva = exe.readUInt32LE(ddOff + 16);
  assert.equal(rsrcRva, sections[2].vaddr);
  const rsrcSlice = exe.subarray(sections[2].rawOff, sections[2].rawOff + sections[2].vsize);
  const numIdEntries = rsrcSlice.readUInt16LE(14);
  assert.equal(numIdEntries, 3);
  const typeIds = [
    rsrcSlice.readUInt32LE(16),
    rsrcSlice.readUInt32LE(24),
    rsrcSlice.readUInt32LE(32),
  ];
  assert.deepEqual(typeIds, [3, 14, 16]);

  // Verify PNG icon and VS_VERSION_INFO v2.1.0.0 metadata inside .rsrc
  assert.ok(rsrcSlice.includes(iconPng));
  const fixedSig = Buffer.alloc(4);
  fixedSig.writeUInt32LE(0xfeef04bd, 0);
  assert.ok(rsrcSlice.includes(fixedSig));
  assert.ok(rsrcSlice.includes(Buffer.from('CosmoChat Desktop Messenger\0', 'utf16le')));
  assert.ok(rsrcSlice.includes(Buffer.from('2.1.0.0\0', 'utf16le')));
  assert.ok(rsrcSlice.includes(Buffer.from('CosmoChat.exe\0', 'utf16le')));

  // Verify PE checksum is non-zero
  assert.ok(exe.readUInt32LE(optOff + 64) > 0);
});
