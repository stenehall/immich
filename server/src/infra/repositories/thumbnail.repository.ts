import { CropOptions, IThumbnailRepository, ResizeOptions } from '@app/domain';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';

export class ThumbnailRepository implements IThumbnailRepository {
  crop(input: string, options: CropOptions): Promise<Buffer> {
    return sharp(input, { failOnError: false })
      .extract({
        left: options.left,
        top: options.top,
        width: options.width,
        height: options.height,
      })
      .toBuffer();
  }

  async resize(input: string | Buffer, output: string, options: ResizeOptions): Promise<void> {
    switch (options.format) {
      case 'webp':
        await sharp(input, { failOnError: false })
          .resize(options.size, options.size, { fit: 'outside', withoutEnlargement: true })
          .webp()
          .rotate()
          .toFile(output);
        return;

      case 'jpeg':
        await sharp(input, { failOnError: false })
          .resize(options.size, options.size, { fit: 'outside', withoutEnlargement: true })
          .jpeg()
          .rotate()
          .toFile(output);
        return;
    }
  }

  extractVideoThumbnail(input: string, output: string, size: number) {
    return new Promise<void>((resolve, reject) => {
      ffmpeg(input)
        .outputOptions([
          '-ss 00:00:00.000',
          '-frames:v 1',
          `-vf scale='min(${size},iw)':'min(${size},ih)':force_original_aspect_ratio=increase`,
        ])
        .output(output)
        .on('error', reject)
        .on('end', resolve)
        .run();
    });
  }

  async generateThumbhash(imagePath: string): Promise<Buffer> {
    const maxSize = 100;

    const { data, info } = await sharp(imagePath)
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const thumbhash = await import('thumbhash');
    return Buffer.from(thumbhash.rgbaToThumbHash(info.width, info.height, data));
  }
}
