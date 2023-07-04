import { SystemConfigFFmpegDto } from '../system-config';

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

export interface CodecHandler {
  getScalingOptions(stream: VideoStreamInfo): Array<string>;
  getPresetOptions(): Array<string>;
  getBitrateOptions(): Array<string>;
  getThreadOptions(): Array<string>;
}

export interface ITranscodeRepository {
  probe(input: string): Promise<VideoInfo>;
  transcode(input: string, output: string, options: TranscodeOptions): Promise<void>;
}
