import {
  AssetSearchOptions,
  IAssetRepository,
  LivePhotoSearchOptions,
  MapMarker,
  MapMarkerSearchOptions,
  TimeBucketItem,
  TimeBucketOptions,
  TimeBucketSize,
  WithoutProperty,
} from '@app/domain';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, FindOptionsWhere, In, IsNull, Not, Repository } from 'typeorm';
import { AssetEntity, AssetType } from '../entities';

const truncateMap: Record<TimeBucketSize, string> = {
  [TimeBucketSize.DAY]: 'day',
  [TimeBucketSize.MONTH]: 'month',
};

@Injectable()
export class AssetRepository implements IAssetRepository {
  constructor(@InjectRepository(AssetEntity) private repository: Repository<AssetEntity>) {}

  getByIds(ids: string[]): Promise<AssetEntity[]> {
    return this.repository.find({
      where: { id: In(ids) },
      relations: {
        exifInfo: true,
        smartInfo: true,
        tags: true,
      },
    });
  }
  async deleteAll(ownerId: string): Promise<void> {
    await this.repository.delete({ ownerId });
  }

  getAll(options?: AssetSearchOptions | undefined): Promise<AssetEntity[]> {
    options = options || {};

    return this.repository.find({
      where: {
        isVisible: options.isVisible,
        type: options.type,
      },
      relations: {
        exifInfo: true,
        smartInfo: true,
        tags: true,
      },
    });
  }

  async save(asset: Partial<AssetEntity>): Promise<AssetEntity> {
    const { id } = await this.repository.save(asset);
    return this.repository.findOneOrFail({
      where: { id },
      relations: {
        exifInfo: true,
        owner: true,
        smartInfo: true,
        tags: true,
      },
    });
  }

  findLivePhotoMatch(options: LivePhotoSearchOptions): Promise<AssetEntity | null> {
    const { ownerId, otherAssetId, livePhotoCID, type } = options;

    return this.repository.findOne({
      where: {
        id: Not(otherAssetId),
        ownerId,
        type,
        exifInfo: {
          livePhotoCID,
        },
      },
      relations: {
        exifInfo: true,
      },
    });
  }

  getWithout(property: WithoutProperty): Promise<AssetEntity[]> {
    let relations: FindOptionsRelations<AssetEntity> = {};
    let where: FindOptionsWhere<AssetEntity> | FindOptionsWhere<AssetEntity>[] = {};

    switch (property) {
      case WithoutProperty.THUMBNAIL:
        where = [
          { resizePath: IsNull(), isVisible: true },
          { resizePath: '', isVisible: true },
          { webpPath: IsNull(), isVisible: true },
          { webpPath: '', isVisible: true },
        ];
        break;

      case WithoutProperty.ENCODED_VIDEO:
        where = [
          { type: AssetType.VIDEO, encodedVideoPath: IsNull() },
          { type: AssetType.VIDEO, encodedVideoPath: '' },
        ];
        break;

      case WithoutProperty.EXIF:
        relations = {
          exifInfo: true,
        };
        where = {
          isVisible: true,
          resizePath: Not(IsNull()),
          exifInfo: {
            assetId: IsNull(),
          },
        };
        break;

      case WithoutProperty.CLIP_ENCODING:
        relations = {
          smartInfo: true,
        };
        where = {
          isVisible: true,
          smartInfo: {
            clipEmbedding: IsNull(),
          },
        };
        break;

      case WithoutProperty.OBJECT_TAGS:
        relations = {
          smartInfo: true,
        };
        where = {
          resizePath: IsNull(),
          isVisible: true,
          smartInfo: {
            tags: IsNull(),
          },
        };
        break;

      case WithoutProperty.FACES:
        relations = {
          faces: true,
        };
        where = {
          resizePath: IsNull(),
          isVisible: true,
          faces: {
            assetId: IsNull(),
            personId: IsNull(),
          },
        };
        break;

      default:
        throw new Error(`Invalid getWithout property: ${property}`);
    }

    return this.repository.find({
      relations,
      where,
    });
  }

  getFirstAssetForAlbumId(albumId: string): Promise<AssetEntity | null> {
    return this.repository.findOne({
      where: { albums: { id: albumId } },
      order: { fileCreatedAt: 'DESC' },
    });
  }

  async getMapMarkers(ownerId: string, options: MapMarkerSearchOptions = {}): Promise<MapMarker[]> {
    const { isFavorite } = options;

    const assets = await this.repository.find({
      select: {
        id: true,
        exifInfo: {
          latitude: true,
          longitude: true,
        },
      },
      where: {
        ownerId,
        isVisible: true,
        isArchived: false,
        exifInfo: {
          latitude: Not(IsNull()),
          longitude: Not(IsNull()),
        },
        isFavorite,
      },
      relations: {
        exifInfo: true,
      },
      order: {
        fileCreatedAt: 'DESC',
      },
    });

    return assets.map((asset) => ({
      id: asset.id,

      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
      lat: asset.exifInfo!.latitude!,

      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
      lon: asset.exifInfo!.longitude!,
    }));
  }

  getTimeBuckets(userId: string, options: TimeBucketOptions): Promise<TimeBucketItem[]> {
    const truncateValue = truncateMap[options.size];

    return this.getBuilder(userId, options)
      .select(`COUNT(asset.id)::int`, 'count')
      .addSelect(`date_trunc('${truncateValue}', "fileCreatedAt")`, 'timeBucket')
      .groupBy(`date_trunc('${truncateValue}', "fileCreatedAt")`)
      .orderBy(`date_trunc('${truncateValue}', "fileCreatedAt")`, 'DESC')
      .getRawMany();
  }

  getByTimeBucket(userId: string, timeBucket: string, options: TimeBucketOptions): Promise<AssetEntity[]> {
    const truncateValue = truncateMap[options.size];
    return this.getBuilder(userId, options)
      .andWhere(`date_trunc('${truncateValue}', "fileCreatedAt") = :timeBucket`, { timeBucket })
      .orderBy('asset.fileCreatedAt', 'DESC')
      .getMany();
  }

  private getBuilder(userId: string, options: TimeBucketOptions) {
    const { isArchived, isFavorite, albumId } = options;

    let builder = this.repository
      .createQueryBuilder('asset')
      .where('asset.ownerId = :userId', { userId })
      .andWhere('asset.resizePath is not NULL')
      .andWhere('asset.isVisible = true');

    if (albumId) {
      builder = builder.leftJoin('asset.albums', 'album').andWhere('album.id = :albumId', { albumId });
    }

    if (isArchived != undefined) {
      builder = builder.andWhere('asset.isArchived = :isArchived', { isArchived });
    }

    if (isFavorite !== undefined) {
      builder = builder.andWhere('asset.isFavorite = :isFavorite', { isFavorite });
    }

    return builder;
  }
}
