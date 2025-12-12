import { Module } from '@nestjs/common';
import { SecretsDetectorService } from './secrets-detector.service';

@Module({
  providers: [SecretsDetectorService],
  exports: [SecretsDetectorService],
})
export class SecurityModule {}
