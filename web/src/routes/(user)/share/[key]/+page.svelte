<script lang="ts">
	import AlbumViewer from '$lib/components/album-page/album-viewer.svelte';
	import IndividualSharedViewer from '$lib/components/share-page/individual-shared-viewer.svelte';
	import { SharedLinkType } from '@api';
	import type { PageData } from './$types';

	export let data: PageData;

	$: sharedLink = data.sharedLink;
	$: album = sharedLink.album;
	$: isOwned = data.user?.id === sharedLink.userId;
</script>

{#if sharedLink.type === SharedLinkType.Album && album}
	<div class="immich-scrollbar">
		<AlbumViewer {album} {sharedLink} startDate={data.startDate} endDate={data.endDate} />
	</div>
{/if}

{#if sharedLink.type === SharedLinkType.Individual}
	<div class="immich-scrollbar">
		<IndividualSharedViewer {sharedLink} {isOwned} />
	</div>
{/if}
