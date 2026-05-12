import { Capacitor } from '@capacitor/core';

export type NfcScanResult = 'success' | 'wrong_tag' | 'cancelled' | 'unavailable' | 'error';

// Tags must contain an NDEF Text record with content "boost:<station_id>"
// Write using the free "NFC Tools" app (iOS/Android).
export async function scanForStation(params: {
  expectedStationId: string;
  alertMessage?: string;
}): Promise<NfcScanResult> {
  const { expectedStationId, alertMessage = 'Halte dein iPhone an die Station' } = params;

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
    const { supported } = await CapacitorNfc.isSupported();
    if (!supported) return 'unavailable';
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

      await CapacitorNfc.startScanning({ alertMessage, invalidateAfterFirstRead: true, iosSessionType: 'tag' });
    };

    run().catch(() => void settle('error'));
  });
}
