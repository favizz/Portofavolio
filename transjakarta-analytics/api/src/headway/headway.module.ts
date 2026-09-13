import { Module } from '@nestjs/common';
import { HeadwayController } from './headway.controller';
import { HeadwayService } from './headway.service';

@Module({
  controllers: [HeadwayController],
  providers: [HeadwayService],
})
export class HeadwayModule {}
