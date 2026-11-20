/**
 * Pure TypeScript Windows PE32+ (x86-64 GUI) executable builder for CosmoChat v2.1.
 * Produces a standalone native Windows .exe (no console window) with the CosmoChat icon,
 * full Windows VS_VERSION_INFO metadata, and dedicated Edge/Chrome/Brave app-window launch
 * with default-browser fallback.
 */

const FILE_ALIGNMENT = 0x200;
const SECTION_ALIGNMENT = 0x1000;
const SIZE_OF_HEADERS = 0x400;
const IMAGE_BASE = 0x0000000140000000n;
const DEFAULT_TARGET_URL = 'https://cosmochat.ai.studio';

function alignUp(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

function encodeUtf16LeNull(str: string): Buffer {
  return Buffer.from(`${str}\0`, 'utf16le');
}

function encodeAsciiNull(str: string): Buffer {
  return Buffer.from(`${str}\0`, 'ascii');
}

export function sanitizeExeTargetUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return DEFAULT_TARGET_URL;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 512) return DEFAULT_TARGET_URL;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_TARGET_URL;
    }
    return parsed.toString().replace(/\/+$/, '') || DEFAULT_TARGET_URL;
  } catch {
    return DEFAULT_TARGET_URL;
  }
}

function buildVersionBlock(
  key: string,
  wType: 0 | 1,
  value: Buffer | string | null,
  children: Buffer[] = []
): Buffer {
  const keyBuf = encodeUtf16LeNull(key);
  let valueBuf: Buffer = Buffer.alloc(0);
  let wValueLength = 0;

  if (typeof value === 'string') {
    valueBuf = encodeUtf16LeNull(value);
    wValueLength = value.length + 1; // WCHAR count including null terminator
  } else if (Buffer.isBuffer(value)) {
    valueBuf = value;
    wValueLength = value.length; // byte length for binary values
  }

  const headerAndKeyLen = 6 + keyBuf.length;
  const valueOffset = alignUp(headerAndKeyLen, 4);
  const afterValueOffset = valueOffset + valueBuf.length;
  let cursor = children.length > 0 ? alignUp(afterValueOffset, 4) : afterValueOffset;

  const childOffsets: number[] = [];
  for (let i = 0; i < children.length; i++) {
    cursor = alignUp(cursor, 4);
    childOffsets.push(cursor);
    cursor += children[i].length;
  }

  const totalLen = cursor;
  const out = Buffer.alloc(totalLen);
  out.writeUInt16LE(totalLen, 0);
  out.writeUInt16LE(wValueLength, 2);
  out.writeUInt16LE(wType, 4);
  keyBuf.copy(out, 6);
  if (valueBuf.length > 0) {
    valueBuf.copy(out, valueOffset);
  }
  children.forEach((child, idx) => {
    child.copy(out, childOffsets[idx]);
  });

  return out;
}

