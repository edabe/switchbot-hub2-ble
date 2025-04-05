# SwitchBot Hub2 BLE Decoder (TypeScript)

![Build](https://github.com/edabe/switchbot-hub2-ble/actions/workflows/test.yml/badge.svg)
![npm](https://img.shields.io/npm/v/switchbot-hub2-ble)

This module provides a complete and reusable BLE decoder for the **SwitchBot Hub2** device. It scans for BLE advertisements using `@abandonware/noble`, extracts environment sensor readings from the `manufacturerData` field, and returns a clean TypeScript object containing temperature, humidity, and light level.

## ✅ Features

- Decodes **temperature (°C and °F)**, **humidity (%)**, and **light level (0–31)**
- Extracts **MAC address** from BLE data
- Fully self-contained BLE scanner (no BLE setup required by consuming apps)
- Can be used as a standalone module or integrated into larger IoT projects

## 🚀 Installation

```bash
npm install switchbot-hub2-ble
```

## 🧪 Example Usage

```ts
import { onSensorUpdate } from 'switchbot-hub2-ble';

onSensorUpdate((data) => {
  console.log('Sensor Data:', data);
});
```

## 🧬 BLE Manufacturer Data Format

The SwitchBot Hub2 broadcasts sensor information using **Bluetooth LE manufacturer data** with the following structure:

### Manufacturer Data Layout

| Offset | Field        | Description                                      |
|--------|--------------|--------------------------------------------------|
| 0–1    | `0x69 0x09`  | SwitchBot Manufacturer ID (LE format)            |
| 2–7    | MAC Address  | Device MAC in raw bytes                          |
| 14     | Status byte  | Lower 5 bits contain light level (0–31)          |
| 15–17  | Sensor data  | Encodes temperature (Celsius), humidity          |

> Note: The decoding offsets match [pySwitchbot's `process_wohub2()`](https://github.com/sblibs/pySwitchbot/blob/master/switchbot/adv_parsers/hub2.py) function. We apply an offset shift of +2 to account for the stripped `0x6909` ID bytes.

## 🌡️ Temperature Decoding

The temperature is encoded in 2 bytes:

- Sign is stored in the MSB of the second byte
- Value = `(second_byte & 0x7F) + ((first_byte & 0x0F) / 10)`
- Multiply by -1 if the sign bit is set

### Conversion

- Celsius: decoded as above
- Fahrenheit: `C * 9 / 5 + 32`

## 💧 Humidity

Stored in the 3rd byte of the `tempBytes` triplet:

- Mask with `0x7F` to remove reserved bit

## 💡 Light Level

Extracted from the **status byte** (offset 14):

- `status & 0x1F`

## 📦 Output Format

```ts
interface SwitchBotHub2Data {
  temperatureC: number;
  temperatureF: number;
  humidityPercent: number;
  lightLevel: number;
  macAddress?: string;
}
```

## 🧪 Unit Test Example

```ts
const sampleManufacturerData = Buffer.from('6909c9165c55517800ff67ee84b98a048eab00', 'hex');
const result = SwitchBotHub2.decode(sampleManufacturerData);

expect(result?.temperatureC).toBeCloseTo(17.8);
expect(result?.humidityPercent).toBe(44);
expect(result?.lightLevel).toBe(12);
```

## 🙏 Credits and Sources

This module was made possible thanks to open-source contributions and reverse engineering efforts from the following:

- [pySwitchbot](https://github.com/sblibs/pySwitchbot): Python BLE decoding library maintained by the Home Assistant community
- [Home Assistant SwitchBot Integration](https://github.com/home-assistant/core/tree/dev/homeassistant/components/switchbot)
- BLE analysis and field decoding provided by community examples and device experimentation

## 🔒 License

MIT
