import noble from '@abandonware/noble';
import { ILogObj, Logger } from 'tslog';
import { EventEmitter } from 'events';

const logger = new Logger<ILogObj>({ name: 'SwitchBot Hub2 BLE' });

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

class SwitchBotHub2Class extends EventEmitter {
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
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private scanDuration: ReturnType<typeof setTimeout> | null = null;

  // Track noble state
  private isNoblePoweredOn: boolean = false;

  /**
   * Class constructor
   */
  constructor() {
    super();
    // Bind event handler to this in order to set the right context
    this.onBleDiscover = this.onBleDiscover.bind(this);
    this.sampleAdvertisements = this.sampleAdvertisements.bind(this);
  }

  /**
   * Extracts the MAC address from the manufacturer data buffer retrieved
   * from the device BLE advertisement
   * 
   * @param manufacturerData The manufacturer data buffer
   * @returns The MAC address as string, or undefined
   */
  public extractMac(manufacturerData: Buffer): string | undefined {
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
  public decode(manufacturerData: Buffer): SwitchBotHub2Data | null {
    if (
      manufacturerData.length < 18 ||
      manufacturerData.slice(0, 2).toString('hex') !== SwitchBotHub2Class.MANUFACTURER_ID
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
  public isScanning(): boolean {
    return this.scanning;
  }

  /**
   * Start scanning for BLE advertisements
   * @param options The scan frequency in milliseconds
   */
  public startScanning(options?: ScanOptions): void {
    if (this.scanning) return;
    this.scanning = true;
    logger.info("Start scanning")
    const interval = options?.interval || this.defaultOptions.interval;
    const duration = (options?.duration || this.defaultOptions.duration) as number;

    // Checks if state change event listener is already registered)
    if (this.isNoblePoweredOn) {
      logger.info("Noble already initialized");
      this.sampleAdvertisements(duration);
      this.scanInterval = setInterval(this.sampleAdvertisements, interval, duration);
    } else {
      logger.info("Noble not yet initialized", this.seenDevices.size);
      noble.on('stateChange', (state) => {
        if (state === 'poweredOn') {
          this.isNoblePoweredOn = true;
          this.sampleAdvertisements(duration);
          this.scanInterval = setInterval(this.sampleAdvertisements, interval, duration);
        } else {
          this.isNoblePoweredOn = false;
          logger.error(`Library Noble state has changed from "poweredOn" to "${state}"`);
          noble.stopScanning();
        }
      });
    }
  }

  /**
   * Stop scanning for BLE advertisements
   */
  public stopScanning(): void {
    if (!this.scanning) return;

    this.scanning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.scanDuration) {
      clearTimeout(this.scanDuration);
      this.scanDuration = null;
    }
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

    const mac = this.extractMac(manufacturerData);
    if (!mac || this.seenDevices.has(mac)) return;

    this.seenDevices.add(mac);

    const decoded = this.decode(manufacturerData);
    if (decoded) {
      this.emit('data', decoded);
    }
  }

  /**
   * Sample the BLE advertisements for a given duration
   * 
   * @param duration The duration of the BLE sampling (ms)
   */
  private sampleAdvertisements(duration: number) {
    logger.info("sampleAdvertisements");
    this.seenDevices.clear();
    noble.on('discover', this.onBleDiscover);
    noble.startScanning([], true);

    this.scanDuration = setTimeout(() => {
      noble.stopScanning();
      noble.removeListener('discover', this.onBleDiscover);
    }, duration);
  }
}

export const SwitchBotHub2 = new SwitchBotHub2Class();
