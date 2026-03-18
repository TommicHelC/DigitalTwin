import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Adres email użytkownika',
    example: 'admin@hellcold.pl',
  })
  @IsEmail({}, { message: 'Nieprawidłowy format adresu email' })
  email: string;

  @ApiProperty({
    description: 'Hasło użytkownika',
    example: 'SecurePassword123!',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Hasło musi mieć co najmniej 6 znaków' })
  password: string;
}
