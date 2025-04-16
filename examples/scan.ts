import { SwitchBotHub2, SwitchBotHub2Data } from '../src';

// Callback function
function logSensorData(data: SwitchBotHub2Data) {
  console.log('🔍 Sensor Data:', data);
}

// Add callback function to the listener array
SwitchBotHub2.on('data', logSensorData);

// Start scanning for advertisements
// - interval: The interval between scans
// - duration: The duration of each scan
SwitchBotHub2.startScanning({ interval: 2000, duration: 500 });

// Stop after 30 seconds and exit
setTimeout(() => {
  console.log('⏱️ Stopping sampling after 30 seconds...');
  // Stop scanning
  SwitchBotHub2.stopScanning();
  // Remove callback from the listener array
  SwitchBotHub2.removeListener('data', logSensorData);
  process.exit(0);
}, 60000);
