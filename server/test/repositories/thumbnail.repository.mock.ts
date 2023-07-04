import { IThumbnailRepository } from '@app/domain';

export const newThumbnailRepositoryMock = (): jest.Mocked<IThumbnailRepository> => {
  return {
    extractVideoThumbnail: jest.fn(),
    generateThumbhash: jest.fn(),
    resize: jest.fn(),
    crop: jest.fn(),
  };
};
