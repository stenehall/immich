import { VideoCodec } from '@app/infra/entities';

export const ITranscodeRepository = 'ITranscodeRepository';

export interface VideoStreamInfo {
  height: number;
  width: number;
  rotation: number;
  codecName?: string;
  codecType?: string;
  frameCount: number;
}

export interface AudioStreamInfo {
  codecName?: string;
  codecType?: string;
}

export interface VideoFormat {
  formatName?: string;
  formatLongName?: string;
  duration: number;
}

export interface VideoInfo {
  format: VideoFormat;
  videoStreams: VideoStreamInfo[];
  audioStreams: AudioStreamInfo[];
}

export interface TranscodeOptions {
  outputOptions: string[];
  twoPass: boolean;
}

export interface BitrateDistribution {
  max: number;
  target: number;
  min: number;
  unit: string;
}

export interface VideoCodecSWHandler {
  getOptions(stream: VideoStreamInfo): TranscodeOptions;
}

export interface VideoCodecHWHandler extends VideoCodecSWHandler {
  getSupportedCodecs(): Array<VideoCodec>;
}

export interface ITranscodeRepository {
  probe(input: string): Promise<VideoInfo>;
  transcode(input: string, output: string, options: TranscodeOptions): Promise<void>;
}
