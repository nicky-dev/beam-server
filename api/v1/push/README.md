# Push Stream API Documentation

API endpoints for pushing streams from OME to external platforms like YouTube, Facebook, and Twitch.

## Endpoints

### 1. Start Push Stream

**POST** `/v1/push/start`

Start pushing a stream to an external platform.

#### Request Body

```json
{
  "streamId": "your-stream-id",
  "platform": "youtube",
  "streamKey": "your-platform-stream-key",
  "rtmpUrl": "rtmp://custom.url/live",
  "outputStreamName": "optional-output-name"
}
```

**Parameters:**
- `streamId` (string, required) - The source stream ID from OME
- `platform` (string, required) - Target platform: `youtube`, `facebook`, `twitch`, or `custom`
- `streamKey` (string, required) - Stream key provided by the platform
- `rtmpUrl` (string, optional) - Required only for `custom` platform
- `outputStreamName` (string, optional) - Custom name for the push stream

#### Response

```json
{
  "success": true,
  "data": {
    "id": "youtube_stream123_1698272400000",
    "state": "created"
  },
  "message": "Started pushing stream to YouTube"
}
```

#### Examples

**YouTube:**
```bash
curl -X POST http://localhost:3000/v1/push/start \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "my-stream-123",
    "platform": "youtube",
    "streamKey": "xxxx-xxxx-xxxx-xxxx-xxxx"
  }'
```

**Facebook:**
```bash
curl -X POST http://localhost:3000/v1/push/start \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "my-stream-123",
    "platform": "facebook",
    "streamKey": "FB-xxxx-xxxx-xxxx"
  }'
```

**Twitch:**
```bash
curl -X POST http://localhost:3000/v1/push/start \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "my-stream-123",
    "platform": "twitch",
    "streamKey": "live_xxxxxxxxxx_xxxxxxxxxxxxxxxxxxxxx"
  }'
```

**Custom Platform:**
```bash
curl -X POST http://localhost:3000/v1/push/start \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "my-stream-123",
    "platform": "custom",
    "rtmpUrl": "rtmp://custom-server.com/live",
    "streamKey": "custom-key"
  }'
```

---

### 2. Stop Push Stream

**POST** `/v1/push/stop`

Stop an active push stream.

#### Request Body

```json
{
  "streamId": "your-stream-id",
  "pushId": "youtube_stream123_1698272400000"
}
```

**Parameters:**
- `streamId` (string, required) - The source stream ID
- `pushId` (string, required) - The push stream ID to stop

#### Response

```json
{
  "success": true,
  "message": "Push stream stopped successfully"
}
```

#### Example

```bash
curl -X POST http://localhost:3000/v1/push/stop \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "my-stream-123",
    "pushId": "youtube_stream123_1698272400000"
  }'
```

---

### 3. List Push Streams

**GET** `/v1/push/list/:streamId`

Get all active push streams for a specific stream.

#### URL Parameters

- `streamId` (string, required) - The source stream ID

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "youtube_stream123_1698272400000",
      "state": "started",
      "protocol": "rtmp",
      "url": "rtmp://a.rtmp.youtube.com/live2/xxxx-xxxx-xxxx-xxxx"
    }
  ],
  "count": 1
}
```

#### Example

```bash
curl http://localhost:3000/v1/push/list/my-stream-123
```

---

### 4. Get Supported Platforms

**GET** `/v1/push/platforms`

Get a list of all supported streaming platforms.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "youtube",
      "name": "YouTube",
      "rtmpUrl": "rtmp://a.rtmp.youtube.com/live2"
    },
    {
      "id": "facebook",
      "name": "Facebook",
      "rtmpUrl": "rtmps://live-api-s.facebook.com:443/rtmp"
    },
    {
      "id": "twitch",
      "name": "Twitch",
      "rtmpUrl": "rtmp://live.twitch.tv/app"
    }
  ]
}
```

#### Example

```bash
curl http://localhost:3000/v1/push/platforms
```

---

## Platform-Specific Information

### YouTube Live
- **RTMP URL**: `rtmp://a.rtmp.youtube.com/live2`
- **Stream Key**: Get from YouTube Studio → Go Live → Stream Settings
- **Requirements**: YouTube account with live streaming enabled

### Facebook Live
- **RTMP URL**: `rtmps://live-api-s.facebook.com:443/rtmp`
- **Stream Key**: Get from Facebook → Live Producer → Stream Settings
- **Requirements**: Facebook page or profile with live streaming access

### Twitch
- **RTMP URL**: `rtmp://live.twitch.tv/app`
- **Stream Key**: Get from Twitch Dashboard → Settings → Stream
- **Requirements**: Twitch account

### Custom Platform
- **RTMP URL**: Provide your own RTMP server URL
- **Stream Key**: Your custom stream key
- **Requirements**: Any RTMP-compatible streaming server

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields: streamId, platform, streamKey"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to start push stream",
  "message": "Connection timeout"
}
```

---

## Workflow Example

1. **Start streaming to OME** using your stream ID
2. **Get supported platforms**: `GET /v1/push/platforms`
3. **Start push to YouTube**: `POST /v1/push/start` with YouTube credentials
4. **Check active pushes**: `GET /v1/push/list/:streamId`
5. **Stop when done**: `POST /v1/push/stop`

---

## Notes

- Multiple platforms can be pushed simultaneously from a single source stream
- Push streams will automatically stop when the source stream ends
- Make sure your source stream is active before starting a push
- Platform stream keys should be kept secure and never exposed in client-side code
