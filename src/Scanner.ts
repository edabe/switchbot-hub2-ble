import noble from '@abandonware/noble';
import { SwitchBotHub2 } from './SwitchBotHub2';
import { SwitchBotHub2Data } from './SwitchBotHub2';

/**
 * Starts sampling BLE advertisements from SwitchBot Hub2 devices on an interval.
 * Returns a cleanup function that stops the scanner gracefully.
 *
 * @param callback Function called with decoded sensor data.
 * @param intervalMs How often to scan (default 15s)
 * @param scanDurationMs How long each scan lasts (default 3s)
 * @returns A function to stop scanning
 */
export function startSensorSampling(
  callback: (data: SwitchBotHub2Data) => void,
  intervalMs: number = 15000,
  scanDurationMs: number = 3000
): () => void {
  const seenDevices = new Set<string>();

  function onDiscover(peripheral: any) {
    const { manufacturerData } = peripheral.advertisement;
    if (!manufacturerData?.toString('hex').startsWith('6909')) return;

    const mac = SwitchBotHub2.extractMac(manufacturerData);
    if (!mac || seenDevices.has(mac)) return;

    seenDevices.add(mac);

    const decoded = SwitchBotHub2.decode(manufacturerData);
    if (decoded) {
      callback(decoded);
    }
  }

  function sampleOnce() {
    seenDevices.clear();
    noble.on('discover', onDiscover);
    noble.startScanning([], true);

    setTimeout(() => {
      noble.stopScanning();
      noble.removeListener('discover', onDiscover);
    }, scanDurationMs);
  }

  const intervalId = setInterval(sampleOnce, intervalMs);

  noble.on('stateChange', (state) => {
    if (state === 'poweredOn') {
      sampleOnce(); // initial sample
    } else {
      noble.stopScanning();
    }
  });

  return () => {
    clearInterval(intervalId);
    noble.stopScanning();
    noble.removeAllListeners('discover');
    console.log('🛑 BLE sampling stopped.');
  };
}
