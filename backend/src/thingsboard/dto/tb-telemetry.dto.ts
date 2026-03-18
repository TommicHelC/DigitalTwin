export interface TbDevice {
  id: {
    id: string;
    entityType: string;
  };
  name: string;
  type: string;
  tenantId: {
    id: string;
  };
}

export interface TbDeviceCredentials {
  credentialsType: string;
  credentialsId: string; // device token for HTTP API
}

export interface TbAlarm {
  id: {
    id: string;
    entityType: string;
  };
  type: string;
  severity: string;
  status: string;
  originator: {
    id: string;
    entityType: string;
  };
  details: Record<string, unknown>;
  createdTime: number;
}

export interface TbTelemetryValue {
  ts: number;
  value: string;
}

export type TbTelemetryResponse = Record<string, TbTelemetryValue[]>;
