import { Module } from '@nestjs/common';
import { BbsController } from './bbs.controller';
import { BbsService } from './bbs.service';

@Module({
  controllers: [BbsController],
  providers: [BbsService]
})
export class BbsModule {}
