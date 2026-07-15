export interface DirectPlayProfile {
  Type: 'Video' | 'Audio';
  Container: string;
  VideoCodec?: string;
  AudioCodec?: string;
}

export interface TranscodingProfile {
  Type: 'Video' | 'Audio';
  Context: 'Streaming';
  Protocol: 'hls' | 'http';
  Container: string;
  VideoCodec?: string;
  AudioCodec: string;
  MaxAudioChannels?: string;
  CopyTimestamps?: boolean;
  EnableSubtitlesInManifest?: boolean;
}

export interface SubtitleProfile {
  Format: string;
  Method: 'External' | 'Embed';
}

export interface IinaDeviceProfile {
  Name: string;
  MaxStreamingBitrate: number;
  MaxStaticBitrate: number;
  MusicStreamingTranscodingBitrate: number;
  TimelineOffsetSeconds: number;
  DirectPlayProfiles: DirectPlayProfile[];
  TranscodingProfiles: TranscodingProfile[];
  SubtitleProfiles: SubtitleProfile[];
}

const VIDEO_CONTAINERS = 'mkv,mp4,m4v,mov,ts,mpegts,webm,avi';
const VIDEO_CODECS = 'h264,hevc,vp8,vp9,av1,mpeg2video,mpeg4,vc1';
const VIDEO_AUDIO_CODECS = 'aac,ac3,eac3,mp3,flac,alac,opus,vorbis,pcm_s16le,pcm_s24le,truehd,dts';
const AUDIO_CONTAINERS = 'mp3,aac,m4a,flac,ogg,oga,opus,wav,aiff,alac';

/**
 * Describes formats mpv can consume rather than the narrower formats that
 * Apple's system media frameworks can decode. Hardware acceleration is not
 * promised; mpv can fall back to software decoding.
 */
export function createIinaDeviceProfile(maxStreamingBitrate = 120_000_000): IinaDeviceProfile {
  if (!Number.isInteger(maxStreamingBitrate) || maxStreamingBitrate < 1_000_000) {
    throw new RangeError('maxStreamingBitrate must be an integer of at least 1 Mbps');
  }

  return {
    Name: 'IINA Direct Mode',
    MaxStreamingBitrate: maxStreamingBitrate,
    MaxStaticBitrate: maxStreamingBitrate,
    MusicStreamingTranscodingBitrate: 384_000,
    TimelineOffsetSeconds: 0,
    DirectPlayProfiles: [
      {
        Type: 'Video',
        Container: VIDEO_CONTAINERS,
        VideoCodec: VIDEO_CODECS,
        AudioCodec: VIDEO_AUDIO_CODECS,
      },
      {
        Type: 'Audio',
        Container: AUDIO_CONTAINERS,
      },
    ],
    TranscodingProfiles: [
      {
        Type: 'Video',
        Context: 'Streaming',
        Protocol: 'hls',
        Container: 'ts',
        VideoCodec: 'h264,hevc',
        AudioCodec: 'aac,ac3,eac3,opus',
        MaxAudioChannels: '8',
        CopyTimestamps: true,
        EnableSubtitlesInManifest: true,
      },
      {
        Type: 'Audio',
        Context: 'Streaming',
        Protocol: 'http',
        Container: 'mp3',
        AudioCodec: 'mp3',
        MaxAudioChannels: '2',
      },
    ],
    SubtitleProfiles: [
      { Format: 'srt', Method: 'External' },
      { Format: 'vtt', Method: 'External' },
      { Format: 'ass', Method: 'External' },
      { Format: 'ssa', Method: 'External' },
      { Format: 'pgs', Method: 'Embed' },
      { Format: 'dvdsub', Method: 'Embed' },
      { Format: 'dvbsub', Method: 'Embed' },
    ],
  };
}
