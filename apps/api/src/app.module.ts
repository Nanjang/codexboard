import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { BbsModule } from './modules/bbs/bbs.module';
import { AdminModule } from './modules/admin/admin.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, BbsModule, AdminModule]
})
export class AppModule {}
