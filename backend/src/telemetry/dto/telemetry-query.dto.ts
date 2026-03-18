import { IsISO8601, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class TelemetryQueryDto {
  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;

  @IsOptional()
  @IsString()
  metrics?: string; // comma-separated: "temperature,setpoint"

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number = 500;
}

export interface TelemetryPoint {
  ts: number; // Unix ms
  metric: string;
  value: number;
}
