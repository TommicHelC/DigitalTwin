import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DataverseService } from './dataverse.service';
import { Alert } from '../../alerts/entities/alert.entity';
import { Device } from '../../devices/entities/device.entity';
import { Client } from '../../clients/entities/client.entity';

export interface D365Case {
  incidentid: string;
  title: string;
  statecode: number;
  createdon: string;
}

@Injectable()
export class CaseService {
  private readonly logger = new Logger(CaseService.name);

  constructor(private readonly dataverseService: DataverseService) {}

  async createCase(alert: Alert, device: Device, client: Client): Promise<string> {
    const token = await this.dataverseService.getBearerToken();
    const headers = this.dataverseService.buildHeaders(token);

    const payload = {
      title: `[HVAC Alert] ${alert.severity.toUpperCase()}: ${device.name}`,
      description: [
        `Device: ${device.name}`,
        `Site: ${device.site?.name ?? 'Unknown'}`,
        `Message: ${alert.message}`,
        `Timestamp: ${alert.createdAt?.toISOString() ?? new Date().toISOString()}`,
      ].join('\n'),
      prioritycode: alert.severity === 'critical' ? 1 : 2,
    };

    const url = `${this.dataverseService.orgUri}/api/data/v9.2/incidents`;

    try {
      const response = await axios.post<{ incidentid: string }>(url, payload, { headers });
      const caseId = response.data.incidentid;
      this.logger.log(`Created D365 case ${caseId} for alert ${alert.id}`);
      return caseId;
    } catch (err) {
      this.logger.error(`Failed to create D365 case for alert ${alert.id}: ${(err as Error).message}`);
      throw err;
    }
  }

  async getCasesByDeviceId(daikinDeviceId: string): Promise<D365Case[]> {
    const token = await this.dataverseService.getBearerToken();
    const headers = this.dataverseService.buildHeaders(token);

    const filter = encodeURIComponent(`contains(description,'${daikinDeviceId}')`);
    const select = 'incidentid,title,statecode,createdon';
    const url = `${this.dataverseService.orgUri}/api/data/v9.2/incidents?$filter=${filter}&$select=${select}`;

    try {
      const response = await axios.get<{ value: D365Case[] }>(url, { headers });
      return response.data.value ?? [];
    } catch (err) {
      this.logger.warn(`Failed to get D365 cases for device ${daikinDeviceId}: ${(err as Error).message}`);
      return [];
    }
  }
}
