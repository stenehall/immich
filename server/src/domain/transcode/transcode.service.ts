import { AssetEntity, AssetType, TranscodePreset } from '@app/infra/entities';
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
  BitrateDistribution,
  CodecHandler,
  ITranscodeRepository,
  TranscodeOptions,
  VideoStreamInfo,
} from './transcode.repository';

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
    this.logger.log(`Start encoding video ${asset.id} ${transcodeOptions}`);
    await this.transcodeRepository.transcode(input, output, transcodeOptions);

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
      case TranscodePreset.DISABLED:
        return false;

      case TranscodePreset.ALL:
        return true;

      case TranscodePreset.REQUIRED:
        return !allTargetsMatching;

      case TranscodePreset.OPTIMAL:
        return !allTargetsMatching || shouldScale(videoStream, ffmpegConfig);

      default:
        return false;
    }
  }

  private getFfmpegOptions(stream: VideoStreamInfo, config: SystemConfigFFmpegDto) {
    const options = {
      outputOptions: [
        `-vcodec ${config.targetVideoCodec}`,
        `-acodec ${config.targetAudioCodec}`,
        // Makes a second pass moving the moov atom to the beginning of
        // the file for improved playback speed.
        '-movflags faststart',
        '-fps_mode passthrough',
      ],
      twoPass: eligibleForTwoPass(config),
    } as TranscodeOptions;

    const handler = this.getHandler(config);

    options.outputOptions.push(...handler.getScalingOptions(stream));
    options.outputOptions.push(...handler.getPresetOptions());
    options.outputOptions.push(...handler.getThreadOptions());
    options.outputOptions.push(...handler.getBitrateOptions());

    return options;
  }

  private getHandler(config: SystemConfigFFmpegDto) {
    let handler: CodecHandler;
    switch (config.targetVideoCodec) {
      case 'h264':
        handler = new H264Handler(config);
        break;
      case 'hevc':
        handler = new HEVCHandler(config);
        break;
      case 'vp9':
        handler = new VP9Handler(config);
        break;
      default:
        throw new UnsupportedMediaTypeException(`Codec '${config.targetVideoCodec}' is unsupported`);
    }
    return handler;
  }
}

class H264Handler implements CodecHandler {
  protected config: SystemConfigFFmpegDto;

  constructor(config: SystemConfigFFmpegDto) {
    this.config = config;
  }

  getScalingOptions(stream: VideoStreamInfo) {
    if (!shouldScale(stream, this.config)) {
      return [];
    }
    const targetResolution = getTargetResolution(stream, this.config);
    const scaling = isVideoVertical(stream) ? `${targetResolution}:-2` : `-2:${targetResolution}`;

    return [`-vf scale=${scaling}`];
  }

  getPresetOptions() {
    return [`-preset ${this.config.preset}`];
  }

  getBitrateOptions() {
    const bitrates = getBitrateDistribution(this.config);
    if (eligibleForTwoPass(this.config)) {
      return [
        `-b:v ${bitrates.target}${bitrates.unit}`,
        `-minrate ${bitrates.min}${bitrates.unit}`,
        `-maxrate ${bitrates.max}${bitrates.unit}`,
      ];
    } else if (bitrates.max > 0) {
      // -bufsize is the peak possible bitrate at any moment, while -maxrate is the max rolling average bitrate
      // needed for -maxrate to be enforced
      return [
        `-crf ${this.config.crf}`,
        `-maxrate ${bitrates.max}${bitrates.unit}`,
        `-bufsize ${bitrates.max * 2}${bitrates.unit}`,
      ];
    } else {
      return [`-crf ${this.config.crf}`];
    }
  }

  getThreadOptions() {
    if (this.config.threads <= 0) {
      return [];
    }
    return [
      `-threads ${this.config.threads}`,
      '-x264-params "pools=none"',
      `-x264-params "frame-threads=${this.config.threads}"`,
    ];
  }
}

