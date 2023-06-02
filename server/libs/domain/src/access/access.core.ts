import { ForbiddenException } from '@nestjs/common';
import { AuthUserDto } from '../auth';
import { IAccessRepository } from './access.repository';

export class AccessCore {
  constructor(private repository: IAccessRepository) {}

  async assetCheck(authUser: AuthUserDto, assetIds: string[]) {
    for (const assetId of assetIds) {
      // Shared link
      if (authUser.sharedLinkId) {
        const hasSharedLinkAccess = await this.repository.hasSharedLinkAssetAccess(authUser.sharedLinkId, assetId);
        if (!hasSharedLinkAccess) {
          throw new ForbiddenException();
        }
      }

      const userId = authUser.id;

      const canAccess =
        // Owner
        (await this.repository.hasOwnerAssetAccess(userId, assetId)) ||
        // Partner sharing
        (await this.repository.hasPartnerAssetAccess(userId, assetId)) ||
        // Album sharing
        (await this.repository.hasAlbumAssetAccess(userId, assetId));

      if (!canAccess) {
        throw new ForbiddenException();
      }
    }
  }

  // private async checkUserAccess(authUser: AuthUserDto, userId: string) {
  //   // Check if userId shares assets with authUser
  //   if (!(await this.partnerCore.get({ sharedById: userId, sharedWithId: authUser.id }))) {
  //     throw new ForbiddenException();
  //   }
  // }

  // // share
  // checkDownloadAccess(user: AuthUserDto) {
  //   if (user.isPublicUser && !user.isAllowDownload) {
  //     throw new ForbiddenException();
  //   }
  // }
}
