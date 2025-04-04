export interface SwitchBotHub2Data {
  temperatureC: number;
  temperatureF: number;
  humidityPercent: number;
  lightLevel: number;
  macAddress?: string;
}

export class SwitchBotHub2 {
  static readonly MANUFACTURER_ID = '6909';

  static extractMac(manufacturerData: Buffer): string | undefined {
    if (manufacturerData.length < 8) return undefined;
    const mac = manufacturerData.subarray(2, 8);
    return Array.from(mac)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':');
  }

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
}
