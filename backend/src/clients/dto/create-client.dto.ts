import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  subscriptionTier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tbTenantId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