class HEVCHandler extends H264Handler {
  getThreadOptions() {
    if (this.config.threads <= 0) {
      return [];
    }
    return [
      `-threads ${this.config.threads}`,
      '-x265-params "pools=none"',
      `-x265-params "frame-threads=${this.config.threads}"`,
    ];
  }
}

class VP9Handler implements CodecHandler {
  protected config: SystemConfigFFmpegDto;

  constructor(config: SystemConfigFFmpegDto) {
    this.config = config;
  }
  getScalingOptions(stream: VideoStreamInfo) {
    if (!shouldScale(stream, this.config)) {
      return [];
    }
    const targetResolution = getTargetResolution(stream, this.config);
    const scaling = isVideoVertical(stream) ? `${targetResolution}:-2` : `-2:${targetResolution}`;

    return [`-vf scale=${scaling}`];
  }

  getPresetOptions() {
    const presets = ['veryslow', 'slower', 'slow', 'medium', 'fast', 'faster', 'veryfast', 'superfast', 'ultrafast'];

    const speed = Math.min(presets.indexOf(this.config.preset), 5); // values over 5 require realtime mode, which is its own can of worms since it overrides -crf and -threads
    if (speed >= 0) {
      return [`-cpu-used ${speed}`];
    }
    return [];
  }

  getBitrateOptions() {
    const bitrates = getBitrateDistribution(this.config);
    if (eligibleForTwoPass(this.config)) {
      return [
        `-b:v ${bitrates.target}${bitrates.unit}`,
        `-minrate ${bitrates.min}${bitrates.unit}`,
        `-maxrate ${bitrates.max}${bitrates.unit}`,
      ];
    }

    return [`-crf ${this.config.crf}`, `-b:v ${bitrates.max}${bitrates.unit}`];
  }

  getThreadOptions() {
    if (this.config.threads) {
      return ['-row-mt 1', `-threads ${this.config.threads}`];
    }
    return ['-row-mt 1'];
  }
}

function eligibleForTwoPass(config: SystemConfigFFmpegDto) {
  if (!config.twoPass) {
    return false;
  }

  return isBitrateConstrained(config) || config.targetVideoCodec === 'vp9';
}

function getBitrateDistribution(ffmpeg: SystemConfigFFmpegDto) {
  const max = getMaxBitrateValue(ffmpeg);
  const target = Math.ceil(max / 1.45); // recommended by https://developers.google.com/media/vp9/settings/vod
  const min = target / 2;
  const unit = getBitrateUnit(ffmpeg);

  return { max, target, min, unit } as BitrateDistribution;
}

function getTargetResolution(stream: VideoStreamInfo, ffmpeg: SystemConfigFFmpegDto) {
  if (ffmpeg.targetResolution === 'original') {
    return Math.min(stream.height, stream.width);
  }

  return Number.parseInt(ffmpeg.targetResolution);
}

function shouldScale(stream: VideoStreamInfo, ffmpeg: SystemConfigFFmpegDto) {
  if (ffmpeg.targetResolution === 'original') {
    return false;
  }
  return Math.min(stream.height, stream.width) > Number.parseInt(ffmpeg.targetResolution);
}

function isVideoRotated(stream: VideoStreamInfo) {
  return Math.abs(stream.rotation) === 90;
}

function isVideoVertical(stream: VideoStreamInfo) {
  return stream.height > stream.width || isVideoRotated(stream);
}

function isBitrateConstrained(ffmpeg: SystemConfigFFmpegDto) {
  return getMaxBitrateValue(ffmpeg) > 0;
}

function getBitrateUnit(ffmpeg: SystemConfigFFmpegDto) {
  const maxBitrate = getMaxBitrateValue(ffmpeg);
  return ffmpeg.maxBitrate.trim().substring(maxBitrate.toString().length); // use inputted unit if provided
}

function getMaxBitrateValue(ffmpeg: SystemConfigFFmpegDto) {
  return Number.parseInt(ffmpeg.maxBitrate) || 0;
}
