import {
  AssetResponseDto,
  AuthUserDto,
  TimeBucketAssetDto,
  TimeBucketDto,
  TimeBucketResponseDto,
  TimeBucketService,
} from '@app/domain';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetAuthUser } from '../decorators/auth-user.decorator';
import { Authenticated } from '../decorators/authenticated.decorator';
import { UseValidation } from '../decorators/use-validation.decorator';

@ApiTags('Time Bucket')
@Controller('time-bucket')
@Authenticated()
@UseValidation()
export class TimeBucketController {
  constructor(private service: TimeBucketService) {}

  @Get()
  getTimeBuckets(@GetAuthUser() authUser: AuthUserDto, @Query() dto: TimeBucketDto): Promise<TimeBucketResponseDto[]> {
    return this.service.getAll(authUser, dto);
  }

  @Get('assets')
  getByTimeBucket(@GetAuthUser() authUser: AuthUserDto, @Query() dto: TimeBucketAssetDto): Promise<AssetResponseDto[]> {
    return this.service.getAssets(authUser, dto);
  }
}
