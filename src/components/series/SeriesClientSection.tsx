"use client";

import { useRef } from "react";
import { TrendingTopics } from "./TrendingTopics";
import { GenerateVideoButton, GenerateVideoButtonHandle } from "@/components/videos/GenerateVideoButton";
import { UploadVideoButton } from "@/components/videos/UploadVideoButton";
import { AudioToVideoButton } from "@/components/videos/AudioToVideoButton";

interface Props {
  seriesId: string;
  niche: string;
  defaultDuration: number;
  logoUrl?: string | null;
}

export function SeriesClientSection({ seriesId, niche, defaultDuration, logoUrl }: Props) {
  const generateRef = useRef<GenerateVideoButtonHandle>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <UploadVideoButton seriesId={seriesId} />
        <AudioToVideoButton seriesId={seriesId} seriesLogoUrl={logoUrl} />
        <GenerateVideoButton ref={generateRef} seriesId={seriesId} defaultDuration={defaultDuration} />
      </div>
      <TrendingTopics
        seriesId={seriesId}
        niche={niche}
        onUseTopic={(topic) => generateRef.current?.openWithTopic(topic)}
      />
    </>
  );
}
