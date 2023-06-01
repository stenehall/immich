import { AppRoute } from '$lib/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, locals: { api, user } }) => {
	if (!user) {
		throw redirect(302, AppRoute.AUTH_LOGIN);
	}

	const albumId = params['albumId'];

	try {
		const { data: album } = await api.albumApi.getAlbumInfo(albumId);

		const getFileCreatedAt = (index: number) => {
			const asset = album.assets?.[index];
			if (asset) {
				return new Date(asset.fileCreatedAt);
			}
		};

		const startDate = getFileCreatedAt(0);
		const endDate = getFileCreatedAt(album.assetCount - 1);

		album.assets = [];

		return {
			album,
			startDate,
			endDate,
			meta: {
				title: album.albumName
			}
		};
	} catch (e) {
		throw redirect(302, AppRoute.ALBUMS);
	}
}) satisfies PageServerLoad;
