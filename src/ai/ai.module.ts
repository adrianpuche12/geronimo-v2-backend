import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OpenAIProvider } from "./providers/openai.provider";
import { GroqProvider } from "./providers/groq.provider";
import { OllamaProvider } from "./providers/ollama.provider";
import { AIFactory } from "./ai.factory";
import { ChromaDBModule } from "./vectorstore/chromadb.module";
import { ChromaDBService } from "./vectorstore/chromadb.service";
import { RagModule } from "./rag/rag.module";

@Module({
  imports: [
    ConfigModule,
    ChromaDBModule,
    RagModule,
  ],
  providers: [
    // AI Providers
    OpenAIProvider,
    GroqProvider,
    OllamaProvider,
    // AI Factory (main orchestrator)
    AIFactory,
  ],
  exports: [
    // Export factory (primary interface)
    AIFactory,
    // Export individual providers (if needed directly)
    OpenAIProvider,
    GroqProvider,
    OllamaProvider,
    // Export ChromaDB for vector operations
    ChromaDBModule,
    // Export RAG module
    RagModule,
  ],
})
export class AiModule {}
