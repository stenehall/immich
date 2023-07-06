import { ITranscodeRepository, TranscodeOptions, VideoInfo } from '@app/domain';
import ffmpeg, { FfprobeData } from 'fluent-ffmpeg';
import fs from 'fs/promises';
import { promisify } from 'util';

const probe = promisify<string, FfprobeData>(ffmpeg.ffprobe);

export class TranscodeRepository implements ITranscodeRepository {
  async probe(input: string): Promise<VideoInfo> {
    const results = await probe(input);

    return {
      format: {
        formatName: results.format.format_name,
        formatLongName: results.format.format_long_name,
        duration: results.format.duration || 0,
      },
      videoStreams: results.streams
        .filter((stream) => stream.codec_type === 'video')
        .map((stream) => ({
          height: stream.height || 0,
          width: stream.width || 0,
          codecName: stream.codec_name,
          codecType: stream.codec_type,
          frameCount: Number.parseInt(stream.nb_frames ?? '0'),
          rotation: Number.parseInt(`${stream.rotation ?? 0}`),
        })),
      audioStreams: results.streams
        .filter((stream) => stream.codec_type === 'audio')
        .map((stream) => ({
          codecType: stream.codec_type,
          codecName: stream.codec_name,
        })),
    };
  }

  transcode(input: string, output: string, options: TranscodeOptions): Promise<void> {
    if (!options.twoPass) {
      return new Promise((resolve, reject) => {
        ffmpeg(input, { niceness: 10, stdoutLines: 0 })
          .inputOptions(options.inputOptions)
          .outputOptions(options.outputOptions)
          .output(output)
          .on('error', (err, stdout, stderr) => {
            console.log(stderr);
            reject(err);
          })
          .on('end', resolve)
          .run();
      });
    }

    // two-pass allows for precise control of bitrate at the cost of running twice
    // recommended for vp9 for better quality and compression
    return new Promise((resolve, reject) => {
      ffmpeg(input, { niceness: 10 })
        .inputOptions(options.inputOptions)
        .outputOptions(options.outputOptions)
        .addOptions('-pass', '1')
        .addOptions('-passlogfile', output)
        .addOptions('-f null')
        .output('/dev/null') // first pass output is not saved as only the .log file is needed
        .on('error', reject)
        .on('end', () => {
          // second pass
          ffmpeg(input, { niceness: 10 })
            .inputOptions(options.inputOptions)
            .outputOptions(options.outputOptions)
            .addOptions('-pass', '2')
            .addOptions('-passlogfile', output)
            .output(output)
            .on('error', (err, stdout, stderr) => {
              console.log(stderr);
              reject(err);
            })
            .on('end', () => fs.unlink(`${output}-0.log`))
            .on('end', () => fs.rm(`${output}-0.log.mbtree`, { force: true }))
            .on('end', resolve)
            .run();
        })
        .run();
    });
  }
}
