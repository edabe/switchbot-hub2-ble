import { startSensorSampling } from '../src';

const stopSampling = startSensorSampling((data) => {
  console.log('🔍 Sensor Data:', data);
}, 15000); // Scan every 15s

// Stop after 30 seconds and exit
setTimeout(() => {
  console.log('⏱️ Stopping sampling after 30 seconds...');
  stopSampling();
  process.exit(0);
}, 30000);
