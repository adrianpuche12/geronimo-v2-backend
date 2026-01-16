import { Injectable, Logger } from "@nestjs/common";
import { CostTrackerService, BudgetStatus } from "./cost-tracker.service";

export interface AlertMessage {
  tenantId: string;
  type: "warning" | "critical" | "exceeded";
  title: string;
  message: string;
  currentSpend: number;
  budgetLimit: number;
  percentUsed: number;
  timestamp: Date;
}

@Injectable()
export class BudgetAlertService {
  private readonly logger = new Logger(BudgetAlertService.name);
  private readonly ALERT_COOLDOWN_HOURS = 4;

  constructor(private readonly costTrackerService: CostTrackerService) {}

  async checkAndAlert(tenantId: string): Promise<AlertMessage | null> {
    const status = await this.costTrackerService.getBudgetStatus(tenantId);

    if (!status.budget || !status.isNearThreshold) {
      return null;
    }

    // Check cooldown
    if (status.budget.last_alert_sent) {
      const hoursSinceLastAlert = 
        (Date.now() - status.budget.last_alert_sent.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastAlert < this.ALERT_COOLDOWN_HOURS) {
        this.logger.debug(
          "Alert cooldown active for tenant " + tenantId + 
          ". Hours remaining: " + (this.ALERT_COOLDOWN_HOURS - hoursSinceLastAlert).toFixed(1)
        );
        return null;
      }
    }

    const alert = this.buildAlertMessage(tenantId, status);
    await this.sendAlert(alert, status);

    return alert;
  }

  private buildAlertMessage(tenantId: string, status: BudgetStatus): AlertMessage {
    let type: "warning" | "critical" | "exceeded";
    let title: string;

    if (status.isOverBudget) {
      type = "exceeded";
      title = "Budget Exceeded";
    } else if (status.percentUsed >= 90) {
      type = "critical";
      title = "Budget Critical - 90% Used";
    } else {
      type = "warning";
      title = "Budget Warning - Threshold Reached";
    }

    const message = 
      "Tenant " + tenantId + " has used " + status.percentUsed.toFixed(1) + 
      "% of the monthly AI budget. " +
      "Current spend: $" + status.currentSpend.toFixed(2) + " / $" + 
      status.budget!.monthly_budget_usd.toFixed(2) + ". " +
      "Remaining: $" + status.remaining.toFixed(2);

    return {
      tenantId,
      type,
      title,
      message,
      currentSpend: status.currentSpend,
      budgetLimit: status.budget!.monthly_budget_usd,
      percentUsed: status.percentUsed,
      timestamp: new Date(),
    };
  }

  private async sendAlert(alert: AlertMessage, status: BudgetStatus): Promise<void> {
    const budget = status.budget!;

    // Send webhook alert
    if (budget.alert_webhook) {
      await this.sendWebhookAlert(budget.alert_webhook, alert);
    }

    // Send email alert (placeholder)
    if (budget.alert_email) {
      await this.sendEmailAlert(budget.alert_email, alert);
    }

    // Update last alert sent
    await this.costTrackerService.updateLastAlertSent(alert.tenantId);

    this.logger.log(
      "Budget alert sent for tenant " + alert.tenantId + 
      ": " + alert.type + " - " + alert.percentUsed.toFixed(1) + "% used"
    );
  }

  private async sendWebhookAlert(webhookUrl: string, alert: AlertMessage): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: "budget_alert",
          data: alert,
        }),
      });

      if (!response.ok) {
        this.logger.error("Webhook alert failed: " + response.statusText);
      } else {
        this.logger.debug("Webhook alert sent to " + webhookUrl);
      }
    } catch (error) {
      this.logger.error("Webhook alert error: " + error);
    }
  }

  private async sendEmailAlert(email: string, alert: AlertMessage): Promise<void> {
    // Placeholder for email implementation
    // In production, integrate with email service (SendGrid, SES, etc.)
    this.logger.debug(
      "Email alert placeholder - would send to " + email + 
      ": " + alert.title
    );
  }
}
