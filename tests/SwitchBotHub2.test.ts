/** ------------------------------------------------------------------------------------
    MOCKING BLE LIBRARY (IMPORTANT)

    We mock @abandonware/noble inline instead of using a __mocks__ folder for 3 reasons:

    1. Native bindings in noble (via bluetooth-hci-socket) crash in headless environments
       like GitHub Actions. Jest loads the real module before applying __mocks__, which
       results in EAFNOSUPPORT or "Address family not supported by protocol" errors.

    2. Inline mocking ensures that the mock is applied BEFORE the import happens.
       This avoids ever loading native BLE code, even indirectly.

    3. The mock includes all BLE methods used in Scanner.ts, so we can safely
       unit test sensor sampling logic without accessing hardware.
    ------------------------------------------------------------------------------------ */
jest.mock('@abandonware/noble', () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    startScanning: jest.fn(),
    stopScanning: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn()
  }
}));

import nobleImport from '@abandonware/noble';
const noble = nobleImport as unknown as {
  on: jest.Mock;
  startScanning: jest.Mock;
  stopScanning: jest.Mock;
  removeListener: jest.Mock;
  removeAllListeners: jest.Mock;
};

import { SwitchBotHub2, SwitchBotHub2Data } from '../src/SwitchBotHub2';

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

describe('SwitchBotHub2.startScanning default parameter', () => {
  let originalSetInterval: typeof setInterval;
  let originalSampleAdvertisements: typeof SwitchBotHub2['sampleAdvertisements'];
  let originalIsNoblePoweredOn: boolean
  beforeEach(() => {
    originalSetInterval = global.setInterval;
    global.setInterval = jest.spyOn(global, 'setInterval') as unknown as typeof setInterval;
    originalSampleAdvertisements = SwitchBotHub2['sampleAdvertisements'];
    SwitchBotHub2['sampleAdvertisements'] = jest.fn();
    originalIsNoblePoweredOn = SwitchBotHub2['isNoblePoweredOn'];
    SwitchBotHub2['isNoblePoweredOn'] = true;
  });
  afterEach(() => {
    global.setInterval = originalSetInterval;
    SwitchBotHub2['sampleAdvertisements'] = originalSampleAdvertisements;
    SwitchBotHub2['isNoblePoweredOn'] = originalIsNoblePoweredOn;
  });
  test('startScanning should accept no arguments', () => {
    const options = SwitchBotHub2['defaultOptions'];
    SwitchBotHub2.startScanning();
    expect(setInterval).toHaveBeenCalledWith(SwitchBotHub2['sampleAdvertisements'], options.interval, options.duration);
    SwitchBotHub2.stopScanning();
  });
  test('startScanning should accept custom options', () => {
    const options = { interval: 10000, duration: 100 };
    SwitchBotHub2.startScanning(options);
    expect(setInterval).toHaveBeenCalledWith(SwitchBotHub2['sampleAdvertisements'], options.interval, options.duration);
    SwitchBotHub2.stopScanning();
  });
});

describe('Sensor sampler (mocked noble)', () => {
  test('triggers scanning on stateChange and handles discover', (done) => {
    const callback = jest.fn();

    SwitchBotHub2.on('data', callback);
    SwitchBotHub2.startScanning({ interval: 10000, duration: 500 });

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
      SwitchBotHub2.stopScanning();
      expect(callback).toHaveBeenCalled();
      expect(noble.startScanning).toHaveBeenCalled();
      expect(noble.stopScanning).toHaveBeenCalled();
      expect(noble.removeListener).toHaveBeenCalledWith('discover', expect.any(Function));
      done();
    }, 1000);
  });
});
