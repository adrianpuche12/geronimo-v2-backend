import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: 'http://62.171.160.238:8095/realms/Geronimo/protocol/openid-connect/certs',
      }),
      issuer: 'http://62.171.160.238:8095/realms/Geronimo',
      audience: 'account',
    });
  }

  async validate(payload: any) {
    // Extraer roles de Keycloak
    const realmRoles = payload.realm_access?.roles || [];
    const isAdmin = realmRoles.includes('admin');

    return {
      userId: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      roles: realmRoles,
      isAdmin,
    };
  }
}
