import {
  assetEntityStub,
  newAssetRepositoryMock,
  newJobRepositoryMock,
  newStorageRepositoryMock,
  newThumbnailRepositoryMock,
} from '@test';
import { IAssetRepository, WithoutProperty } from '../asset';
import { IJobRepository, JobName } from '../job';
import { IStorageRepository } from '../storage';
import { IThumbnailRepository } from './thumbnail.repository';
import { ThumbnailService } from './thumbnail.service';

describe(ThumbnailService.name, () => {
  let sut: ThumbnailService;
  let assetMock: jest.Mocked<IAssetRepository>;
  let jobMock: jest.Mocked<IJobRepository>;
  let thumbnailMock: jest.Mocked<IThumbnailRepository>;
  let storageMock: jest.Mocked<IStorageRepository>;

  beforeEach(async () => {
    assetMock = newAssetRepositoryMock();
    jobMock = newJobRepositoryMock();
    thumbnailMock = newThumbnailRepositoryMock();
    storageMock = newStorageRepositoryMock();

    sut = new ThumbnailService(assetMock, jobMock, thumbnailMock, storageMock);
  });

  it('should be defined', () => {
    expect(sut).toBeDefined();
  });

  describe('handleQueueGenerateThumbnails', () => {
    it('should queue all assets', async () => {
      assetMock.getAll.mockResolvedValue({
        items: [assetEntityStub.image],
        hasNextPage: false,
      });

      await sut.handleQueueGenerateThumbnails({ force: true });

      expect(assetMock.getAll).toHaveBeenCalled();
      expect(assetMock.getWithout).not.toHaveBeenCalled();
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.GENERATE_JPEG_THUMBNAIL,
        data: { id: assetEntityStub.image.id },
      });
    });

    it('should queue all assets with missing resize path', async () => {
      assetMock.getWithout.mockResolvedValue({
        items: [assetEntityStub.noResizePath],
        hasNextPage: false,
      });

      await sut.handleQueueGenerateThumbnails({ force: false });

      expect(assetMock.getAll).not.toHaveBeenCalled();
      expect(assetMock.getWithout).toHaveBeenCalledWith({ skip: 0, take: 1000 }, WithoutProperty.THUMBNAIL);
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.GENERATE_JPEG_THUMBNAIL,
        data: { id: assetEntityStub.image.id },
      });
    });

    it('should queue all assets with missing webp path', async () => {
      assetMock.getWithout.mockResolvedValue({
        items: [assetEntityStub.noWebpPath],
        hasNextPage: false,
      });

      await sut.handleQueueGenerateThumbnails({ force: false });

      expect(assetMock.getAll).not.toHaveBeenCalled();
      expect(assetMock.getWithout).toHaveBeenCalledWith({ skip: 0, take: 1000 }, WithoutProperty.THUMBNAIL);
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.GENERATE_WEBP_THUMBNAIL,
        data: { id: assetEntityStub.image.id },
      });
    });

    it('should queue all assets with missing thumbhash', async () => {
      assetMock.getWithout.mockResolvedValue({
        items: [assetEntityStub.noThumbhash],
        hasNextPage: false,
      });

      await sut.handleQueueGenerateThumbnails({ force: false });

      expect(assetMock.getAll).not.toHaveBeenCalled();
      expect(assetMock.getWithout).toHaveBeenCalledWith({ skip: 0, take: 1000 }, WithoutProperty.THUMBNAIL);
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.GENERATE_THUMBHASH_THUMBNAIL,
        data: { id: assetEntityStub.image.id },
      });
    });
  });

  describe('handleGenerateJpegThumbnail', () => {
    it('should generate a thumbnail for an image', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.image]);
      await sut.handleGenerateJpegThumbnail({ id: assetEntityStub.image.id });

      expect(storageMock.mkdirSync).toHaveBeenCalledWith('upload/thumbs/user-id');
      expect(thumbnailMock.resize).toHaveBeenCalledWith('/original/path.ext', 'upload/thumbs/user-id/asset-id.jpeg', {
        size: 1440,
        format: 'jpeg',
      });
      expect(assetMock.save).toHaveBeenCalledWith({
        id: 'asset-id',
        resizePath: 'upload/thumbs/user-id/asset-id.jpeg',
      });
    });

    it('should generate a thumbnail for a video', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleGenerateJpegThumbnail({ id: assetEntityStub.video.id });

      expect(storageMock.mkdirSync).toHaveBeenCalledWith('upload/thumbs/user-id');
      expect(thumbnailMock.extractVideoThumbnail).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/thumbs/user-id/asset-id.jpeg',
        1440,
      );
      expect(assetMock.save).toHaveBeenCalledWith({
        id: 'asset-id',
        resizePath: 'upload/thumbs/user-id/asset-id.jpeg',
      });
    });

    it('should run successfully', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.image]);
      await sut.handleGenerateJpegThumbnail({ id: assetEntityStub.image.id });
    });
  });

  describe('handleGenerateWebpThumbnail', () => {
    it('should skip thumbnail generate if resize path is missing', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.noResizePath]);
      await sut.handleGenerateWepbThumbnail({ id: assetEntityStub.noResizePath.id });
      expect(thumbnailMock.resize).not.toHaveBeenCalled();
    });

    it('should generate a thumbnail', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.image]);
      await sut.handleGenerateWepbThumbnail({ id: assetEntityStub.image.id });

      expect(thumbnailMock.resize).toHaveBeenCalledWith(
        '/uploads/user-id/thumbs/path.ext',
        '/uploads/user-id/thumbs/path.ext',
        { format: 'webp', size: 250 },
      );
      expect(assetMock.save).toHaveBeenCalledWith({ id: 'asset-id', webpPath: '/uploads/user-id/thumbs/path.ext' });
    });
  });

  describe('handleGenerateThumbhashThumbnail', () => {
    it('should skip thumbhash generation if resize path is missing', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.noResizePath]);
      await sut.handleGenerateThumbhashThumbnail({ id: assetEntityStub.noResizePath.id });
      expect(thumbnailMock.generateThumbhash).not.toHaveBeenCalled();
    });

    it('should generate a thumbhash', async () => {
      const thumbhashBuffer = Buffer.from('a thumbhash', 'utf8');
      assetMock.getByIds.mockResolvedValue([assetEntityStub.image]);
      thumbnailMock.generateThumbhash.mockResolvedValue(thumbhashBuffer);

      await sut.handleGenerateThumbhashThumbnail({ id: assetEntityStub.image.id });

      expect(thumbnailMock.generateThumbhash).toHaveBeenCalledWith('/uploads/user-id/thumbs/path.ext');
      expect(assetMock.save).toHaveBeenCalledWith({ id: 'asset-id', thumbhash: thumbhashBuffer });
    });
  });
});
