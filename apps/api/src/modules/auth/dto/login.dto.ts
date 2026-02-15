import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  loginId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(100)
  password!: string;
}
