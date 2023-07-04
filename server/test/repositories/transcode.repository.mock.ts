import { ITranscodeRepository } from '@app/domain';

export const newTranscodeRepositoryMock = (): jest.Mocked<ITranscodeRepository> => {
  return {
    probe: jest.fn(),
    transcode: jest.fn(),
  };
};
