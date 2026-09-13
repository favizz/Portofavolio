// Ingest API: receives telemetry over MQTT, writes raw readings to
// Postgres, and enqueues an anomaly-detection job on Redis for the worker
// service to pick up. Kept deliberately thin - detection logic lives in
// worker/, not here, so the ingest path stays fast under load.
import express from 'express';
import pkg from 'pg';
import Redis from 'ioredis';
import mqtt from 'mqtt';

const { Pool } = pkg;

const app = express();
app.use(express.json());

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);
const mqttClient = mqtt.connect(process.env.MQTT_URL);

mqttClient.on('connect', () => {
  mqttClient.subscribe('meters/+/telemetry');
});

mqttClient.on('message', async (topic, payload) => {
  const meterId = topic.split('/')[1];
  const reading = JSON.parse(payload.toString());

  await db.query(
    'INSERT INTO readings (meter_id, voltage, flow, recorded_at) VALUES ($1, $2, $3, NOW())',
    [meterId, reading.voltage, reading.flow]
  );

  await redis.lpush('anomaly-queue', JSON.stringify({ meterId, ...reading }));
});

app.get('/readings/:meterId', async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM readings WHERE meter_id = $1 ORDER BY recorded_at DESC LIMIT 100',
    [req.params.meterId]
  );
  res.json(rows);
});

app.listen(3000, () => console.log('telemetry-api listening on :3000'));
