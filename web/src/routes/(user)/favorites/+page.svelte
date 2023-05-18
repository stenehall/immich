<script lang="ts">
	import UserPageLayout from '$lib/components/layouts/user-page-layout.svelte';
	import CreateSharedLink from '$lib/components/photos-page/actions/create-shared-link.svelte';
	import RemoveFavorite from '$lib/components/photos-page/actions/remove-favorite.svelte';
	import AssetGrid from '$lib/components/photos-page/asset-grid.svelte';
	import AssetSelectControlBar from '$lib/components/photos-page/asset-select-control-bar.svelte';
	import EmptyPlaceholder from '$lib/components/shared-components/empty-placeholder.svelte';
	import { TimeBucketSize } from '@api';
	import {
		assetInteractionStore,
		isMultiSelectStoreState,
		selectedAssets
	} from '$lib/stores/asset-interaction.store';
	import type { PageData } from './$types';

	let empty = false;

	export let data: PageData;
</script>

{#if $isMultiSelectStoreState}
	<AssetSelectControlBar
		assets={$selectedAssets}
		clearSelect={assetInteractionStore.clearMultiselect}
	>
		<CreateSharedLink />
		<RemoveFavorite />
	</AssetSelectControlBar>
{/if}

<UserPageLayout
	user={data.user}
	hideNavbar={$isMultiSelectStoreState}
	title={data.meta.title}
	scrollbar={false}
>
	{#if empty}
		<EmptyPlaceholder
			text="Add favorites to quickly find your best pictures and videos"
			alt="Empty favorites"
		/>
	{/if}

	<AssetGrid bind:empty options={{ isFavorite: true, size: TimeBucketSize.Month }} />
</UserPageLayout>
