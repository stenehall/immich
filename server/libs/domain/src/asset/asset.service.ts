import { AssetEntity, AssetType } from '@app/infra/entities';
import { ForbiddenException, Inject } from '@nestjs/common';
import { AuthUserDto } from '../auth';
import { IAssetJob, IJobRepository, JobName } from '../job';
import { IPartnerRepository, PartnerCore } from '../partner';
import { AssetCore } from './asset.core';
import { IAssetRepository } from './asset.repository';
import { TimeBucketAssetDto, TimeBucketDto } from './dto';
import { MapMarkerDto } from './dto/map-marker.dto';
import { AssetResponseDto, mapAsset, MapMarkerResponseDto, TimeBucketResponseDto } from './response-dto';

export class AssetService {
  private assetCore: AssetCore;
  private partnerCore: PartnerCore;

  constructor(
    @Inject(IAssetRepository) private assetRepository: IAssetRepository,
    @Inject(IJobRepository) private jobRepository: IJobRepository,
    @Inject(IPartnerRepository) partnerRepository: IPartnerRepository,
  ) {
    this.assetCore = new AssetCore(assetRepository, jobRepository);
    this.partnerCore = new PartnerCore(partnerRepository);
  }

  async handleAssetUpload(data: IAssetJob) {
    await this.jobRepository.queue({ name: JobName.GENERATE_JPEG_THUMBNAIL, data });

    if (data.asset.type == AssetType.VIDEO) {
      await this.jobRepository.queue({ name: JobName.VIDEO_CONVERSION, data });
      await this.jobRepository.queue({ name: JobName.EXTRACT_VIDEO_METADATA, data });
    } else {
      await this.jobRepository.queue({ name: JobName.EXIF_EXTRACTION, data });
    }
  }

  save(asset: Partial<AssetEntity>) {
    return this.assetCore.save(asset);
  }

  getMapMarkers(authUser: AuthUserDto, options: MapMarkerDto): Promise<MapMarkerResponseDto[]> {
    return this.assetRepository.getMapMarkers(authUser.id, options);
  }

  async getTimeBuckets(authUser: AuthUserDto, dto: TimeBucketDto): Promise<TimeBucketResponseDto[]> {
    // TODO: shared link access
    const { userId, ...options } = dto;
    const targetId = userId || authUser.id;
    await this.checkUserAccess(authUser, targetId);
    return this.assetRepository.getTimeBuckets(targetId, options);
  }

  async getByTimeBucket(authUser: AuthUserDto, dto: TimeBucketAssetDto): Promise<AssetResponseDto[]> {
    // TODO: shared link access
    const { userId, timeBucket, ...options } = dto;
    const targetId = userId || authUser.id;
    await this.checkUserAccess(authUser, targetId);
    const assets = await this.assetRepository.getByTimeBucket(targetId, timeBucket, options);
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
