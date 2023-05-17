import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AssetResponseDto, IAssetRepository, mapAsset } from '../asset';
import { AuthUserDto } from '../auth';
import { IPartnerRepository, PartnerCore } from '../partner';
import { TimeBucketResponseDto } from './time-bucket-response.dto';
import { TimeBucketAssetDto, TimeBucketDto } from './time-bucket.dto';

@Injectable()
export class TimeBucketService {
  private partnerCore: PartnerCore;

  constructor(
    @Inject(IAssetRepository) private repository: IAssetRepository,
    @Inject(IPartnerRepository) partnerRepository: IPartnerRepository,
  ) {
    this.partnerCore = new PartnerCore(partnerRepository);
  }

  async getAll(authUser: AuthUserDto, dto: TimeBucketDto): Promise<TimeBucketResponseDto[]> {
    const { userId, ...options } = dto;
    const targetId = userId || authUser.id;
    await this.checkUserAccess(authUser, targetId);
    return this.repository.getTimeBuckets(targetId, options);
  }

  async getAssets(authUser: AuthUserDto, dto: TimeBucketAssetDto): Promise<AssetResponseDto[]> {
    const { userId, timeBucket, ...options } = dto;
    const targetId = userId || authUser.id;
    await this.checkUserAccess(authUser, targetId);
    const assets = await this.repository.getByTimeBucket(targetId, timeBucket, options);
    return assets.map(mapAsset);
  }

  private async checkUserAccess(authUser: AuthUserDto, userId: string) {
    if (userId === authUser.id) {
      return;
    }

    // Check if userId shares assets with authUser
    if (!(await this.partnerCore.get({ sharedById: userId, sharedWithId: authUser.id }))) {
      throw new ForbiddenException();
    }
  }
}