function buildVersionInfoBlob(): Buffer {
  // VS_FIXEDFILEINFO (52 bytes)
  const fixedInfo = Buffer.alloc(52);
  fixedInfo.writeUInt32LE(0xfeef04bd, 0); // dwSignature
  fixedInfo.writeUInt32LE(0x00010000, 4); // dwStrucVersion
  fixedInfo.writeUInt32LE(0x00020001, 8); // dwFileVersionMS (2.1)
  fixedInfo.writeUInt32LE(0x00000000, 12); // dwFileVersionLS (.0.0)
  fixedInfo.writeUInt32LE(0x00020001, 16); // dwProductVersionMS (2.1)
  fixedInfo.writeUInt32LE(0x00000000, 20); // dwProductVersionLS (.0.0)
  fixedInfo.writeUInt32LE(0x0000003f, 24); // dwFileFlagsMask
  fixedInfo.writeUInt32LE(0x00000000, 28); // dwFileFlags
  fixedInfo.writeUInt32LE(0x00040004, 32); // dwFileOS (VOS_NT_WINDOWS32)
  fixedInfo.writeUInt32LE(0x00000001, 36); // dwFileType (VFT_APP)
  fixedInfo.writeUInt32LE(0x00000000, 40); // dwFileSubtype
  fixedInfo.writeUInt32LE(0, 44); // dwFileDateMS
  fixedInfo.writeUInt32LE(0, 48); // dwFileDateLS

  const stringEntries: Array<[string, string]> = [
    ['CompanyName', 'CosmoChat'],
    ['FileDescription', 'CosmoChat Desktop Messenger'],
    ['FileVersion', '2.1.0.0'],
    ['InternalName', 'CosmoChat'],
    ['OriginalFilename', 'CosmoChat.exe'],
    ['ProductName', 'CosmoChat'],
    ['ProductVersion', '2.1.0.0'],
  ];

  const stringBlocks = stringEntries.map(([k, v]) => buildVersionBlock(k, 1, v));
  const stringTable = buildVersionBlock('040904b0', 1, null, stringBlocks);
  const stringFileInfo = buildVersionBlock('StringFileInfo', 1, null, [stringTable]);

  const translationVal = Buffer.alloc(4);
  translationVal.writeUInt16LE(0x0409, 0); // US English
  translationVal.writeUInt16LE(0x04b0, 2); // Unicode
  const varBlock = buildVersionBlock('Translation', 0, translationVal);
  const varFileInfo = buildVersionBlock('VarFileInfo', 1, null, [varBlock]);

  return buildVersionBlock('VS_VERSION_INFO', 0, fixedInfo, [stringFileInfo, varFileInfo]);
}

interface ResourceSectionResult {
  buffer: Buffer;
  virtualSize: number;
}

function buildResourceSection(rsrcRva: number, pngBuffer?: Buffer): ResourceSectionResult {
  const versionData = buildVersionInfoBlob();

  interface ResourceItem {
    typeId: number;
    nameId: number;
    langId: number;
    data: Buffer;
  }

  const items: ResourceItem[] = [];

  if (pngBuffer && pngBuffer.length > 0) {
    // GRPICONDIR (6 bytes) + GRPICONDIRENTRY (14 bytes) = 20 bytes
    const groupIconData = Buffer.alloc(20);
    groupIconData.writeUInt16LE(0, 0); // idReserved
    groupIconData.writeUInt16LE(1, 2); // idType = 1 (icon)
    groupIconData.writeUInt16LE(1, 4); // idCount = 1
    // GRPICONDIRENTRY
    groupIconData.writeUInt8(192, 6); // bWidth (192px)
    groupIconData.writeUInt8(192, 7); // bHeight (192px)
    groupIconData.writeUInt8(0, 8); // bColorCount
    groupIconData.writeUInt8(0, 9); // bReserved
    groupIconData.writeUInt16LE(1, 10); // wPlanes
    groupIconData.writeUInt16LE(32, 12); // wBitCount
    groupIconData.writeUInt32LE(pngBuffer.length, 14); // dwBytesInRes
    groupIconData.writeUInt16LE(1, 18); // nID = 1 (matches RT_ICON id 1)

    items.push({ typeId: 3, nameId: 1, langId: 0x0409, data: pngBuffer });
    items.push({ typeId: 14, nameId: 1, langId: 0x0409, data: groupIconData });
  }

  // RT_VERSION = 16 (sorted ascending after 3 and 14)
  items.push({ typeId: 16, nameId: 1, langId: 0x0409, data: versionData });
  items.sort((a, b) => a.typeId - b.typeId);

  const count = items.length;
  // Directory sizes:
  // Root dir: 16 + count * 8
  // Per item: Type dir (24 bytes) + Name dir (24 bytes) + DataEntry (16 bytes)
  const rootDirSize = 16 + count * 8;
  const typeDirsOffset = rootDirSize;
  const nameDirsOffset = typeDirsOffset + count * 24;
  const dataEntriesOffset = nameDirsOffset + count * 24;
  let dataCursor = alignUp(dataEntriesOffset + count * 16, 4);

  const dataOffsets: number[] = [];
  for (const item of items) {
    dataCursor = alignUp(dataCursor, 4);
    dataOffsets.push(dataCursor);
    dataCursor += item.data.length;
  }

  const totalSize = dataCursor;
  const rsrc = Buffer.alloc(totalSize);

  const writeDir = (offset: number, entries: Array<{ id: number; targetOffset: number; isSubDir: boolean }>) => {
    rsrc.writeUInt32LE(0, offset); // Characteristics
    rsrc.writeUInt32LE(0, offset + 4); // TimeDateStamp
    rsrc.writeUInt16LE(0, offset + 8); // MajorVersion
    rsrc.writeUInt16LE(0, offset + 10); // MinorVersion
    rsrc.writeUInt16LE(0, offset + 12); // NumberOfNamedEntries
    rsrc.writeUInt16LE(entries.length, offset + 14); // NumberOfIdEntries
    entries.forEach((entry, idx) => {
      const eOff = offset + 16 + idx * 8;
      rsrc.writeUInt32LE(entry.id, eOff);
      rsrc.writeUInt32LE(entry.isSubDir ? (entry.targetOffset | 0x80000000) >>> 0 : entry.targetOffset, eOff + 4);
    });
  };

  writeDir(
    0,
    items.map((item, idx) => ({
      id: item.typeId,
      targetOffset: typeDirsOffset + idx * 24,
      isSubDir: true,
    }))
  );

  items.forEach((item, idx) => {
    const typeDirOff = typeDirsOffset + idx * 24;
    const nameDirOff = nameDirsOffset + idx * 24;
    const dataEntryOff = dataEntriesOffset + idx * 16;

    writeDir(typeDirOff, [{ id: item.nameId, targetOffset: nameDirOff, isSubDir: true }]);
    writeDir(nameDirOff, [{ id: item.langId, targetOffset: dataEntryOff, isSubDir: false }]);

    rsrc.writeUInt32LE(rsrcRva + dataOffsets[idx], dataEntryOff);
    rsrc.writeUInt32LE(item.data.length, dataEntryOff + 4);
    rsrc.writeUInt32LE(0, dataEntryOff + 8);
    rsrc.writeUInt32LE(0, dataEntryOff + 12);

    item.data.copy(rsrc, dataOffsets[idx]);
  });

  return { buffer: rsrc, virtualSize: totalSize };
}

