# openapi.model.SystemConfigFFmpegDto

## Load the model package
```dart
import 'package:openapi/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**crf** | **int** |  | 
**threads** | **int** |  | 
**preset** | **String** |  | 
**thumbnailGeneration** | [**JobSettingsDto**](JobSettingsDto.md) |  | [optional] 
**targetVideoCodec** | [**VideoCodec**](VideoCodec.md) |  | 
**targetAudioCodec** | [**AudioCodec**](AudioCodec.md) |  | 
**targetResolution** | **String** |  | 
**maxBitrate** | **String** |  | 
**twoPass** | **bool** |  | 
**transcode** | [**TranscodePolicy**](TranscodePolicy.md) |  | 
**accel** | [**TranscodeHWAccel**](TranscodeHWAccel.md) |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


