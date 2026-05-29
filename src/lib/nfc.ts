import { Capacitor } from '@capacitor/core';

export type NfcScanResult = 'success' | 'wrong_tag' | 'cancelled' | 'unavailable' | 'error';

export type NfcTagRead =
  | { status: 'success'; tagId: string }
  | { status: 'cancelled' | 'unavailable' | 'error' };

// Android reader mode flags: NFC A/B/F/V + suppress platform sound.
// Intentionally omits FLAG_READER_SKIP_NDEF_CHECK (0x80) so Android caches the
// NDEF message during discovery. getCachedNdefMessage() then reliably returns
// data even when the plugin's manual MIFARE-Ultralight read path fails, which
// was causing Android scans to fire an nfcEvent with no ndefMessage at all.
const ANDROID_READER_FLAGS =
  0x1 |   // FLAG_READER_NFC_A
  0x2 |   // FLAG_READER_NFC_B
  0x4 |   // FLAG_READER_NFC_F
  0x8 |   // FLAG_READER_NFC_V
  0x100;  // FLAG_READER_NO_PLATFORM_SOUNDS  (= 271 decimal)

/**
 * Extracts a normalised station ID from a single NDEF record.
 *
 * Supports:
 *   - NDEF Text records  (TNF=0x01, type=[0x54='T'])
 *   - NDEF URI records   (TNF=0x01, type=[0x55='U'])
 *   - Any fallback payload (treated as raw UTF-8 text)
 *
 * Strips a leading "boost:" prefix (case-insensitive), trims whitespace /
 * newlines, and returns the result uppercased — matching the DB column which
 * stores IDs as uppercase text.
 *
 * Returns null if the record yields no usable text.
 */
function parseNdefRecord(record: any): string | null {
  if (!record.payload?.length) return null;

  const payload = new Uint8Array(record.payload as number[]);
  const type: number[] = Array.isArray(record.type) ? Array.from(record.type as number[]) : [];

  let text: string;

  if (type.length === 1 && type[0] === 0x55) {
    // NDEF URI record: byte 0 is a URI-identifier prefix code, rest is the URI.
    // For custom schemes like "boost:", the prefix code is always 0x00 (no prefix),
    // so we just skip that byte.
    text = new TextDecoder().decode(payload.slice(1));
  } else {
    // NDEF Text record (or unknown): byte 0 is a status byte where bits 0-5
    // encode the language-code length, followed by the language code, then text.
    const statusByte = payload[0];
    const langLen = statusByte & 0x3f;
    const textStart = 1 + langLen;
    if (textStart >= payload.length) {
      // Malformed record: not enough bytes. Try the raw payload as plain text.
      text = new TextDecoder().decode(payload);
    } else {
      text = new TextDecoder().decode(payload.slice(textStart));
    }
  }

  // Strip the "boost:" prefix (case-insensitive) then normalise.
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const id = lower.startsWith('boost:') ? trimmed.slice(6).trim() : trimmed;
  return id.toUpperCase() || null;
}

