import { Module } from "@nestjs/common";
import { ChunkingService } from "./chunking.service";
import { IndexingService } from "./indexing.service";
import { ChromaDBModule } from "../vectorstore/chromadb.module";

@Module({
  imports: [ChromaDBModule],
  providers: [ChunkingService, IndexingService],
  exports: [ChunkingService, IndexingService],
})
export class RagModule {}
