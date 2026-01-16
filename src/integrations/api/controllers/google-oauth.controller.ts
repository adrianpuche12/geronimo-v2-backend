import { Controller, Get, Query, Req, Res, UseGuards, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";
import { OAuthService } from "../../infrastructure/services/oauth.service";
import { ActiveIntegrationRepository } from "../../domain/repositories/active-integration.repository";
import { IntegrationCatalogRepository } from "../../domain/repositories/integration-catalog.repository";

@Controller("api/integrations")
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name);

  constructor(
    private oauthService: OAuthService,
    private activeIntegrationRepo: ActiveIntegrationRepository,
    private catalogRepo: IntegrationCatalogRepository,
  ) {}

  @Get("gmail/auth")
  @UseGuards(AuthGuard("google"))
  async initiateGmailOAuth(@Query("tenantId") tenantId: string) {}

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    try {
      const user = req.user;
      const tenantId = "default_001";
      const tenantSchema = "tenant_default_001";

      const { encrypted, iv } = this.oauthService.encryptTokens({
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
        expiresAt: user.expiresAt,
      });

      const existing = await this.activeIntegrationRepo.findByTenantAndIntegrationId(
        tenantSchema,
        "int-004",
      );

      if (existing) {
        existing.encryptedConfig = encrypted;
        existing.encryptionIv = iv;
        existing.enabled = true;
        existing.metadata = { ...existing.metadata, googleEmail: user.profile.email };
        await this.activeIntegrationRepo.save(existing);
      } else {
        await this.activeIntegrationRepo.query("SET search_path TO " + tenantSchema);
        await this.activeIntegrationRepo.save({
          integrationId: "int-004",
          enabled: true,
          encryptedConfig: encrypted,
          encryptionIv: iv,
          syncStatus: "pending",
          metadata: { googleEmail: user.profile.email, labels: ["INBOX"] },
        } as any);
      }

      return res.status(200).json({
        success: true,
        message: "Gmail conectado exitosamente",
        email: user.profile.email,
        tenantId,
      });
    } catch (error) {
      this.logger.error("Gmail OAuth error: " + error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
