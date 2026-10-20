import { findAllKeyValuePairs } from "../facebook-parser/utils";
import { Result, YoutubePostData, YoutubeTranscriptData } from "../types";
import { findByKey, parseTimestampToSeconds } from "./utils";

export async function parseTranscriptData(
    payload: string,
): Promise<Result<YoutubePostData>> {
    try {
        const data = JSON.parse(payload);
        const videoId = findByKey(data, "videoId");
        const transcriptSegmentViewModels = findAllKeyValuePairs(data, "transcriptSegmentViewModel")
        const transcript = convertToYoutubeTranscriptData(transcriptSegmentViewModels);

        return {
            ok: true,
            data: {
                entry_rowkey: "",
                post_id: videoId,
                transcript: transcript,
                transcription: transcript.map(t => t.text).join(" "),
                docType: "Post",
            } as YoutubePostData
        };
    } catch (error: any) {
        console.error(
            "Error (Youtube Post Transcript data parser)",
            error?.message
        );
        return { ok: false, error: new Error("Failed to parse Youtube post transcript data") };
    }
}

function convertToYoutubeTranscriptData(items: {value: any}[]): YoutubeTranscriptData[] {
  const result = [];

  for (let i = 0; i < items.length; i++) {
    const current = items[i].value;
    const start = parseTimestampToSeconds(current.timestamp);

    let duration = 0;
    if (i < items.length - 1) {
      const next = items[i + 1].value;
      const nextStart = parseTimestampToSeconds(next.timestamp);
      duration = nextStart - start;
    }

    result.push({
      start,
      duration,
      text: current.simpleText,
    });
  }

  return result;
}
