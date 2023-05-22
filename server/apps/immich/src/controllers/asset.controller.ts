import {
  AssetResponseDto,
  AssetService,
  AuthUserDto,
  MapMarkerResponseDto,
  TimeBucketAssetDto,
  TimeBucketDto,
  TimeBucketResponseDto,
} from '@app/domain';
import { MapMarkerDto } from '@app/domain';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetAuthUser } from '../decorators/auth-user.decorator';
import { Authenticated } from '../decorators/authenticated.decorator';
import { UseValidation } from '../decorators/use-validation.decorator';

@ApiTags('Asset')
@Controller('asset')
@Authenticated()
@UseValidation()
export class AssetController {
  constructor(private service: AssetService) {}

  @Get('map-marker')
  getMapMarkers(@GetAuthUser() authUser: AuthUserDto, @Query() options: MapMarkerDto): Promise<MapMarkerResponseDto[]> {
    return this.service.getMapMarkers(authUser, options);
  }

  @Get()
  getTimeBuckets(@GetAuthUser() authUser: AuthUserDto, @Query() dto: TimeBucketDto): Promise<TimeBucketResponseDto[]> {
    return this.service.getTimeBuckets(authUser, dto);
  }

  @Get('assets')
  getByTimeBucket(@GetAuthUser() authUser: AuthUserDto, @Query() dto: TimeBucketAssetDto): Promise<AssetResponseDto[]> {
    return this.service.getByTimeBucket(authUser, dto);
  }
}
