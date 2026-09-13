import { Controller, Get, Post } from '@nestjs/common';
import { HeadwayService } from './headway.service';

@Controller('headway')
export class HeadwayController {
  constructor(private readonly headway: HeadwayService) {}

  @Get('summary')
  summary() {
    return this.headway.summary();
  }

  @Post('compute')
  recompute() {
    return this.headway.recompute();
  }
}
