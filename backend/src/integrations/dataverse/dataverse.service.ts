import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientSecretCredential } from '@azure/identity';

@Injectable()
export class DataverseService {
  private readonly logger = new Logger(DataverseService.name);
  private credential: ClientSecretCredential;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly config: ConfigService) {
    this.credential = new ClientSecretCredential(
      this.config.get<string>('AZURE_TENANT_ID', ''),
      this.config.get<string>('AZURE_CLIENT_ID', ''),
      this.config.get<string>('AZURE_CLIENT_SECRET', ''),
    );
  }

  get orgUri(): string {
    return this.config.get<string>('D365_ORG_URI', '');
  }

  async getBearerToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const scope = `${this.orgUri}/.default`;
    const tokenResponse = await this.credential.getToken(scope);

    this.cachedToken = tokenResponse.token;
    // Azure tokens are valid for ~1h; cache for 55 min
    this.tokenExpiresAt = Date.now() + 55 * 60 * 1000;
    this.logger.debug('Dataverse Bearer token refreshed');
    return this.cachedToken;
  }

  buildHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    };
  }
}
