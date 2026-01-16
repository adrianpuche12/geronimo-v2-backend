import { Module } from '@nestjs/common';
import { ChromaDBService } from './chromadb.service';

@Module({
  providers: [ChromaDBService],
  exports: [ChromaDBService],
})
export class ChromaDBModule {}
