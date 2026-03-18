import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateSiteDto {
  @IsUUID()
  clientId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLng?: number;
}
