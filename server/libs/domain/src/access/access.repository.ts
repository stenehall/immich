export const IAccessRepository = 'IAccessRepository';

export interface IAccessRepository {
  // library access
  hasPartnerAccess(userId: string, partnerId: string): Promise<boolean>;

  // asset access
  hasOwnerAssetAccess(userId: string, assetId: string): Promise<boolean>;
  hasPartnerAssetAccess(userId: string, assetId: string): Promise<boolean>;
  hasSharedLinkAssetAccess(sharedLinkId: string, assetId: string): Promise<boolean>;
  hasAlbumAssetAccess(userId: string, assetId: string): Promise<boolean>;
}
