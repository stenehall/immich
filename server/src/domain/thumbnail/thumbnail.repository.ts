export const IThumbnailRepository = 'IThumbnailRepository';

export interface ResizeOptions {
  size: number;
  format: 'webp' | 'jpeg';
}

export interface CropOptions {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface IThumbnailRepository {
  resize(input: string | Buffer, output: string, options: ResizeOptions): Promise<void>;
  crop(input: string, options: CropOptions): Promise<Buffer>;
  generateThumbhash(imagePath: string): Promise<Buffer>;
  extractVideoThumbnail(input: string, output: string, size: number): Promise<void>;
}
