import { AssetType, SystemConfigKey } from '@app/infra/entities';
import {
  assetEntityStub,
  newAssetRepositoryMock,
  newJobRepositoryMock,
  newStorageRepositoryMock,
  newSystemConfigRepositoryMock,
  newTranscodeRepositoryMock,
  probeStub,
} from '@test';
import { IAssetRepository, WithoutProperty } from '../asset';
import { IJobRepository, JobName } from '../job';
import { IStorageRepository } from '../storage';
import { ISystemConfigRepository } from '../system-config';
import { ITranscodeRepository } from './transcode.repository';
import { TranscodeService } from './transcode.service';

describe(TranscodeService.name, () => {
  let sut: TranscodeService;
  let assetMock: jest.Mocked<IAssetRepository>;
  let configMock: jest.Mocked<ISystemConfigRepository>;
  let jobMock: jest.Mocked<IJobRepository>;
  let transcodeMock: jest.Mocked<ITranscodeRepository>;
  let storageMock: jest.Mocked<IStorageRepository>;

  beforeEach(async () => {
    assetMock = newAssetRepositoryMock();
    configMock = newSystemConfigRepositoryMock();
    jobMock = newJobRepositoryMock();
    transcodeMock = newTranscodeRepositoryMock();
    storageMock = newStorageRepositoryMock();

    sut = new TranscodeService(assetMock, jobMock, transcodeMock, storageMock, configMock);
  });

  it('should be defined', () => {
    expect(sut).toBeDefined();
  });

  describe('handleQueueVideoConversion', () => {
    it('should queue all video assets', async () => {
      assetMock.getAll.mockResolvedValue({
        items: [assetEntityStub.video],
        hasNextPage: false,
      });

      await sut.handleQueueVideoConversion({ force: true });

      expect(assetMock.getAll).toHaveBeenCalledWith({ skip: 0, take: 1000 }, { type: AssetType.VIDEO });
      expect(assetMock.getWithout).not.toHaveBeenCalled();
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.VIDEO_CONVERSION,
        data: { id: assetEntityStub.video.id },
      });
    });

    it('should queue all video assets without encoded videos', async () => {
      assetMock.getWithout.mockResolvedValue({
        items: [assetEntityStub.video],
        hasNextPage: false,
      });

      await sut.handleQueueVideoConversion({});

      expect(assetMock.getAll).not.toHaveBeenCalled();
      expect(assetMock.getWithout).toHaveBeenCalledWith({ skip: 0, take: 1000 }, WithoutProperty.ENCODED_VIDEO);
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.VIDEO_CONVERSION,
        data: { id: assetEntityStub.video.id },
      });
    });
  });

  describe('handleVideoConversion', () => {
    beforeEach(() => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
    });

    it('should transcode the longest stream', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      transcodeMock.probe.mockResolvedValue(probeStub.multipleVideoStreams);

      await sut.handleVideoConversion({ id: assetEntityStub.video.id });

      expect(transcodeMock.probe).toHaveBeenCalledWith('/original/path.ext');
      expect(configMock.load).toHaveBeenCalled();
      expect(storageMock.mkdirSync).toHaveBeenCalled();
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should skip a video without any streams', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.noVideoStreams);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).not.toHaveBeenCalled();
    });

    it('should skip a video without any height', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.noHeight);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).not.toHaveBeenCalled();
    });

    it('should transcode when set to all', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.multipleVideoStreams);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: 'all' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode when optimal and too big', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.videoStream2160p);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: 'optimal' }]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should not scale resolution if no target resolution', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.videoStream2160p);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_TRANSCODE, value: 'all' },
        { key: SystemConfigKey.FFMPEG_TARGET_RESOLUTION, value: 'original' },
      ]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode with alternate scaling video is vertical', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.videoStreamVertical2160p);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: 'optimal' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=720:-2',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode when audio doesnt match target', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.audioStreamMp3);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: 'optimal' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode when container doesnt match target', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: 'optimal' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should not transcode an invalid transcode value', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.videoStream2160p);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: 'invalid' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).not.toHaveBeenCalled();
    });

    it('should set max bitrate if above 0', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_MAX_BITRATE, value: '4500k' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
            '-maxrate 4500k',
            '-bufsize 9000k',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode in two passes for h264/h265 when enabled and max bitrate is above 0', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_MAX_BITRATE, value: '4500k' },
        { key: SystemConfigKey.FFMPEG_TWO_PASS, value: true },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-b:v 3104k',
            '-minrate 1552k',
            '-maxrate 4500k',
          ],
          twoPass: true,
        },
      );
    });

    it('should fallback to one pass for h264/h265 if two-pass is enabled but no max bitrate is set', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TWO_PASS, value: true }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should configure preset for vp9', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: 'vp9' },
        { key: SystemConfigKey.FFMPEG_THREADS, value: 2 },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec vp9',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-cpu-used 5',
            '-row-mt 1',
            '-threads 2',
            '-crf 23',
            '-b:v 0',
          ],
          twoPass: false,
        },
      );
    });

    it('should configure threads if above 0', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: 'vp9' },
        { key: SystemConfigKey.FFMPEG_THREADS, value: 2 },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec vp9',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-cpu-used 5',
            '-row-mt 1',
            '-threads 2',
            '-crf 23',
            '-b:v 0',
          ],
          twoPass: false,
        },
      );
    });

    it('should disable thread pooling for x264/x265 if thread limit is above 0', async () => {
      transcodeMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_THREADS, value: 2 }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(transcodeMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-threads 2',
            '-x264-params "pools=none"',
            '-x264-params "frame-threads=2"',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });
  });
});
