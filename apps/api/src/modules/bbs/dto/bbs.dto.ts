import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

const toInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export class BoardQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  wr_id?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  page?: number;

  @IsOptional()
  @IsString()
  sca?: string;

  @IsOptional()
  @IsString()
  sfl?: string;

  @IsOptional()
  @IsString()
  stx?: string;

  @IsOptional()
  @IsString()
  @IsIn(['and', 'or'])
  sop?: string;

  @IsOptional()
  @IsString()
  sst?: string;

  @IsOptional()
  @IsString()
  sod?: string;
}

export class WriteTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;
}

export class WriteQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['', 'u', 'r'])
  w?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  wr_id?: number;
}

export class WriteUpdateDto {
  @IsOptional()
  @IsString()
  @IsIn(['', 'u', 'r'])
  w?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @IsString()
  token!: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  wr_id?: number;

  @IsOptional()
  @IsString()
  ca_name?: string;

  @IsOptional()
  @IsString()
  wr_subject?: string;

  @IsOptional()
  @IsString()
  wr_content?: string;

  @IsOptional()
  @IsString()
  wr_link1?: string;

  @IsOptional()
  @IsString()
  wr_link2?: string;

  @IsOptional()
  @IsString()
  wr_name?: string;

  @IsOptional()
  @IsString()
  wr_email?: string;

  @IsOptional()
  @IsString()
  wr_homepage?: string;

  @IsOptional()
  @IsString()
  wr_password?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsString()
  mail?: string;

  @IsOptional()
  @IsString()
  notice?: string;

  @IsOptional()
  @IsString()
  bf_content?: string;
}

export class WriteCommentUpdateDto {
  @IsString()
  @IsIn(['c', 'cu'])
  w!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @Transform(toInt)
  @IsInt()
  wr_id!: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  comment_id?: number;

  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  wr_content?: string;

  @IsOptional()
  @IsString()
  wr_name?: string;

  @IsOptional()
  @IsString()
  wr_password?: string;

  @IsOptional()
  @IsString()
  wr_secret?: string;

  @IsOptional()
  @IsString()
  wr_email?: string;

  @IsOptional()
  @IsString()
  wr_homepage?: string;
}

export class GoodDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @Transform(toInt)
  @IsInt()
  wr_id!: number;

  @IsString()
  @IsIn(['good', 'nogood'])
  good!: string;
}

export class DeleteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @Transform(toInt)
  @IsInt()
  wr_id!: number;

  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  wr_password?: string;
}

export class DeleteCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @Transform(toInt)
  @IsInt()
  comment_id!: number;

  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  wr_password?: string;
}

export class PasswordCheckDto {
  @IsString()
  @IsIn(['s', 'sc'])
  w!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @Transform(toInt)
  @IsInt()
  wr_id!: number;

  @IsString()
  wr_password!: string;
}

export class PasswordQueryDto {
  @IsString()
  @IsIn(['u', 'd', 'x', 's', 'sc'])
  w!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  wr_id?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  comment_id?: number;
}

export class DownloadQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @Transform(toInt)
  @IsInt()
  wr_id!: number;

  @Transform(toInt)
  @IsInt()
  no!: number;

  @IsOptional()
  @IsString()
  nonce?: string;

  @IsOptional()
  @IsString()
  js?: string;
}

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  gr_id?: string;

  @IsOptional()
  @IsString()
  onetable?: string;

  @IsOptional()
  @IsString()
  sfl?: string;

  @IsOptional()
  @IsString()
  stx?: string;

  @IsOptional()
  @IsString()
  @IsIn(['and', 'or'])
  sop?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  page?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  srows?: number;
}
