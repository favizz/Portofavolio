import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RoutesModule } from './routes/routes.module';
import { StopsModule } from './stops/stops.module';
import { HeadwayModule } from './headway/headway.module';
import { CoverageModule } from './coverage/coverage.module';
import { NetworkModule } from './network/network.module';
import { AppController } from './app.controller';

@Module({
  imports: [DatabaseModule, RoutesModule, StopsModule, HeadwayModule, CoverageModule, NetworkModule],
  controllers: [AppController],
})
export class AppModule {}