function computePeChecksum(buf: Buffer, checksumOffset: number): number {
  let sum = 0n;
  const limit = 0x100000000n;
  for (let i = 0; i + 1 < buf.length; i += 2) {
    if (i === checksumOffset || i === checksumOffset + 2) continue;
    sum += BigInt(buf.readUInt16LE(i));
    if (sum >= limit) {
      sum = (sum & 0xffffffffn) + (sum >> 32n);
    }
  }
  if (buf.length % 2 === 1) {
    sum += BigInt(buf[buf.length - 1]);
  }
  sum = (sum & 0xffffn) + (sum >> 16n);
  sum = (sum & 0xffffn) + (sum >> 16n);
  return Number((sum + BigInt(buf.length)) & 0xffffffffn);
}

export function buildCosmoChatWindowsExe(options?: {
  targetUrl?: string;
  iconPng?: Buffer;
}): Buffer {
  const targetUrl = sanitizeExeTargetUrl(options?.targetUrl);
  const iconPng = options?.iconPng && options.iconPng.length > 0 ? options.iconPng : undefined;

  const textRva = 0x1000;
  const rdataRva = 0x2000;

  // --- Build .rdata layout ---
  // Import Directory: 2 DLL entries (kernel32.dll, shell32.dll) + 1 zero entry = 60 bytes
  const importDirSize = 60;
  const iltKernelOffset = 64; // 8-byte aligned: [RVA, 0] (16 bytes)
  const iltShellOffset = 80; // [RVA, 0] (16 bytes)
  const iatKernelOffset = 96; // [RVA, 0] (16 bytes)
  const iatShellOffset = 112; // [RVA, 0] (16 bytes)

  const exitProcHintBuf = Buffer.concat([Buffer.from([0, 0]), encodeAsciiNull('ExitProcess')]);
  const shellExecHintBuf = Buffer.concat([Buffer.from([0, 0]), encodeAsciiNull('ShellExecuteW')]);
  const kernelDllBuf = encodeAsciiNull('kernel32.dll');
  const shellDllBuf = encodeAsciiNull('shell32.dll');

  const exitProcHintOffset = 128;
  const shellExecHintOffset = alignUp(exitProcHintOffset + exitProcHintBuf.length, 2);
  const kernelDllOffset = alignUp(shellExecHintOffset + shellExecHintBuf.length, 2);
  const shellDllOffset = alignUp(kernelDllOffset + kernelDllBuf.length, 2);

  const wszOpen = encodeUtf16LeNull('open');
  const wszEdge = encodeUtf16LeNull('msedge.exe');
  const wszChrome = encodeUtf16LeNull('chrome.exe');
  const wszBrave = encodeUtf16LeNull('brave.exe');
  const wszAppArg = encodeUtf16LeNull(`--app=${targetUrl} --new-window`);
  const wszUrl = encodeUtf16LeNull(targetUrl);

  const wszOpenOffset = alignUp(shellDllOffset + shellDllBuf.length, 2);
  const wszEdgeOffset = wszOpenOffset + wszOpen.length;
  const wszChromeOffset = wszEdgeOffset + wszEdge.length;
  const wszBraveOffset = wszChromeOffset + wszChrome.length;
  const wszAppArgOffset = wszBraveOffset + wszBrave.length;
  const wszUrlOffset = wszAppArgOffset + wszAppArg.length;
  const rdataVirtualSize = wszUrlOffset + wszUrl.length;

  const rdataBuf = Buffer.alloc(rdataVirtualSize);

  // Import Directory entries
  // 0: kernel32.dll
  rdataBuf.writeUInt32LE(rdataRva + iltKernelOffset, 0);
  rdataBuf.writeUInt32LE(rdataRva + kernelDllOffset, 12);
  rdataBuf.writeUInt32LE(rdataRva + iatKernelOffset, 16);
  // 1: shell32.dll
  rdataBuf.writeUInt32LE(rdataRva + iltShellOffset, 20);
  rdataBuf.writeUInt32LE(rdataRva + shellDllOffset, 32);
  rdataBuf.writeUInt32LE(rdataRva + iatShellOffset, 36);

  // ILT & IAT entries
  rdataBuf.writeBigUInt64LE(BigInt(rdataRva + exitProcHintOffset), iltKernelOffset);
  rdataBuf.writeBigUInt64LE(BigInt(rdataRva + exitProcHintOffset), iatKernelOffset);
  rdataBuf.writeBigUInt64LE(BigInt(rdataRva + shellExecHintOffset), iltShellOffset);
  rdataBuf.writeBigUInt64LE(BigInt(rdataRva + shellExecHintOffset), iatShellOffset);

  exitProcHintBuf.copy(rdataBuf, exitProcHintOffset);
  shellExecHintBuf.copy(rdataBuf, shellExecHintOffset);
  kernelDllBuf.copy(rdataBuf, kernelDllOffset);
  shellDllBuf.copy(rdataBuf, shellDllOffset);
  wszOpen.copy(rdataBuf, wszOpenOffset);
  wszEdge.copy(rdataBuf, wszEdgeOffset);
  wszChrome.copy(rdataBuf, wszChromeOffset);
  wszBrave.copy(rdataBuf, wszBraveOffset);
  wszAppArg.copy(rdataBuf, wszAppArgOffset);
  wszUrl.copy(rdataBuf, wszUrlOffset);

  const iatExitProcessRva = rdataRva + iatKernelOffset;
  const iatShellExecuteWRva = rdataRva + iatShellOffset;

  // --- Build .text (x86-64 machine code) ---
  const code: number[] = [];
  const pushBytes = (...bytes: number[]) => code.push(...bytes);
  const emitRipDisp32 = (opcode: number[], targetRva: number) => {
    pushBytes(...opcode);
    const nextIpRva = textRva + code.length + 4;
    const disp = targetRva - nextIpRva;
    const b = Buffer.alloc(4);
    b.writeInt32LE(disp, 0);
    pushBytes(b[0], b[1], b[2], b[3]);
  };

  // sub rsp, 0x38 (keeps 16-byte alignment before CALL, reserves shadow + 2 stack args)
  pushBytes(0x48, 0x83, 0xec, 0x38);

  const jumpPatches: Array<{ patchIndex: number; fromIndex: number }> = [];

  const emitBrowserAttempt = (browserRva: number) => {
    pushBytes(0x31, 0xc9); // xor ecx, ecx (hwnd = NULL)
    emitRipDisp32([0x48, 0x8d, 0x15], rdataRva + wszOpenOffset); // lea rdx, [L"open"]
    emitRipDisp32([0x4c, 0x8d, 0x05], browserRva); // lea r8, [browser]
    emitRipDisp32([0x4c, 0x8d, 0x0d], rdataRva + wszAppArgOffset); // lea r9, [L"--app=<url> --new-window"]
    pushBytes(0x48, 0xc7, 0x44, 0x24, 0x20, 0x00, 0x00, 0x00, 0x00); // mov qword [rsp+0x20], 0 (lpDirectory)
    pushBytes(0x48, 0xc7, 0x44, 0x24, 0x28, 0x01, 0x00, 0x00, 0x00); // mov qword [rsp+0x28], 1 (SW_SHOWNORMAL)
    emitRipDisp32([0xff, 0x15], iatShellExecuteWRva); // call [ShellExecuteW]
    pushBytes(0x48, 0x83, 0xf8, 0x20); // cmp rax, 32 (ShellExecuteW > 32 means success)
    pushBytes(0x0f, 0x87, 0x00, 0x00, 0x00, 0x00); // ja near done (rel32 patched below)
    jumpPatches.push({ patchIndex: code.length - 4, fromIndex: code.length });
  };

  // Attempt 1: Microsoft Edge --app=<url> --new-window
  emitBrowserAttempt(rdataRva + wszEdgeOffset);
  // Attempt 2: Google Chrome --app=<url> --new-window
  emitBrowserAttempt(rdataRva + wszChromeOffset);
  // Attempt 3: Brave Browser --app=<url> --new-window
  emitBrowserAttempt(rdataRva + wszBraveOffset);

  // Attempt 4: Default OS browser open <url>
  pushBytes(0x31, 0xc9); // xor ecx, ecx
  emitRipDisp32([0x48, 0x8d, 0x15], rdataRva + wszOpenOffset); // lea rdx, [L"open"]
  emitRipDisp32([0x4c, 0x8d, 0x05], rdataRva + wszUrlOffset); // lea r8, [L"<url>"]
  pushBytes(0x45, 0x31, 0xc9); // xor r9d, r9d (lpParameters = NULL)
  pushBytes(0x48, 0xc7, 0x44, 0x24, 0x20, 0x00, 0x00, 0x00, 0x00); // mov qword [rsp+0x20], 0
  pushBytes(0x48, 0xc7, 0x44, 0x24, 0x28, 0x01, 0x00, 0x00, 0x00); // mov qword [rsp+0x28], 1
  emitRipDisp32([0xff, 0x15], iatShellExecuteWRva); // call [ShellExecuteW]

  // done:
  const doneIndex = code.length;
  for (const patch of jumpPatches) {
    const rel32 = doneIndex - patch.fromIndex;
    const b = Buffer.alloc(4);
    b.writeInt32LE(rel32, 0);
    code[patch.patchIndex] = b[0];
    code[patch.patchIndex + 1] = b[1];
    code[patch.patchIndex + 2] = b[2];
    code[patch.patchIndex + 3] = b[3];
  }

  pushBytes(0x31, 0xc9); // xor ecx, ecx (exit code 0)
  emitRipDisp32([0xff, 0x15], iatExitProcessRva); // call [ExitProcess]
  pushBytes(0x48, 0x83, 0xc4, 0x38); // add rsp, 0x38
  pushBytes(0xc3); // ret

  const textBuf = Buffer.from(code);

  // --- Assemble sections ---
  interface SectionDef {
    name: string;
    virtualAddress: number;
    virtualSize: number;
    rawData: Buffer;
    characteristics: number;
  }

  const sections: SectionDef[] = [
    {
      name: '.text',
      virtualAddress: textRva,
      virtualSize: textBuf.length,
      rawData: textBuf,
      characteristics: 0x60000020, // CNT_CODE | MEM_EXECUTE | MEM_READ
    },
    {
      name: '.rdata',
      virtualAddress: rdataRva,
      virtualSize: rdataVirtualSize,
      rawData: rdataBuf,
      characteristics: 0x40000040, // CNT_INITIALIZED_DATA | MEM_READ
    },
  ];

  let nextRva = alignUp(rdataRva + rdataVirtualSize, SECTION_ALIGNMENT);
  const builtRsrc = buildResourceSection(nextRva, iconPng);
  const rsrcDirRva = nextRva;
  const rsrcDirSize = builtRsrc.virtualSize;
  sections.push({
    name: '.rsrc',
    virtualAddress: rsrcDirRva,
    virtualSize: rsrcDirSize,
    rawData: builtRsrc.buffer,
    characteristics: 0x40000040,
  });
  nextRva = alignUp(nextRva + rsrcDirSize, SECTION_ALIGNMENT);

  // Minimal empty .reloc block so DYNAMIC_BASE / HIGH_ENTROPY_VA works cleanly
  const relocBuf = Buffer.alloc(8);
  relocBuf.writeUInt32LE(textRva, 0);
  relocBuf.writeUInt32LE(8, 4);
  const relocRva = nextRva;
  sections.push({
    name: '.reloc',
    virtualAddress: relocRva,
    virtualSize: relocBuf.length,
    rawData: relocBuf,
    characteristics: 0x42000040, // CNT_INITIALIZED_DATA | MEM_DISCARDABLE | MEM_READ
  });
  nextRva = alignUp(nextRva + relocBuf.length, SECTION_ALIGNMENT);

  // Compute raw file offsets
  let cursor = SIZE_OF_HEADERS;
  const sectionLayouts = sections.map((sec) => {
    const pointerToRawData = cursor;
    const sizeOfRawData = alignUp(sec.rawData.length, FILE_ALIGNMENT);
    cursor += sizeOfRawData;
    return { ...sec, pointerToRawData, sizeOfRawData };
  });

  const totalFileSize = cursor;
  const exe = Buffer.alloc(totalFileSize);

  // --- DOS Header (64 bytes) ---
  exe.writeUInt16LE(0x5a4d, 0); // 'MZ'
  exe.writeUInt16LE(0x0090, 2);
  exe.writeUInt16LE(0x0003, 4);
  exe.writeUInt16LE(0x0004, 8);
  exe.writeUInt16LE(0xffff, 12);
  exe.writeUInt16LE(0x00b8, 16);
  exe.writeUInt16LE(0x0040, 24);
  const peHeaderOffset = 0x80;
  exe.writeUInt32LE(peHeaderOffset, 0x3c); // e_lfanew

  // Minimal DOS stub
  Buffer.from('CosmoChat Desktop Launcher v2.1 (Windows x64)\r\n$', 'ascii').copy(exe, 0x40);

  // --- PE Signature & COFF File Header ---
  exe.write('PE\0\0', peHeaderOffset, 'ascii');
  const coffOff = peHeaderOffset + 4;
  exe.writeUInt16LE(0x8664, coffOff); // IMAGE_FILE_MACHINE_AMD64
  exe.writeUInt16LE(sectionLayouts.length, coffOff + 2); // NumberOfSections
  exe.writeUInt32LE(Math.floor(Date.now() / 1000), coffOff + 4); // TimeDateStamp
  exe.writeUInt32LE(0, coffOff + 8); // PointerToSymbolTable
  exe.writeUInt32LE(0, coffOff + 12); // NumberOfSymbols
  exe.writeUInt16LE(0x00f0, coffOff + 16); // SizeOfOptionalHeader (240)
  exe.writeUInt16LE(0x0022, coffOff + 18); // EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE

  // --- Optional Header PE32+ (240 bytes) ---
  const optOff = coffOff + 20;
  const codeSize = alignUp(textBuf.length, FILE_ALIGNMENT);
  const initDataSize = sectionLayouts
    .slice(1)
    .reduce((acc, s) => acc + s.sizeOfRawData, 0);

  exe.writeUInt16LE(0x020b, optOff); // Magic PE32+
  exe.writeUInt8(14, optOff + 2); // MajorLinkerVersion
  exe.writeUInt8(0, optOff + 3); // MinorLinkerVersion
  exe.writeUInt32LE(codeSize, optOff + 4);
  exe.writeUInt32LE(initDataSize, optOff + 8);
  exe.writeUInt32LE(0, optOff + 12); // SizeOfUninitializedData
  exe.writeUInt32LE(textRva, optOff + 16); // AddressOfEntryPoint
  exe.writeUInt32LE(textRva, optOff + 20); // BaseOfCode
  exe.writeBigUInt64LE(IMAGE_BASE, optOff + 24); // ImageBase
  exe.writeUInt32LE(SECTION_ALIGNMENT, optOff + 32);
  exe.writeUInt32LE(FILE_ALIGNMENT, optOff + 36);
  exe.writeUInt16LE(6, optOff + 40); // MajorOperatingSystemVersion (Win Vista+)
  exe.writeUInt16LE(0, optOff + 42);
  exe.writeUInt16LE(2, optOff + 44); // MajorImageVersion (2.1)
  exe.writeUInt16LE(1, optOff + 46); // MinorImageVersion
  exe.writeUInt16LE(6, optOff + 48); // MajorSubsystemVersion
  exe.writeUInt16LE(0, optOff + 50);
  exe.writeUInt32LE(0, optOff + 52); // Win32VersionValue
  exe.writeUInt32LE(nextRva, optOff + 56); // SizeOfImage
  exe.writeUInt32LE(SIZE_OF_HEADERS, optOff + 60); // SizeOfHeaders
  const checksumOffset = optOff + 64;
  exe.writeUInt32LE(0, checksumOffset); // CheckSum (computed below)
  exe.writeUInt16LE(2, optOff + 68); // Subsystem = IMAGE_SUBSYSTEM_WINDOWS_GUI
  exe.writeUInt16LE(0x8160, optOff + 70); // HIGH_ENTROPY_VA | DYNAMIC_BASE | NX_COMPAT | TERMINAL_SERVER_AWARE
  exe.writeBigUInt64LE(0x100000n, optOff + 72); // SizeOfStackReserve
  exe.writeBigUInt64LE(0x1000n, optOff + 80); // SizeOfStackCommit
  exe.writeBigUInt64LE(0x100000n, optOff + 88); // SizeOfHeapReserve
  exe.writeBigUInt64LE(0x1000n, optOff + 96); // SizeOfHeapCommit
  exe.writeUInt32LE(0, optOff + 104); // LoaderFlags
  exe.writeUInt32LE(16, optOff + 108); // NumberOfRvaAndSizes

  const ddOff = optOff + 112;
  // DataDirectory[1]: Import Table
  exe.writeUInt32LE(rdataRva, ddOff + 1 * 8);
  exe.writeUInt32LE(importDirSize, ddOff + 1 * 8 + 4);
  // DataDirectory[2]: Resource Table
  exe.writeUInt32LE(rsrcDirRva, ddOff + 2 * 8);
  exe.writeUInt32LE(rsrcDirSize, ddOff + 2 * 8 + 4);
  // DataDirectory[5]: Base Relocation Table
  exe.writeUInt32LE(relocRva, ddOff + 5 * 8);
  exe.writeUInt32LE(relocBuf.length, ddOff + 5 * 8 + 4);
  // DataDirectory[12]: IAT
  exe.writeUInt32LE(rdataRva + iatKernelOffset, ddOff + 12 * 8);
  exe.writeUInt32LE(32, ddOff + 12 * 8 + 4);

  // --- Section Headers ---
  const secHdrOff = optOff + 240;
  sectionLayouts.forEach((sec, idx) => {
    const off = secHdrOff + idx * 40;
    exe.write(sec.name.slice(0, 8), off, 'ascii');
    exe.writeUInt32LE(sec.virtualSize, off + 8);
    exe.writeUInt32LE(sec.virtualAddress, off + 12);
    exe.writeUInt32LE(sec.sizeOfRawData, off + 16);
    exe.writeUInt32LE(sec.pointerToRawData, off + 20);
    exe.writeUInt32LE(sec.characteristics, off + 36);
    sec.rawData.copy(exe, sec.pointerToRawData);
  });

  // Write valid PE checksum
  const checksum = computePeChecksum(exe, checksumOffset);
  exe.writeUInt32LE(checksum, checksumOffset);

  return exe;
}
