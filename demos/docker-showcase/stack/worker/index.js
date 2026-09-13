// Anomaly-detection worker: blocking-pops jobs off the shared Redis queue
// and runs the same style of rolling/threshold rule set as the Go WASM
// demo elsewhere in this portfolio. Runs as 2 replicas (see
// docker-compose.yml) - safe because BLPOP hands each job to exactly one
// worker, so scaling out is just "add more replicas," no coordination code.
import pkg from 'pg';
import Redis from 'ioredis';

const { Pool } = pkg;

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

const VOLTAGE_LOW = 200;
const VOLTAGE_HIGH = 240;

function detectAnomalies(reading) {
  const anomalies = [];
  if (reading.voltage < VOLTAGE_LOW || reading.voltage > VOLTAGE_HIGH) {
    anomalies.push('voltage_out_of_range');
  }
  return anomalies;
}

async function loop() {
  while (true) {
    const result = await redis.blpop('anomaly-queue', 0);
    const job = JSON.parse(result[1]);
    const anomalies = detectAnomalies(job);

    if (anomalies.length > 0) {
      await db.query(
        'INSERT INTO anomalies (meter_id, kinds, detected_at) VALUES ($1, $2, NOW())',
        [job.meterId, anomalies]
      );
      console.log(`anomaly on meter ${job.meterId}:`, anomalies);
    }
  }
}

loop().catch((err) => {
  console.error('worker crashed:', err);
  process.exit(1);
});
