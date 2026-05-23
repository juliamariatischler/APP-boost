import { Capacitor } from '@capacitor/core';

export type NfcScanResult = 'success' | 'wrong_tag' | 'cancelled' | 'unavailable' | 'error';

export type NfcTagRead =
  | { status: 'success'; tagId: string }
  | { status: 'cancelled' | 'unavailable' | 'error' };

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
    return input.trim() === expectedStationId ? 'success' : 'wrong_tag';
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
          if (!record.payload?.length) continue;
          const statusByte = record.payload[0];
          const langLen = statusByte & 0x3f;
          const text = new TextDecoder().decode(
            new Uint8Array(record.payload).slice(1 + langLen)
          );
          const tagId = text.startsWith('boost:') ? text.slice(6).trim() : text.trim();
          if (tagId === expectedStationId) {
            await settle('success');
            return;
          }
        }
        await settle('wrong_tag');
      });

      // Safety: auto-cancel after 30 s if iOS sheet is dismissed without event
      timeoutId = setTimeout(() => void settle('cancelled'), 30_000);

      await CapacitorNfc.startScanning({ alertMessage, invalidateAfterFirstRead: true });
    };

    run().catch(() => void settle('error'));
  });
}

/**
 * Reads any NFC tag and returns its raw tag ID (strips the "boost:" prefix if present).
 * Use this for the route-based NFC scan flow where the server determines which station was scanned.
 */
export async function readNfcTag(
  alertMessage = 'Halte dein Handy an die Station',
): Promise<NfcTagRead> {
  if (!Capacitor.isNativePlatform()) {
    const input = window.prompt(
      'NFC Simulation – Tag-ID eingeben (z. B. BOOST-WALDWEG-START):',
    );
    if (input === null) return { status: 'cancelled' };
    const trimmed = input.trim().toUpperCase();
    return trimmed ? { status: 'success', tagId: trimmed } : { status: 'error' };
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
          if (!record.payload?.length) continue;
          const statusByte = record.payload[0];
          const langLen = statusByte & 0x3f;
          const text = new TextDecoder().decode(
            new Uint8Array(record.payload).slice(1 + langLen),
          );
          const tagId = text.startsWith('boost:')
            ? text.slice(6).trim().toUpperCase()
            : text.trim().toUpperCase();
          if (tagId) {
            await settle({ status: 'success', tagId });
            return;
          }
        }
        await settle({ status: 'error' });
      });

      timeoutId = setTimeout(() => void settle({ status: 'cancelled' }), 30_000);

      await CapacitorNfc.startScanning({
        alertMessage,
        invalidateAfterFirstRead: true,
      });
    };

    run().catch(() => void settle({ status: 'error' }));
  });
}
