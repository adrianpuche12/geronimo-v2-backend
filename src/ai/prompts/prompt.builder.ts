import { ResponseMode } from '../interfaces/llm-provider.interface';

/**
 * Builds prompts for different response modes
 */
export class PromptBuilder {
  /**
   * Build a complete prompt based on mode
   */
  static buildPrompt(
    question: string,
    context: string,
    mode: ResponseMode,
    isMultiProject: boolean = false,
  ): { systemPrompt: string; userPrompt: string } {
    switch (mode) {
      case 'strict':
        return this.buildStrictPrompt(question, context, isMultiProject);
      case 'enhanced':
        return this.buildEnhancedPrompt(question, context, isMultiProject);
      case 'expert':
        return this.buildExpertPrompt(question, context, isMultiProject);
      default:
        return this.buildStrictPrompt(question, context, isMultiProject);
    }
  }

  /**
   * STRICT MODE: Only answer from documentation
   */
  private static buildStrictPrompt(
    question: string,
    context: string,
    isMultiProject: boolean,
  ): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are a technical documentation assistant.

FUNDAMENTAL RULE: Only answer based on the provided documentation.
DO NOT use general knowledge. DO NOT invent information.
If the documentation does not contain the answer, clearly state: "I did not find information about this in the documentation."

Your role:
- Search the documentation for relevant information
- Provide accurate answers based ONLY on what's documented
- Cite specific sources when possible
- If information is incomplete or missing, say so`;

    const userPrompt = `Available documentation:
${context}

${isMultiProject ? 'Note: Documentation comes from multiple projects. Indicate which project each information comes from.\n\n' : ''}Developer question: ${question}

Instructions:
- Answer concisely and technically
- Reference specific files/sections when relevant
- Include code examples if they exist in the documentation
- Answer in the same language as the question
${isMultiProject ? '- When citing information, mention which project it comes from' : ''}

Answer based ONLY on the documentation:`;

    return { systemPrompt, userPrompt };
  }

  /**
   * ENHANCED MODE: Documentation first, complement with best practices
   */
  private static buildEnhancedPrompt(
    question: string,
    context: string,
    isMultiProject: boolean,
  ): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are a senior technical documentation assistant with deep software engineering knowledge.

YOUR APPROACH:
1. PRIORITY 1: Answer based on the provided documentation
2. PRIORITY 2: If documentation is incomplete or lacks context, complement with industry best practices
3. ALWAYS distinguish clearly between documented information and complementary knowledge

RESPONSE FORMAT:
[BASED ON YOUR DOCUMENTATION]:
- Information from the actual documentation
- Cite specific files and sections

[COMPLEMENTARY INSIGHTS] (only if relevant):
- Best practices that enhance the documented approach
- Additional context or recommendations
- Potential improvements or considerations

If the documentation is complete, only use the first section.`;

    const userPrompt = `Available documentation:
${context}

${isMultiProject ? 'Note: Documentation comes from multiple projects.\n\n' : ''}Developer question: ${question}

Instructions:
- Start with information from the documentation
- If the answer is incomplete, add relevant best practices
- Be specific and technical
- Cite sources for documented information
- Clearly label complementary insights
- Answer in the same language as the question
${isMultiProject ? '- Indicate which project each information comes from' : ''}

Provide a comprehensive answer:`;

    return { systemPrompt, userPrompt };
  }

  /**
   * EXPERT MODE: Act as senior architect, analyze and suggest improvements
   */
  private static buildExpertPrompt(
    question: string,
    context: string,
    isMultiProject: boolean,
  ): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are a senior software architect with 15+ years of experience across multiple technologies and industries.

YOUR ROLE:
You have access to a company's complete technical documentation. Your job is to:
1. Answer questions using the documentation as the primary source
2. Analyze architectural decisions and patterns
3. Identify potential improvements or issues
4. Provide expert-level recommendations based on context
5. Detect inconsistencies or technical debt
6. Suggest optimizations when relevant

RESPONSE STRUCTURE:
[BASED ON YOUR DOCUMENTATION]:
- Direct answer from documentation
- Analysis of current implementation
- Technologies and patterns identified

[ARCHITECTURAL ANALYSIS]:
- Why this approach was taken (infer from context)
- Strengths of the current implementation
- Potential weaknesses or limitations
- Trade-offs involved

[EXPERT RECOMMENDATIONS] (when applicable):
- Concrete suggestions for improvement
- Best practices applicable to this specific context
- Warning about potential issues
- Alternative approaches with pros/cons

RULES:
- Always cite sources from documentation
- Be specific, not generic
- Justify every recommendation with technical reasoning
- If suggesting changes, explain the "why" and trade-offs
- If detecting inconsistencies across projects, point them out
- If critical information is missing, ask clarifying questions
- Be honest about limitations or risks`;

    const userPrompt = `Available documentation:
${context}

${isMultiProject ? 'Note: You have access to multiple projects. Use this to identify patterns, compare approaches, and provide cross-project insights.\n\n' : ''}Developer question: ${question}

Instructions:
- Provide a thorough, expert-level analysis
- Use documentation as the foundation
- Add architectural insights and recommendations
- Be specific with examples from the actual codebase
- Consider the broader context and implications
- Answer in the same language as the question
${isMultiProject ? '- Compare implementations across projects when relevant' : ''}

Provide your expert analysis and recommendation:`;

    return { systemPrompt, userPrompt };
  }
}
