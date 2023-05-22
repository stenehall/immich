<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import {
		assetInteractionStore,
		isViewingAssetStoreState,
		viewingAssetStoreState
	} from '$lib/stores/asset-interaction.store';
	import {
		assetGridEmpty,
		assetGridState,
		assetStore,
		loadingBucketState
	} from '$lib/stores/assets.store';
	import { AssetResponseDto, TimeBucketResponseDto, TimeBucketSize, api } from '@api';
	import { AssetGridOptions } from '../../models/asset-grid-state';
	import AssetViewer from '../asset-viewer/asset-viewer.svelte';
	import IntersectionObserver from '../asset-viewer/intersection-observer.svelte';
	import Portal from '../shared-components/portal/portal.svelte';
	import Scrollbar, {
		OnScrollbarClickDetail,
		OnScrollbarDragDetail
	} from '../shared-components/scrollbar/scrollbar.svelte';
	import AssetDateGroup from './asset-date-group.svelte';

	export let isAlbumSelectionMode = false;
	export let options: AssetGridOptions = {
		size: TimeBucketSize.Month
	};

	export let empty = false;
	$: empty = $assetGridEmpty;

	const MIN_OVERFLOW_THRESHOLD = 100;

	let viewportHeight = 0;
	let viewportWidth = 0;
	let assetGridElement: HTMLElement;
	export let timeBuckets: TimeBucketResponseDto[] = [];
	export let showArchive = true;
	export let showFavorite = true;

	onMount(async () => {
		const { data } = await api.assetApi.getTimeBuckets(
			options.size,
			...api.getTimeBucketOptions(options)
		);

		timeBuckets = data;

		assetStore.setInitialState(viewportHeight, viewportWidth, timeBuckets, options);

		// Get asset bucket if bucket height is smaller than viewport height
		let bucketsToFetchInitially: string[] = [];
		let initialBucketsHeight = 0;
		$assetGridState.buckets.every((bucket) => {
			if (initialBucketsHeight < viewportHeight) {
				initialBucketsHeight += bucket.bucketHeight;
				bucketsToFetchInitially.push(bucket.bucketDate);
				return true;
			} else {
				return false;
			}
		});

		bucketsToFetchInitially.forEach((bucketDate) => {
			assetStore.getAssetsByBucket(bucketDate);
		});
	});

	onDestroy(() => {
		assetStore.reset();
		assetInteractionStore.clearMultiselect();
		assetInteractionStore.setIsViewingAsset(false);
	});

	function intersectedHandler(event: CustomEvent) {
		const el = event.detail as HTMLElement;
		const target = el.firstChild as HTMLElement;

		if (target) {
			const bucketDate = target.id.split('_')[1];
			assetStore.getAssetsByBucket(bucketDate);
		}
	}

	const navigateToPreviousAsset = () => {
		assetInteractionStore.navigateAsset('previous');
	};

	const navigateToNextAsset = () => {
		assetInteractionStore.navigateAsset('next');
	};

	let lastScrollPosition = 0;
	let animationTick = false;

	const handleTimelineScroll = () => {
		if (!animationTick) {
			window.requestAnimationFrame(() => {
				lastScrollPosition = assetGridElement?.scrollTop;
				animationTick = false;
			});

			animationTick = true;
		}
	};

	const handleScrollbarClick = (e: OnScrollbarClickDetail) => {
		assetGridElement.scrollTop = e.scrollTo;
	};

	const handleScrollbarDrag = (e: OnScrollbarDragDetail) => {
		assetGridElement.scrollTop = e.scrollTo;
	};

	const handleArchiveSuccess = (e: CustomEvent) => {
		const asset = e.detail as AssetResponseDto;
		navigateToNextAsset();
		assetStore.removeAsset(asset.id);
	};
</script>

{#if timeBuckets.length > 0 && viewportHeight && viewportHeight + MIN_OVERFLOW_THRESHOLD < $assetGridState.timelineHeight}
	<Scrollbar
		scrollbarHeight={viewportHeight}
		scrollTop={lastScrollPosition}
		on:onscrollbarclick={(e) => handleScrollbarClick(e.detail)}
		on:onscrollbardrag={(e) => handleScrollbarDrag(e.detail)}
	/>
{/if}

<section
	id="asset-grid"
	class="overflow-y-auto pl-4 scrollbar-hidden h-full pb-8"
	bind:clientHeight={viewportHeight}
	bind:clientWidth={viewportWidth}
	bind:this={assetGridElement}
	on:scroll={handleTimelineScroll}
>
	{#if assetGridElement}
		<section id="virtual-timeline" style:height={$assetGridState.timelineHeight + 'px'}>
			{#each $assetGridState.buckets as bucket, bucketIndex (bucketIndex)}
				<IntersectionObserver
					on:intersected={intersectedHandler}
					on:hidden={async () => {
						// If bucket is hidden and in loading state, cancel the request
						if ($loadingBucketState[bucket.bucketDate]) {
							await assetStore.cancelBucketRequest(bucket.cancelToken, bucket.bucketDate);
						}
					}}
					let:intersecting
					top={750}
					bottom={750}
					root={assetGridElement}
				>
					<div id={'bucket_' + bucket.bucketDate} style:height={bucket.bucketHeight + 'px'}>
						{#if intersecting}
							<AssetDateGroup
								{showArchive}
								{showFavorite}
								{isAlbumSelectionMode}
								assets={bucket.assets}
								bucketDate={bucket.bucketDate}
								bucketHeight={bucket.bucketHeight}
								sharedKey={options.sharedKey}
							/>
						{/if}
					</div>
				</IntersectionObserver>
			{/each}
		</section>
	{/if}
</section>

<Portal target="body">
	{#if $isViewingAssetStoreState}
		<AssetViewer
			asset={$viewingAssetStoreState}
			on:navigate-previous={navigateToPreviousAsset}
			on:navigate-next={navigateToNextAsset}
			on:close={() => {
				assetInteractionStore.setIsViewingAsset(false);
			}}
			on:archived={handleArchiveSuccess}
		/>
	{/if}
</Portal>

<style>
	#asset-grid {
		contain: layout;
		scrollbar-width: none;
	}
</style>
