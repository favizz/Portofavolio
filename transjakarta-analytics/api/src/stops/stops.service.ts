import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class StopsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const { rows } = await this.db.query(
      `SELECT stop_id, stop_name, stop_lat, stop_lon, wheelchair_boarding FROM stops`
    );
    return rows;
  }

  async count() {
    const { rows } = await this.db.query(`SELECT count(*)::int AS count FROM stops`);
    return rows[0].count;
  }
}
