import noble from '@abandonware/noble';
import { time } from 'console';
import { EventEmitter } from 'events';

type ScanOptions = {
  interval?: number; // ms
  duration?: number; // ms
}

export type SwitchBotHub2Data = {
  temperatureC: number;
  temperatureF: number;
  humidityPercent: number;
  lightLevel: number;
  macAddress?: string;
}

export class SwitchBotHub2 extends EventEmitter {
  // SwitchBot manufacturer ID for the Hub2
  static readonly MANUFACTURER_ID = '6909';

  // Scanning state
  private scanning = false;

  
  // Default options
  private readonly defaultOptions: ScanOptions = {
    interval: 15000,
    duration: 3000
  }
  
  // Devices seen by the scanner
  private seenDevices = new Set<string>();
  
  // Timeout and Interval ids
  private scanInterval: number | null = null;
  private scanDuration: ReturnType<typeof setTimeout> | null = null;

  /**
   * Extracts the MAC address from the manufacturer data buffer retrieved
   * from the device BLE advertisement
   * 
   * @param manufacturerData The manufacturer data buffer
   * @returns The MAC address as string, or undefined
   */
  static extractMac(manufacturerData: Buffer): string | undefined {
    if (manufacturerData.length < 8) return undefined;
    const mac = manufacturerData.subarray(2, 8);
    return Array.from(mac)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':');
  }

  /**
   * Decodes the device data from the manufacturer data buffer retrieved 
   * from the BLE advertisement
   * 
   * @param manufacturerData The manufacturer data buffer
   * @returns The extracted manufacturer data, or null
   */
  static decode(manufacturerData: Buffer): SwitchBotHub2Data | null {
    if (
      manufacturerData.length < 18 ||
      manufacturerData.slice(0, 2).toString('hex') !== SwitchBotHub2.MANUFACTURER_ID
    ) {
      return null;
    }

    const data = manufacturerData.subarray(2);
    const status = data[12];
    const tempBytes = data.subarray(13, 16);

    if (tempBytes.length < 3) return null;

    const tempSign = (tempBytes[1] & 0b10000000) ? 1 : -1;
    const tempC =
      tempSign *
      ((tempBytes[1] & 0x7f) + ((tempBytes[0] & 0x0f) / 10));
    const tempF = (tempC * 9) / 5 + 32;
    const humidity = tempBytes[2] & 0x7f;
    const lightLevel = status & 0x1f;

    return {
      temperatureC: parseFloat(tempC.toFixed(1)),
      temperatureF: parseFloat(tempF.toFixed(1)),
      humidityPercent: humidity,
      lightLevel,
      macAddress: this.extractMac(manufacturerData),
    };
  }

  /**
   * Access whether the decoder is scanning for BLE advertisements
   * @returns The scanning state
   */
  isScanning(): boolean {
    return this.scanning;
  }

  /**
   * Start scanning for BLE advertisements
   * @param options The scan frequency in milliseconds
   */
  startScanning(options: ScanOptions): void {
    if (this.scanning) return;
    this.scanning = true;
    const interval = options.interval || this.defaultOptions.interval;
    const duration = options.duration || this.defaultOptions.duration;

    // Start scanning in intervals
    this.scanInterval = setInterval(this.sampleOnce, interval, duration);

    noble.on('stateChange', (state) => {
      if (state === 'poweredOn') {

        this.sampleOnce(duration as number); // initial sample
      } else {
        noble.stopScanning();
      }
    });
    





    this.scanTimer = setInterval(() => {
      const buffer = this.fakeScan(); // Replace with actual BLE scan logic
      const data = SwitchBotHub2Class.decode(buffer);
      this.emit('advertisement', data);
    }, interval);
  }

  /**
   * The noble 'discover' callback
   * 
   * @param peripheral 
   * @returns 
   */
  private onBleDiscover(peripheral: any) {
    const { manufacturerData } = peripheral.advertisement;
    if (!manufacturerData?.toString('hex').startsWith('6909')) return;

    const mac = SwitchBotHub2.extractMac(manufacturerData);
    if (!mac || this.seenDevices.has(mac)) return;

    this.seenDevices.add(mac);

    const decoded = SwitchBotHub2.decode(manufacturerData);
    if (decoded) {
      this.emit('data', decoded);
    }
  }

  /**
   * Sample the BLE advertisements once
   * 
   * @param duration The duration of the BLE sampling (ms)
   * @returns The timeout id to help clean exit
   */
  private sampleOnce(duration: number): NodeJS.Timeout {
    this.seenDevices.clear();
    noble.on('discover', this.onBleDiscover);
    noble.startScanning([], true);

    return setTimeout(() => {
      noble.stopScanning();
      noble.removeListener('discover', this.onBleDiscover);
    }, duration);
  }




  private sensorSampling(emitter: EventEmitter, options: ScanOptions): () => void {
    const seenDevices = new Set<string>();
  
    function onDiscover(peripheral: any) {
      const { manufacturerData } = peripheral.advertisement;
      if (!manufacturerData?.toString('hex').startsWith('6909')) return;
  
      const mac = SwitchBotHub2.extractMac(manufacturerData);
      if (!mac || seenDevices.has(mac)) return;
  
      seenDevices.add(mac);
  
      const decoded = SwitchBotHub2.decode(manufacturerData);
      if (decoded) {
        emitter.emit('data', decoded);
      }
    }
  
    function sampleOnce(): NodeJS.Timeout {
      seenDevices.clear();
      noble.on('discover', onDiscover);
      noble.startScanning([], true);
  
      return setTimeout(() => {
        noble.stopScanning();
        noble.removeListener('discover', onDiscover);
      }, options.duration);
    }
  
    const intervalId = setInterval(sampleOnce, options.interval);
    let timeoutId: NodeJS.Timeout;
  
    noble.on('stateChange', (state) => {
      if (state === 'poweredOn') {
        timeoutId = sampleOnce(); // initial sample
      } else {
        noble.stopScanning();
      }
    });
  
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      noble.stopScanning();
      noble.removeAllListeners('discover');
      console.log('🛑 BLE sampling stopped.');
    };
  }
}
