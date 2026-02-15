import { Transform } from 'class-transformer';
import {
  IsBoolean,
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

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  gr_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject!: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  admin_user_id?: number;

  @IsOptional()
  @IsBoolean()
  use_access?: boolean;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  order_no?: number;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  admin_user_id?: number | null;

  @IsOptional()
  @IsBoolean()
  use_access?: boolean;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  order_no?: number;
}

export class CreateBoardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  bo_table!: string;

  @Transform(toInt)
  @IsInt()
  group_id!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject!: string;
}

export class UpdateBoardPolicyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_list_level?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_read_level?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_write_level?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_reply_level?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_comment_level?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_upload_level?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_download_level?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_use_secret?: number;

  @IsOptional()
  @IsBoolean()
  bo_use_good?: boolean;

  @IsOptional()
  @IsBoolean()
  bo_use_nogood?: boolean;

  @IsOptional()
  @IsBoolean()
  bo_use_search?: boolean;

  @IsOptional()
  @IsBoolean()
  bo_use_category?: boolean;

  @IsOptional()
  @IsString()
  bo_category_list?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_reply_order?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_count_modify?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_count_delete?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_upload_count?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_upload_size?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_read_point?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_write_point?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_comment_point?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  bo_download_point?: number;
}
