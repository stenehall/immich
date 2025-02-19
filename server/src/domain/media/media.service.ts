import { AssetEntity, AssetType, TranscodePolicy, VideoCodec } from '@app/infra/entities';
import { Inject, Injectable, Logger, UnsupportedMediaTypeException } from '@nestjs/common';
import { join } from 'path';
import { IAssetRepository, WithoutProperty } from '../asset';
import { usePagination } from '../domain.util';
import { IBaseJob, IEntityJob, IJobRepository, JobName, JOBS_ASSET_PAGINATION_SIZE } from '../job';
import { IStorageRepository, StorageCore, StorageFolder } from '../storage';
import { ISystemConfigRepository, SystemConfigFFmpegDto } from '../system-config';
import { SystemConfigCore } from '../system-config/system-config.core';
import { JPEG_THUMBNAIL_SIZE, WEBP_THUMBNAIL_SIZE } from './media.constant';
import { AudioStreamInfo, IMediaRepository, VideoStreamInfo } from './media.repository';
import { H264Config, HEVCConfig, VP9Config } from './media.util';

@Injectable()
export class MediaService {
  private logger = new Logger(MediaService.name);
  private storageCore = new StorageCore();
  private configCore: SystemConfigCore;

  constructor(
    @Inject(IAssetRepository) private assetRepository: IAssetRepository,
    @Inject(IJobRepository) private jobRepository: IJobRepository,
    @Inject(IMediaRepository) private mediaRepository: IMediaRepository,
    @Inject(IStorageRepository) private storageRepository: IStorageRepository,
    @Inject(ISystemConfigRepository) systemConfig: ISystemConfigRepository,
  ) {
    this.configCore = new SystemConfigCore(systemConfig);
  }

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

  async handleGenerateWebpThumbnail({ id }: IEntityJob) {
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

  async handleQueueVideoConversion(job: IBaseJob) {
    const { force } = job;

    const assetPagination = usePagination(JOBS_ASSET_PAGINATION_SIZE, (pagination) => {
      return force
        ? this.assetRepository.getAll(pagination, { type: AssetType.VIDEO })
        : this.assetRepository.getWithout(pagination, WithoutProperty.ENCODED_VIDEO);
    });

    for await (const assets of assetPagination) {
      for (const asset of assets) {
        await this.jobRepository.queue({ name: JobName.VIDEO_CONVERSION, data: { id: asset.id } });
      }
    }

    return true;
  }

  async handleVideoConversion({ id }: IEntityJob) {
    const [asset] = await this.assetRepository.getByIds([id]);
    if (!asset || asset.type !== AssetType.VIDEO) {
      return false;
    }

    const input = asset.originalPath;
    const outputFolder = this.storageCore.getFolderLocation(StorageFolder.ENCODED_VIDEO, asset.ownerId);
    const output = join(outputFolder, `${asset.id}.mp4`);
    this.storageRepository.mkdirSync(outputFolder);

    const { videoStreams, audioStreams, format } = await this.mediaRepository.probe(input);
    const mainVideoStream = this.getMainVideoStream(videoStreams);
    const mainAudioStream = this.getMainAudioStream(audioStreams);
    const containerExtension = format.formatName;
    if (!mainVideoStream || !containerExtension) {
      return false;
    }

    const { ffmpeg: config } = await this.configCore.getConfig();

    const required = this.isTranscodeRequired(asset, mainVideoStream, mainAudioStream, containerExtension, config);
    if (!required) {
      return false;
    }

    let transcodeOptions;
    try {
      transcodeOptions = this.getCodecConfig(config).getOptions(mainVideoStream);
    } catch (err) {
      this.logger.error(`An error occurred while configuring transcoding options: ${err}`);
      return false;
    }

    this.logger.log(`Start encoding video ${asset.id} ${JSON.stringify(transcodeOptions)}`);
    await this.mediaRepository.transcode(input, output, transcodeOptions);

    this.logger.log(`Encoding success ${asset.id}`);

    await this.assetRepository.save({ id: asset.id, encodedVideoPath: output });

    return true;
  }

  private getMainVideoStream(streams: VideoStreamInfo[]): VideoStreamInfo | null {
    return streams.sort((stream1, stream2) => stream2.frameCount - stream1.frameCount)[0];
  }

  private getMainAudioStream(streams: AudioStreamInfo[]): AudioStreamInfo | null {
    return streams[0];
  }

  private isTranscodeRequired(
    asset: AssetEntity,
    videoStream: VideoStreamInfo,
    audioStream: AudioStreamInfo | null,
    containerExtension: string,
    ffmpegConfig: SystemConfigFFmpegDto,
  ): boolean {
    if (!videoStream.height || !videoStream.width) {
      this.logger.error('Skipping transcode, height or width undefined for video stream');
      return false;
    }

    const isTargetVideoCodec = videoStream.codecName === ffmpegConfig.targetVideoCodec;
    const isTargetContainer = ['mov,mp4,m4a,3gp,3g2,mj2', 'mp4', 'mov'].includes(containerExtension);
    const isTargetAudioCodec = audioStream == null || audioStream.codecName === ffmpegConfig.targetAudioCodec;

    if (audioStream != null) {
      this.logger.verbose(
        `${asset.id}: AudioCodecName ${audioStream.codecName}, AudioStreamCodecType ${audioStream.codecType}, containerExtension ${containerExtension}`,
      );
    } else {
      this.logger.verbose(
        `${asset.id}: AudioCodecName None, AudioStreamCodecType None, containerExtension ${containerExtension}`,
      );
    }

    const allTargetsMatching = isTargetVideoCodec && isTargetAudioCodec && isTargetContainer;
    const scalingEnabled = ffmpegConfig.targetResolution !== 'original';
    const targetRes = Number.parseInt(ffmpegConfig.targetResolution);
    const isLargerThanTargetRes = scalingEnabled && Math.min(videoStream.height, videoStream.width) > targetRes;

    switch (ffmpegConfig.transcode) {
      case TranscodePolicy.DISABLED:
        return false;

      case TranscodePolicy.ALL:
        return true;

      case TranscodePolicy.REQUIRED:
        return !allTargetsMatching;

      case TranscodePolicy.OPTIMAL:
        return !allTargetsMatching || isLargerThanTargetRes;

      default:
        return false;
    }
  }

  private getCodecConfig(config: SystemConfigFFmpegDto) {
    switch (config.targetVideoCodec) {
      case VideoCodec.H264:
        return new H264Config(config);
      case VideoCodec.HEVC:
        return new HEVCConfig(config);
      case VideoCodec.VP9:
        return new VP9Config(config);
      default:
        throw new UnsupportedMediaTypeException(`Codec '${config.targetVideoCodec}' is unsupported`);
    }
  }
}
