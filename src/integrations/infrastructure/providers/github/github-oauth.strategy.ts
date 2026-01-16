import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GitHubStrategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

/**
 * GitHub OAuth2 Strategy usando Passport.js
 *
 * Esta strategy se activa cuando se usa @UseGuards(AuthGuard('github'))
 *
 * Flow:
 * 1. Usuario visita /api/integrations/github/auth
 * 2. Passport redirige a GitHub OAuth
 * 3. Usuario autoriza en GitHub
 * 4. GitHub redirige a /api/integrations/github/callback con code
 * 5. Passport intercambia code por access_token automáticamente
 * 6. validate() se ejecuta con el token
 */
@Injectable()
export class GitHubOAuthStrategy extends PassportStrategy(GitHubStrategy, 'github') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL') || 
                   'https://geronimo-api.duckdns.org/api/integrations/github/callback',
      scope: ['repo', 'read:user'],
      // 'repo': Acceso completo a repos privados y públicos
      // 'read:user': Leer perfil del usuario
      passReqToCallback: true,  // Para acceder a req en validate()
    });
  }

  /**
   * Llamado por Passport después de recibir access_token de GitHub
   *
   * @param req - Request object (para acceder a query params como state)
   * @param accessToken - Token de acceso OAuth (válido por 1 año)
   * @param refreshToken - Token para renovar (GitHub no lo usa actualmente)
   * @param profile - Perfil del usuario de GitHub
   * @returns Objeto que se adjunta a req.user
   */
  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<any> {
    // Validación adicional si es necesario
    if (!accessToken) {
      throw new Error('No access token received from GitHub');
    }

    // Retornar datos que estarán disponibles en req.user
    return {
      accessToken,
      refreshToken: refreshToken || null,  // GitHub puede no proveer refresh token
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        avatarUrl: profile.photos?.[0]?.value,
      },
    };
  }
}