// Tags must contain an NDEF Text record with content "boost:<station_id>"
// Write using the free "NFC Tools" app (iOS/Android).
export async function scanForStation(params: {
  expectedStationId: string;
  alertMessage?: string;
}): Promise<NfcScanResult> {
  const { expectedStationId, alertMessage = 'Halte dein Handy an die Station' } = params;

  if (!Capacitor.isNativePlatform()) {
    const input = window.prompt(
      `NFC Simulation – ID eingeben (erwartet: "${expectedStationId}")`
    );
    if (input === null) return 'cancelled';
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();
    const parsed = (lower.startsWith('boost:') ? trimmed.slice(6).trim() : trimmed).toUpperCase();
    return parsed === expectedStationId.toUpperCase() ? 'success' : 'wrong_tag';
  }

  let CapacitorNfc: any;
  try {
    ({ CapacitorNfc } = await import('@capgo/capacitor-nfc'));
  } catch {
    return 'unavailable';
  }

  try {
    const { status } = await CapacitorNfc.getStatus();
    if (status === 'NO_NFC' || status === 'NFC_DISABLED') return 'unavailable';
  } catch {
    return 'unavailable';
  }

  return new Promise((resolve) => {
    let settled = false;
    let listener: any = null;
    let timeoutId: ReturnType<typeof setTimeout>;

    const settle = async (result: NfcScanResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try { await listener?.remove(); } catch { /* ignore */ }
      try { await CapacitorNfc.stopScanning(); } catch { /* ignore */ }
      resolve(result);
    };

    const run = async () => {
      listener = await CapacitorNfc.addListener('nfcEvent', async (event: any) => {
        const records: any[] = event?.tag?.ndefMessage ?? [];

        for (const record of records) {
          const tagId = parseNdefRecord(record);
          if (tagId === expectedStationId.toUpperCase()) {
            await settle('success');
            return;
          }
        }

        // Got records but none matched the expected station.
        if (records.length > 0) {
          await settle('wrong_tag');
          return;
        }

        // No NDEF records: Android failed to read the NDEF message.
        // Settle with error so the caller can surface a retry prompt.
        await settle('error');
      });

      timeoutId = setTimeout(() => void settle('cancelled'), 30_000);

      await CapacitorNfc.startScanning({
        alertMessage,
        invalidateAfterFirstRead: true,
        androidReaderModeFlags: ANDROID_READER_FLAGS,
      });
    };

    run().catch(() => void settle('error'));
  });
}

/**
 * Reads any NFC tag and returns its normalised tag ID (strips the "boost:"
 * prefix if present). Use this for the route-based NFC scan flow where the
 * server determines which station was scanned.
 */
export async function readNfcTag(
  alertMessage = 'Halte dein Handy an die Station',
): Promise<NfcTagRead> {
  if (!Capacitor.isNativePlatform()) {
    const input = window.prompt(
      'NFC Simulation – Tag-ID eingeben (z. B. BOOST-WALDWEG-START):',
    );
    if (input === null) return { status: 'cancelled' };
    const tagId = input.trim().toUpperCase();
    return tagId ? { status: 'success', tagId } : { status: 'error' };
  }

  let CapacitorNfc: any;
  try {
    ({ CapacitorNfc } = await import('@capgo/capacitor-nfc'));
  } catch {
    return { status: 'unavailable' };
  }

  try {
    const { status } = await CapacitorNfc.getStatus();
    if (status === 'NO_NFC' || status === 'NFC_DISABLED') return { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }

  return new Promise((resolve) => {
    let settled = false;
    let listener: any = null;
    let timeoutId: ReturnType<typeof setTimeout>;

    const settle = async (result: NfcTagRead) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try { await listener?.remove(); } catch { /* ignore */ }
      try { await CapacitorNfc.stopScanning(); } catch { /* ignore */ }
      resolve(result);
    };

    const run = async () => {
      listener = await CapacitorNfc.addListener('nfcEvent', async (event: any) => {
        const records: any[] = event?.tag?.ndefMessage ?? [];

        for (const record of records) {
          const tagId = parseNdefRecord(record);
          if (tagId) {
            await settle({ status: 'success', tagId });
            return;
          }
        }

        // Got records but nothing parseable → tag has no usable NDEF data.
        if (records.length > 0) {
          await settle({ status: 'error' });
          return;
        }

        // No NDEF records: Android failed to read the NDEF message (e.g. the
        // plugin's MIFARE-Ultralight path returned null). Settle as error so
        // the caller surfaces a retry prompt rather than waiting 30 s.
        await settle({ status: 'error' });
      });

      timeoutId = setTimeout(() => void settle({ status: 'cancelled' }), 30_000);

      await CapacitorNfc.startScanning({
        alertMessage,
        invalidateAfterFirstRead: true,
        androidReaderModeFlags: ANDROID_READER_FLAGS,
      });
    };

    run().catch(() => void settle({ status: 'error' }));
  });
}
