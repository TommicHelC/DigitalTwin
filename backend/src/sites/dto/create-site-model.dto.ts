import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateSiteModelDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  apsUrn: string;

  @IsOptional()
  @IsString()
  description?: string;
}
