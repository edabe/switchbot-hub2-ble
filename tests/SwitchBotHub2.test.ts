jest.mock('@abandonware/noble');

import noble from '@abandonware/noble';
import { SwitchBotHub2 } from '../src/SwitchBotHub2';
import { startSensorSampling } from '../src/Scanner';

const samples = [
  {
    hex: '6909c9165c55517800ff67ee84b98a048eab00',
    expected: { tempC: 14.4, humidity: 43, light: 10 }
  },
  {
    hex: '6909c9165c55517800ff67ee84b98a048fab00',
    expected: { tempC: 15.4, humidity: 43, light: 10 }
  },
  {
    hex: '6909c9165c55517800ff67ee84b98a048cab00',
    expected: { tempC: 12.4, humidity: 43, light: 10 }
  },
  {
    hex: '6909c9165c55517800ff67ef0bb0820891ad00',
    expected: { tempC: 17.8, humidity: 45, light: 2 }
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
    });
  }
});

describe('Sensor sampler cleanup (mocked noble)', () => {
  test('calls cleanup logic correctly', (done) => {
    const stop = startSensorSampling(() => {}, 10000, 1000);
    expect(typeof stop).toBe('function');

    setTimeout(() => {
      stop();
      expect(noble.stopScanning).toHaveBeenCalled();
      expect(noble.removeAllListeners).toHaveBeenCalledWith('discover');
      done();
    }, 1500);
  });
});
