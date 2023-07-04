import { AssetType } from '@app/infra/entities';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { IAssetRepository, WithoutProperty } from '../asset';
import { usePagination } from '../domain.util';
import { IBaseJob, IEntityJob, IJobRepository, JobName, JOBS_ASSET_PAGINATION_SIZE } from '../job';
import { IStorageRepository, StorageCore, StorageFolder } from '../storage';
import { JPEG_THUMBNAIL_SIZE, WEBP_THUMBNAIL_SIZE } from './thumbnail.constant';
import { IThumbnailRepository } from './thumbnail.repository';

@Injectable()
export class ThumbnailService {
  private logger = new Logger(ThumbnailService.name);
  private storageCore = new StorageCore();

  constructor(
    @Inject(IAssetRepository) private assetRepository: IAssetRepository,
    @Inject(IJobRepository) private jobRepository: IJobRepository,
    @Inject(IThumbnailRepository) private mediaRepository: IThumbnailRepository,
    @Inject(IStorageRepository) private storageRepository: IStorageRepository,
  ) {}

  async handleQueueGenerateThumbnails(job: IBaseJob) {
    const { force } = job;

    const assetPagination = usePagination(JOBS_ASSET_PAGINATION_SIZE, (pagination) => {
      return force
        ? this.assetRepository.getAll(pagination)
        : this.assetRepository.getWithout(pagination, WithoutProperty.THUMBNAIL);
    });

    for await (const assets of assetPagination) {
      for (const asset of assets) {
        if (!asset.resizePath || force) {
          await this.jobRepository.queue({ name: JobName.GENERATE_JPEG_THUMBNAIL, data: { id: asset.id } });
          continue;
        }
        if (!asset.webpPath) {
          await this.jobRepository.queue({ name: JobName.GENERATE_WEBP_THUMBNAIL, data: { id: asset.id } });
        }
        if (!asset.thumbhash) {
          await this.jobRepository.queue({ name: JobName.GENERATE_THUMBHASH_THUMBNAIL, data: { id: asset.id } });
        }
      }
    }

    return true;
  }

  async handleGenerateJpegThumbnail({ id }: IEntityJob) {
    const [asset] = await this.assetRepository.getByIds([id]);
    if (!asset) {
      return false;
    }

    const resizePath = this.storageCore.getFolderLocation(StorageFolder.THUMBNAILS, asset.ownerId);
    this.storageRepository.mkdirSync(resizePath);
    const jpegThumbnailPath = join(resizePath, `${asset.id}.jpeg`);

    switch (asset.type) {
      case AssetType.IMAGE:
        await this.mediaRepository.resize(asset.originalPath, jpegThumbnailPath, {
          size: JPEG_THUMBNAIL_SIZE,
          format: 'jpeg',
        });
        break;
      case AssetType.VIDEO:
        this.logger.log('Generating video thumbnail');
        await this.mediaRepository.extractVideoThumbnail(asset.originalPath, jpegThumbnailPath, JPEG_THUMBNAIL_SIZE);
        this.logger.log(`Successfully generated video thumbnail ${asset.id}`);
        break;
    }

    await this.assetRepository.save({ id: asset.id, resizePath: jpegThumbnailPath });

    return true;
  }

  async handleGenerateWepbThumbnail({ id }: IEntityJob) {
    const [asset] = await this.assetRepository.getByIds([id]);
    if (!asset || !asset.resizePath) {
      return false;
    }

    const webpPath = asset.resizePath.replace('jpeg', 'webp');

    await this.mediaRepository.resize(asset.resizePath, webpPath, { size: WEBP_THUMBNAIL_SIZE, format: 'webp' });
    await this.assetRepository.save({ id: asset.id, webpPath: webpPath });

    return true;
  }

  async handleGenerateThumbhashThumbnail({ id }: IEntityJob): Promise<boolean> {
    const [asset] = await this.assetRepository.getByIds([id]);
    if (!asset?.resizePath) {
      return false;
    }

    const thumbhash = await this.mediaRepository.generateThumbhash(asset.resizePath);
    await this.assetRepository.save({ id: asset.id, thumbhash });

    return true;
  }
}
