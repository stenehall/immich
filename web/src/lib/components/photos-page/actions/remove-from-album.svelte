<script lang="ts">
	import CircleIconButton from '$lib/components/elements/buttons/circle-icon-button.svelte';
	import {
		NotificationType,
		notificationController
	} from '$lib/components/shared-components/notification/notification';
	import { api } from '@api';
	import DeleteOutline from 'svelte-material-icons/DeleteOutline.svelte';
	import { OnAssetDelete, getAssetControlContext } from '../asset-select-control-bar.svelte';

	export let albumId: string;
	export let onAssetDelete: OnAssetDelete;

	const { getAssets, clearSelect } = getAssetControlContext();

	const handleRemoveFromAlbum = async () => {
		if (window.confirm('Do you want to remove selected assets from the album?')) {
			try {
				const assetIds = Array.from(getAssets()).map((a) => a.id);
				await api.albumApi.removeAssetFromAlbum(albumId, { assetIds });

				assetIds.forEach(onAssetDelete);
				clearSelect();
			} catch (e) {
				console.error('Error [album-viewer] [removeAssetFromAlbum]', e);
				notificationController.show({
					type: NotificationType.Error,
					message: 'Error removing assets from album, check console for more details'
				});
			}
		}
	};
</script>

<CircleIconButton title="Remove from album" on:click={handleRemoveFromAlbum} logo={DeleteOutline} />
