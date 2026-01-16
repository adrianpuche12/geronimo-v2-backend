import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from "passport-google-oauth20";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(GoogleStrategy, "google") {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>("GOOGLE_CLIENT_ID") || "",
      clientSecret: configService.get<string>("GOOGLE_CLIENT_SECRET") || "",
      callbackURL: configService.get<string>("GOOGLE_GMAIL_CALLBACK_URL") || "https://geronimo-n8n.duckdns.org/api/integrations/google/callback",
      scope: [
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      accessType: "offline",
      prompt: "consent",
    } as any);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    if (!accessToken) {
      return done(new Error("No access token received from Google"), null);
    }

    if (!refreshToken) {
      console.warn("⚠️  No refresh token received (user already authorized before)");
    }

    const user = {
      accessToken,
      refreshToken: refreshToken || null,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      profile: {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        displayName: profile.displayName,
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        photo: profile.photos?.[0]?.value,
      },
    };

    done(null, user);
  }
}
