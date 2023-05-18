# openapi.api.TimeBucketApi

## Load the API package
```dart
import 'package:openapi/api.dart';
```

All URIs are relative to */api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getByTimeBucket**](TimeBucketApi.md#getbytimebucket) | **GET** /time-bucket/assets | 
[**getTimeBuckets**](TimeBucketApi.md#gettimebuckets) | **GET** /time-bucket | 


# **getByTimeBucket**
> List<AssetResponseDto> getByTimeBucket(size, timeBucket, userId, albumId, isArchived, isFavorite, key)



### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure API key authorization: cookie
//defaultApiClient.getAuthentication<ApiKeyAuth>('cookie').apiKey = 'YOUR_API_KEY';
// uncomment below to setup prefix (e.g. Bearer) for API key, if needed
//defaultApiClient.getAuthentication<ApiKeyAuth>('cookie').apiKeyPrefix = 'Bearer';
// TODO Configure API key authorization: api_key
//defaultApiClient.getAuthentication<ApiKeyAuth>('api_key').apiKey = 'YOUR_API_KEY';
// uncomment below to setup prefix (e.g. Bearer) for API key, if needed
//defaultApiClient.getAuthentication<ApiKeyAuth>('api_key').apiKeyPrefix = 'Bearer';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = TimeBucketApi();
final size = ; // TimeBucketSize | 
final timeBucket = timeBucket_example; // String | 
final userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final albumId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final isArchived = true; // bool | 
final isFavorite = true; // bool | 
final key = key_example; // String | 

try {
    final result = api_instance.getByTimeBucket(size, timeBucket, userId, albumId, isArchived, isFavorite, key);
    print(result);
} catch (e) {
    print('Exception when calling TimeBucketApi->getByTimeBucket: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **size** | [**TimeBucketSize**](.md)|  | 
 **timeBucket** | **String**|  | 
 **userId** | **String**|  | [optional] 
 **albumId** | **String**|  | [optional] 
 **isArchived** | **bool**|  | [optional] 
 **isFavorite** | **bool**|  | [optional] 
 **key** | **String**|  | [optional] 

### Return type

[**List<AssetResponseDto>**](AssetResponseDto.md)

### Authorization

[cookie](../README.md#cookie), [api_key](../README.md#api_key), [bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getTimeBuckets**
> List<TimeBucketResponseDto> getTimeBuckets(size, userId, albumId, isArchived, isFavorite, key)



### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure API key authorization: cookie
//defaultApiClient.getAuthentication<ApiKeyAuth>('cookie').apiKey = 'YOUR_API_KEY';
// uncomment below to setup prefix (e.g. Bearer) for API key, if needed
//defaultApiClient.getAuthentication<ApiKeyAuth>('cookie').apiKeyPrefix = 'Bearer';
// TODO Configure API key authorization: api_key
//defaultApiClient.getAuthentication<ApiKeyAuth>('api_key').apiKey = 'YOUR_API_KEY';
// uncomment below to setup prefix (e.g. Bearer) for API key, if needed
//defaultApiClient.getAuthentication<ApiKeyAuth>('api_key').apiKeyPrefix = 'Bearer';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = TimeBucketApi();
final size = ; // TimeBucketSize | 
final userId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final albumId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final isArchived = true; // bool | 
final isFavorite = true; // bool | 
final key = key_example; // String | 

try {
    final result = api_instance.getTimeBuckets(size, userId, albumId, isArchived, isFavorite, key);
    print(result);
} catch (e) {
    print('Exception when calling TimeBucketApi->getTimeBuckets: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **size** | [**TimeBucketSize**](.md)|  | 
 **userId** | **String**|  | [optional] 
 **albumId** | **String**|  | [optional] 
 **isArchived** | **bool**|  | [optional] 
 **isFavorite** | **bool**|  | [optional] 
 **key** | **String**|  | [optional] 

### Return type

[**List<TimeBucketResponseDto>**](TimeBucketResponseDto.md)

### Authorization

[cookie](../README.md#cookie), [api_key](../README.md#api_key), [bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

