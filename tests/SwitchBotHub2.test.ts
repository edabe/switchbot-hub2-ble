jest.mock('@abandonware/noble');

import realNoble from '@abandonware/noble';
const noble = realNoble as jest.Mocked<typeof realNoble>;
import { SwitchBotHub2 } from '../src/SwitchBotHub2';
import { startSensorSampling } from '../src/Scanner';

const samples = [
  {
    hex: '6909c9165c5551a600ff67ee84b98a048eab00',
    expected: { tempC: 14.4, humidity: 43, light: 10, mac: 'c9:16:5c:55:51:a6' }
  },
  {
    hex: '6909e4de3a66c7a600ff67ee84b98a048fab00',
    expected: { tempC: 15.4, humidity: 43, light: 10, mac: 'e4:de:3a:66:c7:a6' }
  },
  {
    hex: '6909c9165c5551a600ff67ee84b98a048cab00',
    expected: { tempC: 12.4, humidity: 43, light: 10, mac: 'c9:16:5c:55:51:a6' }
  },
  {
    hex: '6909e4de3a66c7a600ff67ef0bb0820891ad00',
    expected: { tempC: 17.8, humidity: 45, light: 2, mac: 'e4:de:3a:66:c7:a6' }
  }
];

describe('SwitchBotHub2.decode', () => {
  for (const { hex, expected } of samples) {
    test(`decodes temp=${expected.tempC}C humidity=${expected.humidity}% light=${expected.light}`, () => {
      const buffer = Buffer.from(hex, 'hex');
      const result = SwitchBotHub2.decode(buffer);
      expect(result).not.toBeNull();
      expect(result?.temperatureC).toBeCloseTo(expected.tempC, 1);
      expect(result?.humidityPercent).toBe(expected.humidity);
      expect(result?.lightLevel).toBe(expected.light);
      expect(result?.macAddress).toBe(expected.mac);
    });
  }

  test('returns null for short buffer', () => {
    const result = SwitchBotHub2.decode(Buffer.from('6909', 'hex'));
    expect(result).toBeNull();
  });
});

describe('Sensor sampler (mocked noble)', () => {
  test('triggers scanning on stateChange and handles discover', (done) => {
    const callback = jest.fn();

    const stop = startSensorSampling(callback, 10000, 500);

    // Simulate BLE powered on event
    const stateChange = noble.on.mock.calls.find(call => call[0] === 'stateChange')?.[1];
    stateChange?.('poweredOn');

    // Simulate discover event
    const discover = noble.on.mock.calls.find(call => call[0] === 'discover')?.[1];
    const fakePeripheral = {
      advertisement: {
        manufacturerData: Buffer.from('6909c9165c55517800ff67ef0bb0820891ad00', 'hex')
      }
    };
    discover?.(fakePeripheral);

    setTimeout(() => {
      stop();
      expect(callback).toHaveBeenCalled();
      expect(noble.startScanning).toHaveBeenCalled();
      expect(noble.stopScanning).toHaveBeenCalled();
      expect(noble.removeAllListeners).toHaveBeenCalledWith('discover');
      done();
    }, 1000);
  });
});
