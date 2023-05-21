import { error } from '@sveltejs/kit';
import { ThumbnailFormat, api as clientApi } from '@api';
import type { PageServerLoad } from './$types';
import featurePanelUrl from '$lib/assets/feature-panel.png';

export const load = (async ({ params, locals: { api } }) => {
	const { key } = params;

	try {
		const { data: sharedLink } = await api.shareApi.getMySharedLink(key);

		const assetCount = sharedLink.assets.length;
		const assetId = sharedLink.album?.albumThumbnailAssetId || sharedLink.assets[0]?.id;

		const getFileCreatedAt = (index: number) => {
			const asset = sharedLink.assets?.[index];
			if (asset) {
				return new Date(asset.fileCreatedAt);
			}
		};

		const startDate = getFileCreatedAt(0);
		const endDate = getFileCreatedAt(sharedLink.assets.length - 1);

		return {
			sharedLink,
			startDate,
			endDate,
			meta: {
				title: sharedLink.album ? sharedLink.album.albumName : 'Public Share',
				description: sharedLink.description || `${assetCount} shared photos & videos.`,
				imageUrl: assetId
					? clientApi.getAssetThumbnailUrl(assetId, ThumbnailFormat.Webp, sharedLink.key)
					: featurePanelUrl
			}
		};
	} catch (e) {
		throw error(404, {
			message: 'Invalid shared link'
		});
	}
}) satisfies PageServerLoad;
