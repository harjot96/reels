export type SeriesStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";
export type VideoStatus = "PENDING" | "GENERATING" | "READY" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";
export type PipelineStep = "SCRIPT" | "AUDIO" | "IMAGES" | "ASSEMBLE" | "UPLOAD" | "COMPLETE" | "FAILED";

export interface Series {
  id: string;
  userId: string;
  title: string;
  niche: string;
  description: string | null;
  style: string;
  voiceId: string;
  imageStyle: string;
  videoDuration: number;
  autoPublish: boolean;
  publishSchedule: string | null;
  status: SeriesStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { videos: number };
}

export interface Video {
  id: string;
  seriesId: string;
  title: string;
  script: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  status: VideoStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  series?: Series;
  job?: GenerationJob;
  imageAssets?: ImageAsset[];
}

export interface GenerationJob {
  id: string;
  videoId: string;
  currentStep: PipelineStep;
  stepProgress: number;
  overallProgress: number;
  stepMessage: string | null;
  logs: string | null;
  failedStep: PipelineStep | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImageAsset {
  id: string;
  videoId: string;
  prompt: string;
  url: string;
  index: number;
  createdAt: string;
}

export interface YoutubeAccount {
  id: string;
  userId: string;
  channelId: string;
  channelName: string;
  createdAt: string;
}

export interface DashboardStats {
  totalSeries: number;
  totalVideos: number;
  publishedVideos: number;
  scheduledVideos: number;
  generatingVideos: number;
}
