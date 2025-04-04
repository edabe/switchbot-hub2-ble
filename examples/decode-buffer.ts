import { SwitchBotHub2, SwitchBotHub2Data } from '../src';

/**
 * This sample demonstrates how to use SwitchBotHub2 to decode
 * and consume a raw manufacturerData buffer.
 * 
 * To run:
 * npx ts-node examples/decode-buffer.ts
 */
// Sample BLE manufacturerData buffer (hex format)
const rawHex = '6909c9165c55517800ff67ee84b98a048eab00';
const buffer = Buffer.from(rawHex, 'hex');

// Consuming the decoded data
function logEnvironment(data: SwitchBotHub2Data) {
  console.log(`🌡️  ${data.temperatureC}°C | 💧 ${data.humidityPercent}% | 💡 ${data.lightLevel}`);
}

const data = SwitchBotHub2.decode(buffer);

if (data) {
  console.log('✅ Decoded sensor data:', data);
  logEnvironment(data);
} else {
  console.log('❌ Could not decode buffer.');
}
