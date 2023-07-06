import { AssetEntity, AssetType, TranscodeHWAccel, TranscodePolicy, VideoCodec } from '@app/infra/entities';
import { Inject, Injectable, Logger, UnsupportedMediaTypeException } from '@nestjs/common';
import { join } from 'path';
import { IAssetRepository, WithoutProperty } from '../asset';
import { usePagination } from '../domain.util';
import { IBaseJob, IEntityJob, IJobRepository, JobName, JOBS_ASSET_PAGINATION_SIZE } from '../job';
import { IStorageRepository, StorageCore, StorageFolder } from '../storage';
import { ISystemConfigRepository, SystemConfigFFmpegDto } from '../system-config';
import { SystemConfigCore } from '../system-config/system-config.core';
import {
  AudioStreamInfo,
  ITranscodeRepository,
  VideoCodecHWHandler,
  VideoCodecSWHandler,
  VideoStreamInfo,
} from './transcode.repository';
import {
  H264Handler,
  HEVCHandler,
  NVENCHandler,
  QSVHandler,
  shouldScale,
  VAAPIHandler,
  VP9Handler,
} from './transcode.util';

@Injectable()
export class TranscodeService {
  private logger = new Logger(TranscodeService.name);
  private storageCore = new StorageCore();
  private configCore: SystemConfigCore;

  constructor(
    @Inject(IAssetRepository) private assetRepository: IAssetRepository,
    @Inject(IJobRepository) private jobRepository: IJobRepository,
    @Inject(ITranscodeRepository) private transcodeRepository: ITranscodeRepository,
    @Inject(IStorageRepository) private storageRepository: IStorageRepository,
    @Inject(ISystemConfigRepository) systemConfig: ISystemConfigRepository,
  ) {
    this.configCore = new SystemConfigCore(systemConfig);
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

    const { videoStreams, audioStreams, format } = await this.transcodeRepository.probe(input);
    const mainVideoStream = this.getMainVideoStream(videoStreams);
    const mainAudioStream = this.getMainAudioStream(audioStreams);
    const containerExtension = format.formatName;
    if (!mainVideoStream || !mainAudioStream || !containerExtension) {
      return false;
    }

    const { ffmpeg: config } = await this.configCore.getConfig();

    const required = this.isTranscodeRequired(asset, mainVideoStream, mainAudioStream, containerExtension, config);
    if (!required) {
      return false;
    }

    const transcodeOptions = this.getFfmpegOptions(mainVideoStream, config);
    this.logger.log(`Start encoding video ${asset.id} ${JSON.stringify(transcodeOptions)}`);
    try {
      await this.transcodeRepository.transcode(input, output, transcodeOptions);
    } catch (err) {
      this.logger.error(err);
      if (config.accel !== TranscodeHWAccel.DISABLED) {
        this.logger.error(`Error occurred during transcoding. Retrying with ${config.accel} acceleration disabled.`);
      }
      config.accel = TranscodeHWAccel.DISABLED;
      const transcodeOptions = this.getFfmpegOptions(mainVideoStream, config);
      await this.transcodeRepository.transcode(input, output, transcodeOptions);
    }

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
    audioStream: AudioStreamInfo,
    containerExtension: string,
    ffmpegConfig: SystemConfigFFmpegDto,
  ): boolean {
    if (!videoStream.height || !videoStream.width) {
      this.logger.error('Skipping transcode, height or width undefined for video stream');
      return false;
    }

    const isTargetVideoCodec = videoStream.codecName === ffmpegConfig.targetVideoCodec;
    const isTargetAudioCodec = audioStream.codecName === ffmpegConfig.targetAudioCodec;
    const isTargetContainer = ['mov,mp4,m4a,3gp,3g2,mj2', 'mp4', 'mov'].includes(containerExtension);

    this.logger.verbose(
      `${asset.id}: AudioCodecName ${audioStream.codecName}, AudioStreamCodecType ${audioStream.codecType}, containerExtension ${containerExtension}`,
    );

    const allTargetsMatching = isTargetVideoCodec && isTargetAudioCodec && isTargetContainer;

    switch (ffmpegConfig.transcode) {
      case TranscodePolicy.DISABLED:
        return false;

      case TranscodePolicy.ALL:
        return true;

      case TranscodePolicy.REQUIRED:
        return !allTargetsMatching;

      case TranscodePolicy.OPTIMAL:
        return !allTargetsMatching || shouldScale(videoStream, ffmpegConfig);

      default:
        return false;
    }
  }

  private getFfmpegOptions(stream: VideoStreamInfo, config: SystemConfigFFmpegDto) {
    config.accel = TranscodeHWAccel.NVENC;
    return this.getHWHandler(config).getOptions(stream);
    //   if (config.accel === TranscodeHWAccel.DISABLED) {
    //   return this.getSWHandler(config).getOptions(stream);
    // } else {
    //   return this.getHWHandler(config).getOptions(stream);
    // }
  }

  private getSWHandler(config: SystemConfigFFmpegDto) {
    let handler: VideoCodecSWHandler;
    switch (config.targetVideoCodec) {
      case VideoCodec.H264:
        handler = new H264Handler(config);
        break;
      case VideoCodec.HEVC:
        handler = new HEVCHandler(config);
        break;
      case VideoCodec.VP9:
        handler = new VP9Handler(config);
        break;
      default:
        throw new UnsupportedMediaTypeException(`Codec '${config.targetVideoCodec}' is unsupported`);
    }
    return handler;
  }

  private getHWHandler(config: SystemConfigFFmpegDto) {
    let handler: VideoCodecHWHandler;
    switch (config.accel) {
      case TranscodeHWAccel.NVENC:
        handler = new NVENCHandler(config);
        break;
      case TranscodeHWAccel.QSV:
        handler = new QSVHandler(config);
        break;
      default:
        throw new UnsupportedMediaTypeException(`${config.accel} acceleration is unsupported`);
    }
    if (!handler.getSupportedCodecs().includes(config.targetVideoCodec)) {
      throw new UnsupportedMediaTypeException(
        `${config.accel} acceleration does not support codec '${
          config.targetVideoCodec
        }'. Supported codecs: ${handler.getSupportedCodecs()}`,
      );
    }

    return handler;
  }
}
