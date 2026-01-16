import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OpenAIProvider } from "./providers/openai.provider";
import { GroqProvider } from "./providers/groq.provider";
import { OllamaProvider } from "./providers/ollama.provider";
import { AIFactory } from "./ai.factory";
import { ChromaDBModule } from "./vectorstore/chromadb.module";
import { RagModule } from "./rag/rag.module";
import { ControlModule } from "./control/control.module";

@Module({
  imports: [
    ConfigModule,
    ChromaDBModule,
    RagModule,
    ControlModule,
  ],
  providers: [
    OpenAIProvider,
    GroqProvider,
    OllamaProvider,
    AIFactory,
  ],
  exports: [
    AIFactory,
    OpenAIProvider,
    GroqProvider,
    OllamaProvider,
    ChromaDBModule,
    RagModule,
    ControlModule,
  ],
})
export class AiModule {}
