import {
  IsString,
  IsUUID,
  IsIn,
  IsOptional,
  IsInt,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { DeviceType } from '../entities/device.entity';

const DEVICE_TYPES: DeviceType[] = [
  'DaikinSplit',
  'DaikinVRV',
  'ModbusSensor',
  'BACnetNode',
  'AirHandlingUnit',
  'EnergyMeter',
];

export class CreateDeviceDto {
  @IsUUID()
  siteId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsIn(DEVICE_TYPES)
  type: DeviceType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tbDeviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  daikinDeviceId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  apsObjectId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
