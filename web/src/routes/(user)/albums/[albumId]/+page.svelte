<script lang="ts">
	import AlbumViewer from '$lib/components/album-page/album-viewer.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<AlbumViewer album={data.album} startDate={data.startDate} endDate={data.endDate} />
