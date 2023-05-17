import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { toBoolean } from '../../../../apps/immich/src/utils/transform.util';
import { TimeBucketSize } from '../asset';

export class TimeBucketDto {
  @IsNotEmpty()
  @IsEnum(TimeBucketSize)
  @ApiProperty({ enum: TimeBucketSize, enumName: 'TimeBucketSize' })
  size!: TimeBucketSize;

  @IsOptional()
  @IsUUID('4')
  @ApiProperty({ format: 'uuid' })
  userId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  isArchived?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  isFavorite?: boolean;
}

export class TimeBucketAssetDto extends TimeBucketDto {
  @IsString()
  @IsNotEmpty()
  timeBucket!: string;
}
