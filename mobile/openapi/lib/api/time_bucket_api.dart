//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.12

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class TimeBucketApi {
  TimeBucketApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Performs an HTTP 'GET /time-bucket/assets' operation and returns the [Response].
  /// Parameters:
  ///
  /// * [TimeBucketSize] size (required):
  ///
  /// * [String] timeBucket (required):
  ///
  /// * [String] userId:
  ///
  /// * [String] albumId:
  ///
  /// * [bool] isArchived:
  ///
  /// * [bool] isFavorite:
  Future<Response> getByTimeBucketWithHttpInfo(TimeBucketSize size, String timeBucket, { String? userId, String? albumId, bool? isArchived, bool? isFavorite, }) async {
    // ignore: prefer_const_declarations
    final path = r'/time-bucket/assets';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

      queryParams.addAll(_queryParams('', 'size', size));
    if (userId != null) {
      queryParams.addAll(_queryParams('', 'userId', userId));
    }
    if (albumId != null) {
      queryParams.addAll(_queryParams('', 'albumId', albumId));
    }
    if (isArchived != null) {
      queryParams.addAll(_queryParams('', 'isArchived', isArchived));
    }
    if (isFavorite != null) {
      queryParams.addAll(_queryParams('', 'isFavorite', isFavorite));
    }
      queryParams.addAll(_queryParams('', 'timeBucket', timeBucket));

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Parameters:
  ///
  /// * [TimeBucketSize] size (required):
  ///
  /// * [String] timeBucket (required):
  ///
  /// * [String] userId:
  ///
  /// * [String] albumId:
  ///
  /// * [bool] isArchived:
  ///
  /// * [bool] isFavorite:
  Future<List<AssetResponseDto>?> getByTimeBucket(TimeBucketSize size, String timeBucket, { String? userId, String? albumId, bool? isArchived, bool? isFavorite, }) async {
    final response = await getByTimeBucketWithHttpInfo(size, timeBucket,  userId: userId, albumId: albumId, isArchived: isArchived, isFavorite: isFavorite, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      final responseBody = await _decodeBodyBytes(response);
      return (await apiClient.deserializeAsync(responseBody, 'List<AssetResponseDto>') as List)
        .cast<AssetResponseDto>()
        .toList();

    }
    return null;
  }

  /// Performs an HTTP 'GET /time-bucket' operation and returns the [Response].
  /// Parameters:
  ///
  /// * [TimeBucketSize] size (required):
  ///
  /// * [String] userId:
  ///
  /// * [String] albumId:
  ///
  /// * [bool] isArchived:
  ///
  /// * [bool] isFavorite:
  Future<Response> getTimeBucketsWithHttpInfo(TimeBucketSize size, { String? userId, String? albumId, bool? isArchived, bool? isFavorite, }) async {
    // ignore: prefer_const_declarations
    final path = r'/time-bucket';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

      queryParams.addAll(_queryParams('', 'size', size));
    if (userId != null) {
      queryParams.addAll(_queryParams('', 'userId', userId));
    }
    if (albumId != null) {
      queryParams.addAll(_queryParams('', 'albumId', albumId));
    }
    if (isArchived != null) {
      queryParams.addAll(_queryParams('', 'isArchived', isArchived));
    }
    if (isFavorite != null) {
      queryParams.addAll(_queryParams('', 'isFavorite', isFavorite));
    }

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Parameters:
  ///
  /// * [TimeBucketSize] size (required):
  ///
  /// * [String] userId:
  ///
  /// * [String] albumId:
  ///
  /// * [bool] isArchived:
  ///
  /// * [bool] isFavorite:
  Future<List<TimeBucketResponseDto>?> getTimeBuckets(TimeBucketSize size, { String? userId, String? albumId, bool? isArchived, bool? isFavorite, }) async {
    final response = await getTimeBucketsWithHttpInfo(size,  userId: userId, albumId: albumId, isArchived: isArchived, isFavorite: isFavorite, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      final responseBody = await _decodeBodyBytes(response);
      return (await apiClient.deserializeAsync(responseBody, 'List<TimeBucketResponseDto>') as List)
        .cast<TimeBucketResponseDto>()
        .toList();

    }
    return null;
  }
}
