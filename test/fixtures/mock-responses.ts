/**
 * Respuestas mockeadas para tests
 */

import { GenerationResult, ResponseMode } from '../../src/ai/interfaces/llm-provider.interface';

export const mockResponses: Record<string, GenerationResult> = {
  groqSuccess: {
    answer: `**Authentication System Analysis**

[BASED ON YOUR DOCUMENTATION]:
- JWT tokens are used for authentication
- Access tokens last 15 minutes
- Refresh tokens last 7 days
- Login endpoint is /api/auth/login

[ARCHITECTURAL ANALYSIS]:
- Short-lived access tokens reduce security risk
- Refresh tokens allow seamless user experience
- HTTP-only cookies prevent XSS attacks

[EXPERT RECOMMENDATIONS]:
- Implement token blacklisting for logout
- Add rate limiting on auth endpoints
- Consider implementing MFA for sensitive operations`,
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    mode: 'expert' as ResponseMode,
    tokensUsed: 1122,
    responseTime: 1983,
  },

  openaiSuccess: {
    answer: `The authentication system uses JSON Web Tokens (JWT) for secure access control.

Key features:
- Two token types: Access (15min) and Refresh (7 days)
- Login flow validates credentials and generates tokens
- Protected routes require valid access token
- Token storage in HTTP-only cookies

This approach provides a good balance between security and usability.`,
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    mode: 'strict' as ResponseMode,
    tokensUsed: 890,
    responseTime: 3200,
  },

  ollamaSuccess: {
    answer: `Based on the documentation, authentication works as follows:

The system uses JWT tokens with two types:
1. Access tokens (15 minutes)
2. Refresh tokens (7 days)

Login process:
- Send credentials to /api/auth/login
- Server validates and generates tokens
- Tokens sent to client
- Client uses access token for protected routes`,
    provider: 'ollama',
    model: 'qwen2.5:7b',
    mode: 'enhanced' as ResponseMode,
    tokensUsed: 654,
    responseTime: 4500,
  },

  strictModeResponse: {
    answer: `According to the documentation:
- Access tokens have 15 minutes validity
- Refresh tokens have 7 days validity`,
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    mode: 'strict' as ResponseMode,
    tokensUsed: 45,
    responseTime: 800,
  },

  expertModeResponse: {
    answer: `**Expert Analysis of Authentication System**

[BASED ON YOUR DOCUMENTATION]:
The system implements JWT-based authentication with dual token approach.

[ARCHITECTURAL ANALYSIS]:
Strengths:
- Stateless authentication reduces server load
- Short-lived access tokens minimize exposure window
- HTTP-only cookies prevent XSS attacks

Weaknesses:
- No token revocation mechanism mentioned
- Potential for token replay attacks if not using HTTPS
- Missing information about token rotation strategy

[EXPERT RECOMMENDATIONS]:
1. Implement token blacklisting in Redis for immediate logout
2. Add token fingerprinting for additional security
3. Consider implementing refresh token rotation
4. Add rate limiting on authentication endpoints (10 req/min)
5. Monitor for suspicious authentication patterns`,
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    mode: 'expert' as ResponseMode,
    tokensUsed: 1850,
    responseTime: 2100,
  },

  noContextResponse: {
    answer: 'I did not find information about this in the provided documentation.',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    mode: 'strict' as ResponseMode,
    tokensUsed: 25,
    responseTime: 600,
  },
};

export default mockResponses;
